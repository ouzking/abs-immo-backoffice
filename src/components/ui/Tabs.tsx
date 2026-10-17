import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface TabItem<K extends string> {
  key: K
  label: ReactNode
  count?: number
}

/** Onglets accessibles (role="tablist"), navigation au clavier par flèches. */
export function Tabs<K extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: Array<TabItem<K>>
  value: K
  onChange: (key: K) => void
  label: string
  className?: string
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const onKeyDown = (e: KeyboardEvent, index: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length
    refs.current[next]?.focus()
    onChange(items[next]!.key)
  }
  return (
    <div role="tablist" aria-label={label} className={cn('scroll-thin flex gap-1 overflow-x-auto border-b border-mist-200', className)}>
      {items.map((item, i) => {
        const active = item.key === value
        return (
          <button
            key={item.key}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors',
              active ? 'border-brand-red-600 text-navy-800' : 'border-transparent text-mist-500 hover:text-ink',
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  'tabular rounded-full px-1.5 py-0.5 text-[11px] font-bold',
                  active ? 'bg-navy-700 text-white' : 'bg-mist-100 text-mist-600',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
