import { useEffect, useRef, useState } from 'react'
import { toast, useSonner, type Action, type ToastT, type ToasterProps } from 'sonner'
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon, XIcon } from 'lucide-react'

function Notice({ notice, paused, front, expanded }: { notice: ToastT; paused: boolean; front: boolean; expanded: boolean }) {
  const duration = Number.isFinite(notice.duration) ? Math.max(0, notice.duration!) : 4000
  const remaining = useRef(duration)
  useEffect(() => { remaining.current = duration }, [duration, notice.title, notice.type])
  useEffect(() => {
    if (paused) return
    const started = performance.now()
    const timer = window.setTimeout(() => { notice.onAutoClose?.(notice); toast.dismiss(notice.id) }, remaining.current)
    return () => { clearTimeout(timer); remaining.current = Math.max(0, remaining.current - (performance.now() - started)) }
  }, [paused, duration, notice])
  const action = notice.action && typeof notice.action === 'object' && 'label' in notice.action ? notice.action as Action : null
  const Icon = ({success: CircleCheckIcon, error: OctagonXIcon, warning: TriangleAlertIcon, loading: Loader2Icon} as const)[notice.type as 'success' | 'error' | 'warning' | 'loading'] || InfoIcon
  return <div className="app-notice" data-kind={notice.type || 'normal'} role={notice.type === 'error' ? 'alert' : 'status'} aria-hidden={!front && !expanded}>
    <span className="app-notice-icon" aria-hidden="true">{notice.icon || <Icon className={notice.type === 'loading' ? 'size-4 animate-spin' : 'size-4'} />}</span>
    <div className="app-notice-content">
      <div>{typeof notice.title === 'function' ? notice.title() : notice.title}</div>
      {notice.description && <div className="app-notice-description">{typeof notice.description === 'function' ? notice.description() : notice.description}</div>}
      {notice.action && <div>{action ? <button onClick={(e) => { action.onClick(e); toast.dismiss(notice.id) }}>{action.label}</button> : notice.action as React.ReactNode}</div>}
    </div>
    <button type="button" className="app-notice-close" aria-label="关闭此通知" tabIndex={front || expanded ? 0 : -1} onClick={() => { notice.onDismiss?.(notice); toast.dismiss(notice.id) }}><XIcon className="size-3.5" /></button>
  </div>
}

// 复用 Sonner 的公开通知队列；交互与计时独立，避免拖拽取消遗留暂停状态。
export function Toaster(_props: ToasterProps) {
  const { toasts } = useSonner()
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(document.hidden)
  const region = useRef<HTMLDivElement>(null)
  const expanded = hovered || focused
  useEffect(() => {
    const reset = () => { setHovered(false); setFocused(false) }
    const visibility = () => { setHidden(document.hidden); reset() }
    const outside = (e: PointerEvent) => { if (region.current && !region.current.contains(e.target as Node)) reset() }
    window.addEventListener('blur', reset)
    window.addEventListener('pointercancel', reset)
    document.addEventListener('visibilitychange', visibility)
    document.addEventListener('pointerdown', outside)
    return () => { window.removeEventListener('blur', reset); window.removeEventListener('pointercancel', reset); document.removeEventListener('visibilitychange', visibility); document.removeEventListener('pointerdown', outside) }
  }, [])
  useEffect(() => { if (!toasts.length) setHovered(false); if (!region.current?.contains(document.activeElement)) setFocused(false) }, [toasts.length])
  return <div ref={region} className="app-notices" data-expanded={expanded} role="region" aria-label="操作通知" onPointerEnter={(e) => {if (e.pointerType !== 'touch') setHovered(true)}} onPointerLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={(e) => {if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false)}} onKeyDown={(e) => {if (e.key === 'Escape') { e.stopPropagation(); const id = toasts[0]?.id; if (id !== undefined) toast.dismiss(id) }}}>
    {toasts.map((notice, index) => <div key={notice.id} className="app-notice-layer" data-front={index === 0} data-hidden={!expanded && index >= 3} style={{'--notice-index': index, zIndex: toasts.length - index} as React.CSSProperties} onPointerDown={(e) => {if (e.pointerType === 'touch' && !(e.target as HTMLElement).closest('button')) setHovered(true)}}>
      <Notice notice={notice} paused={expanded || hidden} front={index === 0} expanded={expanded} />
    </div>)}
  </div>
}
