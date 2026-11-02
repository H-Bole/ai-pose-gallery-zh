import { useEffect, useRef, type ReactNode, type PointerEvent } from 'react'
import { useMotion } from './motionContext'

export function TiltSurface({ children, className = '', disabled = false, onLightChange }: {
  children: ReactNode
  className?: string
  disabled?: boolean
  onLightChange?: (x: number, y: number) => void
}) {
  const { enabled } = useMotion()
  const ref = useRef<HTMLDivElement>(null)
  const frame = useRef(0)
  const reset = () => {
    cancelAnimationFrame(frame.current)
    ref.current?.style.removeProperty('--tilt-x')
    ref.current?.style.removeProperty('--tilt-y')
    ref.current?.removeAttribute('data-tilting')
  }
  useEffect(() => { if (!enabled || disabled) reset(); return () => cancelAnimationFrame(frame.current) }, [enabled, disabled])
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!enabled || disabled || e.pointerType !== 'mouse' || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      ref.current?.style.setProperty('--tilt-x', `${(0.5 - y) * 12}deg`)
      ref.current?.style.setProperty('--tilt-y', `${(x - 0.5) * 14}deg`)
      ref.current?.setAttribute('data-tilting', 'true')
      onLightChange?.(x, y)
    })
  }
  return <div ref={ref} className={`tilt-surface ${className}`} onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset}>{children}</div>
}
