export interface CardPresentation {
  version?: 2
  engine?: 'holocardlab'
  effectId?: string
  effectStrength?: number
  layout: 'original' | 'collectible' | 'player'
  finish: 'none' | 'foil' | 'emboss' | 'holo'
  title: string
  subtitle: string
  number: string
  fit: 'contain' | 'cover'
  cropX: number
  cropY: number
  lightX: number
  lightY: number
}

export const DEFAULT_CARD_PRESENTATION: CardPresentation = {
  layout: 'original', finish: 'none', title: '', subtitle: '', number: '',
  fit: 'contain', cropX: 0.5, cropY: 0.5, lightX: 0.35, lightY: 0.25,
}

export function normalizeCardPresentation(value?: Partial<CardPresentation>): CardPresentation {
  const p = { ...DEFAULT_CARD_PRESENTATION, ...value }
  const unit = (n: number, fallback: number) => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback
  return {
    ...p,
    layout: ['original', 'collectible', 'player'].includes(p.layout) ? p.layout : 'original',
    finish: ['none', 'foil', 'emboss', 'holo'].includes(p.finish) ? p.finish : 'none',
    fit: p.fit === 'cover' ? 'cover' : 'contain',
    title: typeof p.title === 'string' ? p.title.slice(0, 48) : '',
    subtitle: typeof p.subtitle === 'string' ? p.subtitle.slice(0, 72) : '',
    number: typeof p.number === 'string' ? p.number.slice(0, 16) : '',
    cropX: unit(p.cropX, .5), cropY: unit(p.cropY, .5),
    lightX: unit(p.lightX, .35), lightY: unit(p.lightY, .25),
    ...(p.engine === 'holocardlab' && typeof p.effectId === 'string' ? {
      version: 2 as const, engine: 'holocardlab' as const, effectId: p.effectId,
      effectStrength: unit(p.effectStrength ?? .6, .6), finish: 'none' as const,
    } : { version: undefined, engine: undefined, effectId: undefined, effectStrength: undefined }),
  }
}
