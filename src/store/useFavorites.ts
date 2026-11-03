import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '@/lib/notifications'
import { idbRead, idbWrite } from '@/lib/idbStorage'
const KEY = 'pose_atlas_favorites_v1'
interface FavoriteItem { id: string; source?: string; selectedView?: string; views?: Array<{id: string}> }
const identityOf = (category: string, item: FavoriteItem) => JSON.stringify([category, item.source || 'gallery', item.id])
function keyOf(category: string, item: FavoriteItem) {
  const parts = [category, item.source || 'gallery', item.id]
  if (category === 'costume' && item.views && item.views.length > 1) {
    const view = item.views.find((view) => view.id === item.selectedView) || item.views.find((view) => view.id === 'front') || item.views[0]
    parts.push(view.id)
  }
  return JSON.stringify(parts)
}
function parseFavorite(key: string): { identity: string; view?: string } | null {
  try {
    const parts: unknown = JSON.parse(key)
    if (!Array.isArray(parts) || parts.length < 3 || !parts.slice(0, 3).every((part) => typeof part === 'string')) return null
    return { identity: JSON.stringify(parts.slice(0, 3)), view: parts[0] === 'costume' && typeof parts[3] === 'string' ? parts[3] : undefined }
  } catch { return null }
}
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
  const indexed = useMemo(() => {
    const entries = new Map<string, {view?: string}>()
    for (const key of favorites) {
      const entry = parseFavorite(key)
      if (entry && (!entries.has(entry.identity) || entry.view)) entries.set(entry.identity, {view: entry.view})
    }
    return entries
  }, [favorites])
  const isFavorite = useCallback((category: string, item: FavoriteItem) => indexed.has(identityOf(category, item)), [indexed])
  const favoriteView = useCallback((category: string, item: FavoriteItem) => indexed.get(identityOf(category, item))?.view, [indexed])
  const toggleFavorite = async (category: string, item: FavoriteItem) => {
    if (!ready || !hydrated) {toast.info('请等待收藏恢复后再试');return false}
    if (busy.current) {toast.info('收藏正在保存，请稍后再试');return false}
    busy.current = true;setBusy(true)
    try {
      const identity = identityOf(category, item)
      const next = indexed.has(identity) ? favorites.filter((key) => parseFavorite(key)?.identity !== identity) : [...favorites, keyOf(category, item)]
      await idbWrite(KEY, next);setFavorites(next);return true
    } catch {toast.error('收藏保存失败，请检查浏览器存储空间');return false}
    finally {busy.current = false;setBusy(false)}
  }
  return {favorites, isFavorite, favoriteView, toggleFavorite, libraryReady: ready && hydrated, libraryBusy}
}
