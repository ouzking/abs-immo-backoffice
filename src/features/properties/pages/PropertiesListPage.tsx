import { useMemo } from 'react'
import { Link } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { Building2, FilterX, Plus, Star } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable, type ColumnMeta } from '@/components/ui/DataTable'
import { FilterSelect, SearchInput } from '@/components/ui/Misc'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/States'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAgentOptions, usePropertyTypes } from '@/features/reference/hooks'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { formatDate, formatPrice, formatRelative } from '@/lib/format'
import { COMMERCIAL_STATUSES, PUBLICATION_STATUSES, TRANSACTION_TYPES, labelOf, optionsOf } from '@/lib/labels'
import type { CommercialStatus, PublicationStatus, TransactionType } from '@/types'
import { listProperties, type PropertyFilters, type PropertyListRow, type PropertySortKey } from '../api'
import { CommercialBadge, PropertyThumb, PublicationBadge } from '../components/PropertyBits'
import { propertyKeys, useCityOptions, useSignedImageUrls } from '../hooks'

const PAGE_SIZE = 20
const SORTABLE: PropertySortKey[] = ['updated_at', 'created_at', 'price_amount', 'title', 'reference']

export function PropertiesListPage() {
  const { can, access } = useAuth()
  const { values, set, page, setPage, activeCount } = useUrlFilters({
    q: '',
    type: '',
    transaction: '',
    city: '',
    publication: '',
    commercial: '',
    agent: '',
    sort: 'updated_at',
    dir: 'desc',
  })
  const types = usePropertyTypes()
  const agents = useAgentOptions()
  const cities = useCityOptions()

  const sort = (SORTABLE.includes(values.sort as PropertySortKey) ? values.sort : 'updated_at') as PropertySortKey
  const filters: PropertyFilters = {
    q: values.q,
    propertyType: values.type,
    transaction: values.transaction as TransactionType | '',
    cityId: values.city,
    publication: values.publication as PublicationStatus | '' | 'all',
    commercial: values.commercial as CommercialStatus | '',
    agentId: values.agent === 'me' ? access?.user_id : values.agent,
    sort,
    desc: values.dir !== 'asc',
    page,
    pageSize: PAGE_SIZE,
  }
  const query = useQuery({
    queryKey: propertyKeys.list(filters),
    queryFn: () => listProperties(filters),
    placeholderData: keepPreviousData,
  })
  const rows = useMemo(() => query.data?.rows ?? [], [query.data])
  const covers = useSignedImageUrls(rows.map((r) => r.cover[0]?.storage_path))
  const typeLabel = useMemo(() => Object.fromEntries((types.data ?? []).map((t) => [t.code, t.label])), [types.data])
  const coverUrl = (r: PropertyListRow) => covers.data?.get(r.cover[0]?.storage_path ?? '') ?? null

  const columns = useMemo<Array<ColumnDef<PropertyListRow, unknown>>>(
    () => [
      {
        id: 'title',
        header: 'Bien',
        enableSorting: true,
        meta: { className: 'min-w-[280px]' } satisfies ColumnMeta,
        cell: ({ row: { original: p } }) => (
          <Link to={`/biens/${p.id}`} className="group flex items-center gap-3">
            <PropertyThumb url={coverUrl(p)} loading={covers.isLoading} alt="" className="h-12 w-16" />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="line-clamp-1 font-semibold text-ink group-hover:text-navy-700 group-hover:underline">{p.title}</span>
                {p.is_featured && <Star className="h-3.5 w-3.5 shrink-0 fill-brand-red-600 text-brand-red-600" aria-label="Mis en avant" />}
              </span>
              <span className="block text-xs text-mist-500">
                <span className="font-mono">{p.reference}</span> · {typeLabel[p.property_type] ?? p.property_type} ·{' '}
                {labelOf(TRANSACTION_TYPES, p.transaction_type)}
              </span>
            </span>
          </Link>
        ),
      },
      {
        id: 'price_amount',
        header: 'Prix',
        enableSorting: true,
        meta: { className: 'whitespace-nowrap text-right' } satisfies ColumnMeta,
        cell: ({ row: { original: p } }) => (
          <span className="tabular font-semibold">{formatPrice(p.price_amount, { rentPeriod: p.rent_period, onRequest: p.price_on_request })}</span>
        ),
      },
      {
        id: 'city',
        header: 'Localisation',
        meta: { hideBelowLg: true } satisfies ColumnMeta,
        cell: ({ row: { original: p } }) => (
          <span className="text-mist-700">{[p.neighborhood?.name, p.city?.name].filter(Boolean).join(', ') || '—'}</span>
        ),
      },
      {
        id: 'status',
        header: 'Statuts',
        cell: ({ row: { original: p } }) => (
          <div className="flex flex-col items-start gap-1">
            <PublicationBadge status={p.publication_status} />
            <CommercialBadge status={p.commercial_status} />
          </div>
        ),
      },
      {
        id: 'agent',
        header: 'Agent',
        meta: { hideBelowLg: true } satisfies ColumnMeta,
        cell: ({ row: { original: p } }) => <span className="text-mist-700">{p.agent?.display_name ?? <em className="text-mist-400">Non affecté</em>}</span>,
      },
      {
        id: 'created_at',
        header: 'Création',
        enableSorting: true,
        meta: { hideBelowLg: true, className: 'whitespace-nowrap' } satisfies ColumnMeta,
        cell: ({ row: { original: p } }) => <span className="text-mist-600">{formatDate(p.created_at)}</span>,
      },
      {
        id: 'updated_at',
        header: 'Modification',
        enableSorting: true,
        meta: { className: 'whitespace-nowrap' } satisfies ColumnMeta,
        cell: ({ row: { original: p } }) => (
          <span className="text-mist-600" title={formatDate(p.updated_at)}>
            {formatRelative(p.updated_at)}
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [covers.data, covers.isLoading, typeLabel],
  )

  const sorting: SortingState = [{ id: sort, desc: values.dir !== 'asc' }]
  const resetFilters = () =>
    set({ q: '', type: '', transaction: '', city: '', publication: '', commercial: '', agent: '' })

  return (
    <>
      <PageHeader
        title="Biens immobiliers"
        description="Toutes les annonces de l'agence : brouillons, annonces publiées et archives."
        actions={
          can('properties.create') && (
            <ButtonLink to="/biens/nouveau" variant="primary" icon={<Plus className="h-4 w-4" />}>
              Nouveau bien
            </ButtonLink>
          )
        }
      />

      <Card className="overflow-hidden">
        <div className="space-y-3 border-b border-mist-100 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              value={values.q}
              onChange={(q) => set({ q })}
              placeholder="Rechercher par titre ou référence (ex. ABS-V-2600001)…"
              className="flex-1"
            />
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" icon={<FilterX className="h-4 w-4" />} onClick={resetFilters}>
                Réinitialiser ({activeCount})
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <FilterSelect
              label="Type"
              value={values.type}
              onChange={(v) => set({ type: v })}
              options={(types.data ?? []).map((t) => ({ value: t.code, label: t.label }))}
            />
            <FilterSelect label="Transaction" value={values.transaction} onChange={(v) => set({ transaction: v })} allLabel="Toutes" options={optionsOf(TRANSACTION_TYPES)} />
            <FilterSelect label="Ville" value={values.city} onChange={(v) => set({ city: v })} allLabel="Toutes" options={cities} />
            <FilterSelect
              label="Publication"
              value={values.publication}
              onChange={(v) => set({ publication: v })}
              allLabel="Tous (hors archives)"
              options={[...optionsOf(PUBLICATION_STATUSES), { value: 'all', label: 'Tous, archives comprises' }]}
            />
            <FilterSelect label="Statut commercial" value={values.commercial} onChange={(v) => set({ commercial: v })} options={optionsOf(COMMERCIAL_STATUSES)} />
            <FilterSelect
              label="Agent"
              value={values.agent}
              onChange={(v) => set({ agent: v })}
              options={[
                ...(access?.is_agent ? [{ value: 'me', label: 'Mes biens' }] : []),
                ...(agents.data ?? []).map((a) => ({ value: a.profile_id, label: a.display_name })),
              ]}
            />
          </div>
        </div>

        <DataTable
          caption="Liste des biens immobiliers"
          data={rows}
          columns={columns}
          loading={query.isFetching && !query.data ? true : query.isPlaceholderData}
          error={query.error}
          onRetry={() => void query.refetch()}
          getRowId={(r) => r.id}
          sorting={sorting}
          onSortingChange={(s) => {
            const first = s[0]
            if (first) set({ sort: first.id, dir: first.desc ? 'desc' : 'asc' })
          }}
          rowClassName={(r) => (r.publication_status === 'archived' ? 'opacity-70' : undefined)}
          empty={
            activeCount > 0 ? (
              <EmptyState
                title="Aucun bien ne correspond à ces critères"
                description="Élargissez la recherche ou réinitialisez les filtres."
                action={
                  <Button variant="secondary" onClick={resetFilters}>
                    Réinitialiser les filtres
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Building2 className="h-6 w-6" />}
                title="Aucun bien pour le moment"
                description="Créez une première annonce : elle restera en brouillon tant que vous ne la publiez pas."
                action={
                  can('properties.create') && (
                    <ButtonLink to="/biens/nouveau" variant="primary" icon={<Plus className="h-4 w-4" />}>
                      Créer un bien
                    </ButtonLink>
                  )
                }
              />
            )
          }
          mobileCard={(p) => (
            <Link to={`/biens/${p.id}`} className="flex gap-3 px-4 py-3.5 active:bg-mist-50">
              <PropertyThumb url={coverUrl(p)} loading={covers.isLoading} alt="" className="h-20 w-24" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold text-ink">{p.title}</p>
                <p className="mt-0.5 text-xs text-mist-500">
                  <span className="font-mono">{p.reference}</span> · {[p.neighborhood?.name, p.city?.name].filter(Boolean).join(', ')}
                </p>
                <p className="tabular mt-1 text-sm font-bold text-navy-800">
                  {formatPrice(p.price_amount, { rentPeriod: p.rent_period, onRequest: p.price_on_request })}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <PublicationBadge status={p.publication_status} />
                  <CommercialBadge status={p.commercial_status} />
                </div>
              </div>
            </Link>
          )}
        />
        {(query.data?.total ?? 0) > 0 && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onPageChange={setPage} label="biens" />
        )}
      </Card>
    </>
  )
}
