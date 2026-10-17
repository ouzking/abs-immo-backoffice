import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { SERIES } from '../chartTheme'

/**
 * Barres horizontales en HTML (une seule série = une seule couleur). Lisibles,
 * accessibles (liste + valeurs écrites) et sans dépendance de rendu SVG.
 */
export function BarList({
  items,
  color = SERIES.blue,
  emptyLabel = 'Aucune donnée sur cette période.',
}: {
  items: Array<{ key: string; label: string; value: number; hint?: string }>
  color?: string
  emptyLabel?: string
}) {
  const max = Math.max(1, ...items.map((i) => i.value))
  if (items.every((i) => i.value === 0)) return <p className="py-6 text-center text-sm text-mist-500">{emptyLabel}</p>
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.key} title={`${item.label} : ${formatNumber(item.value)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-mist-700">{item.label}</span>
            <span className="tabular shrink-0 font-bold text-ink">
              {formatNumber(item.value)}
              {item.hint && <span className="ml-1.5 text-xs font-medium text-mist-500">{item.hint}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-mist-100">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${(item.value / max) * 100}%`, background: color, minWidth: item.value > 0 ? 4 : 0 }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Barres empilées vente / location par type de bien, avec légende. */
export function StackedTypeBars({
  rows,
}: {
  rows: Array<{ key: string; label: string; sale: number; rent: number }>
}) {
  const max = Math.max(1, ...rows.map((r) => r.sale + r.rent))
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-mist-500">Aucun bien au catalogue.</p>
  return (
    <div>
      <ul className="mb-4 flex gap-5 text-xs text-mist-600" aria-label="Légende">
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.blue }} aria-hidden />
          Vente
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.red }} aria-hidden />
          Location
        </li>
      </ul>
      <ul className="space-y-3">
        {rows.map((r) => {
          const total = r.sale + r.rent
          return (
            <li key={r.key} title={`${r.label} : ${r.sale} en vente, ${r.rent} en location`}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
                <span className="truncate text-mist-700">{r.label}</span>
                <span className="tabular shrink-0 text-xs text-mist-500">
                  <span className="text-sm font-bold text-ink">{formatNumber(total)}</span>
                  <span className="ml-1.5">
                    ({r.sale} V · {r.rent} L)
                  </span>
                </span>
              </div>
              <div className="flex h-2 gap-[2px] overflow-hidden rounded-full bg-mist-100" style={{ width: `${(total / max) * 100}%`, minWidth: 6 }}>
                {r.sale > 0 && <div className="h-full" style={{ flex: r.sale, background: SERIES.blue }} />}
                {r.rent > 0 && <div className="h-full" style={{ flex: r.rent, background: SERIES.red }} />}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Répartition en deux parts (pas de camembert à deux parts : une barre proportionnelle chiffrée). */
export function SplitBar({
  parts,
  className,
}: {
  parts: Array<{ key: string; label: string; value: number; color: string }>
  className?: string
}) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  return (
    <div className={className}>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-mist-100">
        {total > 0 &&
          parts.map((p) => (p.value > 0 ? <div key={p.key} style={{ flex: p.value, background: p.color }} title={`${p.label} : ${p.value}`} /> : null))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        {parts.map((p) => (
          <div key={p.key} className={cn('rounded-lg border border-mist-100 bg-mist-50/60 px-3 py-2.5')}>
            <dt className="flex items-center gap-2 text-xs text-mist-600">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />
              {p.label}
            </dt>
            <dd className="mt-1 flex items-baseline gap-2">
              <span className="tabular text-xl font-extrabold text-ink">{formatNumber(p.value)}</span>
              <span className="tabular text-xs text-mist-500">{total > 0 ? `${Math.round((p.value / total) * 100)} %` : '—'}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
