export class HoloCard {
  constructor(canvas: HTMLCanvasElement, options: { image: string; preset: string; width?: number; aspect?: number | 'image' })
  ready: Promise<void>
  gl: WebGLRenderingContext | null
  error?: string
  setImage(url: string): Promise<void>
  setMask(url: string): Promise<void>
  setPreset(id: string): void
  setEffectStrength(value: number): boolean
  setPose(x: number, y: number, options?: { immediate?: boolean; reducedMotion?: boolean }): void
  resize(width?: number): void
  flush(): void
  exportPng(options?: { longEdge?: number; pose?: { x: number; y: number }; strength?: number }): Promise<Blob>
  dispose(): void
}
