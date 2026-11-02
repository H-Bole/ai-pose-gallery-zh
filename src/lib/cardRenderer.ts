import type { CardPresentation } from '../types/cards'

export function loadCardImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片加载失败，请检查图片地址或跨域权限后重试。'))
    image.src = url
  })
}

/** 预览与导出共享同一画布绘制，倾斜只发生在 CSS 展示层。 */
export function renderCard(canvas: HTMLCanvasElement, image: HTMLImageElement, p: CardPresentation, longEdge?: number) {
  const original = p.layout === 'original'
  const size = longEdge ?? (original ? Math.max(image.naturalWidth, image.naturalHeight) : 2048)
  const ratio = original ? image.naturalWidth / image.naturalHeight : 0.708
  canvas.width = Math.round(ratio >= 1 ? size : size * ratio)
  canvas.height = Math.round(ratio >= 1 ? size / ratio : size)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('浏览器无法创建画布，请更换浏览器重试。')
  const w = canvas.width, h = canvas.height, u = Math.min(w, h)
  ctx.clearRect(0, 0, w, h)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  const gold = '#e8cfa0', pale = '#fff5e3'
  if (!original) {
    const base = ctx.createLinearGradient(0, 0, w, h)
    base.addColorStop(0, '#353745'); base.addColorStop(.45, '#121522'); base.addColorStop(1, '#383039')
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h)
  }
  const m = original ? 0 : u * .045
  const hasText = !!(p.title || p.subtitle || p.number)
  const foot = !original && hasText ? h * (p.layout === 'player' ? .18 : .14) : m
  const x = m, y = m, iw = w - 2 * m, ih = h - m - foot
  ctx.save()
  ctx.beginPath(); ctx.rect(x, y, iw, ih); ctx.clip()
  if (!original) { ctx.fillStyle = '#10121d'; ctx.fillRect(x, y, iw, ih) }
  const scale = p.fit === 'cover' && !original ? Math.max(iw / image.naturalWidth, ih / image.naturalHeight) : Math.min(iw / image.naturalWidth, ih / image.naturalHeight)
  const dw = image.naturalWidth * scale, dh = image.naturalHeight * scale
  ctx.drawImage(image, x + (iw - dw) * (p.fit === 'cover' ? p.cropX : .5), y + (ih - dh) * (p.fit === 'cover' ? p.cropY : .5), dw, dh)
  ctx.restore()

  if (!original) {
    ctx.strokeStyle = gold; ctx.lineWidth = u * .002
    ctx.strokeRect(m * .45, m * .45, w - m * .9, h - m * .9)
    ctx.globalAlpha = .45
    ctx.strokeRect(m * .7, m * .7, w - m * 1.4, h - m * 1.4)
    ctx.globalAlpha = 1
    // 原创角饰与斜切线条，无品牌标识。
    for (const [cx, cy, sx, sy] of [[m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1]]) {
      ctx.beginPath(); ctx.moveTo(cx + sx * u * .10, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * u * .10); ctx.stroke()
    }
    if (p.layout === 'player') {
      const stripe = ctx.createLinearGradient(0, h * .7, w, h)
      stripe.addColorStop(0, '#d7b77a'); stripe.addColorStop(.5, '#fff0c8'); stripe.addColorStop(1, '#ac7f4c')
      ctx.fillStyle = stripe
      ctx.beginPath(); ctx.moveTo(m, h - foot); ctx.lineTo(w - m, h - foot - u * .055); ctx.lineTo(w - m, h - foot - u * .035); ctx.lineTo(m, h - foot + u * .02); ctx.fill()
    }
  }

  if (hasText) {
    if (original) {
      const shade = ctx.createLinearGradient(0, h * .72, 0, h)
      shade.addColorStop(0, 'transparent'); shade.addColorStop(1, 'rgba(8,10,18,.85)')
      ctx.fillStyle = shade; ctx.fillRect(0, h * .72, w, h * .28)
    }
    const tx = original ? u * .055 : m * 1.5
    const baseline = original ? h - u * .10 : h - foot * .48
    ctx.fillStyle = pale
    ctx.textBaseline = 'alphabetic'
    const text = (value: string, size: number, yy: number, max: number, weight = '500') => {
      ctx.font = `${weight} ${size}px Inter, "Microsoft YaHei", sans-serif`
      while (ctx.measureText(value).width > max && size > u * .014) { size -= 1; ctx.font = `${weight} ${size}px Inter, "Microsoft YaHei", sans-serif` }
      if (p.finish === 'emboss') { ctx.shadowColor = '#000'; ctx.shadowBlur = u * .002; ctx.shadowOffsetY = u * .002 }
      ctx.fillText(value, tx, yy, max)
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
    }
    text(p.title, u * .052, baseline, w - tx * 2, '600')
    ctx.fillStyle = gold
    text(p.subtitle, u * .024, baseline + u * .043, w - tx * 2)
    if (p.number) {
      ctx.textAlign = 'right'; ctx.font = `500 ${u * .025}px Inter, sans-serif`
      ctx.fillText(p.number, w - tx, original ? u * .065 : m + u * .047, w * .45)
      ctx.textAlign = 'left'
    }
  }

  if (p.finish !== 'none') {
    ctx.save()
    if (p.finish === 'emboss') {
      // 浮雕只作用于装饰纹理与边框，不推断照片人物的几何。
      ctx.beginPath(); ctx.rect(0, 0, w, h)
      if (!original) ctx.rect(m, m, iw, ih)
      else ctx.rect(u * .022, u * .022, w - u * .044, h - u * .044)
      ctx.clip('evenodd')
      for (let n = -h; n < w + h; n += u * .018) {
        ctx.strokeStyle = 'rgba(255,240,210,.12)'; ctx.lineWidth = u * .001
        ctx.beginPath(); ctx.moveTo(n, 0); ctx.lineTo(n + h, h); ctx.stroke()
        ctx.strokeStyle = 'rgba(0,0,0,.20)'
        ctx.beginPath(); ctx.moveTo(n + u * .002, 0); ctx.lineTo(n + h + u * .002, h); ctx.stroke()
      }
      ctx.restore()
      ctx.save(); ctx.strokeStyle = 'rgba(255,245,220,.65)'; ctx.lineWidth = u * .003
      ctx.strokeRect(u * .012, u * .012, w - u * .024, h - u * .024)
    } else {
      ctx.globalCompositeOperation = 'soft-light'
      const spectral = ctx.createLinearGradient(-w * .4 + p.lightX * w, -h * .3 + p.lightY * h, w * 1.3, h * 1.2)
      const colors = p.finish === 'holo' ? ['#acbfff', '#8ef1df', '#f4dca0', '#f5a6cf', '#9bbaff', '#9affdf'] : ['#83705b', '#e8d1a3', '#fff8dc', '#9daebb', '#b19160']
      colors.forEach((color, i) => spectral.addColorStop(i / (colors.length - 1), color))
      ctx.globalAlpha = p.finish === 'holo' ? .52 : .40
      ctx.fillStyle = spectral; ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = .28
      const glow = ctx.createRadialGradient(p.lightX * w, p.lightY * h, 0, p.lightX * w, p.lightY * h, u * .8)
      glow.addColorStop(0, '#fff8e5'); glow.addColorStop(.3, 'rgba(255,245,220,.18)'); glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h)
      // 窄幅镜面光带随光位移动，使闪箔与全息在静态导出中也有层次。
      const band = ctx.createLinearGradient(p.lightX * w - u * .75, p.lightY * h - u * .3, p.lightX * w + u * .75, p.lightY * h + u * .3)
      band.addColorStop(0, 'transparent'); band.addColorStop(.34, 'transparent')
      band.addColorStop(.46, p.finish === 'holo' ? '#d9c5ff' : '#f6ddaa')
      band.addColorStop(.5, '#fffef4'); band.addColorStop(.54, p.finish === 'holo' ? '#b8fff0' : '#e2c58e')
      band.addColorStop(.66, 'transparent'); band.addColorStop(1, 'transparent')
      ctx.globalAlpha = .24; ctx.fillStyle = band; ctx.fillRect(0, 0, w, h)
      if (p.finish === 'holo') {
        ctx.globalAlpha = .14; ctx.lineWidth = u * .0008
        for (let n = -12; n < 42; n++) {
          ctx.strokeStyle = colors[((n + 12) % colors.length)]
          const offset = n * u * .035
          ctx.beginPath(); ctx.moveTo(0, offset)
          ctx.bezierCurveTo(w * .35, offset + h * .45, w * .65, offset - h * .15, w, offset + h * .30)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = .12
      for (let n = 0; n < 100; n++) {
        const xx = ((n * 73.37) % 100) / 100 * w, yy = ((n * 41.71) % 100) / 100 * h
        ctx.fillStyle = '#ffffff'; ctx.fillRect(xx, yy, u * .0012, u * .003)
      }
    }
    ctx.restore()
  }
}

export function cardPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try { canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG 生成失败，请重试。')), 'image/png') }
    catch { reject(new Error('图片服务器未授权导出（CORS），请使用下载原图或更换本地图片。')) }
  })
}

export function downloadCardBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
