import type { ApiConfig, GenerationSnapshot, ImageProviderId, RecipeState } from '@/types/gallery'
import { workflowIdentity } from './comfyWorkflowParameters'
import { referenceImageUrl } from './recipeImages'

export async function durableImage(url: string): Promise<string> {
  if (url.startsWith('data:image/')) return url
  const response = await fetch(referenceImageUrl(url))
  if (!response.ok) throw new Error('图片下载失败')
  const blob = await response.blob()
  if (!blob.type.startsWith('image/')) throw new Error('引用不是图片')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(blob)
  })
}
export async function durableRecipe(recipe: RecipeState) {
  const next = structuredClone(recipe)
  for (const item of [next.portrait, next.costume, next.pose]) {
    if (item?.source === 'upload') {
      item.原图 = await durableImage(item.原图)
      item.缩略图 = item.原图
      if ('预览图' in item) item.预览图 = item.原图
    }
  }
  for (const image of [...(next.extraImages || []), ...Object.values(next.workflowImages || {})]) image.url = await durableImage(image.url)
  return next
}

export async function snapshotGeneration(recipe: RecipeState, config: ApiConfig, prompt: string): Promise<GenerationSnapshot> {
  const {providers, ...settings} = structuredClone(config)
  const models = Object.fromEntries(Object.entries(providers).map(([key, value]) => [key, {model: value.model, customModel: value.customModel}])) as GenerationSnapshot['models']
  return {recipe: await durableRecipe(recipe), prompt, settings, models}
}
export function restoreGeneration(config: ApiConfig, snapshot: Pick<GenerationSnapshot, 'settings' | 'models' | 'submittedWorkflowJson'>): ApiConfig {
  const settings = structuredClone(snapshot.settings)
  if (snapshot.submittedWorkflowJson && settings.activeProvider === 'comfyui') settings.comfyuiParams = {...settings.comfyuiParams, workflowJson: snapshot.submittedWorkflowJson, parameterOverrides: undefined}
  return {...config, ...settings, providers: Object.fromEntries(Object.entries(config.providers).map(([key, value]) => [key, {...value, ...snapshot.models[key as ImageProviderId]}])) as ApiConfig['providers']}
}

export function restoreRecipe(snapshot: GenerationSnapshot): RecipeState {
  const recipe = structuredClone(snapshot.recipe)
  if (snapshot.submittedWorkflowJson && recipe.workflowImagesIdentity === workflowIdentity(snapshot.settings.comfyuiParams.workflowJson)) recipe.workflowImagesIdentity = workflowIdentity(snapshot.submittedWorkflowJson)
  return recipe
}
