import { HeartIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStudio } from '@/store/studioStore'
export function FavoriteButton({category, item, compact = false}: {category: string; item: {id: string; source?: string}; compact?: boolean}) {
  const {isFavorite, toggleFavorite, libraryReady, libraryBusy} = useStudio()
  const selected = isFavorite(category, item)
  const label = `${selected ? '取消收藏' : '收藏'} ${item.id}`
  return <Button type="button" variant={selected ? 'default' : 'secondary'} size="sm" className={compact ? 'size-11 shrink-0 p-0' : 'min-h-11'} disabled={!libraryReady || libraryBusy} aria-label={label} title={label} aria-pressed={selected} onClick={(e) => {e.stopPropagation(); void toggleFavorite(category, item)}}>
    <HeartIcon className={selected ? 'size-4 fill-current' : 'size-4'} />{!compact && (selected ? '已收藏' : '收藏')}
  </Button>
}
