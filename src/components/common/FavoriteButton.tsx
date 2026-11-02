import { HeartIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStudio } from '@/store/studioStore'
export function FavoriteButton({category, item}: {category: string; item: {id: string; source?: string}}) {
  const {isFavorite, toggleFavorite, libraryReady, libraryBusy} = useStudio()
  const selected = isFavorite(category, item)
  return <Button variant="secondary" size="sm" className="min-h-11" disabled={!libraryReady || libraryBusy} aria-pressed={selected} onClick={(e) => {e.stopPropagation(); void toggleFavorite(category, item)}}>
    <HeartIcon className={selected ? 'size-4 fill-current' : 'size-4'} />{selected ? '已收藏' : '收藏'}
  </Button>
}
