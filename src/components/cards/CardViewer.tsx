import { useEffect, useRef, useState } from 'react'
import { Dialog } from 'radix-ui'
import { Download, RotateCcw, Save, X, Sparkles } from 'lucide-react'
import { DEFAULT_CARD_PRESENTATION, normalizeCardPresentation, type CardPresentation } from '../../types/cards'
import { cardPngBlob, downloadCardBlob, loadCardImage, renderCard } from '../../lib/cardRenderer'
import { MotionToggle } from '../motion/MotionProvider'
import { TiltSurface } from '../motion/TiltSurface'

export interface CardViewerProps {
  imageUrl: string
  open: boolean
  onOpenChange: (open: boolean) => void
  initialPresentation?: CardPresentation
  onSavePresentation?: (presentation: CardPresentation) => Promise<void>
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
  const canvas = useRef<HTMLCanvasElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!open || image) return
    let active = true
    loadCardImage(imageUrl).then(loaded => { if (active) setImage(loaded) }).catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [imageUrl, retry, open, image])
  useEffect(() => {
    if (!image || !canvas.current) return
    const frame = requestAnimationFrame(() => {
      try { renderCard(canvas.current!, image, presentation, 1024) }
      catch (e) { setError(e instanceof Error ? e.message : '预览生成失败。') }
    })
    return () => cancelAnimationFrame(frame)
  }, [image, presentation, open])
  const change = <K extends keyof CardPresentation>(key: K, value: CardPresentation[K]) => {
    setPresentation(p => ({ ...p, [key]: value })); setNotice('')
  }
  const action = async (kind: 'save' | 'png' | 'original') => {
    setBusy(kind); setError(''); setNotice('')
    try {
      if (kind === 'save' && onSavePresentation) {
        await onSavePresentation({ ...presentation })
        if (mounted.current) { setSaved(JSON.stringify(presentation)); setNotice('展示样式已保存。') }
      } else if (kind === 'png' && image) {
        const output = document.createElement('canvas')
        renderCard(output, image, presentation)
        downloadCardBlob(await cardPngBlob(output), `作品卡面-${presentation.layout}-${presentation.finish}.png`)
        if (mounted.current) setNotice('PNG 已生成；导出保留当前光位与构图。')
      } else if (kind === 'original') {
        const response = await fetch(imageUrl)
        if (!response.ok) throw new Error('原图下载失败，请检查图片链接。')
        const blob = await response.blob()
        if (!blob.size || !blob.type.startsWith('image/')) throw new Error('原图响应不是有效图片，请重试。')
        const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : blob.type === 'image/jpeg' ? 'jpg' : 'image'
        downloadCardBlob(blob, `作品卡面-原图.${extension}`)
        if (mounted.current) setNotice('原图已下载。')
      }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : '操作失败，编辑内容已保留，请重试。') }
    finally { if (mounted.current) setBusy(null) }
  }
  const dirty = saved !== JSON.stringify(presentation)
  const range = (key: 'cropX' | 'cropY' | 'lightX' | 'lightY', label: string) => <label className="card-range" key={key}><span>{label}<output>{Math.round(presentation[key] * 100)}%</output></span><input type="range" min="0" max="1" step="0.01" value={presentation[key]} onChange={e => change(key, Number(e.target.value))} /></label>
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="card-viewer-overlay" /><Dialog.Content className="card-viewer" aria-describedby="card-viewer-description" onOpenAutoFocus={() => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null }} onCloseAutoFocus={event => { if (returnFocus.current?.isConnected) { event.preventDefault(); returnFocus.current.focus() } }}>
    <header className="card-viewer-heading"><div><span className="card-eyebrow">作品卡面 · CARD ATELIER</span><Dialog.Title>让灵感，成为珍藏</Dialog.Title><Dialog.Description id="card-viewer-description">保留原图，或为这一次创作定制专属卡面。</Dialog.Description></div><Dialog.Close className="card-icon-button" aria-label="关闭卡牌展示"><X size={22} /></Dialog.Close></header>
    <div className="card-viewer-body">
      <section className="card-stage" aria-label="卡面预览">
        <div className="card-stage-orbit" aria-hidden="true" />
        <span className="card-stage-label">{presentation.layout === 'original' ? 'ORIGINAL' : presentation.layout === 'collectible' ? 'COLLECTOR EDITION' : 'PLAYER EDITION'}</span>
        {!image ? <div className="card-loading" role="status">{error ? <><span>暂时无法显示图片</span><button onClick={() => { setError(''); setRetry(n => n + 1) }}>重新加载</button></> : '正在准备卡面…'}</div> : <TiltSurface className="card-preview-tilt" onLightChange={(x, y) => { if (presentation.finish === 'foil' || presentation.finish === 'holo') setPresentation(p => ({ ...p, lightX: x, lightY: y })) }}><canvas ref={canvas} className="card-preview-canvas" role="img" aria-label={`${presentation.title || '作品'}，${presentation.layout === 'original' ? '原图' : '卡牌'}预览`} /></TiltSurface>}
        <p className="card-stage-note">正视导出 · {presentation.layout === 'original' ? (image ? `${image.naturalWidth} × ${image.naturalHeight} px` : '原始像素尺寸') : '长边 2048 px'} · PNG<br />{presentation.finish === 'foil' || presentation.finish === 'holo' ? '移动鼠标探索光泽，或使用光位滑块精确调整' : '自由选择版式与材质，导出保留当前构图'}</p>
      </section>
      <section className="card-controls" aria-label="卡面编辑">
        <div className="card-control-intro"><Sparkles size={17} aria-hidden="true" /><span>你的作品，你来定义</span><MotionToggle /></div>
        <fieldset><legend>01 / 选择版式</legend><div className="card-choice-row">{([['original', '原图', '保持原始比例'], ['collectible', '收藏卡', '细金线 · 典藏边框'], ['player', '球员卡', '斜切线 · 竞技构图']] as const).map(([value, label, desc]) => <button key={value} type="button" aria-pressed={presentation.layout === value} onClick={() => change('layout', value)}><strong>{label}</strong><small>{desc}</small></button>)}</div></fieldset>
        <fieldset><legend>02 / 表面材质</legend><div className="card-finish-row">{([['none', '无材质'], ['foil', '闪箔'], ['emboss', '浮雕'], ['holo', '全息']] as const).map(([value, label]) => <button type="button" key={value} data-finish={value} aria-pressed={presentation.finish === value} onClick={() => change('finish', value)}><i aria-hidden="true" />{label}</button>)}</div><p className="card-helper">{presentation.finish === 'emboss' ? '浮雕模拟文字、边框与装饰纹理的压印，不改变人物几何。' : '材质可搭配任意版式；默认保留原图质感。'}</p></fieldset>
        {presentation.layout !== 'original' && <fieldset><legend>03 / 图片构图</legend><div className="card-fit-row"><button type="button" aria-pressed={presentation.fit === 'contain'} onClick={() => change('fit', 'contain')}>完整展示</button><button type="button" aria-pressed={presentation.fit === 'cover'} onClick={() => change('fit', 'cover')}>铺满卡面</button></div>{presentation.fit === 'cover' ? <div className="card-ranges">{range('cropX', '裁切位置 · 水平')}{range('cropY', '裁切位置 · 垂直')}<p className="card-helper">铺满会裁切超出画框的部分；滑块调整保留区域。</p></div> : <p className="card-helper">完整保留主体，比例不同处以卡面底色留白。</p>}</fieldset>}
        <fieldset><legend>可选 / 卡面文字</legend><div className="card-text-fields"><label>标题<input value={presentation.title} maxLength={48} onChange={e => change('title', e.target.value)} placeholder="为作品命名（可留空）" /></label><label>副标题<input value={presentation.subtitle} maxLength={72} onChange={e => change('subtitle', e.target.value)} placeholder="一句灵感（可留空）" /></label><label>编号<input value={presentation.number} maxLength={16} onChange={e => change('number', e.target.value)} placeholder="例如 001 / 100（可留空）" /></label></div></fieldset>
        {(presentation.finish === 'foil' || presentation.finish === 'holo') && <fieldset><legend>光泽位置 / 同步到导出</legend><div className="card-ranges">{range('lightX', '光位 · 水平')}{range('lightY', '光位 · 垂直')}</div></fieldset>}
        <button className="card-reset" type="button" onClick={() => { setPresentation({ ...DEFAULT_CARD_PRESENTATION }); setNotice('已恢复原图展示，保存后更新记录。') }}><RotateCcw size={15} />恢复原图与默认设置</button>
        <div className="card-feedback" aria-live="polite">{error ? <p role="alert">{error} 编辑内容已保留。</p> : notice || (dirty ? '存在未保存的展示样式。' : '展示样式只在点击保存后写入记录。')}</div>
      </section>
    </div>
    <footer className="card-viewer-footer"><button type="button" onClick={() => action('original')} disabled={!!busy}><Download size={16} />{busy === 'original' ? '下载中…' : '下载原图'}</button><div>{onSavePresentation && <button type="button" onClick={() => action('save')} disabled={!!busy || !dirty}><Save size={16} />{busy === 'save' ? '保存中…' : '保存展示样式'}</button>}<button className="card-primary" type="button" onClick={() => action('png')} disabled={!!busy || !image}><Download size={16} />{busy === 'png' ? '正在生成…' : '导出卡面 PNG'}</button></div></footer>
  </Dialog.Content></Dialog.Portal></Dialog.Root>
}
