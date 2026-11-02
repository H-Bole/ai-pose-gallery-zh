import { useEffect, useRef, type ReactNode } from 'react'
import { useMotion } from './motionContext'

/** 用事件计数触发提示，保留子树及表单焦点，不通过重建内容播放动画。 */
export function RevealSurface({ eventKey, children, className = '' }: {
  eventKey: number
  children: ReactNode
  className?: string
}) {
  const { enabled } = useMotion()
  const surface = useRef<HTMLDivElement>(null)
  const previousEvent = useRef(eventKey)

  useEffect(() => {
    const changed = previousEvent.current !== eventKey
    previousEvent.current = eventKey
    if (!changed || !enabled || !surface.current?.animate) return
    const animation = surface.current.animate([
      { transform: 'perspective(1000px) rotateX(-8deg) translateY(5px)', opacity: .78 },
      { transform: 'perspective(1000px) rotateX(1deg) translateY(0)', opacity: 1, offset: .7 },
      { transform: 'perspective(1000px) rotateX(0deg) translateY(0)', opacity: 1 },
    ], { duration: 280, easing: 'cubic-bezier(.2,.7,.3,1)' })
    return () => animation.cancel()
  }, [eventKey, enabled])

  return <div ref={surface} className={className}>{children}</div>
}
