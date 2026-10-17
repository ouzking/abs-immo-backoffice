import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { Button } from './Button'

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  label = 'résultats',
}: {
  /** Page courante, à partir de 0. */
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  label?: string
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)
  return (
    <nav
      className="flex flex-col items-center justify-between gap-3 border-t border-mist-100 px-4 py-3 text-sm text-mist-600 sm:flex-row"
      aria-label="Pagination"
    >
      <p className="tabular">
        <span className="font-semibold text-ink">
          {formatNumber(from)}–{formatNumber(to)}
        </span>{' '}
        sur <span className="font-semibold text-ink">{formatNumber(total)}</span> {label}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 0}
          icon={<ChevronLeft className="h-4 w-4" />}
          aria-label="Page précédente"
        >
          <span className="hidden sm:inline">Précédente</span>
        </Button>
        <span className="tabular px-1 text-xs text-mist-500" aria-current="page">
          Page {page + 1} / {pageCount}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page + 1 >= pageCount}
          aria-label="Page suivante"
        >
          <span className="hidden sm:inline">Suivante</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  )
}
