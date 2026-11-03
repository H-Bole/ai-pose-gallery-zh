import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { toast } from '@/lib/notifications'
import { isNsfwCostume, isNsfwPose } from '@/api/gallery'
import { idbRead, idbWrite } from '@/lib/idbStorage'
import { durableImage, durableRecipe } from '@/lib/persistentImages'
import { useFavorites } from './useFavorites'
import { uploadedReferences } from '@/lib/recipeImages'
import type { ApiConfig, ImageProviderId, RecipeState, SavedOutfit } from '@/types/gallery'

const OUTFITS = 'pose_atlas_outfits_v1'
export function useCreativeLibrary(input: {
  hydrated: boolean
  recipe: RecipeState; config: ApiConfig; prompt: string | null; safeMode: boolean
  setRecipe: Dispatch<SetStateAction<RecipeState>>
  setPoseDepthMode: (value: boolean) => void
  setConfig: (config: ApiConfig) => void
  setPrompt: (prompt: string | null) => void
  unlock: (callback: () => void) => void
}) {
  const favoriteState = useFavorites(input.hydrated)
  const [outfits, setOutfits] = useState<SavedOutfit[]>([])
  const [loaded, setReady] = useState(false)
  const libraryReady = loaded && input.hydrated
  const [libraryBusy, setBusy] = useState(false)
  const latestConfig = useRef(input.config)
  useEffect(() => { latestConfig.current = input.config }, [input.config])
  const latestRecipe = useRef(input.recipe)
  useEffect(() => { latestRecipe.current = input.recipe }, [input.recipe])
  const busy = useRef(false)
  useEffect(() => {
    let active = true
    idbRead<SavedOutfit[]>(OUTFITS).then((o) => {
      if (active) { setOutfits(o || []); setReady(true) }
    }).catch(() => { if (active) toast.error('收藏与搭配读取失败，已暂停保存以保护原数据') })
    return () => { active = false }
  }, [])
  const write = async (action: () => Promise<void>) => {
    if (!libraryReady) { toast.error('浏览器数据尚未恢复'); return false }
    if (busy.current) { toast.info('正在保存，请稍后再试'); return false }
    busy.current = true
    setBusy(true)
    try { await action(); return true } catch (e) { toast.error(e instanceof Error ? `保存失败：${e.message}` : '保存失败，请检查浏览器存储空间'); return false }
    finally { busy.current = false; setBusy(false) }
  }
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
      input.setConfig({ ...latestConfig.current, ...item.settings, providers: Object.fromEntries(Object.entries(latestConfig.current.providers).map(([key, value]) => [key, {...value, ...item.models[key as ImageProviderId]}])) as ApiConfig['providers'] })
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
  return {...favoriteState, libraryReady: libraryReady && favoriteState.libraryReady, libraryBusy: libraryBusy || favoriteState.libraryBusy, outfits, saveOutfit, loadOutfit, renameOutfit, deleteOutfit, setResultAsPortrait}
}
