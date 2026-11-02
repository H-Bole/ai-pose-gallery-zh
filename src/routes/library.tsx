import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { CardViewer } from '@/components/cards/CardViewer'
import { TiltSurface } from '@/components/motion/TiltSurface'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { loadCardImage, renderCard } from '@/lib/cardRenderer'
import { useStudio } from '@/store/studioStore'
import type { SavedCreation } from '@/types/gallery'
export const Route = createFileRoute('/library')({ staticData: {title: '作品与搭配库'}, component: LibraryPage })

function CreationFace({item}: {item: SavedCreation}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const styled = item.presentation && (item.presentation.layout !== 'original' || item.presentation.finish !== 'none' || item.presentation.title || item.presentation.subtitle || item.presentation.number)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!styled || !item.presentation) return
    let active = true
    loadCardImage(item.result.imageUrl).then((image) => { if (active && canvas.current) renderCard(canvas.current, image, item.presentation!, 600) }).catch(() => {if (active) setFailed(true)})
    return () => { active = false }
  }, [styled, item.presentation, item.result.imageUrl])
  return styled && !failed ? <canvas ref={canvas} className="max-h-96 w-full object-contain" role="img" aria-label={item.name} /> : <img src={item.result.imageUrl} alt={item.name} loading="lazy" className="h-full max-h-96 w-full object-contain" />
}
function LibraryPage() {
  const {creations, creationsReady, creationBusy, renameCreation, deleteCreation, savePresentation, loadCreation, outfits, loadOutfit, renameOutfit, deleteOutfit, setResultAsPortrait} = useStudio()
  const [viewed, setViewed] = useState<SavedCreation | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [rename, setRename] = useState<{id:string;name:string;legacy?:boolean}|null>(null)
  const [remove, setRemove] = useState<{id:string;legacy?:boolean}|null>(null)
  const [load, setLoad] = useState<{id:string;legacy?:boolean}|null>(null)
  const report = async (action:()=>Promise<unknown>, message:string) => {
    try {const result=await action();if(result===false)return false;toast.success(message);return true} catch(e){toast.error(e instanceof Error?e.message:'操作失败，原数据已保留');return false}
  }
  const filtered = creations.filter((x)=>`${x.name} ${x.result.recipeSummary}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <>
    <PageHeader title="作品与搭配库" actions={<Button asChild><Link to="/studio">去创作间</Link></Button>} />
    <p className="text-sm text-muted-foreground">命名保存的作品独立保留。可直接查看原图，也可选择卡面；有生成配方的作品能够恢复参考与参数。</p>
    <Input aria-label="搜索已保存作品" placeholder="搜索作品名称或参考摘要" value={query} onChange={(e)=>setQuery(e.target.value)} />
    {!creationsReady ? <p role="status">正在恢复作品库…</p> : !filtered.length ? <EmptyState title={query?'没有匹配作品':'还没有保存的作品'} description="在生成结果或历史记录中点击“保存作品”，不需要制作卡牌也能保存。" /> :
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filtered.map((item)=><article key={item.id} className="flex min-w-0 flex-col gap-3 rounded-2xl border bg-muted/50 p-3">
        <TiltSurface><button type="button" className="flex aspect-[5/7] w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-xl bg-background focus-visible:outline-2 focus-visible:outline-ring" aria-label={`查看作品：${item.name}`} onClick={()=>{setViewed(item);setViewerOpen(true)}}><CreationFace item={item}/></button></TiltSurface>
        <div><h2 className="break-words text-sm font-semibold">{item.name}</h2><p className="mt-1 text-xs text-muted-foreground">{item.result.snapshot?'含生成配方':'仅作品 · 未记录完整配方'}</p></div>
        <div className="mt-auto grid grid-cols-2 gap-2">
          <Button variant="outline" className="min-h-11" onClick={()=>{setViewed(item);setViewerOpen(true)}}>制卡与分享</Button>
          <Button variant="outline" className="min-h-11" onClick={()=>void setResultAsPortrait(item.result.imageUrl)}>继续创作</Button>
          {item.result.snapshot && <Button variant="outline" className="col-span-2 min-h-11" onClick={()=>setLoad({id:item.id})}>载入生成配方</Button>}
          <Button variant="ghost" className="min-h-11" onClick={()=>setRename({id:item.id,name:item.name})}>改名</Button>
          <Button variant="ghost" className="min-h-11" onClick={()=>setRemove({id:item.id})}>删除</Button>
        </div>
      </article>)}</div>}
    {outfits.length>0 && <section className="space-y-3 rounded-2xl border p-4"><h2 className="font-semibold">已有搭配（{outfits.length}）</h2><p className="text-xs text-muted-foreground">这些是旧版保存的参考与参数，没有绑定成品；记录仍可使用。</p>{outfits.map((item)=><div key={item.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-muted p-3"><span className="min-w-0 flex-1 break-words text-sm">{item.name}</span><Button variant="outline" className="min-h-11" onClick={()=>setLoad({id:item.id,legacy:true})}>载入</Button><Button variant="ghost" className="min-h-11" onClick={()=>setRename({id:item.id,name:item.name,legacy:true})}>改名</Button><Button variant="ghost" className="min-h-11" onClick={()=>setRemove({id:item.id,legacy:true})}>删除</Button></div>)}</section>}
    <CardViewer imageUrl={viewed?.result.imageUrl || ''} open={viewerOpen} onOpenChange={setViewerOpen} initialPresentation={viewed?.presentation} onSavePresentation={viewed ? (p)=>savePresentation(viewed.id,p) : undefined}/>
    <Dialog open={!!rename} onOpenChange={(open)=>{if(!open&&!creationBusy)setRename(null)}}><DialogContent><DialogHeader><DialogTitle>修改名称</DialogTitle><DialogDescription>名称只在本浏览器的作品库中使用。</DialogDescription></DialogHeader><form className="space-y-3" onSubmit={async(e)=>{e.preventDefault();if(rename && await report(()=>rename.legacy?renameOutfit(rename.id,rename.name):renameCreation(rename.id,rename.name),'名称已保存'))setRename(null)}}><Input aria-label="新名称" value={rename?.name||''} maxLength={80} onChange={(e)=>setRename((x)=>x?{...x,name:e.target.value}:null)}/><Button className="min-h-11" disabled={creationBusy||!rename?.name.trim()}>保存名称</Button></form></DialogContent></Dialog>
    <AlertDialog open={!!remove} onOpenChange={(open)=>{if(!open&&!creationBusy)setRemove(null)}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除这条保存记录？</AlertDialogTitle><AlertDialogDescription>只删除作品库中的记录，不会删除后端输出或其他生成历史。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>保留</AlertDialogCancel><Button disabled={creationBusy} onClick={async()=>{if(remove && await report(()=>remove.legacy?deleteOutfit(remove.id):deleteCreation(remove.id),'保存记录已删除'))setRemove(null)}}>删除记录</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={!!load} onOpenChange={(open)=>!open&&setLoad(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>载入生成配方？</AlertDialogTitle><AlertDialogDescription>将替换创作间当前参考图、提示词和生成设置，保留当前连接地址与密钥，不会自动生成。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>保留当前编辑</AlertDialogCancel><AlertDialogAction onClick={()=>{if(load){if(load.legacy)loadOutfit(load.id);else loadCreation(load.id)}setLoad(null)}}>确认载入</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>
}
