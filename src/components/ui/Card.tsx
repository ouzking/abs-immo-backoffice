import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-card border border-mist-200 bg-white shadow-soft', className)} {...rest} />
}

export function CardHeader({
  title,
  description,
  actions,
  icon,
  className,
  id,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  icon?: ReactNode
  className?: string
  id?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-mist-100 px-5 py-4', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 id={id} className="text-[15px] font-bold text-ink">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-mist-500">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-5', className)} {...rest} />
}

/** Liste de propriétés « libellé : valeur » pour les fiches de détail. */
export function DetailList({ items, className }: { items: Array<{ label: string; value: ReactNode; full?: boolean }>; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2', className)}>
      {items.map((item) => (
        <div key={item.label} className={cn('min-w-0', item.full && 'sm:col-span-2')}>
          <dt className="text-xs font-semibold tracking-wide text-mist-500 uppercase">{item.label}</dt>
          <dd className="mt-1 text-sm break-words text-ink">{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
