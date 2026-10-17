import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface Crumb {
  label: string
  to?: string
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  meta,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  breadcrumbs?: Crumb[]
  meta?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between', className)}>
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Fil d'Ariane" className="mb-2">
            <ol className="flex flex-wrap items-center gap-1 text-xs font-medium text-mist-500">
              {breadcrumbs.map((c, i) => (
                <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden />}
                  {c.to ? (
                    <Link to={c.to} className="rounded hover:text-navy-700 hover:underline">
                      {c.label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="text-mist-600">
                      {c.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-mist-500">{description}</p>}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
