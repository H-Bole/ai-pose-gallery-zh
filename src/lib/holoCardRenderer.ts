import { HoloCard } from '@/vendor/holocardlab/renderer.js'
import { cardPngBlob, renderCard } from './cardRenderer'
import { materialById } from './cardMaterials'
import type { CardPresentation } from '@/types/cards'

export async function cardBaseBlob(image: HTMLImageElement, presentation: CardPresentation, longEdge: number) {
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  try {
    renderCard(canvas, image, presentation, longEdge)
    return await cardPngBlob(canvas)
  } finally { canvas.width = canvas.height = 0 }
}

export async function exportCardPng(image: HTMLImageElement, presentation: CardPresentation, longEdge = 2048) {
  const base = await cardBaseBlob(image, presentation, longEdge)
  if (presentation.engine !== 'holocardlab' || !presentation.effectId) return base
  const material = materialById(presentation.effectId)
  if (!material) throw new Error('此卡面材质暂不可用，原有样式与编辑内容已保留。')
  const imageURL = URL.createObjectURL(base)
  const canvas = document.createElement('canvas')
  let card: HoloCard | undefined
  try {
    card = new HoloCard(canvas, { image: imageURL, preset: material.id, width: 1, aspect: 'image' })
    await card.ready
    if (material.masked) await card.setMask(`${location.origin}/card-materials/mask.svg`)
    return await card.exportPng({ longEdge, pose: { x: presentation.lightX, y: presentation.lightY }, strength: material.adjustable ? presentation.effectStrength ?? .6 : 1 })
  } finally {
    const gl = card?.gl
    card?.dispose()
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    canvas.width = canvas.height = 0
    URL.revokeObjectURL(imageURL)
  }
}

export function blobDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('无法保存卡面预览，编辑内容已保留。'))
    reader.readAsDataURL(blob)
  })
}
