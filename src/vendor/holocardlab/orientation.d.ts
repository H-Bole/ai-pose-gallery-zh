export class OrientationInput {
  constructor(options: { onPose: (x: number, y: number) => void; onState: (state: { status: string; message: string }) => void })
  readonly active: boolean
  start(): Promise<boolean>
  calibrate(): void
  stop(message?: string): void
  dispose(): void
}
