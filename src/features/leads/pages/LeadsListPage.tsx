import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { FilterX, Plus, Users } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable, type ColumnMeta } from '@/components/ui/DataTable'
import { FilterSelect, SearchInput } from '@/components/ui/Misc'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/States'
import { useAccess, useAuth } from '@/features/auth/AuthProvider'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { formatDate, formatPhone, formatRelative } from '@/lib/format'
import { LEAD_SOURCES, LEAD_STATUSES, labelOf, optionsOf, toneOf } from '@/lib/labels'
import type { LeadSource, LeadStatus } from '@/types'
import { listLeads, type LeadFilters, type LeadListRow } from '../api'
import { AssignedFilter } from '../components/AssignedFilter'
import { LeadFormDialog } from '../components/LeadFormDialog'
import { leadKeys } from '../hooks'

const PAGE_SIZE = 25

export function LeadsListPage() {
  const { can } = useAuth()
  const access = useAccess()
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const { values, set, page, setPage, activeCount } = useUrlFilters({
    q: '',
    status: 'open',
    source: '',
    assigned: '',
    sort: 'last_activity_at',
    dir: 'desc',
  })
  const sort = (['last_activity_at', 'created_at', 'full_name'].includes(values.sort) ? values.sort : 'last_activity_at') as LeadFilters['sort']
  const filters: LeadFilters = {
    q: values.q,
    status: (values.status === 'all' ? '' : values.status) as LeadStatus | '' | 'open',
    source: values.source as LeadSource | '',
    assigned: values.assigned,
    me: access.user_id,
    sort,
    desc: values.dir !== 'asc',
    page,
    pageSize: PAGE_SIZE,
  }
  const query = useQuery({ queryKey: leadKeys.list(filters), queryFn: () => listLeads(filters), placeholderData: keepPreviousData })

  const columns = useMemo<Array<ColumnDef<LeadListRow, unknown>>>(
    () => [
      {
        id: 'full_name',
        header: 'Prospect',
        enableSorting: true,
        cell: ({ row: { original: l } }) => (
          <Link to={`/prospects/${l.id}`} className="group block">
            <span className="font-semibold text-ink group-hover:text-navy-700 group-hover:underline">{l.full_name}</span>
            <span className="block text-xs text-mist-500">{[formatPhone(l.phone), l.email].filter((x) => x && x !== '—').join(' · ')}</span>
          </Link>
        ),
      },
      {
        id: 'status',
        header: 'Étape',
        cell: ({ row: { original: l } }) => <Badge tone={toneOf(LEAD_STATUSES, l.status)}>{labelOf(LEAD_STATUSES, l.status)}</Badge>,
      },
      { id: 'source', header: 'Canal', meta: { hideBelowLg: true } satisfies ColumnMeta, cell: ({ row: { original: l } }) => labelOf(LEAD_SOURCES, l.source) },
      {
        id: 'agent',
        header: 'Agent',
        cell: ({ row: { original: l } }) => l.agent?.display_name ?? <em className="text-mist-400">Non affecté</em>,
      },
      {
        id: 'last_activity_at',
        header: 'Dernière activité',
        enableSorting: true,
        meta: { className: 'whitespace-nowrap' } satisfies ColumnMeta,
        cell: ({ row: { original: l } }) => <span className="text-mist-600">{formatRelative(l.last_activity_at)}</span>,
      },
      {
        id: 'created_at',
        header: 'Création',
        enableSorting: true,
        meta: { hideBelowLg: true, className: 'whitespace-nowrap' } satisfies ColumnMeta,
        cell: ({ row: { original: l } }) => <span className="text-mist-600">{formatDate(l.created_at)}</span>,
      },
    ],
    [],
  )
  const sorting: SortingState = [{ id: sort ?? 'last_activity_at', desc: values.dir !== 'asc' }]

  return (
    <>
      <PageHeader
        title="Prospects"
        description={can('leads.read_all') ? 'Tous les contacts commerciaux de l’agence.' : 'Les prospects qui vous sont affectés.'}
        actions={
          can('leads.create') && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
              Nouveau prospect
            </Button>
          )
        }
      />
      <Card className="overflow-hidden">
        <div className="space-y-3 border-b border-mist-100 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput value={values.q} onChange={(q) => set({ q })} placeholder="Nom, e-mail ou téléphone…" className="flex-1" />
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" icon={<FilterX className="h-4 w-4" />} onClick={() => set({ q: '', status: 'open', source: '', assigned: '' })}>
                Réinitialiser
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <FilterSelect
              label="Étape"
              value={values.status === 'all' ? '' : values.status}
              onChange={(v) => set({ status: v || 'all' })}
              allLabel="Toutes"
              options={[{ value: 'open', label: 'En cours (hors convertis / non aboutis)' }, ...optionsOf(LEAD_STATUSES)]}
            />
            <FilterSelect label="Canal" value={values.source} onChange={(v) => set({ source: v })} options={optionsOf(LEAD_SOURCES)} />
            <AssignedFilter value={values.assigned} onChange={(v) => set({ assigned: v })} />
          </div>
        </div>
        <DataTable
          caption="Liste des prospects"
          data={query.data?.rows ?? []}
          columns={columns}
          loading={query.isFetching && !query.data ? true : query.isPlaceholderData}
          error={query.error}
          onRetry={() => void query.refetch()}
          getRowId={(r) => r.id}
          sorting={sorting}
          onSortingChange={(s) => s[0] && set({ sort: s[0].id, dir: s[0].desc ? 'desc' : 'asc' })}
          empty={<EmptyState icon={<Users className="h-6 w-6" />} title="Aucun prospect" description="Aucun prospect ne correspond à ces critères." />}
          mobileCard={(l) => (
            <Link to={`/prospects/${l.id}`} className="block px-4 py-3.5 active:bg-mist-50">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{l.full_name}</p>
                <Badge tone={toneOf(LEAD_STATUSES, l.status)}>{labelOf(LEAD_STATUSES, l.status)}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-mist-500">{[formatPhone(l.phone), l.email].filter((x) => x && x !== '—').join(' · ')}</p>
              <p className="mt-1 text-xs text-mist-500">
                {l.agent?.display_name ?? 'Non affecté'} · {formatRelative(l.last_activity_at)}
              </p>
            </Link>
          )}
        />
        {(query.data?.total ?? 0) > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={query.data!.total} onPageChange={setPage} label="prospects" />}
      </Card>
      {createOpen && <LeadFormDialog open onClose={() => setCreateOpen(false)} onCreated={(id) => navigate(`/prospects/${id}`)} />}
    </>
  )
}
