type WorkflowNode = {
  class_type?: unknown
  inputs?: Record<string, unknown>
  _meta?: { title?: string; studio?: { hiddenInputs?: unknown[] } }
}

// Only the published director graph is eligible; custom saving nodes stay untouched.
export function migrateDirectorPreviewWorkflow(workflowJson: string): string {
  let workflow: Record<string, WorkflowNode>
  try {
    workflow = JSON.parse(workflowJson)
  } catch {
    return workflowJson
  }
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) return workflowJson
  const result = workflow['12']
  const reference = workflow['18']
  const gate = workflow['206']
  const isLink = (value: unknown, id: string, slot: number) =>
    Array.isArray(value) && value.length === 2 && value[0] === id && value[1] === slot
  if (result?.class_type !== 'SaveImage'
    || result.inputs?.filename_prefix !== 'pose_studio/all_combinations/result'
    || !isLink(result.inputs?.images, '205', 0)
    || reference?.class_type !== 'SaveImage'
    || reference.inputs?.filename_prefix !== 'pose_studio/all_combinations/reference'
    || !isLink(reference.inputs?.images, '206', 0)
    || reference._meta?.title !== '保存实际姿势或可用参考（无姿势不运行深度）'
    || !Array.isArray(reference._meta.studio?.hiddenInputs)
    || reference._meta.studio.hiddenInputs.length !== 1
    || reference._meta.studio.hiddenInputs[0] !== 'filename_prefix'
    || gate?.class_type !== 'LazySwitchKJ'
    || !isLink(gate.inputs?.switch, '201', 2)
    || !isLink(gate.inputs?.on_false, '204', 0)
    || !isLink(gate.inputs?.on_true, '50', 0)) return workflowJson

  reference.class_type = 'PreviewImage'
  delete reference.inputs.filename_prefix
  if (reference._meta) {
    reference._meta.title = '实际参考（临时预览，不保存成品）'
    if (Array.isArray(reference._meta.studio?.hiddenInputs)) {
      reference._meta.studio.hiddenInputs = reference._meta.studio.hiddenInputs.filter((name) => name !== 'filename_prefix')
    }
  }
  return JSON.stringify(workflow, null, 2)
}
