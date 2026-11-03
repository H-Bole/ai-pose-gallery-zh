// SPDX-License-Identifier: MIT
// Procedural optical surfaces; MIT prism/oil adaptations are identified below.
// Prism/oil material construction: Copyright (c) 2026 kongyo2; see THIRD_PARTY_NOTICES.md.
export const fragmentSource = `
precision highp float;
varying vec2 uv;
uniform sampler2D artwork;
uniform sampler2D coatingMask;
uniform sampler2D reliefMap;
uniform float useMask;
uniform vec2 pose;
uniform vec2 resolution;
uniform vec2 imageScale;
uniform vec4 material;
uniform vec4 recipe;
uniform vec4 micro;
uniform float region;
uniform float metal;
uniform float effectStrength;
uniform float roundCorners;
const float TAU = 6.2831853;
float hash(vec2 p) { return fract(sin(dot(p, vec2(113.71, 27.43))) * 17341.739); }
float noise(vec2 p) {
  vec2 cell = floor(p), t = fract(p); t = t*t*(3.-2.*t);
  return mix(mix(hash(cell),hash(cell+vec2(1,0)),t.x),mix(hash(cell+vec2(0,1)),hash(cell+1.),t.x),t.y);
}
float box(vec2 p, vec2 low, vec2 high) {
  vec2 a = smoothstep(low, low+.003, p), b = 1.-smoothstep(high-.003,high,p);
  return a.x*a.y*b.x*b.y;
}
float coating(vec2 p) {
  float art = box(p,vec2(.08,.14),vec2(.92,.50));
  float stage = box(p,vec2(.13,.17),vec2(.92,.50));
  float trainer = box(p,vec2(.08,.16),vec2(.92,.54));
  float inner = box(p,vec2(.035),vec2(.965));
  if (region < .5) return 1.;
  if (region < 1.5) return art;
  if (region < 2.5) return (1.-art)*inner;
  if (region < 3.5) {
    float cloud = length((p-vec2(.5,.32))*vec2(1.,1.5));
    return max(art,1.-smoothstep(.23,.36+noise(p*17.)*.07,cloud));
  }
  if (region < 4.5) return inner;
  if (region < 5.5) return stage;
  if (region < 6.5) return trainer;
  if (region < 7.5) return (1.-stage)*inner;
  if (region < 8.5) return (1.-trainer)*inner;
  // An original geometric specimen mask; never claims to infer a user's subject.
  float orbit = abs(length((p-vec2(.52,.38))*vec2(1.,.8))-.23);
  return max(1.-smoothstep(.008,.018,orbit),box(p,vec2(.2,.25),vec2(.8,.58)));
}
vec3 spectrum(float path) {
  // Three wavelength samples approximate a thin-film interference response.
  return .5+.5*cos(TAU*path/vec3(.650,.532,.445));
}
float starField(vec2 p, float density, vec2 tilt) {
  vec2 grid = p*density, id = floor(grid), f = fract(grid);
  vec2 center = vec2(.18+.64*hash(id), .18+.64*hash(id+31.));
  vec2 d = abs(f-center);
  float seed = hash(id+71.);
  float peak = pow(max(0.,cos(seed*TAU+dot(tilt,vec2(4.1,5.7)))),12.);
  float core = exp(-dot(d,d)*380.);
  float cross = exp(-min(d.x,d.y)*160.)*exp(-max(d.x,d.y)*17.);
  return (core+cross*.65)*step(.82,seed)*(.12+peak*2.6);
}
vec3 mineralFlakes(vec2 p, vec2 tilt, float scale) {
  vec2 grid = p*scale, id = floor(grid);
  vec2 center = .2+.6*vec2(hash(id+18.),hash(id+43.));
  vec2 d = fract(grid)-center;
  float a = hash(id+12.)*TAU;
  d = mat2(cos(a),sin(a),-sin(a),cos(a))*d;
  float radius = .025+.27*pow(hash(id+64.),2.);
  float flake = length(d*vec2(.75+.6*hash(id+6.),.75+.6*hash(id+8.)));
  flake *= 1.+.12*sin(atan(d.y,d.x)*5.+hash(id)*TAU);
  float disk = 1.-smoothstep(radius*.3,radius+.045,flake);
  float selected = step(scale < 20. ? .82 : .54,hash(id+99.));
  float response = .15+1.6*pow(.5+.5*cos(dot(tilt,vec2(3.,-4.))+hash(id)*TAU),4.);
  vec3 color = .08+.92*(.5+.5*cos(hash(id+7.)*TAU+tilt.x*.8+vec3(0.,2.1,4.2)));
  color = mix(vec3(.12,.9,.55),color,.15+min(1.,length(tilt))*.72);
  color = mix(vec3(.25,.65,.55),color,.8);
  return color*disk*selected*response;
}

vec3 foilColor(float phase) {
  return .04+.96*(.5+.5*cos(phase+vec3(0.,2.094,4.189)));
}

vec3 otherSurface(vec2 p, vec2 texUV, vec2 tilt, vec3 ink) {
  vec2 card = p*vec2(resolution.x/resolution.y,1.);
  if (recipe.x > 15.5 && recipe.x < 17.5) {
    vec4 relief = texture2D(reliefMap,texUV);
    vec3 n = normalize(relief.rgb*2.-1.);
    vec3 lightDir = normalize(vec3(-tilt*1.25+vec2(-.38,-.42),.9));
    vec3 viewDir = normalize(vec3(tilt*.38,1.));
    vec3 halfway = normalize(lightDir+viewDir);
    float diffuse = max(0.,dot(n,lightDir));
    float specular = pow(max(0.,dot(n,halfway)),42.);
    float sharp = pow(max(0.,dot(n,halfway)),130.);
    float raised = smoothstep(.08,.72,relief.a);
    float ridge = 1.-n.z;
    float brushed = .9+.1*sin(card.y*1750.+sin(card.x*23.)*2.);
    bool silver = recipe.x > 16.5;
    vec3 metalColor = silver ? vec3(.74,.86,.97) : vec3(.86,.63,.31);
    vec3 body = silver ? mix(vec3(.025,.041,.065),metalColor*.48,raised) : mix(ink*.32,metalColor*.24,raised);
    body *= (.32+diffuse*.92)*brushed;
    body += metalColor*(specular*(.10+raised*.25+ridge*.65)+sharp*.25);
    body += metalColor*ridge*pow(diffuse,3.)*.48;
    body *= .76+.24*smoothstep(0.,.4,relief.a);
    return body;
  }
  if (recipe.x > 17.5 && recipe.x < 19.5) {
    // Adapted material construction from kongyo2/cards-css (MIT), fixed commit
    // cd25c33682922c3af89b470a79dc2185597034ed, prism.css / oilslick.css.
    // CSS gradients/blends become single-pass angular/radial fields; see notices.
    vec2 lamp = card-(pose*vec2(resolution.x/resolution.y,1.));
    float spot = exp(-dot(lamp,lamp)*5.);
    float away = min(1.,length(tilt));
    vec3 foil;
    float glint;
    if (recipe.x > 17.5 && recipe.x < 18.5) {
      vec2 center = (p-vec2(.5)-tilt*.12)*vec2(.718,1.);
      float angle = atan(center.y,center.x)-tilt.x*.09;
      float facets = angle*6.;
      foil = .08+.92*(.5+.5*cos(facets+vec3(0.,2.094,4.189)));
      float cut = abs(fract((angle+tilt.y*.07)/.419)-.43);
      glint = exp(-cut*cut*1600.)*(.16+away*.45);
      foil *= .35+spot*.65;
    } else if (recipe.x > 18.5 && recipe.x < 19.5) {
      vec2 a = (p-vec2(.65,.36)+tilt*.25)*vec2(.718,1.);
      vec2 b = (p-vec2(.28,.7)-tilt*.22)*vec2(.718,1.);
      float rings = length(a)*9.1-length(b)*5.4;
      float drift = sin(card.x*13.+card.y*8.)*.19+sin(card.y*19.)*.07;
      foil = .04+.96*(.5+.5*cos(TAU*(rings+drift+dot(tilt,vec2(.3,.18)))+vec3(0.,2.094,4.189)));
      foil = pow(foil,vec3(1.45))*(.3+.7*spot);
      glint = pow(spot,5.)*.22;
    }
    float grain = hash(floor(card*vec2(650.,900.)));
    vec3 color = ink*(.68+foil*.38)+foil*(.11+spot*.28)*material.x;
    color += vec3(1.,.98,.94)*(glint+pow(spot,7.)*.16);
    color += foil*pow(grain,18.)*(.025+away*.06);
    return color;
  }
  // Original full-surface coatings: geometry is fixed; reflection follows pose.
  vec2 lamp = (p-pose)*vec2(resolution.x/resolution.y,1.);
  float spot = exp(-dot(lamp,lamp)*7.);
  if (recipe.x > 19.5 && recipe.x < 20.5) {
    float nacre = noise(card*5.)*.1+sin(card.y*8.+card.x*5.)*.04;
    vec3 pearl = .72+.28*cos((card.x*.7+card.y*.4+dot(tilt,vec2(.6,-.4))+nacre)*4.+vec3(0.,1.7,3.4));
    float sheen = .16+spot*.45;
    return ink*(.93+pearl*.07)+pearl*sheen*.26+vec3(1.,.97,.92)*pow(spot,3.)*.17;
  }
  if (recipe.x > 20.5 && recipe.x < 21.5) {
    float scratch = hash(vec2(floor(card.y*1500.),floor(card.x*6.)));
    float fibers = .5+.5*sin(card.y*3700.+scratch*3.);
    float bandAxis = (p.x-pose.x)*3.+tilt.y*.5;
    float band = exp(-bandAxis*bandAxis*3.);
    vec3 silver = vec3(.85,.9,.96);
    return ink*(.79+fibers*.09+band*.12)+silver*(.025+band*.17)*(.55+fibers*.45);
  }
  if (recipe.x > 21.5 && recipe.x < 22.5) {
    vec2 grid = card*23.+vec2(sin(card.y*31.),sin(card.x*27.))*.35;
    vec2 cell = floor(grid), f = fract(grid);
    float diagonal = hash(cell+91.) < .5 ? f.x-f.y : f.x+f.y-1.;
    float triangle = step(0.,diagonal);
    vec2 id = cell+vec2(triangle*.37,triangle*.73);
    float seed = hash(id);
    vec2 facetTilt = vec2(hash(id+13.),hash(id+47.))*2.-1.;
    float flash = pow(max(0.,1.-length(tilt-facetTilt)*.65),10.);
    vec3 foil = foilColor(seed*TAU+dot(tilt,facetTilt)*3.);
    float edge = 1.-smoothstep(.01,.055,min(min(f.x,1.-f.x),min(min(f.y,1.-f.y),abs(diagonal))));
    return ink*(.88+flash*.1)+foil*(.035+flash*.39)+vec3(edge*.018);
  }
  if (recipe.x > 22.5 && recipe.x < 23.5) {
    vec2 grid = card*155., cell = floor(grid);
    vec2 center = .15+.7*vec2(hash(cell+3.),hash(cell+29.));
    vec2 d = fract(grid)-center;
    float grain = exp(-dot(d,d)*85.);
    float seed = hash(cell+67.);
    float flash = pow(max(0.,cos(seed*TAU+dot(tilt,vec2(4.3,-3.7)))),24.);
    vec3 glitter = mix(vec3(.95,.95,1.),foilColor(seed*TAU),.22);
    return ink*.98+glitter*grain*step(.35,seed)*(.025+flash*.8)+vec3(spot*.035);
  }
  if (recipe.x > 23.5 && recipe.x < 24.5) {
    vec2 reflection = lamp*vec2(.8,1.7);
    float softbox = exp(-pow(abs(reflection.x)*2.5,6.)-pow(abs(reflection.y)*2.5,6.));
    float rimAxis = (p.x+p.y*.38-pose.x-pose.y*.38)*32.;
    float rim = exp(-rimAxis*rimAxis);
    return ink*(.97+spot*.03)+vec3(1.,.985,.96)*(softbox*.22+rim*.075);
  }
  if (recipe.x > 24.5 && recipe.x < 25.5) {
    float axis = card.x+card.y*.43;
    float phase = axis-dot(tilt,vec2(.48,-.32))-.5;
    float sweep = exp(-phase*phase*32.);
    float grooves = .5+.5*cos(axis*2100.);
    vec3 diffraction = foilColor(phase*22.+tilt.y*3.);
    return ink*(.92+grooves*.025)+diffraction*sweep*(.16+grooves*.16)+vec3(pow(sweep,12.)*.07);
  }
  return ink;
}
void main() {
  vec2 p = vec2(uv.x,1.-uv.y);
  vec2 texUV = (p-.5)*imageScale+.5;
  vec4 base = texture2D(artwork, texUV);
  vec2 tilt = pose*2.-1.;
  float aspect = resolution.x/resolution.y;
  vec2 q = p*vec2(aspect,1.);
  if (recipe.x > 15.5) {
    vec3 color = otherSurface(p,texUV,tilt,base.rgb);
    color = mix(base.rgb,clamp(color,0.,1.),effectStrength);
    vec2 corner = abs(q-vec2(aspect,1.)*.5)-(vec2(aspect,1.)*.5-.03);
    float silhouette = 1.-smoothstep(-1./resolution.y,0.,length(max(corner,0.))-.03);
    float alpha = base.a*mix(1.,silhouette,roundCorners);
    gl_FragColor = vec4(clamp(color,0.,1.)*alpha,alpha);
    return;
  }
  float direction = dot(q,normalize(vec2(.63,.91)));
  float structure = 0., sparkle = 0.;
  float mode = recipe.x;
  float opticalPath = .71+direction*recipe.y+dot(tilt,vec2(.48,-.35));
  if (mode > .5 && mode < 1.5) {
    structure = pow(.5+.5*cos(q.x*107.+tilt.x*9.+q.y*7.),12.);
    opticalPath += .12*sin(q.x*31.-tilt.y*2.);
  } else if (mode < 2.5 && mode > 1.5) {
    structure = noise(q*142.);
    opticalPath += noise(q*9.)*.21;
  } else if (mode < 3.5 && mode > 2.5) {
    vec2 c = q-vec2(.35,.41);
    structure = .6*noise(q*13.)+.4*sin(length(c)*39.+atan(c.y,c.x)*2.);
    opticalPath += structure*.25;
    sparkle = starField(q+tilt*.003,108.,tilt)*.7+starField(q-tilt*.007,37.,tilt+1.);
  } else if (mode < 4.5 && mode > 3.5) {
    // Nested diamond-distance bands, sized in card units rather than pixels.
    vec2 triangle = abs(fract(vec2(q.x+q.y,q.y-q.x)*1.35+vec2(.12,.37)+tilt*.04)-.5)*2.;
    vec2 band = 1.-smoothstep(vec2(.065),vec2(.085),abs(triangle-.43));
    vec2 outline = 1.-smoothstep(vec2(.012),vec2(.04),abs(triangle-.72));
    structure = max(band.x,band.y)+max(outline.x,outline.y)*.55;
    opticalPath += structure*.035;
  } else if (mode < 5.5 && mode > 4.5) {
    float contour = length(q-vec2(.32,.37)) + sin(q.y*13.)*.025+noise(q*8.)*.035;
    structure = .5+.5*sin(contour*410.);
    opticalPath += structure*.08+contour*.24;
  } else if (mode < 6.5 && mode > 5.5) {
    vec2 c = q-vec2(.36,.4);
    structure = pow(.5+.5*cos(atan(c.y,c.x)*32.+length(c)*15.),8.);
    opticalPath += length(c)*1.2;
  } else if (mode < 7.5 && mode > 6.5) {
    structure = noise(q*35.+noise(q*9.)*3.);
    opticalPath += sin(q.y*16.+sin(q.x*13.))*.18+structure*.12;
  } else if (mode < 8.5 && mode > 7.5) {
    float warp = sin(q.y*21.)*.6+noise(q*13.);
    float fiberA = pow(.5+.5*sin((q.x+q.y)*1040.+warp),7.);
    float fiberB = pow(.5+.5*sin((q.x-q.y)*890.-warp),9.);
    structure = max(fiberA,fiberB);
    opticalPath += structure*.025;
  } else if (mode > 8.5 && mode < 9.5) {
    sparkle = starField(q,27.,tilt);
    vec2 tile = abs(fract(q*27.)-.5);
    structure = exp(-min(tile.x,tile.y)*60.)*exp(-max(tile.x,tile.y)*5.);
    opticalPath += structure*.13;
  } else if (mode > 9.5 && mode < 10.5) {
    float contour = length(q-vec2(.32,.37))+sin(q.y*13.)*.025+noise(q*8.)*.035;
    structure = pow(.5+.5*sin(contour*1150.),8.);
    opticalPath += structure*.018;
  } else if (mode > 10.5 && mode < 11.5) {
    structure = noise(q*180.);
    opticalPath += structure*.035;
  }
  float away = min(1.,length(tilt));
  float southeast = smoothstep(-.1,.75,dot(tilt,vec2(.6,.8)));
  float foilEtch = 0.;
  if ((mode > 1.5 && mode < 2.5) || (useMask > .5 && ((mode > 3.5 && mode < 4.5) || (mode > 7.5 && mode < 8.5) || (mode > 11.5 && mode < 12.5)))) {
    float foilWave = p.y + .055*sin(p.x*49.) + .018*sin(p.x*98.);
    foilEtch = pow(.5+.5*cos(foilWave*102.),6.);
  }
  vec3 iridescence = spectrum(opticalPath);
  if (metal > .5 && metal < 1.5) iridescence = mix(vec3(.9,.56,.12),vec3(1.,.91,.56),iridescence.g);
  if (metal > 1.5) iridescence = mix(vec3(.63,.73,.8),iridescence,.22)+.13;
  vec2 lightDelta = (q-pose*vec2(aspect,1.));
  float light = exp(-dot(lightDelta,lightDelta)*9.);
  float softbox = exp(-pow((q.x*.7+q.y*.5-dot(tilt,vec2(.3,.3))-.42)*7.,2.));
  vec2 grainID = floor(q*vec2(510.,710.));
  float facet = hash(grainID);
  float glint = pow(max(0.,cos(facet*TAU+dot(tilt,vec2(11.,-7.)))),26.);
  float glitter = step(.67,facet)*glint*material.y*(.12+.88*light);
  float active = coating(p)*material.x;
  if (useMask > .5) {
    active = texture2D(coatingMask,p).a*material.x;
    bool windowed = (region > .5 && region < 1.5) || (region > 4.5 && region < 6.5);
    if (windowed && (mode < 1.5 || (mode > 2.5 && mode < 3.5) || (mode > 11.5 && mode < 12.5))) active *= coating(p);
    if (mode > 3.5 && mode < 4.5) active *= box(p,vec2(.035),vec2(.965));
  }
  // Screen-like radiance preserves ink detail; broad glare is deliberately limited.
  vec3 radiance = iridescence*(.09+.21*softbox+.21*light+structure*material.w*.28);
  radiance += iridescence*glitter*.95 + vec3(sparkle)*(.35+material.y);
  if (mode > .5 && mode < 1.5) {
    float slide = dot(tilt,vec2(2.25,-2.1))+.9;
    float clusters = pow(.5+.5*cos(q.x*32.+slide),5.);
    float columns = pow(.5+.5*sin(q.x*1810.),5.);
    float broken = .2+.8*hash(vec2(floor(q.x*420.),7.));
    vec3 dispersed = foilColor(q.x*13.+tilt.y*2.+2.);
    radiance = dispersed*clusters*(.8+columns*.9)*(.55+broken*.45);
    radiance += vec3(1.)*pow(clusters,3.)*(.48+columns*.7);
    radiance += dispersed*sqrt(clusters)*.12;
    radiance *= 1.-southeast*.95;
  }
  if (mode > 2.5 && mode < 3.5) {
    radiance = iridescence*(.018+.045*light)+mineralFlakes(q,tilt,17.)*2.1+mineralFlakes(q+vec2(.37,.19),tilt,43.)*.8;
    vec3 starTint = mix(vec3(.1,.9,.55),foilColor(opticalPath*7.+noise(floor(q*108.))*5.),away);
    radiance += starTint*sparkle*1.4;
    float dustID = hash(floor(q*vec2(210.,300.)));
    float dust = step(.974,dustID)*(.45+.55*pow(.5+.5*cos(dustID*91.+tilt.y*4.),4.));
    radiance += mix(vec3(.1,.9,.5),foilColor(dustID*TAU+tilt.x),.3+.7*away)*dust*.9;
    radiance *= 1.-southeast*.35;
    radiance += vec3(.015,.12,.8)*exp(-dot(lightDelta,lightDelta)*7.)*(.12+away*.85+southeast);
    radiance = mix(radiance,radiance*vec3(.25,.6,1.5),southeast*.65);
  }
  if (mode > 3.5 && mode < 4.5) {
    vec3 pearl = mix(vec3(.53,.95,.84),iridescence,.32);
    float grain = hash(floor(q*vec2(590.,760.)));
    float diamondLight = .4+.55*light+.65*southeast;
    radiance = iridescence*.014+pearl*structure*diamondLight*(.35+.65*grain);
    radiance += vec3(.87,1.,.96)*pow(light,2.)*(.18+.6*southeast);
    radiance += vec3(.88,.97,1.)*pow(grain,35.)*(.35+.8*light);
    if (useMask > .5) {
      vec3 color = foilColor(.8+p.y*4.-tilt.x*2.);
      radiance = color*(.2+foilEtch*(.25+away*.5)+structure*.7) + vec3(.8,1.,1.)*light*.65;
    }
  }
  if (mode > 7.5 && mode < 8.5 && metal > .5 && metal < 1.5) {
    radiance = vec3(1.,.89,.6)*(structure*(.025+.3*away)+light*.035);
    if (useMask > .5) radiance = vec3(1.,.89,.6)*foilEtch*(.12+away*.45);
    radiance += iridescence*glitter*.65;
  }
  if (mode > 9.5 && mode < 10.5) {
    float beam = exp(-pow((q.x*.9+q.y*.38-dot(tilt,vec2(.3,.24))-.4)*16.,2.));
    radiance = iridescence*(.012+.065*softbox+.025*light);
    radiance += vec3(.83,.89,.87)*structure*.13+vec3(.93,.96,.9)*beam*.34;
    radiance += iridescence*glitter*.35;
  }
  if (mode > 10.5 && mode < 11.5) {
    float offAxis = min(1.,length(tilt));
    vec3 pastel = mix(vec3(.85,.88,.91),iridescence,.04+.4*offAxis);
    vec3 colored = foilColor(.6+p.y*5.4+tilt.x*2.2);
    pastel = mix(pastel,colored,offAxis*.85);
    float grains = pow(hash(floor(q*vec2(620.,810.))),3.);
    radiance = pastel*(.02+.035*light+offAxis*(.12+grains*.72));
    radiance += pastel*glitter*(.55+offAxis*1.6);
    float contour = p.x*.36+p.y+sin(p.x*20.)*.025+sin(p.y*26.)*.012;
    float etched = pow(.5+.5*cos(contour*1120.),6.);
    radiance += colored*etched*offAxis*.25;
  }
  if (mode > 11.5 && mode < 12.5) {
    // Each surface has its own continuous original engraving field.
    float kind = floor(micro.w);
    float depth = fract(micro.w);
    float across = dot(q,normalize(vec2(.77,.64)));
    float along = dot(q,normalize(vec2(-.64,.77)));
    float bend = 0.;
    float etchField = along;
    if (kind > .5 && kind < 1.5) { // Fine nested geological folds.
      bend = sin(q.y*19.+sin(q.x*13.))*.015;
      etchField = length((q-vec2(.28,.43))*vec2(1.2,.7)) + sin(q.y*29.)*.013;
    } else if (kind < 2.5 && kind > 1.5) { // Long interleaved river lines.
      bend = sin(q.y*23.)*.023;
      etchField = q.x + sin(q.y*22.)*.035 + sin(q.y*43.+q.x*8.)*.012;
    } else if (kind < 3.5 && kind > 2.5) { // Wide flowing folds with fine ridges.
      bend = sin(q.x*21.+q.y*12.)*.025;
      etchField = q.y+sin(q.x*24.)*.045+sin(q.x*47.)*.011;
    } else if (kind < 4.5 && kind > 3.5) {
      bend = sin(q.y*17.)*.009;
      etchField = q.x*.54+q.y*.84+sin(q.x*32.)*.006;
    } else if (kind < 5.5 && kind > 4.5) { // Contour ribbons.
      bend = sin(q.y*14.+q.x*7.)*.018;
      etchField = q.x+sin(q.y*26.+sin(q.y*11.))*.035;
    } else if (kind < 6.5 && kind > 5.5) { // Overlapping curved fan engravings.
      bend = sin(q.x*19.)*.014;
      etchField = length((q-vec2(.42,.26))*vec2(.7,1.))+sin(q.x*37.)*.012;
    } else if (kind > 6.5) {
      etchField = q.x*.6+q.y*.8+sin(q.y*34.)*.009;
    }
    float surfaceFacet = hash(floor(q*vec2(560.,740.)));
    float deviation = (surfaceFacet-.5)*micro.y*.38;
    float viewPhase = dot(tilt,vec2(.78,.43));
    float d1 = abs(fract((across+bend)*micro.x+viewPhase+deviation+.23)-.5);
    float d2 = abs(fract((across-bend)*micro.x*.73-viewPhase*.81+.42-deviation)-.5);
    float primary = exp(-pow(d1/micro.y,2.));
    float secondary = exp(-pow(d2/(micro.y*.64),2.))*(micro.x < 1.1 ? .08 : .42);
    float lobe = (primary+secondary)*(.65+surfaceFacet*.65);
    // Fine ridges remain visible between reflection lobes, with independent groove response.
    float groovePhase = etchField*1050.;
    float etch = pow(.5+.5*sin(groovePhase),5.);
    float ridgeReflection = pow(.5+.5*cos(groovePhase+dot(tilt,vec2(2.7,-2.1))),4.);
    float woven = pow(.5+.5*cos(etchField*1730.+along*88.),6.);
    float fringe = exp(-pow((d1-micro.y*1.25)/(micro.y*.7),2.));
    vec3 dispersion = foilColor(.9+p.y*6.5+tilt.x*1.7+sin(etchField*58.)*.32);
    dispersion = mix(vec3(.82,.89,.9),dispersion,micro.z);
    float facing = .35+.65*away;
    if (kind > .5 && kind < 6.5) facing *= .18+.82*away;
    if (kind > 4.5 && kind < 5.5) facing = max(facing,.75*(1.-away));
    if (kind > 6.5 && kind < 7.5) facing *= 1.-southeast*.84;
    float engraving = (etch*.38+ridgeReflection*.32+woven*.3)*depth;
    float broadReflection = .07+.18*softbox+.1*light;
    radiance = dispersion*(lobe*(.5+engraving*.8)+fringe*.22+engraving*broadReflection)*facing;
    radiance += vec3(.98,.99,.9)*pow(primary,4.)*.28*facing;
    radiance += dispersion*(engraving*(.025+away*.16)+glitter*lobe*.4);
    if (kind > 3.5 && kind < 4.5) {
      radiance *= .72;
      radiance += vec3(.3,.83,1.)*pow(light,2.)*.25*away;
    }
    if (useMask > .5 && kind > .5) {
      vec3 rainbowFoil = foilColor(4.6+p.y*4.2-tilt.x*2.);
      radiance += rainbowFoil*(foilEtch*.3+engraving*.3)*(.12+.7*away);
    }
  }
  if (mode > 12.5 && mode < 13.5) {
    float mirror = exp(-dot(lightDelta,lightDelta)*5.5);
    float reflection = exp(-pow((q.x+q.y*.36-dot(tilt,vec2(.23,.2))-.48)*5.,2.));
    float facing = .48+.52*smoothstep(-.5,.4,dot(tilt,vec2(.5,.5)));
    radiance = vec3(1.,.99,.82)*(mirror*.30+reflection*.22)*facing;
    radiance += vec3(.9,.96,1.)*glitter*.1;
    radiance += vec3(1.,.99,.86)*pow(light,1.7)*.38*(1.-away);
  }
  if (mode > 13.5 && mode < 14.5) {
    float away = min(1.,length(tilt));
    float granular = hash(floor(q*vec2(620.,810.)));
    float relief = .5+.5*sin((q.x*.8+q.y)*1400.+noise(q*22.)*12.);
    vec3 flakeColor = .01+.99*pow(.5+.5*cos(3.14-tilt.x*1.5+p.y*2.4+vec3(0.,2.1,4.2)),vec3(2.));
    radiance = flakeColor*(.015+away*.3*softbox);
    radiance += flakeColor*pow(granular,5.)*(.06+away*1.65)*(.35+relief*.65);
    radiance += vec3(.85,.88,.9)*glitter*(.1+away*.8);
  }
  if (mode > 14.5 && mode < 15.5) {
    float wave = p.y + sin(p.x*23.)*.07 + sin(p.x*49.+p.y*9.)*.025;
    float carved = pow(.5+.5*cos(wave*165.),7.);
    float grain = pow(hash(floor(q*vec2(620.,810.))),3.);
    vec3 vivid = foilColor(3.7+p.y*1.8+tilt.x*1.5);
    radiance = vivid*(.1+grain*(.65+away*.8)+carved*.22)*(.7+away*.65);
    radiance += vec3(.65,1.,.94)*pow(light,.7)*(.12+away*.35);
  }
  if (mode > 1.5 && mode < 2.5) {
    float grit = pow(hash(floor(q*vec2(620.,810.))),4.);
    float swell = p.y+sin(p.x*22.)*.07+sin(p.x*43.+p.y*6.)*.025;
    float wave = pow(.5+.5*cos(swell*120.),6.);
    vec3 grains = foilColor(-1.+p.y*9.+tilt.x*1.5+sin(p.x*15.)*.3);
    float cloud = .3+.7*pow(.5+.5*sin(p.x*11.+p.y*7.+tilt.y),2.);
    radiance = grains*(grit*(.3+.7*light)*cloud+wave*(.025+.16*light));
    float spillBand = exp(-pow((p.y-.12+tilt.x*.07)*20.,2.));
    float bloom = exp(-pow((swell-.3-tilt.y*.09)*6.,2.));
    radiance += foilColor(.9+(p.y-.3)*8.+tilt.x*.3)*bloom*(.3+.4*light+wave*.4);
    radiance += vec3(.65,.95,1.)*(grit*(.22+.6*light)+spillBand*(.25+grit*.9));
  }
  if (mode < .5 && material.x > .1) {
    vec3 broad = foilColor(1.+p.y*5.8+tilt.x*2.2);
    radiance = broad*(.015+away*.95)*(.55+.45*light);
  }
  vec3 color = base.rgb*(1.-active*.12) + (1.-base.rgb*.6)*radiance*active;
  if (mode > 14.5 && mode < 15.5) {
    vec3 tint = foilColor(3.7+p.y*1.8+tilt.x*1.5);
    float paper = 1.-box(p,vec2(.08,.14),vec2(.92,.50));
    color = base.rgb*(mix(.45,.82,paper)+tint*mix(.65,.22,paper))+radiance*active*(.3+.6*base.rgb)*(.35+away*.5);
  }
  if (mode > 13.5 && mode < 14.5) color *= 1.-away*active*.14;
  if (mode > 11.5 && mode < 12.5) {
    float absorption = recipe.z*min(1.,length(tilt))*(.4+.6*(1.-light));
    color = base.rgb*(1.-active*absorption)+radiance*active*(.7+.3*base.rgb);
  }
  if (mode > 12.5 && mode < 13.5) color = base.rgb*(1.+radiance*active*.9);
  color += vec3(1.,.98,.93)*light*material.z*(mode < .5 ? (material.x < .1 ? 1.8 : .16) : .28);
  float edge = min(min(p.x,1.-p.x),min(p.y,1.-p.y));
  color += spectrum(.75+p.x*.9+p.y*.4+tilt.x*.2)*exp(-edge*250.)*.08;
  vec2 corner = abs(q-vec2(aspect,1.)*.5)-(vec2(aspect,1.)*.5-.03);
  float silhouette = 1.-smoothstep(-1./resolution.y,0.,length(max(corner,0.))-.03);
  float alpha = base.a*mix(1.,silhouette,roundCorners);
  gl_FragColor = vec4(mix(base.rgb,clamp(color,0.,1.),effectStrength)*alpha,alpha);
}
`;
