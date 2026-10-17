import { useEffect, useState, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'

export function Avatar({ name, src, size = 'md', className }: { name: string | null | undefined; src?: string | null; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const dims = { sm: 'h-7 w-7 text-[11px]', md: 'h-9 w-9 text-xs', lg: 'h-14 w-14 text-base' }[size]
  if (src) return <img src={src} alt="" className={cn('shrink-0 rounded-full object-cover', dims, className)} />
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center rounded-full bg-navy-100 font-bold text-navy-800', dims, className)}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}

/** Champ de recherche avec temporisation (évite une requête par frappe). */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Rechercher…',
  label = 'Rechercher',
  delay = 350,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  delay?: number
  className?: string
}) {
  const [draft, setDraft] = useState(value)
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setDraft(value)
  }
  useEffect(() => {
    if (draft === value) return
    const t = window.setTimeout(() => onChange(draft), delay)
    return () => window.clearTimeout(t)
  }, [draft, value, delay, onChange])

  return (
    <div className={cn('relative min-w-0', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-mist-400" aria-hidden />
      <input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onChange(draft)
        }}
        placeholder={placeholder}
        aria-label={label}
        className="h-10 w-full rounded-lg border border-mist-300 bg-white pr-9 pl-9 text-sm shadow-xs placeholder:text-mist-400 focus:border-navy-500 focus:ring-2 focus:ring-navy-100 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {draft && (
        <button
          type="button"
          onClick={() => {
            setDraft('')
            onChange('')
          }}
          className="absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-mist-400 hover:bg-mist-100 hover:text-ink"
          aria-label="Effacer la recherche"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

/** Sélecteur compact pour les barres de filtres. */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel = 'Tous',
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  allLabel?: string
  className?: string
}) {
  return (
    <label className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span className="text-[11px] font-bold tracking-wide text-mist-500 uppercase">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-9 w-full min-w-0 rounded-lg border bg-white px-2.5 text-sm shadow-xs focus:border-navy-500 focus:ring-2 focus:ring-navy-100 focus:outline-none',
          value ? 'border-navy-300 font-semibold text-navy-800' : 'border-mist-300 text-ink',
        )}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Tuile d'indicateur (KPI). */
export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'navy',
  loading,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  tone?: 'navy' | 'red' | 'success' | 'warning' | 'neutral'
  loading?: boolean
}) {
  const toneBox = {
    navy: 'bg-navy-50 text-navy-700',
    red: 'bg-brand-red-50 text-brand-red-600',
    success: 'bg-success-50 text-success-700',
    warning: 'bg-warning-50 text-warning-700',
    neutral: 'bg-mist-100 text-mist-600',
  }[tone]
  return (
    <div className="rounded-card border border-mist-200 bg-white p-4 shadow-soft sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold text-mist-600">{label}</p>
        {icon && <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', toneBox)}>{icon}</span>}
      </div>
      {loading ? (
        <div className="skeleton mt-2 h-8 w-20 rounded-md" />
      ) : (
        <p className="tabular mt-1 text-[28px] leading-tight font-extrabold tracking-tight text-ink">{value}</p>
      )}
      {hint && <p className="mt-1 text-xs text-mist-500">{hint}</p>}
    </div>
  )
}
