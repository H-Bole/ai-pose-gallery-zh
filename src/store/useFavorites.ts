import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { idbRead, idbWrite } from '@/lib/idbStorage'
const KEY = 'pose_atlas_favorites_v1'
const keyOf = (category: string, item: {id: string; source?: string}) => JSON.stringify([category, item.source || 'gallery', item.id])
export function useFavorites(hydrated: boolean) {
  const [favorites, setFavorites] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [libraryBusy, setBusy] = useState(false)
  const busy = useRef(false)
  useEffect(() => {
    let active = true
    idbRead<string[]>(KEY).then((saved) => { if (active) {setFavorites(saved || []);setReady(true)} }).catch(() => {if (active) toast.error('收藏读取失败，已暂停写入以保护原数据')})
    return () => {active = false}
  }, [])
  const isFavorite = useCallback((category: string, item: {id: string; source?: string}) => favorites.includes(keyOf(category, item)), [favorites])
  const toggleFavorite = async (category: string, item: {id: string; source?: string}) => {
    if (!ready || !hydrated) {toast.info('请等待收藏恢复后再试');return false}
    if (busy.current) {toast.info('收藏正在保存，请稍后再试');return false}
    busy.current = true;setBusy(true)
    try {
      const key = keyOf(category, item)
      const next = favorites.includes(key) ? favorites.filter((x) => x !== key) : [...favorites, key]
      await idbWrite(KEY, next);setFavorites(next);return true
    } catch {toast.error('收藏保存失败，请检查浏览器存储空间');return false}
    finally {busy.current = false;setBusy(false)}
  }
  return {favorites, isFavorite, toggleFavorite, libraryReady: ready && hydrated, libraryBusy}
}
