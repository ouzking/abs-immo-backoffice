import { useMemo } from 'react'
import { Link } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { CalendarCheck } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { DataTable, type ColumnMeta } from '@/components/ui/DataTable'
import { SearchInput } from '@/components/ui/Misc'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/States'
import { Tabs } from '@/components/ui/Tabs'
import { useAccess, useAuth } from '@/features/auth/AuthProvider'
import { listViewings, type ViewingFilters, type ViewingRow } from '@/features/leads/api'
import { AssignedFilter } from '@/features/leads/components/AssignedFilter'
import { leadKeys } from '@/features/leads/hooks'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { formatDate, formatDateTime, formatPhone, formatRelative } from '@/lib/format'
import { TIME_SLOTS, VIEWING_STATUSES, labelOf, toneOf } from '@/lib/labels'
import { ViewingActions } from './ViewingActions'

const PAGE_SIZE = 25
const TABS = [
  { key: 'requested', label: 'À confirmer' },
  { key: 'upcoming', label: 'À venir' },
  { key: 'past', label: 'Passées' },
  { key: 'all', label: 'Toutes' },
] as const
type TabKey = (typeof TABS)[number]['key']

function tabFilters(tab: TabKey): Pick<ViewingFilters, 'status' | 'when'> {
  if (tab === 'requested') return { status: 'requested', when: '' }
  if (tab === 'upcoming') return { status: '', when: 'upcoming' }
  if (tab === 'past') return { status: '', when: 'past' }
  return { status: '', when: '' }
}

export function ViewingsPage() {
  const access = useAccess()
  const { can } = useAuth()
  const { values, set, page, setPage } = useUrlFilters({ tab: 'requested', q: '', assigned: '' })
  const tab = (TABS.some((t) => t.key === values.tab) ? values.tab : 'requested') as TabKey
  const filters: ViewingFilters = { ...tabFilters(tab), q: values.q, assigned: values.assigned, me: access.user_id, page, pageSize: PAGE_SIZE }
  const query = useQuery({ queryKey: leadKeys.viewingList(filters), queryFn: () => listViewings(filters), placeholderData: keepPreviousData })
  const canEdit = can('leads.update_all') || can('leads.access_assigned')

  const columns = useMemo<Array<ColumnDef<ViewingRow, unknown>>>(
    () => [
      {
        id: 'contact',
        header: 'Prospect',
        cell: ({ row: { original: v } }) =>
          v.lead ? (
            <Link to={`/prospects/${v.lead.id}`} className="group block">
              <span className="font-semibold group-hover:text-navy-700 group-hover:underline">{v.lead.full_name}</span>
              <span className="block text-xs text-mist-500">{formatPhone(v.lead.phone)}</span>
            </Link>
          ) : (
            '—'
          ),
      },
      {
        id: 'property',
        header: 'Bien',
        meta: { className: 'max-w-[260px]' } satisfies ColumnMeta,
        cell: ({ row: { original: v } }) =>
          v.property ? (
            <Link to={`/biens/${v.property.id}`} className="block truncate text-sm hover:text-navy-700 hover:underline">
              <span className="font-mono text-xs text-mist-500">{v.property.reference}</span> {v.property.title}
            </Link>
          ) : (
            <em className="text-mist-400">Bien supprimé</em>
          ),
      },
      {
        id: 'when',
        header: 'Date',
        meta: { className: 'whitespace-nowrap' } satisfies ColumnMeta,
        cell: ({ row: { original: v } }) =>
          v.scheduled_at ? (
            <span className="font-semibold">{formatDateTime(v.scheduled_at)}</span>
          ) : (
            <span className="text-mist-600">
              Souhaitée : {v.preferred_date ? formatDate(v.preferred_date) : 'libre'}
              <span className="block text-xs">{labelOf(TIME_SLOTS, v.preferred_time_slot)}</span>
            </span>
          ),
      },
      { id: 'agent', header: 'Agent', meta: { hideBelowLg: true } satisfies ColumnMeta, cell: ({ row: { original: v } }) => v.agent?.display_name ?? <em className="text-mist-400">Non affectée</em> },
      {
        id: 'status',
        header: 'Statut',
        cell: ({ row: { original: v } }) => (
          <div>
            <Badge tone={toneOf(VIEWING_STATUSES, v.status)}>{labelOf(VIEWING_STATUSES, v.status)}</Badge>
            <span className="mt-1 block text-xs text-mist-500">Demandée {formatRelative(v.created_at)}</span>
          </div>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row: { original: v } }) => <ViewingActions viewing={v} leadId={v.lead_id} canEdit={canEdit} compact />,
      },
    ],
    [canEdit],
  )

  return (
    <>
      <PageHeader
        title="Visites"
        description="Une visite n’est « confirmée » qu’après enregistrement d’une date de rendez-vous. Pensez à prévenir le prospect."
      />
      <Card className="overflow-hidden">
        <Tabs label="Visites" items={TABS.map((t) => ({ key: t.key, label: t.label }))} value={tab} onChange={(k) => set({ tab: k })} className="px-4" />
        <div className="grid gap-3 border-b border-mist-100 p-4 sm:grid-cols-[minmax(0,2fr)_1fr]">
          <div className="sm:self-end">
            <SearchInput value={values.q} onChange={(q) => set({ q })} placeholder="Nom ou e-mail du prospect…" />
          </div>
          <AssignedFilter value={values.assigned} onChange={(v) => set({ assigned: v })} />
        </div>
        <DataTable
          caption="Demandes de visite"
          data={query.data?.rows ?? []}
          columns={columns}
          loading={query.isFetching && !query.data ? true : query.isPlaceholderData}
          error={query.error}
          onRetry={() => void query.refetch()}
          getRowId={(r) => r.id}
          empty={<EmptyState icon={<CalendarCheck className="h-6 w-6" />} title="Aucune visite" description="Rien dans cette catégorie pour le moment." />}
          mobileCard={(v) => (
            <div className="space-y-2 px-4 py-3.5">
              <div className="flex items-start justify-between gap-2">
                {v.lead ? (
                  <Link to={`/prospects/${v.lead.id}`} className="font-semibold">
                    {v.lead.full_name}
                  </Link>
                ) : (
                  <span>—</span>
                )}
                <Badge tone={toneOf(VIEWING_STATUSES, v.status)}>{labelOf(VIEWING_STATUSES, v.status)}</Badge>
              </div>
              <p className="text-xs text-mist-500">
                {v.property ? `${v.property.reference} — ${v.property.title}` : 'Bien supprimé'}
                <br />
                {v.scheduled_at ? `Rendez-vous ${formatDateTime(v.scheduled_at)}` : `Souhaitée ${v.preferred_date ? formatDate(v.preferred_date) : 'date libre'} (${labelOf(TIME_SLOTS, v.preferred_time_slot)})`}
              </p>
              <ViewingActions viewing={v} leadId={v.lead_id} canEdit={canEdit} compact />
            </div>
          )}
        />
        {(query.data?.total ?? 0) > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={query.data!.total} onPageChange={setPage} label="visites" />}
      </Card>
    </>
  )
}
