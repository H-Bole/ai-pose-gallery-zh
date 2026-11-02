import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { toast } from 'sonner'
import { isNsfwCostume, isNsfwPose } from '@/api/gallery'
import { idbRead, idbWrite } from '@/lib/idbStorage'
import { durableImage, durableRecipe } from '@/lib/generationSnapshot'
import { uploadedReferences } from '@/lib/recipeImages'
import type { ApiConfig, ImageProviderId, RecipeState, SavedOutfit } from '@/types/gallery'

const FAVORITES = 'pose_atlas_favorites_v1'
const OUTFITS = 'pose_atlas_outfits_v1'
const keyOf = (category: string, item: {id: string; source?: string}) => JSON.stringify([category, item.source || 'gallery', item.id])
export function useCreativeLibrary(input: {
  hydrated: boolean
  recipe: RecipeState; config: ApiConfig; prompt: string | null; safeMode: boolean
  setRecipe: Dispatch<SetStateAction<RecipeState>>
  setPoseDepthMode: (value: boolean) => void
  setConfig: (config: ApiConfig) => void
  setPrompt: (prompt: string | null) => void
  unlock: (callback: () => void) => void
}) {
  const [favorites, setFavorites] = useState<string[]>([])
  const [outfits, setOutfits] = useState<SavedOutfit[]>([])
  const [loaded, setReady] = useState(false)
  const libraryReady = loaded && input.hydrated
  const [libraryBusy, setBusy] = useState(false)
  const latestRecipe = useRef(input.recipe)
  useEffect(() => { latestRecipe.current = input.recipe }, [input.recipe])
  const busy = useRef(false)
  useEffect(() => {
    let active = true
    Promise.all([idbRead<string[]>(FAVORITES), idbRead<SavedOutfit[]>(OUTFITS)]).then(([f, o]) => {
      if (active) { setFavorites(f || []); setOutfits(o || []); setReady(true) }
    }).catch(() => { if (active) toast.error('收藏与搭配读取失败，已暂停保存以保护原数据') })
    return () => { active = false }
  }, [])
  const write = async (action: () => Promise<void>) => {
    if (!libraryReady) { toast.error('浏览器数据尚未恢复'); return }
    if (busy.current) { toast.info('正在保存，请稍后再试'); return }
    busy.current = true
    setBusy(true)
    try { await action() } catch (e) { toast.error(e instanceof Error ? `保存失败：${e.message}` : '保存失败，请检查浏览器存储空间') }
    finally { busy.current = false; setBusy(false) }
  }
  const isFavorite = useCallback((category: string, item: {id: string; source?: string}) => favorites.includes(keyOf(category, item)), [favorites])
  const toggleFavorite = (category: string, item: {id: string; source?: string}) => write(async () => {
    const key = keyOf(category, item)
    const next = favorites.includes(key) ? favorites.filter((x) => x !== key) : [...favorites, key]
    await idbWrite(FAVORITES, next)
    setFavorites(next)
  })
  const saveOutfit = (name: string) => write(async () => {
    if (!name.trim()) return
    const { providers, ...settings } = input.config
    const models = Object.fromEntries(Object.entries(providers).map(([key, value]) => [key, {model: value.model, customModel: value.customModel}])) as SavedOutfit['models']
    const next = [{ id: crypto.randomUUID(), name: name.trim(), recipe: await durableRecipe(input.recipe), prompt: input.prompt, settings, models }, ...outfits]
    await idbWrite(OUTFITS, next)
    setOutfits(next)
    toast.success('搭配已保存')
  })
  const loadOutfit = (id: string) => {
    if (!libraryReady || busy.current) { toast.info('请等待数据恢复或保存完成'); return }
    const item = outfits.find((x) => x.id === id)
    if (!item) return
    const load = () => {
      input.setRecipe(item.recipe)
      input.setPoseDepthMode(Boolean(item.recipe.pose?.useDepth))
      input.setPrompt(item.prompt)
      input.setConfig({ ...input.config, ...item.settings, providers: Object.fromEntries(Object.entries(input.config.providers).map(([key, value]) => [key, {...value, ...item.models[key as ImageProviderId]}])) as ApiConfig['providers'] })
      toast.success('已载入搭配，保留当前连接地址和密钥')
    }
    if (input.safeMode && ((item.recipe.costume && isNsfwCostume(item.recipe.costume)) || (item.recipe.pose && isNsfwPose(item.recipe.pose)))) input.unlock(load)
    else load()
  }
  const renameOutfit = (id: string, name: string) => write(async () => {
    if (!name.trim()) return
    const next = outfits.map((x) => x.id === id ? {...x, name: name.trim()} : x)
    await idbWrite(OUTFITS, next); setOutfits(next); toast.success('搭配已改名')
  })
  const deleteOutfit = (id: string) => write(async () => {
    const next = outfits.filter((x) => x.id !== id)
    await idbWrite(OUTFITS, next); setOutfits(next); toast.success('搭配已删除')
  })
  const setResultAsPortrait = (url: string) => write(async () => {
    const image = await durableImage(url)
    const portrait = uploadedReferences('成品继续创作', image, 0, 0, 0).portrait
    // 只替换人像，保留下载期间对其他参考的修改；配方由 Provider 持久化。
    await idbWrite('pose_atlas_recipe_v3', {...latestRecipe.current, portrait})
    input.setRecipe((current) => ({...current, portrait}))
    toast.success('已作为人像参考，其他参考与参数保留')
  })
  return {libraryReady, libraryBusy, favorites, isFavorite, toggleFavorite, outfits, saveOutfit, loadOutfit, renameOutfit, deleteOutfit, setResultAsPortrait}
}
