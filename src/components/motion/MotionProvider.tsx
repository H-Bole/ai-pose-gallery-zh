import { useEffect, useState, type ReactNode } from 'react'
import { MotionContext, useMotion, type MotionMode } from './motionContext'

export function MotionProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<MotionMode>(() => {
    try { const saved = localStorage.getItem('gallery-motion'); return saved === 'on' || saved === 'off' ? saved : 'auto' } catch { return 'auto' }
  })
  const [reduced, setReduced] = useState(true)
  const [finePointer, setFinePointer] = useState(false)
  const enabled = !reduced && mode !== 'off' && (mode === 'on' || finePointer)
  useEffect(() => {
    const root = document.documentElement
    const previous = root.getAttribute('data-gallery-motion')
    root.setAttribute('data-gallery-motion', enabled ? 'on' : 'off')
    return () => {
      if (previous === null) root.removeAttribute('data-gallery-motion')
      else root.setAttribute('data-gallery-motion', previous)
    }
  }, [enabled])
  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const pointer = matchMedia('(hover: hover) and (pointer: fine)')
    const update = () => { setReduced(motion.matches); setFinePointer(pointer.matches) }
    update()
    motion.addEventListener('change', update); pointer.addEventListener('change', update)
    return () => { motion.removeEventListener('change', update); pointer.removeEventListener('change', update) }
  }, [])
  const changeMode = (next: MotionMode) => {
    setMode(next)
    try { localStorage.setItem('gallery-motion', next) } catch { /* 本次会话仍可使用 */ }
  }
  return <MotionContext.Provider value={{ mode, setMode: changeMode, enabled }}>{children}</MotionContext.Provider>
}

export function MotionToggle({ className = '' }: { className?: string }) {
  const { mode, setMode } = useMotion()
  return <label className={`motion-toggle ${className}`}><span>动态效果</span><select aria-label="动态效果" value={mode} onChange={e => setMode(e.target.value as MotionMode)}><option value="auto">自动</option><option value="on">开启</option><option value="off">关闭</option></select></label>
}
