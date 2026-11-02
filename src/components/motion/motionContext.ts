import { createContext, useContext } from 'react'

export type MotionMode = 'auto' | 'on' | 'off'
export const MotionContext = createContext({ mode: 'auto' as MotionMode, setMode: (_mode: MotionMode) => {}, enabled: false })
export const useMotion = () => useContext(MotionContext)
