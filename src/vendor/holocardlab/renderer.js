// SPDX-License-Identifier: MIT
import { resolvePreset, patterns, regions } from './presets.js';
import { fragmentSource } from './optics.js';

const vertexSource = `
attribute vec2 position;
varying vec2 uv;
void main() { uv = position * .5 + .5; gl_Position = vec4(position, 0., 1.); }
`;

function safeURL(url) {
  const parsed = new URL(url, document.baseURI);
  if (parsed.origin !== location.origin || !['http:', 'https:', 'blob:'].includes(parsed.protocol)) {
    throw new TypeError('图片只允许同源 URL 或本地 blob URL');
  }
  return parsed.href;
}

function recordTiming(stats, name, start) {
  const ms = performance.now() - start;
  const entry = stats.timings[name] ||= { lastMs: 0, totalMs: 0, count: 0 };
  entry.lastMs = ms; entry.totalMs += ms; entry.count++;
}

function initializationYield(signal) {
  return new Promise(resolve => {
    const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
    const timer = setTimeout(done, 16);
    signal.addEventListener('abort', done, { once: true });
    if (signal.aborted) done();
  });
}

async function loadImage(url, stats, signal) {
  const started = performance.now();
  const source = safeURL(url);
  const response = await fetch(source, { mode: 'same-origin', credentials: 'same-origin', redirect: 'error', signal });
  if (!response.ok) throw new Error(`图片加载失败 (${response.status})`);
  const blob = await response.blob();
  recordTiming(stats, 'fetch', started);
  if (blob.size > 32 * 1024 * 1024) throw new RangeError('图片超过 32 MB');
  signal?.throwIfAborted();
  const objectURL = URL.createObjectURL(blob);
  const image = new Image();
  const cancel = () => { image.src = ''; };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    image.decoding = 'async'; image.src = objectURL;
    const decodeStarted = performance.now();
    try { await image.decode(); } finally { recordTiming(stats, 'decode', decodeStarted); }
    signal?.throwIfAborted();
    if (!image.naturalWidth || image.naturalWidth > 16384 || image.naturalHeight > 16384) throw new RangeError('图片尺寸无效或超过 16384 像素');
    return { image, objectURL, blob };
  } catch (error) { image.src = ''; URL.revokeObjectURL(objectURL); throw error; }
  finally { signal?.removeEventListener('abort', cancel); }
}

export class HoloCard {
  constructor(canvas, { preset = 'regular-holo', image = './assets/specimen.svg', width = 420, aspect = .718 } = {}) {
    if (aspect !== 'image' && (typeof aspect !== 'number' || !Number.isFinite(aspect) || aspect <= 0)) throw new TypeError('aspect 必须为正有限数字或 image');
    this.canvas = canvas;
    this.aspect = aspect;
    this.imageAspect = .718;
    this.width = Math.max(1, Math.min(1000, Number(width) || 420));
    canvas.width = Math.round(this.width);
    canvas.height = Math.max(1, Math.round(this.width / (aspect === 'image' ? this.imageAspect : aspect)));
    if (aspect === 'image') canvas.style.aspectRatio = String(this.imageAspect);
    this.pose = [.5, .5];
    this.effectStrength = 1;
    this.preset = typeof preset === 'string' ? resolvePreset(preset) : preset;
    this.frame = null;
    this.disposed = false;
    this.lost = false;
    this.loadVersion = 0;
    this.maskVersion = 0;
    this.maskCache = new Map();
    this.cssWidth = canvas.clientWidth || this.width;
    this.cssHeight = canvas.clientHeight || canvas.height;
    this.stats = { draws: 0, renderMs: 0, mode: 'initializing', maskDecodes: 0, maskUploads: 0, reliefBuilds: 0, reliefUploads: 0, lastPose: null,
      // Wall-clock JS timings include browser calls, not asynchronous GPU completion.
      timings: {}, resources: {}, counters: { artworkUploads: 0, staticUniformBatches: 0, cancelledImages: 0 } };
    this.onLost = event => {
      event.preventDefault(); this.lost = true;
      this.initializationRequest?.abort();
      this.initializing = false; this.stats.initializing = false;
      if (this.frame !== null) cancelAnimationFrame(this.frame);
      this.frame = null;
      this.canvas.dataset.renderer = 'context-lost';
      this.stats.mode = 'context-lost';
      if (this.imageURL) this.canvas.style.backgroundImage = `url("${this.imageURL}")`;
    };
    this.onRestored = () => {
      if (this.disposed) return;
      this.lost = false;
      this.initialization = this.initialize();
      this.ready = this.finishReady();
      this.watchReady();
    };
    canvas.addEventListener('webglcontextlost', this.onLost);
    canvas.addEventListener('webglcontextrestored', this.onRestored);
    this.initialization = this.initialize();
    this.observer = typeof ResizeObserver === 'function' ? new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        this.cssWidth = entry.contentRect.width; this.cssHeight = entry.contentRect.height;
        this.invalidate();
      }
    }) : null;
    this.observer?.observe(canvas);
    this.setImage(image);
    this.ready = this.finishReady();
    this.watchReady();
  }

  watchReady() {
    // Consumers can await ready; also surface errors without an unhandled rejection.
    this.ready.catch(error => { this.error = error; this.canvas.dispatchEvent(new CustomEvent('holoerror', { detail: error })); });
  }

  async finishReady() {
    await Promise.all([this.waitForInitialization(), this.imageReady]);
    let pending;
    do { pending = this.imageReady; await pending; }
    while (!this.disposed && !this.lost && pending !== this.imageReady);
    if (this.disposed || this.lost || this.initializing) return;
    if (this.image && this.gl && this.uploadedImage !== this.image) this.upload();
    if (this.maskImage && this.gl && this.uploadedMask !== this.maskImage) this.uploadMask();
    this.prepareRelief();
    this.invalidate(); this.flush();
  }

  async waitForInitialization() {
    let pending;
    do { pending = this.initialization; await pending; }
    while (!this.disposed && !this.lost && pending !== this.initialization);
  }

  async initialize() {
    this.initializationRequest?.abort();
    const request = new AbortController();
    this.initializationRequest = request;
    const current = () => this.initializationRequest === request && !request.signal.aborted && !this.disposed && !this.lost;
    const started = performance.now();
    this.initializing = true; this.stats.initializing = true; this.setMode('initializing');
    this.materialDirty = true;
    this.effectStrengthDirty = true;
    this.uniformWidth = null;
    this.uniformImage = null;
    this.uniformMask = null;
    this.uploadedMask = null;
    this.uploadedRelief = null;
    this.uploadedImage = null;
    const gl = this.canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    this.gl = gl;
    if (!gl) { this.context2d = this.canvas.getContext('2d'); this.setMode('static'); this.initializing = false; this.stats.initializing = false; recordTiming(this.stats, 'initialize', started); return; }
    const shaders = [];
    let program, parallel, adopted = false;
    try {
      parallel = gl.getExtension('KHR_parallel_shader_compile');
      this.stats.parallelShaderCompile = !!parallel;
      for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
        const compileStarted = performance.now();
        const shader = gl.createShader(type);
        shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
        const compiled = parallel || gl.getShaderParameter(shader, gl.COMPILE_STATUS);
        recordTiming(this.stats, type === gl.VERTEX_SHADER ? 'vertexCompile' : 'fragmentCompile', compileStarted);
        if (!compiled) throw new Error(gl.getShaderInfoLog(shader));
      }
      program = gl.createProgram();
      shaders.forEach(shader => gl.attachShader(program, shader));
      const linkStarted = performance.now();
      gl.linkProgram(program);
      recordTiming(this.stats, 'linkSubmit', linkStarted);
      if (parallel) {
        const waitStarted = performance.now();
        while (current() && !gl.isContextLost() && !gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) await initializationYield(request.signal);
        recordTiming(this.stats, 'linkWait', waitStarted);
      }
      if (!current()) return;
      if (gl.isContextLost()) { this.lost = true; this.setMode('context-lost'); return; }
      const statusStarted = performance.now();
      const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
      recordTiming(this.stats, 'linkStatus', statusStarted);
      recordTiming(this.stats, 'link', linkStarted);
      if (!linked) {
        const failed = shaders.find(shader => !gl.getShaderParameter(shader, gl.COMPILE_STATUS));
        throw new Error(failed ? gl.getShaderInfoLog(failed) : gl.getProgramInfoLog(program));
      }
      this.program = program; adopted = true;
      gl.useProgram(this.program);
      this.maxTextureSize = Math.min(2048, gl.getParameter(gl.MAX_TEXTURE_SIZE));
      this.buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(this.program, 'position');
      gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      this.uniforms = Object.fromEntries(['artwork','coatingMask','reliefMap','useMask','pose','resolution','imageScale','material','recipe','micro','region','metal','effectStrength','roundCorners'].map(name => [name,gl.getUniformLocation(this.program,name)]));
      gl.uniform1f(this.uniforms.roundCorners, this.aspect === 'image' ? 0 : 1);
      gl.uniform1i(this.uniforms.artwork,0); gl.uniform1i(this.uniforms.coatingMask,1); gl.uniform1i(this.uniforms.reliefMap,2);
      this.texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,this.texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      this.maskTexture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,this.maskTexture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
      this.reliefTexture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D,this.reliefTexture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([128,128,255,0]));
      gl.activeTexture(gl.TEXTURE0);
      this.setMode('webgl');
    } catch (error) {
      if (current()) {
        this.error = error; if (adopted) this.release(); this.gl = null;
        this.setMode('static');
      }
    } finally {
      if (!adopted && program) {
        // Some drivers query the linked object internally until compilation finishes.
        while (parallel && !gl.isContextLost() && !gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) await new Promise(resolve => setTimeout(resolve, 16));
        gl.deleteProgram(program);
      }
      shaders.forEach(shader => gl.deleteShader(shader));
      if (this.initializationRequest === request) { this.initializing = false; this.stats.initializing = false; }
      recordTiming(this.stats, 'initialize', started);
    }
  }

  setMode(mode) {
    this.stats.mode = mode; this.canvas.dataset.renderer = mode;
    if (this.imageURL) this.canvas.style.backgroundImage = mode === 'webgl' ? '' : `url("${this.imageURL}")`;
  }

  setImage(url) {
    return this.imageReady = this.loadArtwork(url);
  }

  async loadArtwork(url) {
    if (this.disposed) return;
    const version = ++this.loadVersion;
    this.imageRequest?.abort();
    const request = new AbortController();
    this.imageRequest = request;
    let loaded;
    try { loaded = await loadImage(url, this.stats, request.signal); }
    catch (error) {
      if (this.disposed || version !== this.loadVersion) { this.stats.counters.cancelledImages++; return; }
      throw error;
    } finally { if (this.imageRequest === request) this.imageRequest = null; }
    const { image, objectURL, blob } = loaded;
    try {
      await this.waitForInitialization();
      if (this.disposed || version !== this.loadVersion) { image.src = ''; URL.revokeObjectURL(objectURL); return; }
      if (this.image) this.image.src = '';
      if (this.imageURL) URL.revokeObjectURL(this.imageURL);
      this.imageURL = objectURL;
      this.image = image;
      this.imageBlob = blob;
      this.imageAspect = image.naturalWidth / image.naturalHeight;
      if (this.aspect === 'image') {
        this.canvas.style.aspectRatio = String(this.imageAspect);
        this.cssHeight = this.cssWidth / this.imageAspect;
      }
      this.reliefImage = null; this.uploadedRelief = null;
      this.stats.resources.artworkDecoded = { width: image.naturalWidth, height: image.naturalHeight, estimatedRGBABytes: image.naturalWidth * image.naturalHeight * 4 };
      this.stats.resources.reliefCPUBytes = 0;
      this.canvas.style.backgroundImage = this.gl && !this.lost && !this.initializing ? '' : `url("${objectURL}")`;
      this.canvas.style.backgroundSize = 'cover';
      this.canvas.style.backgroundPosition = 'center';
      if (this.gl && !this.lost && !this.initializing) this.upload();
      this.prepareRelief();
      this.invalidate();
    } catch (error) { URL.revokeObjectURL(objectURL); throw error; }
  }

  async setMask(url) {
    return this.maskReady = this.loadMask(url);
  }

  async loadMask(url) {
    if (this.disposed) return;
    const version = ++this.maskVersion;
    if (!url) { this.maskImage = null; this.invalidate(); return; }
    let pending = this.maskCache.get(url);
    if (!pending) {
      this.stats.maskDecodes++;
      pending = loadImage(url, this.stats).then(({ image, objectURL }) => {
        const started = performance.now();
        try {
          const bitmap = document.createElement('canvas');
          const scale = 1024 / Math.max(image.naturalWidth, image.naturalHeight);
          bitmap.width = Math.max(1, Math.round(image.naturalWidth * scale));
          bitmap.height = Math.max(1, Math.round(image.naturalHeight * scale));
          bitmap.getContext('2d').drawImage(image, 0, 0, bitmap.width, bitmap.height);
          return bitmap;
        } finally { image.src = ''; URL.revokeObjectURL(objectURL); recordTiming(this.stats, 'maskBuild', started); }
      });
      this.maskCache.set(url, pending);
      if (this.maskCache.size > 2) this.maskCache.delete(this.maskCache.keys().next().value);
    }
    let image;
    try { image = await pending; } catch (error) { if (this.maskCache.get(url) === pending) this.maskCache.delete(url); throw error; }
    await this.waitForInitialization();
    if (this.disposed || version !== this.maskVersion) return;
    this.maskImage = image;
    if (this.gl && !this.lost && !this.initializing && this.uploadedMask !== image) this.uploadMask();
    this.invalidate();
  }

  uploadMask() {
    if (!this.gl || this.lost || this.initializing || this.disposed || !this.maskImage) return;
    const started = performance.now();
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,this.maskTexture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.maskImage);
    gl.activeTexture(gl.TEXTURE0);
    this.uploadedMask = this.maskImage; this.stats.maskUploads++;
    this.stats.resources.maskTextureBytes = this.maskImage.width * this.maskImage.height * 4;
    recordTiming(this.stats, 'maskUpload', started);
  }

  upload() {
    if (!this.gl || this.lost || this.initializing || this.disposed || !this.image) return;
    const gl = this.gl;
    const max = this.maxTextureSize;
    let image = this.image;
    if (Math.max(image.naturalWidth,image.naturalHeight) > max) {
      const started = performance.now();
      const scale = max / Math.max(image.naturalWidth,image.naturalHeight);
      const buffer = document.createElement('canvas');
      buffer.width = Math.max(1,Math.round(image.naturalWidth*scale));
      buffer.height = Math.max(1,Math.round(image.naturalHeight*scale));
      buffer.getContext('2d').drawImage(image,0,0,buffer.width,buffer.height);
      image = buffer;
      recordTiming(this.stats, 'artworkResize', started);
    }
    const started = performance.now();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
    const width = image.naturalWidth || image.width, height = image.naturalHeight || image.height;
    this.stats.resources.artworkTexture = { width, height, estimatedRGBABytes: width * height * 4 };
    this.stats.counters.artworkUploads++;
    this.uploadedImage = this.image;
    recordTiming(this.stats, 'artworkUpload', started);
    if (image !== this.image) { image.width = 0; image.height = 0; }
  }

  prepareRelief() {
    if (!this.image || !this.gl || this.lost || this.initializing || this.disposed || !['dark-relief','silver-relief'].includes(this.preset.pattern)) return;
    if (!this.reliefImage) {
      const started = performance.now();
      const bitmap = document.createElement('canvas');
      const scale = Math.min(1, 714 / Math.max(this.image.naturalWidth, this.image.naturalHeight));
      bitmap.width = Math.max(1, Math.round(this.image.naturalWidth * scale));
      bitmap.height = Math.max(1, Math.round(this.image.naturalHeight * scale));
      const ctx = bitmap.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(this.image, 0, 0, bitmap.width, bitmap.height);
      const pixels = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      const heights = new Float32Array(bitmap.width * bitmap.height);
      for (let i = 0; i < heights.length; i++) {
        const j = i * 4;
        heights[i] = (pixels.data[j] * .2126 + pixels.data[j+1] * .7152 + pixels.data[j+2] * .0722) / 255;
      }
      const { width: w, height: h } = bitmap;
      const sample = (x,y) => heights[Math.max(0,Math.min(h-1,y))*w + Math.max(0,Math.min(w-1,x))];
      // Bake broad bevels and fine cuts once; motion only samples this normal/height map.
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = (sample(x-2,y)-sample(x+2,y))*2.6 + (sample(x-1,y)-sample(x+1,y))*1.2;
        const dy = (sample(x,y-2)-sample(x,y+2))*2.6 + (sample(x,y-1)-sample(x,y+1))*1.2;
        const length = Math.hypot(dx,dy,1), j = (y*w+x)*4;
        pixels.data[j] = (dx/length*.5+.5)*255;
        pixels.data[j+1] = (dy/length*.5+.5)*255;
        pixels.data[j+2] = (1/length*.5+.5)*255;
        pixels.data[j+3] = heights[y*w+x]*255;
      }
      this.reliefImage = pixels; this.stats.reliefBuilds++;
      this.stats.resources.reliefCPUBytes = pixels.data.byteLength;
      bitmap.width = 0; bitmap.height = 0;
      recordTiming(this.stats, 'reliefBuild', started);
    }
    if (this.uploadedRelief !== this.reliefImage) {
      const started = performance.now();
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D,this.reliefTexture);
      // Raw bytes preserve normal RGB independently from the height stored in alpha.
      const { width, height } = this.reliefImage;
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,this.reliefImage.data);
      gl.activeTexture(gl.TEXTURE0);
      this.uploadedRelief = this.reliefImage; this.stats.reliefUploads++;
      this.stats.resources.reliefTextureBytes = width * height * 4;
      recordTiming(this.stats, 'reliefUpload', started);
    }
  }

  setPreset(id) {
    const preset = typeof id === 'string' ? resolvePreset(id) : id;
    if (!preset || !patterns.includes(preset.pattern) || !regions.includes(preset.region)) throw new TypeError('未知材质或区域');
    this.preset = preset; this.materialDirty = true; this.prepareRelief(); this.invalidate();
  }

  setEffectStrength(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1 || value === this.effectStrength) return false;
    this.effectStrength = value; this.effectStrengthDirty = true; this.invalidate();
    return true;
  }

  setPose(x,y,{ reducedMotion = false, immediate = false } = {}) {
    const clamp = n => Math.max(0,Math.min(1,Number.isFinite(n) ? n : .5));
    const next = reducedMotion ? [.5,.5] : [clamp(x),clamp(y)];
    if (next[0] === this.pose[0] && next[1] === this.pose[1]) { if (immediate) this.flush(); return; }
    this.pose = next;
    if (immediate) {
      if (this.frame !== null) this.flush(); else this.render();
    } else this.invalidate();
  }

  resize(width) {
    if (Number.isFinite(width) && width > 0) {
      this.width = Math.min(1000,width);
      this.cssWidth = this.width; this.cssHeight = this.width / (this.aspect === 'image' ? this.imageAspect : this.aspect);
      this.canvas.style.width = `${this.width}px`;
    }
    this.invalidate();
  }

  invalidate() {
    if (this.disposed || this.lost || this.initializing || this.frame !== null) return;
    this.frame = requestAnimationFrame(() => { this.frame = null; this.render(); });
  }

  flush() {
    if (this.frame === null || this.disposed || this.lost) return;
    cancelAnimationFrame(this.frame); this.frame = null;
    this.render();
  }

  render(size) {
    if (this.disposed || this.lost || this.initializing || !this.image) return;
    const start = performance.now();
    const dpr = Math.min(1.5,window.devicePixelRatio || 1);
    const w = size?.width ?? Math.max(1,Math.round(Math.min(1000,this.cssWidth)*dpr));
    const measuredAspect = this.cssHeight / this.cssWidth;
    const h = size?.height ?? Math.max(1,Math.round(w*measuredAspect));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    const imageAspect = this.image.naturalWidth / this.image.naturalHeight;
    const targetAspect = w/h;
    const sx = Math.min(1,targetAspect/imageAspect), sy = Math.min(1,imageAspect/targetAspect);
    if (this.gl) {
      const gl = this.gl, u = this.uniforms, p = this.preset;
      gl.useProgram(this.program); gl.uniform2fv(u.pose,this.pose);
      if (this.uniformWidth !== w || this.uniformHeight !== h || this.uniformImage !== this.image) {
        gl.viewport(0,0,w,h);
        gl.uniform2f(u.resolution,w,h); gl.uniform2f(u.imageScale,sx,sy);
        this.uniformWidth = w; this.uniformHeight = h; this.uniformImage = this.image;
      }
      const useMask = p.masked && this.maskImage ? 1 : 0;
      if (this.uniformMask !== useMask) { gl.uniform1f(u.useMask,useMask); this.uniformMask = useMask; }
      if (this.effectStrengthDirty) {
        gl.uniform1f(u.effectStrength,this.effectStrength); this.effectStrengthDirty = false;
      }
      // Custom mutable recipes keep their previous live-update behavior.
      if (this.materialDirty || !Object.isFrozen(p) || (p.micro && !Object.isFrozen(p.micro))) {
        gl.uniform4f(u.material,p.strength,p.glitter,p.glare,p.emboss);
        gl.uniform4f(u.recipe,patterns.indexOf(p.pattern),p.dispersion,p.absorption || .12,0);
        gl.uniform4fv(u.micro,p.micro || [3,.08,.7,.5]);
        gl.uniform1f(u.region,regions.indexOf(p.region));
        gl.uniform1f(u.metal,p.metal === 'gold' ? 1 : p.metal === 'silver' ? 2 : 0);
        this.materialDirty = false; this.stats.counters.staticUniformBatches++;
      }
      gl.drawArrays(gl.TRIANGLES,0,6);
    } else if (this.context2d) {
      this.context2d.clearRect(0,0,w,h);
      const iw = this.image.naturalWidth, ih = this.image.naturalHeight;
      this.context2d.drawImage(this.image,(1-sx)*iw/2,(1-sy)*ih/2,iw*sx,ih*sy,0,0,w,h);
    }
    this.stats.draws++; this.stats.renderMs = performance.now()-start;
    this.stats.lastPose = [...this.pose]; this.stats.lastFrameTime = performance.now();
  }

  async exportPng({ longEdge = 2048, pose = { x: this.pose[0], y: this.pose[1] }, strength = this.effectStrength } = {}) {
    if (!Number.isInteger(longEdge) || longEdge < 1 || longEdge > 2048) throw new RangeError('longEdge 必须是 1..2048 的整数');
    if (!pose || ![pose.x, pose.y, strength].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1)) throw new RangeError('光位和强度必须为 0..1 的有限数字');
    const exportPose = [pose.x, pose.y];
    const preset = { ...this.preset, micro: [...(this.preset.micro || [3,.08,.7,.5])] };
    await Promise.all([this.waitForInitialization(), this.imageReady, this.maskReady]);
    if (this.disposed || this.lost || !this.gl || !this.image) throw new Error('当前渲染器或图片不可用于光效导出');
    const aspect = this.image.naturalWidth / this.image.naturalHeight;
    const width = Math.max(1, Math.round(aspect >= 1 ? longEdge : longEdge * aspect));
    const height = Math.max(1, Math.round(aspect >= 1 ? longEdge / aspect : longEdge));
    // The immutable source blob survives preview changes without another full-size pixel copy.
    const imageBlob = this.imageBlob;
    const mask = this.maskImage;
    const encode = canvas => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG 编码失败')), 'image/png'));
    const canvas = document.createElement('canvas');
    let exported, imageURL;
    try {
      imageURL = URL.createObjectURL(imageBlob);
      exported = new HoloCard(canvas, { image: imageURL, preset, aspect: 'image', width: 1 });
      await exported.ready;
      if (!exported.gl || exported.lost || exported.error) throw new Error('离屏 WebGL 初始化失败');
      const gl = exported.gl, viewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
      const maximum = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
      if (width > Math.min(viewport[0], maximum) || height > Math.min(viewport[1], maximum)) throw new RangeError('硬件不支持目标导出尺寸');
      if (mask) { exported.maskImage = mask; exported.uploadMask(); }
      exported.pose = exportPose;
      exported.effectStrength = strength; exported.effectStrengthDirty = true;
      if (exported.frame !== null) cancelAnimationFrame(exported.frame);
      exported.frame = null;
      exported.render({ width, height });
      if (gl.isContextLost() || gl.drawingBufferWidth !== width || gl.drawingBufferHeight !== height || gl.getError() !== gl.NO_ERROR) throw new Error('目标分辨率渲染失败');
      return await encode(canvas);
    } finally {
      const gl = exported?.gl;
      exported?.dispose();
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.width = canvas.height = 0;
      if (imageURL) URL.revokeObjectURL(imageURL);
    }
  }

  release() {
    if (!this.gl) return;
    if (this.texture) this.gl.deleteTexture(this.texture);
    if (this.maskTexture) this.gl.deleteTexture(this.maskTexture);
    if (this.reliefTexture) this.gl.deleteTexture(this.reliefTexture);
    if (this.buffer) this.gl.deleteBuffer(this.buffer);
    if (this.program) this.gl.deleteProgram(this.program);
  }

  dispose() {
    this.disposed = true; ++this.loadVersion; ++this.maskVersion;
    this.initializationRequest?.abort(); this.initializing = false; this.stats.initializing = false;
    this.imageRequest?.abort(); this.imageRequest = null;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null; this.observer?.disconnect();
    this.canvas.removeEventListener('webglcontextlost',this.onLost);
    this.canvas.removeEventListener('webglcontextrestored',this.onRestored);
    this.release(); if (this.image) this.image.src = ''; this.image = null; this.imageBlob = null;
    if (this.imageURL) URL.revokeObjectURL(this.imageURL);
    this.maskImage = null;
    this.reliefImage = null; this.uploadedRelief = null;
    this.maskCache.clear();
    this.stats.resources = {};
    this.canvas.style.backgroundImage = '';
    this.setMode('disposed');
  }
}
