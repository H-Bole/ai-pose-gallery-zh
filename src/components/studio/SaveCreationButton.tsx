import { useState } from 'react'
import { toast } from '@/lib/notifications'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useStudio } from '@/store/studioStore'
import type { GenerationHistoryItem } from '@/types/gallery'
export function SaveCreationButton({ result }: { result: GenerationHistoryItem }) {
  const {saveCreation, creationBusy, creationsReady} = useStudio()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const save = async () => {
    try { await saveCreation(result, name); toast.success('作品已保存到作品与搭配库'); setOpen(false) }
    catch (e) { toast.error(e instanceof Error ? e.message : '作品保存失败，图片与编辑内容已保留') }
  }
  return <><Button variant="outline" className="min-h-11" disabled={!creationsReady} onClick={() => {setName(result.recipeSummary || '我的作品');setOpen(true)}}>保存作品</Button>
    <Dialog open={open} onOpenChange={(value) => {if (!creationBusy) setOpen(value)}}><DialogContent><DialogHeader><DialogTitle>保存作品</DialogTitle><DialogDescription>{result.snapshot ? '同时保留这次生成使用的参考图与参数，不包含连接地址和密钥。' : '这张旧作品没有完整配方，仍可保存图片、制作卡面和继续创作。'}</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={(e) => {e.preventDefault();void save()}}><Input aria-label="作品名称" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus /><div className="flex justify-end gap-2"><Button type="button" variant="ghost" disabled={creationBusy} onClick={() => setOpen(false)}>取消</Button><Button className="min-h-11" disabled={creationBusy || !name.trim()}>{creationBusy ? '正在保存…' : '保存作品'}</Button></div></form>
    </DialogContent></Dialog></>
}
