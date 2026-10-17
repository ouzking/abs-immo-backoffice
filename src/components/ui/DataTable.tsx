import type { ReactNode } from 'react'
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { EmptyState, ErrorState, Skeleton } from './States'

export interface ColumnMeta {
  /** Classes de la cellule et de l'en-tête (largeur, alignement…). */
  className?: string
  /** Masque la colonne en dessous du point de rupture `lg` (vue tableau compacte). */
  hideBelowLg?: boolean
}

export interface DataTableProps<T> {
  data: T[]
  columns: Array<ColumnDef<T, unknown>>
  /** Tri côté serveur (contrôlé). Une colonne n'est triable que si `enableSorting: true`. */
  sorting?: SortingState
  onSortingChange?: (sorting: SortingState) => void
  loading?: boolean
  error?: unknown
  onRetry?: () => void
  empty?: ReactNode
  /** Rendu « carte » utilisé sur mobile et tablette portrait (< md). */
  mobileCard?: (row: T) => ReactNode
  getRowId?: (row: T) => string
  caption: string
  rowClassName?: (row: T) => string | undefined
}

/**
 * Tableau métier : tri et pagination délégués au serveur (manual*), états de
 * chargement / erreur / vide intégrés, et bascule en cartes sur petits écrans.
 */
export function DataTable<T>({
  data,
  columns,
  sorting,
  onSortingChange,
  loading,
  error,
  onRetry,
  empty,
  mobileCard,
  getRowId,
  caption,
  rowClassName,
}: DataTableProps<T>) {
  // TanStack Table renvoie des fonctions non mémoïsables : comportement attendu.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    enableSortingRemoval: false,
    enableMultiSort: false,
    state: { sorting: sorting ?? [] },
    onSortingChange: (updater) => {
      if (!onSortingChange) return
      onSortingChange(typeof updater === 'function' ? updater(sorting ?? []) : updater)
    },
    getRowId,
    defaultColumn: { enableSorting: false },
  })

  if (error && !loading) return <ErrorState error={error} onRetry={onRetry} />

  const rows = table.getRowModel().rows
  const showSkeleton = loading && rows.length === 0

  return (
    <div className={cn('relative', loading && rows.length > 0 && 'opacity-60 transition-opacity')} aria-busy={loading || undefined}>
      {/* Cartes (petits écrans) */}
      {mobileCard && (
        <ul className="divide-y divide-mist-100 md:hidden" aria-label={caption}>
          {showSkeleton
            ? Array.from({ length: 4 }, (_, i) => (
                <li key={i} className="space-y-2 px-4 py-4">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </li>
              ))
            : rows.map((row) => <li key={row.id}>{mobileCard(row.original)}</li>)}
        </ul>
      )}

      {/* Tableau (écrans moyens et grands) */}
      <div className={cn('scroll-thin overflow-x-auto', mobileCard && 'hidden md:block')}>
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b border-mist-200 bg-mist-50/80">
                {group.headers.map((header) => {
                  const meta = header.column.columnDef.meta as ColumnMeta | undefined
                  const sorted = header.column.getIsSorted()
                  const canSort = header.column.getCanSort()
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                      className={cn(
                        'px-4 py-3 text-xs font-bold tracking-wide whitespace-nowrap text-mist-500 uppercase',
                        meta?.hideBelowLg && 'hidden lg:table-cell',
                        meta?.className,
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="-mx-1 inline-flex items-center gap-1 rounded px-1 uppercase hover:text-ink"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' ? (
                            <ArrowUp className="h-3.5 w-3.5 text-navy-600" aria-hidden />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="h-3.5 w-3.5 text-navy-600" aria-hidden />
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-mist-100">
            {showSkeleton
              ? Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    {table.getAllLeafColumns().map((col) => {
                      const meta = col.columnDef.meta as ColumnMeta | undefined
                      return (
                        <td key={col.id} className={cn('px-4 py-4', meta?.hideBelowLg && 'hidden lg:table-cell')}>
                          <Skeleton className="h-4 w-full max-w-40" />
                        </td>
                      )
                    })}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr key={row.id} className={cn('transition-colors hover:bg-mist-50/70', rowClassName?.(row.original))}>
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as ColumnMeta | undefined
                      return (
                        <td
                          key={cell.id}
                          className={cn('px-4 py-3 align-middle', meta?.hideBelowLg && 'hidden lg:table-cell', meta?.className)}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      )
                    })}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {!loading && rows.length === 0 && (empty ?? <EmptyState title="Aucun résultat" description="Modifiez vos filtres de recherche." />)}
    </div>
  )
}
