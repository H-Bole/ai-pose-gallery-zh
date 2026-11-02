import type { ReactNode } from 'react'

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <h1 className="text-[22px] leading-snug font-semibold sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm leading-normal text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5 sm:gap-2">{actions}</div>}
    </div>
  )
}
