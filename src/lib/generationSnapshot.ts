import type { ApiConfig, GenerationSnapshot, ImageProviderId, RecipeState } from '@/types/gallery'
import { workflowIdentity } from './comfyWorkflowParameters'
import { durableRecipe } from './persistentImages'
export { durableImage } from './persistentImages'

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
