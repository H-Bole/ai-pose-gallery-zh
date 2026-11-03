import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { ArrowLeft, Check, ChevronRight, Download, Maximize2, Pause, Play, RotateCcw, Save, Search, Smartphone, Sparkles, X } from 'lucide-react'
import { DEFAULT_CARD_PRESENTATION, normalizeCardPresentation, type CardPresentation } from '@/types/cards'
import type { GenerationHistoryItem } from '@/types/gallery'
import { downloadCardBlob, loadCardImage } from '@/lib/cardRenderer'
import { blobDataURL, cardBaseBlob, exportCardPng } from '@/lib/holoCardRenderer'
import { cardMaterials, materialById, materialGroups, readMaterialStrength, rememberMaterialStrength, type CardMaterial } from '@/lib/cardMaterials'
import { HoloCard } from '@/vendor/holocardlab/renderer.js'
import { OrientationInput } from '@/vendor/holocardlab/orientation.js'
import { useStudio } from '@/store/studioStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog'
import { ImageViewer } from '@/components/common/ImageViewer'
import { useMotion } from '@/components/motion/motionContext'

export interface CardViewerProps {
  imageUrl: string; open: boolean; onOpenChange: (open: boolean) => void
  initialPresentation?: CardPresentation
  onSavePresentation?: (presentation: CardPresentation, preview?: string) => Promise<void>
  result?: GenerationHistoryItem
}
type Pose = { x: number; y: number }

function MaterialTile({ material, selected, onSelect }: { material: CardMaterial; selected: boolean; onSelect: () => void }) {
  return <button type="button" className="card-material-option" aria-pressed={selected} onClick={onSelect}>
    <span className="card-material-swatch"><img src={material.thumbnail} alt="" loading="lazy" width="160" height="224" /></span>
    <span className="card-material-name">{material.label}</span><span className="card-material-detail">{material.variant}</span>
    {selected && <Check className="card-material-check size-4" aria-hidden="true" />}
  </button>
}

function HoloSurface({ url, material, strength, pose, rendererRef, onFailure }: {
  url: string; material: CardMaterial; strength: number; pose: Pose
  rendererRef: { current: HoloCard | null }; onFailure: (message: string) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const latest = useRef({ material, strength, pose, onFailure })
  useLayoutEffect(() => { latest.current = { material, strength, pose, onFailure } }, [material, strength, pose, onFailure])
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!canvas.current) return
    let active = true
    const card = new HoloCard(canvas.current, { image: url, preset: latest.current.material.id, width: 520, aspect: 'image' })
    rendererRef.current = card
    const report = () => { if (active) { setFailed(true); latest.current.onFailure('动态材质暂不可用，正在显示底图；可重试。') } }
    const element = canvas.current
    const restored = () => { void card.ready.then(() => { if (active && card.gl) { setFailed(false); latest.current.onFailure(''); card.setPreset(latest.current.material.id); card.setEffectStrength(latest.current.strength); card.setPose(latest.current.pose.x, latest.current.pose.y) } }).catch(report) }
    element.addEventListener('holoerror', report)
    element.addEventListener('webglcontextlost', report)
    element.addEventListener('webglcontextrestored', restored)
    card.ready.then(async () => {
      if (!active) return
      if (!card.gl) { report(); return }
      if (latest.current.material.masked) await card.setMask(`${location.origin}/card-materials/mask.svg`)
      if (!active) return
      card.setPreset(latest.current.material.id)
      card.setEffectStrength(latest.current.strength)
      card.setPose(latest.current.pose.x, latest.current.pose.y)
    }).catch(report)
    return () => {
      active = false; element.removeEventListener('holoerror', report)
      element.removeEventListener('webglcontextlost', report)
      element.removeEventListener('webglcontextrestored', restored)
      if (rendererRef.current === card) rendererRef.current = null
      card.dispose()
    }
  }, [url, rendererRef])
  useEffect(() => {
    const card = rendererRef.current
    if (!card) return
    try {
      card.setPreset(material.id); card.setEffectStrength(strength)
      if (material.masked) void card.setMask(`${location.origin}/card-materials/mask.svg`).catch(() => latest.current.onFailure('分区纹理读取失败，请重试。'))
    } catch { latest.current.onFailure('材质切换失败。') }
  }, [material, strength, rendererRef])
  useEffect(() => { rendererRef.current?.setPose(pose.x, pose.y) }, [pose, rendererRef])
  return <>{failed && <img src={url} alt="卡面底图，动态材质不可用" />}<canvas ref={canvas} hidden={failed} role="img" aria-label={`${material.label}卡面动态预览`} /></>
}

export function CardViewer(props: CardViewerProps) {
  const { creations, savePresentation } = useStudio()
  const existing = props.result ? creations.find((item) => item.result.id === props.result?.id) : undefined
  return props.open ? <CardEditor key={props.imageUrl} {...props} initialPresentation={props.initialPresentation ?? existing?.presentation} onSavePresentation={props.onSavePresentation ?? (existing ? (presentation, preview) => savePresentation(existing.id, presentation, preview) : undefined)} /> : null
}

function CardEditor({ imageUrl, open, onOpenChange, initialPresentation, onSavePresentation, result }: CardViewerProps) {
  const { creations, saveCreation, savePresentation, creationBusy, creationsReady } = useStudio()
  const [presentation, setPresentation] = useState(() => normalizeCardPresentation(initialPresentation))
  const [saved, setSaved] = useState(() => JSON.stringify(normalizeCardPresentation(initialPresentation)))
  const [wasSaved, setWasSaved] = useState(Boolean(initialPresentation))
  const returnFocus = useRef(document.activeElement as HTMLElement | null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [baseURL, setBaseURL] = useState('')
  const [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<'save' | 'png' | 'original' | null>(null)
  const [retry, setRetry] = useState(0)
  const [tab, setTab] = useState<'material' | 'layout' | 'text'>('material')
  const [directory, setDirectory] = useState(false), [group, setGroup] = useState<string>('通用覆膜'), [query, setQuery] = useState('')
  const [confirmClose, setConfirmClose] = useState(false), [enlarged, setEnlarged] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [touchDevice] = useState(() => matchMedia('(pointer: coarse)').matches)
  const [sensorState, setSensorState] = useState({ status: 'idle', message: '' })
  const [pose, setPose] = useState<Pose>(() => ({ x: presentation.lightX, y: presentation.lightY }))
  const renderer = useRef<HoloCard | null>(null), sensor = useRef<OrientationInput | null>(null)
  const face = useRef<HTMLDivElement>(null), mounted = useRef(true), poseFrame = useRef(0)
  const closeButton = useRef<HTMLButtonElement>(null)
  const previewArea = useRef<HTMLDivElement>(null)
  const [previewSize, setPreviewSize] = useState({ width: 240, height: 339 })
  const { enabled, setMode } = useMotion()
  const material = materialById(presentation.effectId)
  const hasMaterial = Boolean(material)
  const strength = material?.adjustable ? presentation.effectStrength ?? .6 : 1
  const dirty = saved !== JSON.stringify(presentation), canSave = Boolean(onSavePresentation || result), disabled = Boolean(busy || creationBusy)
  const ratio = presentation.layout === 'original' && image ? image.naturalWidth / image.naturalHeight : .708
  useLayoutEffect(() => {
    const area = previewArea.current
    if (!area) return
    const measure = () => {
      const width = Math.max(1, Math.min(520, area.clientWidth - 24, (area.clientHeight - 24) * ratio))
      const height = width / ratio
      setPreviewSize((current) => Math.abs(current.width - width) < .5 && Math.abs(current.height - height) < .5 ? current : { width, height })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(area)
    const frame = requestAnimationFrame(measure)
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [ratio])
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; cancelAnimationFrame(poseFrame.current); sensor.current?.dispose() }
  }, [])
  useEffect(() => {
    let active = true
    loadCardImage(imageUrl).then((loaded) => { if (active) { setImage(loaded); setError('') } }).catch((e) => { if (active) setError(e.message) })
    return () => { active = false }
  }, [imageUrl, retry])
  const { layout, fit, cropX, cropY, title, subtitle, number, finish, engine } = presentation
  const legacyLightX = engine ? .35 : presentation.lightX, legacyLightY = engine ? .25 : presentation.lightY
  const basePresentation = useMemo(() => ({ ...DEFAULT_CARD_PRESENTATION, layout, fit, cropX, cropY, title, subtitle, number, finish, lightX: legacyLightX, lightY: legacyLightY }), [layout, fit, cropX, cropY, title, subtitle, number, finish, legacyLightX, legacyLightY])
  useEffect(() => {
    if (!image) return
    let active = true, url = ''
    cardBaseBlob(image, basePresentation, 1400).then((blob) => { if (active) { url = URL.createObjectURL(blob); setBaseURL(url) } }).catch((e) => { if (active) setError(e.message) })
    return () => { active = false; if (url) URL.revokeObjectURL(url) }
    // 材质光位与强度只更新 GPU，不重建底图；旧材质仍按旧参数绘制。
  }, [image, basePresentation])
  const updatePose = useCallback((next: Pose) => { cancelAnimationFrame(poseFrame.current); poseFrame.current = requestAnimationFrame(() => setPose(next)) }, [])
  useEffect(() => {
    face.current?.style.setProperty('--tilt-x', `${enabled ? (.5 - pose.y) * 10 : 0}deg`)
    face.current?.style.setProperty('--tilt-y', `${enabled ? (pose.x - .5) * 12 : 0}deg`)
  }, [pose, enabled])
  useEffect(() => {
    if (enabled) return
    sensor.current?.stop()
    const frame = requestAnimationFrame(() => { setPlaying(false); setPose({ x: presentation.lightX, y: presentation.lightY }) })
    return () => cancelAnimationFrame(frame)
  }, [enabled, presentation.lightX, presentation.lightY])
  useEffect(() => {
    if (!playing || !enabled || !hasMaterial) return
    let frame = 0
    const start = performance.now()
    const tick = (time: number) => { const phase = (time - start) / 1800; setPose({ x: .5 + Math.sin(phase) * .38, y: .5 + Math.cos(phase * .8) * .32 }); frame = requestAnimationFrame(tick) }
    frame = requestAnimationFrame(tick)
    const visibility = () => { if (document.hidden) setPlaying(false) }
    document.addEventListener('visibilitychange', visibility)
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', visibility) }
  }, [playing, enabled, hasMaterial])
  const change = <K extends keyof CardPresentation>(key: K, value: CardPresentation[K]) => { setPresentation((current) => ({ ...current, [key]: value })); setNotice(''); setError('') }
  const selectMaterial = (next?: CardMaterial) => {
    setPresentation((current) => normalizeCardPresentation({ ...current, finish: 'none', version: next ? 2 : undefined, engine: next ? 'holocardlab' : undefined, effectId: next?.id, effectStrength: next ? readMaterialStrength(next.id) : undefined }))
    setNotice(''); setError(''); setDirectory(false)
    if (!next) { setPlaying(false); sensor.current?.stop() }
  }
  const requestClose = () => { if (!disabled) { if (dirty) setConfirmClose(true); else onOpenChange(false) } }
  const action = async (kind: 'save' | 'png' | 'original', closeAfter = false) => {
    if (busy) return
    setBusy(kind); setError(''); setNotice('')
    const submitted = structuredClone(presentation)
    try {
      if (kind === 'save' && image) {
        const preview = await blobDataURL(await exportCardPng(image, submitted, 600))
        if (onSavePresentation) await onSavePresentation(submitted, preview)
        else if (result) {
          const existing = creations.find((item) => item.result.id === result.id)
          if (existing) await savePresentation(existing.id, submitted, preview)
          else await saveCreation(result, result.recipeSummary || '我的作品', submitted, preview)
        }
        else throw new Error('请先保存作品，再保存卡面样式。')
        if (mounted.current) { setSaved(JSON.stringify(submitted)); setWasSaved(true); setNotice('卡面样式已保存到作品库。'); if (closeAfter) onOpenChange(false) }
      } else if (kind === 'png' && image) {
        downloadCardBlob(await exportCardPng(image, submitted), `衣想天开-${submitted.title || material?.label || '作品卡面'}.png`)
        if (mounted.current) setNotice('PNG 已导出，使用已采用的光位。')
      } else if (kind === 'original') {
        const response = await fetch(imageUrl)
        if (!response.ok) throw new Error('原图下载失败，请重试。')
        const blob = await response.blob()
        if (!blob.size || !blob.type.startsWith('image/')) throw new Error('原图响应不是有效图片。')
        downloadCardBlob(blob, `作品原图.${blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg'}`)
        if (mounted.current) setNotice('原图已下载。')
      }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : '操作失败，请重试。') }
    finally { if (mounted.current) setBusy(null) }
  }
  const enlarge = async () => {
    if (!image || busy) return
    setBusy('png'); setError('')
    try { const blob = await exportCardPng(image, { ...presentation, lightX: pose.x, lightY: pose.y }, 1600); if (mounted.current) setEnlarged(URL.createObjectURL(blob)) }
    catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : '预览暂不可用。') }
    finally { if (mounted.current) setBusy(null) }
  }
  useEffect(() => () => { if (enlarged) URL.revokeObjectURL(enlarged) }, [enlarged])
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!enabled || playing || sensor.current?.active || !material || (event.pointerType !== 'mouse' && !event.buttons)) return
    const bounds = event.currentTarget.getBoundingClientRect()
    updatePose({ x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) })
  }
  const toggleSensor = () => {
    if (sensor.current?.active) { sensor.current.stop(); return }
    setPlaying(false)
    if (!sensor.current) sensor.current = new OrientationInput({ onPose: (x, y) => updatePose({ x, y }), onState: setSensorState })
    void sensor.current.start()
  }
  const range = (key: 'cropX' | 'cropY' | 'lightX' | 'lightY', label: string) => <label className="card-range" key={key}><span>{label}<output>{Math.round(presentation[key] * 100)}%</output></span><input aria-label={label} type="range" min="0" max="1" step="0.01" disabled={disabled} value={presentation[key]} onChange={(event) => { const value = Number(event.target.value); change(key, value); if (key === 'lightX' || key === 'lightY') { setPlaying(false); sensor.current?.stop(); setPose((current) => ({ ...current, [key === 'lightX' ? 'x' : 'y']: value })) } }} /></label>
  const filtered = cardMaterials.filter((item) => (group === '全部' || item.group === group) && `${item.label} ${item.variant} ${item.group} ${item.id}`.toLowerCase().includes(query.trim().toLowerCase()))
  const families = [...new Set(filtered.map((item) => item.recipeId))]
  const onFailure = useCallback((message: string) => { setError(message); if (message) { setPlaying(false); sensor.current?.stop() } }, [])
  return <>
    <Dialog open={open} onOpenChange={(next) => { if (!next) requestClose() }}>
      <DialogContent className="card-workspace" showCloseButton={false} onCloseAutoFocus={(event) => { event.preventDefault(); returnFocus.current?.focus() }} onEscapeKeyDown={(event) => { if (enlarged || confirmClose || directory) { event.preventDefault(); if (directory && !enlarged && !confirmClose) setDirectory(false) } }} onPointerDownOutside={(event) => event.preventDefault()}>
        <header className="card-workspace-heading"><div className="card-workspace-title"><Button variant="ghost" className="size-11 shrink-0" onClick={requestClose} disabled={disabled} aria-label="返回原页面"><ArrowLeft className="size-5" /></Button><div><DialogTitle>制卡工作台</DialogTitle><DialogDescription>{result?.recipeSummary || '为作品选择材质、构图与文字'}</DialogDescription></div></div><span className="card-workspace-state">{dirty ? '尚未保存' : wasSaved ? '已保存样式' : '原图展示'}</span><Button variant="ghost" className="size-11" ref={closeButton} aria-label="关闭制卡工作台" onClick={requestClose} disabled={disabled}><X className="size-5" /></Button></header>
        <div className="card-workspace-body">
          <section className="card-stage" aria-label="卡面预览">
            <div className="card-stage-topline"><span>{material?.label || (presentation.engine ? '暂不可用的材质' : finish !== 'none' ? '保留旧版材质' : '原图展示')}</span><span>{material?.variant || '保留原图与生成配方'}</span></div>
            <div ref={previewArea} className="card-preview-area" onPointerMove={pointerMove} onKeyDown={(event) => {
              if (event.target !== event.currentTarget || !material) return
              const offsets: Record<string, Pose> = { ArrowLeft: { x: -.05, y: 0 }, ArrowRight: { x: .05, y: 0 }, ArrowUp: { x: 0, y: -.05 }, ArrowDown: { x: 0, y: .05 } }
              if (offsets[event.key]) { event.preventDefault(); setPlaying(false); sensor.current?.stop(); setPose((current) => ({ x: Math.max(0, Math.min(1, current.x + offsets[event.key].x)), y: Math.max(0, Math.min(1, current.y + offsets[event.key].y)) })) }
              if (event.key === 'Home') { event.preventDefault(); setPlaying(false); setPose({ x: presentation.lightX, y: presentation.lightY }) }
            }} tabIndex={material ? 0 : -1} role="group" aria-label="动态光位预览，方向键调整，Home恢复已采用光位">
              {!image || !baseURL ? <div className="card-loading" role="status">{error ? <><span>图片暂不可用</span><Button variant="outline" onClick={() => { setError(''); setRetry((value) => value + 1) }}>重新加载</Button></> : '正在准备作品…'}</div> : <div ref={face} className="card-preview-face" style={{ aspectRatio: ratio, width: previewSize.width, height: previewSize.height }}>
                {material ? <HoloSurface key={`${baseURL}:${retry}`} url={baseURL} material={material} strength={strength} pose={pose} rendererRef={renderer} onFailure={onFailure} /> : <img src={baseURL} alt="卡面预览" />}
              </div>}
            </div>
            <div className="card-preview-actions"><Button variant="outline" disabled={!material || !enabled || disabled} aria-pressed={playing} onClick={() => { sensor.current?.stop(); setPlaying(!playing) }}>{playing ? <Pause className="size-4" /> : <Play className="size-4" />}{playing ? '暂停' : '播放光效'}</Button>{touchDevice && <Button variant="outline" disabled={!enabled || !material || disabled} aria-pressed={sensorState.status === 'active' || sensorState.status === 'waiting'} onClick={toggleSensor}><Smartphone className="size-4" />{sensorState.status === 'active' || sensorState.status === 'waiting' ? '关闭感应' : '倾斜感应'}</Button>}<Button variant="ghost" disabled={!baseURL || disabled} onClick={() => void enlarge()}><Maximize2 className="size-4" />放大预览</Button></div>
            {sensorState.message && <p className="card-helper" role="status">{sensorState.message}</p>}
            {material && <div className="card-light-summary"><p>查看光位不会自动保存。</p><Button variant="ghost" disabled={disabled} onClick={() => { setPlaying(false); sensor.current?.stop(); setPresentation((current) => ({ ...current, lightX: pose.x, lightY: pose.y })); setNotice('已采用当前光位，保存或导出将使用此位置。') }}><Check className="size-4" />采用当前光位</Button></div>}
            {!enabled && <div className="card-light-summary"><p>当前使用静态预览，仍可手动调整光位；系统减少动态效果设置优先。</p><Button variant="ghost" onClick={() => setMode('on')}>开启动态预览</Button></div>}
            <div className="card-feedback" aria-live="polite">{error ? <><p role="alert">{error} 编辑内容已保留。</p><Button variant="ghost" onClick={() => { setError(''); setRetry((value) => value + 1) }}>重试预览</Button></> : notice}</div>
          </section>
          <section className="card-controls" aria-label="卡面编辑"><fieldset className="card-control-lock" disabled={disabled}>
            <div className="card-editor-tabs" role="tablist" aria-label="卡面编辑分类">{([['material', '材质'], ['layout', '版式'], ['text', '文字']] as const).map(([id, label], index) => <button type="button" key={id} role="tab" id={`card-tab-${id}`} aria-controls={`card-panel-${id}`} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} onClick={() => { setTab(id); setDirectory(false) }} onKeyDown={(event) => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); const next = (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3; const nextId = ['material', 'layout', 'text'][next] as typeof tab; setTab(nextId); setDirectory(false); document.getElementById(`card-tab-${nextId}`)?.focus() } }}>{label}</button>)}</div>
            <div className="card-editor-panel" role="tabpanel" id={`card-panel-${tab}`} aria-labelledby={`card-tab-${tab}`}>
              {tab === 'material' && (directory ? <>
                <div className="card-directory-heading"><Button variant="ghost" onClick={() => setDirectory(false)}><ArrowLeft className="size-4" />返回常用材质</Button><span>{cardMaterials.length}项效果及变体</span></div>
                <label className="card-search"><Search className="size-4" aria-hidden="true" /><Input aria-label="搜索卡面材质" placeholder="搜索名称或效果" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
                <div className="card-group-filter" aria-label="筛选效果分类">{['全部', ...materialGroups].map((name) => <Button key={name} size="sm" variant={group === name ? 'default' : 'outline'} aria-pressed={group === name} onClick={() => setGroup(name)}>{name}</Button>)}</div>
                {!filtered.length && <p className="card-helper">没有匹配材质，试试其他名称或分类。</p>}
                {families.map((family) => <details key={`${group}:${family}`} className="card-material-family" open={Boolean(query) || families.length === 1 ? true : undefined}><summary>{filtered.find((item) => item.recipeId === family)?.label}<span>{filtered.filter((item) => item.recipeId === family).length}项</span></summary><div className="card-material-grid">{filtered.filter((item) => item.recipeId === family).map((item) => <MaterialTile key={item.id} material={item} selected={presentation.effectId === item.id} onSelect={() => selectMaterial(item)} />)}</div></details>)}
              </> : <>
                <div className="card-panel-heading"><h2>选择材质</h2><span>上传即用</span></div>
                <button type="button" className="card-original-choice" aria-pressed={!presentation.engine && finish === 'none'} onClick={() => selectMaterial()}><span><Sparkles className="size-4" />无材质</span><span>保留作品原色</span>{!presentation.engine && finish === 'none' && <Check className="size-4" />}</button>
                <div className="card-material-grid">{cardMaterials.filter((item) => item.group === '通用覆膜').map((item) => <MaterialTile key={item.id} material={item} selected={presentation.effectId === item.id} onSelect={() => selectMaterial(item)} />)}</div>
                <Button variant="outline" className="card-all-materials" onClick={() => { setDirectory(true); setGroup('全部'); setQuery('') }}>浏览全部 {cardMaterials.length} 项<ChevronRight className="size-4" /></Button>
                {material && material.group !== '通用覆膜' && <p className="card-helper">当前：{material.label} · {material.variant}</p>}
                {!presentation.engine && finish !== 'none' && <p className="card-helper">保留旧版材质；选择新材质后才转换。</p>}
                {material?.adjustable && <fieldset><legend>效果强度</legend><label className="card-range"><span>原图与材质混合<output>{Math.round(strength * 100)}%</output></span><input type="range" aria-label="效果强度" min="0" max="1" step="0.01" disabled={disabled} value={strength} onChange={(event) => { const value = Number(event.target.value); change('effectStrength', value); rememberMaterialStrength(material.id, value) }} /></label></fieldset>}
                {(material || finish === 'foil' || finish === 'holo') && <details className="card-advanced"><summary>导出光位</summary><div className="card-ranges">{range('lightX', '光位 · 水平')}{range('lightY', '光位 · 垂直')}</div></details>}
              </>)}
              {tab === 'layout' && <><div className="card-panel-heading"><h2>版式与构图</h2></div><fieldset><legend>版式</legend><div className="card-choice-row">{([['original', '原图'], ['collectible', '留白'], ['player', '海报']] as const).map(([value, label]) => <Button key={value} variant={layout === value ? 'default' : 'outline'} aria-pressed={layout === value} onClick={() => change('layout', value)}>{label}</Button>)}</div></fieldset>{layout !== 'original' ? <fieldset><legend>图片填充</legend><div className="card-fit-row"><Button variant={fit === 'contain' ? 'default' : 'outline'} aria-pressed={fit === 'contain'} onClick={() => change('fit', 'contain')}>完整展示</Button><Button variant={fit === 'cover' ? 'default' : 'outline'} aria-pressed={fit === 'cover'} onClick={() => change('fit', 'cover')}>铺满卡面</Button></div>{fit === 'cover' && <div className="card-ranges">{range('cropX', '裁切位置 · 水平')}{range('cropY', '裁切位置 · 垂直')}</div>}</fieldset> : <p className="card-helper">按作品原始比例完整展示，不裁切。</p>}</>}
              {tab === 'text' && <><div className="card-panel-heading"><h2>卡面文字</h2><span>可选</span></div><div className="card-text-fields"><label>卡名<Input value={title} maxLength={48} onChange={(event) => change('title', event.target.value)} placeholder="作品名称" /></label><label>称号<Input value={subtitle} maxLength={72} onChange={(event) => change('subtitle', event.target.value)} placeholder="一句灵感" /></label><label>编号<Input value={number} maxLength={16} onChange={(event) => change('number', event.target.value)} placeholder="例如 001" /></label></div><p className="card-helper">文字属于卡面样式，不改变作品名称或生成配方。</p></>}
              {!directory && <Button variant="ghost" className="card-reset" disabled={disabled} onClick={() => { setPresentation(structuredClone(DEFAULT_CARD_PRESENTATION)); setPose({ x: .35, y: .25 }); setPlaying(false); sensor.current?.stop(); setNotice('已恢复原图展示，尚未保存。') }}><RotateCcw className="size-4" />恢复原图展示</Button>}
            </div>
          </fieldset></section>
        </div>
        <footer className="card-workspace-footer"><Button variant="ghost" disabled={disabled} onClick={() => void action('original')}><Download className="size-4" /><span>下载原图</span></Button><span className="card-export-hint">PNG · 长边 2048 px</span><div>{canSave && <Button variant="outline" disabled={disabled || !image || (!dirty && wasSaved) || !creationsReady} onClick={() => void action('save')}><Save className="size-4" />{busy === 'save' ? '保存中…' : onSavePresentation ? '保存样式' : '保存到作品库'}</Button>}<Button disabled={disabled || !image} onClick={() => void action('png')}><Download className="size-4" />{busy === 'png' ? '正在准备…' : '导出 PNG'}</Button></div></footer>
      </DialogContent>
    </Dialog>
    <ImageViewer imageUrl={enlarged || ''} open={Boolean(enlarged)} onOpenChange={(next) => { if (!next) setEnlarged(null) }} title="卡面大图预览" />
    <AlertDialog open={confirmClose} onOpenChange={(next) => { if (!disabled) setConfirmClose(next) }}><AlertDialogContent onCloseAutoFocus={(event) => { if (mounted.current) { event.preventDefault(); closeButton.current?.focus() } }}><AlertDialogHeader><AlertDialogTitle>保存这次卡面编辑？</AlertDialogTitle><AlertDialogDescription>关闭后返回原页面，原作品和生成配方始终保留。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><Button variant="ghost" disabled={disabled} onClick={() => setConfirmClose(false)}>继续编辑</Button><Button variant="outline" disabled={disabled} onClick={() => { setConfirmClose(false); onOpenChange(false) }}>放弃本次修改</Button>{canSave && <Button disabled={disabled || !image || !creationsReady} onClick={() => void action('save', true)}>保存并关闭</Button>}</AlertDialogFooter>{error && <p className="text-sm text-destructive" role="alert">{error} 编辑内容已保留。</p>}</AlertDialogContent></AlertDialog>
  </>
}
