import { catalog } from '@/vendor/holocardlab/catalog.js'
import { resolvePreset, strengthEffectIds } from '@/vendor/holocardlab/presets.js'

export const materialGroups = ['通用覆膜', '经典闪膜', '颗粒与纹理', '虹彩', '金银', '雕纹', '画廊'] as const
const groupNames: Record<string, typeof materialGroups[number]> = {
  基础: '经典闪膜', 经典: '经典闪膜', 纹理: '颗粒与纹理', 彩虹: '虹彩',
  金银: '金银', 'V 系': '雕纹', 画廊: '画廊', 特别: '虹彩', 全息: '通用覆膜', 通用覆膜: '通用覆膜',
}
export const cardMaterials = catalog.filter((item) => !['other-dark-emboss', 'other-silver-engraving'].includes(item.id)).map((item) => {
  const preset = resolvePreset(item.id)
  const variants = [item.masked && '分区覆膜', /-stage(?:-|$)/.test(item.id) && '扩展画窗', /-trainer(?:-|$)/.test(item.id) && '下部画窗', /-item(?:-|$)/.test(item.id) && '道具画窗', /-lightning/.test(item.id) && '亮彩', /-darkness/.test(item.id) && '深色', item.id.startsWith('reverse-holo-') && /-metal/.test(item.id) && '金属', preset.aliasOf && '变体'].filter(Boolean)
  return {
    id: item.id, label: preset.label, variant: variants.join(' · ') || '标准',
    group: groupNames[preset.family] || '颗粒与纹理', recipeId: preset.recipeId,
    adjustable: strengthEffectIds.includes(item.id), masked: item.masked,
    thumbnail: `/card-materials/thumbnails/${item.id}.png`,
  }
})
export type CardMaterial = typeof cardMaterials[number]
export const materialById = (id?: string) => cardMaterials.find((item) => item.id === id)

export function readMaterialStrength(id: string): number {
  try {
    const stored = localStorage.getItem(`yixtk-material-strength:${id}`)
    const value = stored === null ? .6 : Number(stored)
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : .6
  } catch { return .6 }
}

export function rememberMaterialStrength(id: string, value: number) {
  try { localStorage.setItem(`yixtk-material-strength:${id}`, String(value)) } catch { /* 本次编辑仍然可用。 */ }
}
