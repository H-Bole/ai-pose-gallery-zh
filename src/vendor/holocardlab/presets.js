// SPDX-License-Identifier: MIT
// Optical recipes; MIT prism/oil adaptations are documented in THIRD_PARTY_NOTICES.md.
const recipes = [
  ['basic', '基础覆膜', '基础', 'plain', 'full', 0, 0, 0.12, 0, 0.7],
  ['reverse-holo', '反向闪膜', '经典', 'mirror', 'reverse', .9, .06, .2, .1, 1.1],
  ['regular-holo', '经典柱状闪', '经典', 'diffraction', 'art', .8, .08, .13, .08, 1.35],
  ['cosmos-holo', '宇宙星尘', '经典', 'cosmos', 'art', .6, .65, .17, .05, .8],
  ['amazing-rare', '溢彩稀有', '纹理', 'grain', 'spill', .85, .8, .2, .3, 1.5],
  ['radiant-holo', '辉耀交织', '纹理', 'diamond', 'full', .85, .12, .13, .7, 1.2],
  ['v-regular', 'V 双向衍射', 'V 系', 'anisotropic', 'full', .85, .26, .15, .18, 1.6],
  ['v-full-art', 'V 全画雕纹', 'V 系', 'anisotropic', 'full', .84, .22, .14, .4, 1.35],
  ['v-alternate', 'V 异画流线', 'V 系', 'anisotropic', 'full', .82, .25, .14, .5, 1.1],
  ['v-max', 'VMAX 浮雕', 'V 系', 'anisotropic', 'full', .9, .32, .14, .65, .7],
  ['v-star', 'VSTAR 珍珠', 'V 系', 'anisotropic', 'full', .87, .3, .14, .62, 1],
  ['rainbow-holo', '彩虹微粒', '彩虹', 'pastel-grain', 'full', .78, .65, .12, .18, .8],
  ['rainbow-alt', '异画虹彩', '彩虹', 'prismatic-grain', 'full', .92, .9, .15, .65, 1.5],
  ['secret-rare', '秘藏鎏金', '金银', 'hatch', 'full', .78, .56, .18, .65, .7],
  ['shiny-rare', '闪色银雕', '金银', 'anisotropic', 'art', .8, .28, .15, .52, 1.2],
  ['shiny-v', '闪色 V 银箔', '金银', 'anisotropic', 'full', .86, .32, .15, .7, 1.5],
  ['shiny-vmax', '闪色 VMAX', '金银', 'wave-foil', 'full', .94, .9, .17, .6, .9],
  ['trainer-full-art', '训练家全画', '画廊', 'anisotropic', 'full', .84, .22, .16, .68, 1.3],
  ['trainer-gallery-holo', '画廊金属闪', '画廊', 'plain', 'inner', .68, .05, .25, .04, .7],
  ['trainer-gallery-secret-rare', '画廊黑金', '画廊', 'hatch', 'full', .85, .75, .17, .82, 1],
  ['trainer-gallery-v-regular', '画廊 V 雕刻', '画廊', 'anisotropic', 'full', .83, .24, .13, .8, 1.2],
  ['trainer-gallery-v-max', '画廊 VMAX 虹彩', '画廊', 'prismatic-grain', 'full', .92, .85, .15, .7, .85],
  ['swsh-pikachu', '纪念虹光', '特别', 'pastel-grain', 'full', .9, .8, .15, .55, 1.1],
  ['other-dark-emboss', '暗金浮雕', '浮雕', 'dark-relief', 'full', .94, .08, .10, .9, .7],
  ['other-silver-engraving', '银质雕花', '浮雕', 'silver-relief', 'full', .94, .12, .10, .8, .5],
  ['other-prism-holo', '棱镜全息', '全息', 'prism-facet', 'full', .84, .15, .12, .6, 1.2],
  ['other-oil-film', '油膜镭射', '全息', 'oil-interference', 'full', .86, .05, .10, .3, .8],
  ['other-pearl-coat', '珠光覆膜', '通用覆膜', 'pearl-coat', 'full', .7, .05, .15, 0, .5],
  ['other-brushed-metal', '拉丝金属', '通用覆膜', 'brushed-metal', 'full', .7, .05, .18, 0, .3],
  ['other-fractured-foil', '碎箔反光', '通用覆膜', 'fractured-foil', 'full', .75, .15, .13, 0, 1.2],
  ['other-fine-glitter', '细闪覆膜', '通用覆膜', 'fine-glitter', 'full', .7, .75, .12, 0, .6],
  ['other-gloss-coat', '亮面清漆', '通用覆膜', 'gloss-coat', 'full', .7, 0, .2, 0, 0],
  ['other-grating-sweep', '光栅扫光', '通用覆膜', 'grating-sweep', 'full', .75, .03, .12, 0, 1.3],
];

export const patterns = Object.freeze(['plain', 'diffraction', 'grain', 'cosmos', 'diamond', 'contour', 'rays', 'foil', 'hatch', 'stars', 'fine-etch', 'pastel-grain', 'anisotropic', 'mirror', 'prismatic-grain', 'wave-foil', 'dark-relief', 'silver-relief', 'prism-facet', 'oil-interference', 'pearl-coat', 'brushed-metal', 'fractured-foil', 'fine-glitter', 'gloss-coat', 'grating-sweep']);
export const strengthEffectIds = Object.freeze([
  'other-prism-holo', 'other-oil-film', 'other-pearl-coat', 'other-brushed-metal',
  'other-fractured-foil', 'other-fine-glitter', 'other-gloss-coat', 'other-grating-sweep',
]);
const microSurfaces = {
  'v-regular': [2.8,.08,.9,.24], 'v-full-art': [3.1,.105,.88,1.84],
  'v-alternate': [3.2,.095,.82,2.9], 'v-max': [2.7,.12,.9,3.92],
  'v-star': [.95,.16,.8,4.9], 'trainer-full-art': [3.3,.105,.82,5.88],
  'trainer-gallery-v-regular': [3.15,.09,.8,6.9],
  'shiny-rare': [3.4,.04,.65,7.7], 'shiny-v': [3.1,.055,.72,8.85],
};
export const regions = Object.freeze(['full', 'art', 'reverse', 'spill', 'inner', 'stage', 'trainer', 'stage-reverse', 'trainer-reverse', 'masked']);
export const presets = recipes.map(([id, label, family, pattern, region, strength, glitter, glare, emboss, dispersion]) => Object.freeze({
  id, label, family, pattern, region, strength, glitter, glare, emboss, dispersion,
  micro: Object.freeze(microSurfaces[id] || [3,.08,.7,.5]),
  absorption: id === 'v-star' ? .44 : id === 'shiny-v' ? .28 : id === 'trainer-gallery-secret-rare' ? .4 : .12,
  metal: id.includes('secret') ? 'gold' : id.startsWith('shiny') || id === 'v-star' ? 'silver' : 'spectrum',
  description: `${label} · ${region === 'art' ? '画窗' : region === 'reverse' ? '画窗外' : '卡面'}光学材质`,
}));
export default presets;

// Aliases deliberately share optics; stage / trainer entries change coating geometry.
const aliases = { 'v-union': 'v-regular', 'trainer-gallery-holo-rarity-alias': 'trainer-gallery-holo', 'promo-swsh020': 'trainer-gallery-holo', 'promo-swsh145': 'secret-rare' };
export function resolvePreset(id) {
  const masked = id.endsWith('-masked');
  const name = masked ? id.slice(0,-7) : id;
  let source = aliases[name] || name;
  let surface = '';
  if (source.startsWith('reverse-holo-')) {
    for (const type of ['lightning', 'darkness', 'metal']) {
      if (source.endsWith(`-${type}`)) { surface = type; source = source.slice(0,-type.length-1); break; }
    }
  }
  let variant = '';
  for (const suffix of ['-stage', '-trainer', '-item']) {
    if (source.endsWith(suffix)) { variant = suffix.slice(1); source = source.slice(0,-suffix.length); break; }
  }
  const base = presets.find(p => p.id === source);
  if (!base) throw new TypeError(`未知材质：${id}`);
  let region = base.region;
  if (variant === 'stage') region = source === 'reverse-holo' ? 'stage-reverse' : 'stage';
  if (variant === 'trainer' || variant === 'item') region = source === 'reverse-holo' ? 'trainer-reverse' : 'trainer';
  const strength = surface === 'lightning' ? .74 : surface === 'darkness' ? .84 : surface === 'metal' ? .7 : base.strength;
  const metal = surface === 'metal' ? 'silver' : base.metal;
  return Object.freeze({ ...base, id, recipeId: source, region, masked, strength, metal, aliasOf: aliases[name] || null });
}
