import { useEffect, useRef, useState } from 'react'
import { Download, RotateCcw, Save, Maximize2, X } from 'lucide-react'
import { DEFAULT_CARD_PRESENTATION, normalizeCardPresentation, type CardPresentation } from '../../types/cards'
import { cardPngBlob, downloadCardBlob, loadCardImage, renderCard } from '../../lib/cardRenderer'
import { TiltSurface } from '../motion/TiltSurface'
import { ImageViewer } from '../common/ImageViewer'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Dialog, DialogContent, DialogClose, DialogTitle, DialogDescription } from '../ui/dialog'
import { useMotion } from '../motion/motionContext'

export interface CardViewerProps {
  imageUrl: string
  open: boolean
  onOpenChange: (open: boolean) => void
  initialPresentation?: CardPresentation
  onSavePresentation?: (presentation: CardPresentation) => Promise<void>
}
const materials: [CardPresentation['finish'], string][] = [['none', '无材质'], ['foil', '闪箔'], ['holo', '全息']]
function CardCanvas({ image, presentation, longEdge = 1024, className = '', onError }: { image: HTMLImageElement; presentation: CardPresentation; longEdge?: number; className?: string; onError?: (error: Error) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const handler = useRef(onError)
  useEffect(() => { handler.current = onError }, [onError])
  useEffect(() => {
    if (!canvas.current) return
    try { renderCard(canvas.current, image, presentation, longEdge) }
    catch (error) { handler.current?.(error instanceof Error ? error : new Error('预览生成失败')) }
  }, [image, presentation, longEdge])
  return <canvas ref={canvas} className={className} role="img" aria-label={`${presentation.title || '作品'}卡面预览`} />
}

export function CardViewer(props: CardViewerProps) {
  return <CardEditor key={props.imageUrl} {...props} />
}

function CardEditor({ imageUrl, open, onOpenChange, initialPresentation, onSavePresentation }: CardViewerProps) {
  const [presentation, setPresentation] = useState(() => normalizeCardPresentation(initialPresentation))
  const [saved, setSaved] = useState(() => JSON.stringify(normalizeCardPresentation(initialPresentation)))
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<'save' | 'png' | 'original' | null>(null)
  const [retry, setRetry] = useState(0)
  const [enlarged, setEnlarged] = useState(false)
  const mounted = useRef(true)
  const { enabled } = useMotion()
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!open || image) return
    let active = true
    loadCardImage(imageUrl).then(loaded => { if (active) setImage(loaded) }).catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [imageUrl, retry, open, image])
  const change = <K extends keyof CardPresentation>(key: K, value: CardPresentation[K]) => {
    setPresentation(p => ({ ...p, [key]: value })); setNotice('')
  }
  const action = async (kind: 'save' | 'png' | 'original') => {
    setBusy(kind); setError(''); setNotice('')
    try {
      if (kind === 'save' && onSavePresentation) {
        await onSavePresentation(structuredClone(presentation))
        if (mounted.current) { setSaved(JSON.stringify(presentation)); setNotice('展示样式已保存。') }
      } else if (kind === 'png' && image) {
        await document.fonts.ready
        const output = document.createElement('canvas')
        renderCard(output, image, presentation)
        downloadCardBlob(await cardPngBlob(output), `作品卡面-${presentation.finish}.png`)
        if (mounted.current) setNotice('PNG 已生成，保留当前光位与构图。')
      } else if (kind === 'original') {
        const response = await fetch(imageUrl)
        if (!response.ok) throw new Error('原图下载失败，请检查图片链接。')
        const blob = await response.blob()
        if (!blob.size || !blob.type.startsWith('image/')) throw new Error('原图响应不是有效图片，请重试。')
        const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : blob.type === 'image/jpeg' ? 'jpg' : 'image'
        downloadCardBlob(blob, `作品原图.${extension}`)
        if (mounted.current) setNotice('原图已下载。')
      }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : '操作失败，编辑内容已保留，请重试。') }
    finally { if (mounted.current) setBusy(null) }
  }
  const dirty = saved !== JSON.stringify(presentation)
  const range = (key: 'cropX' | 'cropY' | 'lightX' | 'lightY', label: string) => <label className="card-range" key={key}><span>{label}<output>{Math.round(presentation[key] * 100)}%</output></span><input aria-label={label} type="range" min="0" max="1" step="0.01" value={presentation[key]} onChange={e => change(key, Number(e.target.value))} /></label>
  const ratio = presentation.layout === 'original' && image ? image.naturalWidth / image.naturalHeight : .708
  const width = ratio >= 1 ? 1600 : 1600 * ratio
  const height = ratio >= 1 ? 1600 / ratio : 1600
  const materialEnabled = presentation.finish === 'foil' || presentation.finish === 'holo'
  return <>
    <Dialog open={open} onOpenChange={(next) => {if (!next) setEnlarged(false); onOpenChange(next)}}>
      <DialogContent className="card-viewer" showCloseButton={false} onEscapeKeyDown={(event) => {if (enlarged) event.preventDefault()}}>
        <header className="card-viewer-heading"><div><DialogTitle>制卡与分享</DialogTitle><DialogDescription>保留原图，或选择适合这张作品的材质与版式。</DialogDescription></div><DialogClose asChild><Button variant="ghost" className="size-11" aria-label="关闭制卡"><X className="size-5" /></Button></DialogClose></header>
        <div className="card-viewer-body">
          <section className="card-stage" aria-label="卡面预览">
            {!image ? <div className="card-loading" role="status">{error ? <><span>暂时无法显示图片</span><Button variant="outline" className="min-h-11" onClick={() => { setError(''); setRetry(n => n + 1) }}>重新加载</Button></> : '正在加载作品…'}</div> : <button className="card-preview-trigger" aria-label="放大当前卡面" type="button" onClick={() => setEnlarged(true)}><TiltSurface disabled={!enabled} className="card-preview-surface"><CardCanvas image={image} presentation={presentation} onError={e => setError(e.message)} /></TiltSurface></button>}
            <div className="card-stage-caption"><Button variant="ghost" className="min-h-11" disabled={!image} onClick={() => setEnlarged(true)}><Maximize2 className="size-4" />放大预览</Button><p>PNG · {presentation.layout === 'original' ? (image ? `${image.naturalWidth} × ${image.naturalHeight} px` : '原始比例') : '长边 2048 px'}</p></div>
          </section>
          <section className="card-controls" aria-label="卡面编辑">
            <fieldset><legend>版式</legend><div className="card-choice-row">{([['original', '原图'], ['collectible', '留白'], ['player', '海报']] as const).map(([value, label]) => <Button key={value} type="button" variant={presentation.layout === value ? 'default' : 'outline'} className="min-h-11" aria-pressed={presentation.layout === value} onClick={() => change('layout', value)}>{label}</Button>)}</div></fieldset>
            <fieldset><legend>材质</legend><div className="card-finish-row">{materials.map(([value, label]) => <Button type="button" key={value} variant="outline" className="card-material-option" aria-pressed={presentation.finish === value} onClick={() => {setPresentation(p => ({...p, finish:value}));setNotice('')}}><span className="card-material-swatch" aria-hidden="true">{image && <CardCanvas image={image} presentation={{...DEFAULT_CARD_PRESENTATION, finish:value}} longEdge={256} />}</span><span>{label}</span></Button>)}</div>{presentation.finish === 'emboss' && <p className="card-helper">正在保留这张作品已保存的压纹样式。</p>}</fieldset>
            {presentation.layout !== 'original' && <fieldset><legend>构图</legend><div className="card-fit-row"><Button variant={presentation.fit === 'contain' ? 'default' : 'outline'} className="min-h-11" aria-pressed={presentation.fit === 'contain'} onClick={() => change('fit', 'contain')}>完整展示</Button><Button variant={presentation.fit === 'cover' ? 'default' : 'outline'} className="min-h-11" aria-pressed={presentation.fit === 'cover'} onClick={() => change('fit', 'cover')}>铺满卡面</Button></div>{presentation.fit === 'cover' && <div className="card-ranges">{range('cropX', '裁切位置 · 水平')}{range('cropY', '裁切位置 · 垂直')}</div>}</fieldset>}
            <fieldset><legend>文字（可选）</legend><div className="card-text-fields"><label>卡名<Input value={presentation.title} maxLength={48} onChange={e => change('title', e.target.value)} placeholder="作品名称" /></label><label>称号<Input value={presentation.subtitle} maxLength={72} onChange={e => change('subtitle', e.target.value)} placeholder="一句灵感" /></label><label>编号<Input value={presentation.number} maxLength={16} onChange={e => change('number', e.target.value)} placeholder="例如 001" /></label></div></fieldset>
            {materialEnabled && <fieldset><legend>光位</legend><div className="card-ranges">{range('lightX', '光位 · 水平')}{range('lightY', '光位 · 垂直')}</div><p className="card-helper">滑动调整的光位会保留在导出中。</p></fieldset>}
            <Button variant="ghost" className="min-h-11" onClick={() => { setPresentation(structuredClone(DEFAULT_CARD_PRESENTATION)); setNotice('已恢复原图展示。') }}><RotateCcw className="size-4" />恢复原图</Button>
            <div className="card-feedback" aria-live="polite">{error ? <p role="alert">{error} 编辑内容已保留。</p> : notice || (dirty && onSavePresentation ? '样式尚未保存。' : '')}</div>
          </section>
        </div>
        <footer className="card-viewer-footer"><Button variant="outline" className="min-h-11" onClick={() => action('original')} disabled={!!busy}><Download className="size-4" />{busy === 'original' ? '下载中…' : '下载原图'}</Button><div>{onSavePresentation && <Button variant="outline" className="min-h-11" onClick={() => action('save')} disabled={!!busy || !dirty}><Save className="size-4" />{busy === 'save' ? '保存中…' : '保存样式'}</Button>}<Button className="min-h-11" onClick={() => action('png')} disabled={!!busy || !image}><Download className="size-4" />{busy === 'png' ? '正在导出…' : '导出分享 PNG'}</Button></div></footer>
      </DialogContent>
    </Dialog>
    <ImageViewer open={enlarged && open} onOpenChange={setEnlarged} title="卡面大图预览" contentWidth={width} contentHeight={height} resetKey={`${imageUrl}:${ratio}`}>{image && <CardCanvas image={image} presentation={presentation} longEdge={2048} className="card-enlarged-surface" onError={e => setError(e.message)} />}</ImageViewer>
  </>
}
