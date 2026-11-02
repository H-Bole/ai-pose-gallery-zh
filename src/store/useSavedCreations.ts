import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { isNsfwCostume, isNsfwPose } from '@/api/gallery'
import { idbRead, idbWrite } from '@/lib/idbStorage'
import { durableImage, restoreGeneration, restoreRecipe } from '@/lib/generationSnapshot'
import { normalizeCardPresentation, type CardPresentation } from '@/types/cards'
import type { ApiConfig, GenerationHistoryItem, RecipeState, SavedCreation } from '@/types/gallery'
const KEY = 'pose_atlas_creations_v1'
export function useSavedCreations(input: {
  hydrated: boolean; config: ApiConfig; safeMode: boolean
  setRecipe: (recipe: RecipeState) => void; setConfig: (config: ApiConfig) => void
  setPrompt: (prompt: string) => void; unlock: (callback: () => void) => void
}) {
  const [creations, setCreations] = useState<SavedCreation[]>([])
  const [ready, setReady] = useState(false)
  const [creationBusy, setBusy] = useState(false)
  const current = useRef(creations)
  const latest = useRef(input)
  useEffect(() => { latest.current = input }, [input])
  const busy = useRef(false)
  useEffect(() => {
    let active = true
    idbRead<SavedCreation[]>(KEY).then((saved) => {
      if (active) { current.current = saved || []; setCreations(saved || []); setReady(true) }
    }).catch(() => toast.error('作品库读取失败，已暂停写入以保护原数据'))
    return () => { active = false }
  }, [])
  const write = async <T,>(action: () => Promise<T>): Promise<T> => {
    if (!ready || !input.hydrated) throw new Error('作品库尚未恢复，请稍后再试')
    if (busy.current) throw new Error('作品正在保存，请稍后再试')
    busy.current = true; setBusy(true)
    try { return await action() } finally { busy.current = false; setBusy(false) }
  }
  const persist = async (next: SavedCreation[]) => {
    await idbWrite(KEY, next)
    current.current = next; setCreations(next)
  }
  const saveCreation = (result: GenerationHistoryItem, name: string) => write(async () => {
    if (!name.trim()) throw new Error('请填写作品名称')
    const imageUrl = await durableImage(result.imageUrl)
    const existing = current.current.find((x) => x.result.id === result.id)
    const item: SavedCreation = { ...existing, id: existing?.id || crypto.randomUUID(), name: name.trim(), createdAt: existing?.createdAt || Date.now(), result: {...structuredClone(result), imageUrl} }
    await persist([item, ...current.current.filter((x) => x.id !== item.id)])
    return item.id
  })
  const renameCreation = (id: string, name: string) => write(async () => {
    if (!name.trim()) throw new Error('请填写作品名称')
    await persist(current.current.map((x) => x.id === id ? {...x, name: name.trim()} : x))
  })
  const deleteCreation = (id: string) => write(() => persist(current.current.filter((x) => x.id !== id)))
  const savePresentation = (id: string, presentation: CardPresentation) => write(async () => {
    if (!current.current.some((x) => x.id === id)) throw new Error('该作品已不存在，无法保存样式')
    await persist(current.current.map((x) => x.id === id ? {...x, presentation: normalizeCardPresentation(presentation)} : x))
  })
  const loadCreation = (id: string) => {
    const snapshot = current.current.find((x) => x.id === id)?.result.snapshot
    if (!snapshot) { toast.info('这张旧作品没有完整生成配方，仍可查看、制卡和继续创作'); return }
    const load = () => {
      latest.current.setRecipe(restoreRecipe(snapshot))
      latest.current.setPrompt(snapshot.prompt)
      latest.current.setConfig(restoreGeneration(latest.current.config, snapshot))
      toast.success('已载入生成配方，保留当前连接地址和密钥')
    }
    const recipe = snapshot.recipe
    if (input.safeMode && ((recipe.costume && isNsfwCostume(recipe.costume)) || (recipe.pose && isNsfwPose(recipe.pose)))) input.unlock(load)
    else load()
  }
  return {creations, creationsReady: ready && input.hydrated, creationBusy, saveCreation, renameCreation, deleteCreation, savePresentation, loadCreation}
}
