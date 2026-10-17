import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { ArrowRight, Inbox } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, DetailList } from '@/components/ui/Card'
import { DataTable, type ColumnMeta } from '@/components/ui/DataTable'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Select } from '@/components/ui/Form'
import { FilterSelect, SearchInput } from '@/components/ui/Misc'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/States'
import { Tabs } from '@/components/ui/Tabs'
import { useAccess, useAuth } from '@/features/auth/AuthProvider'
import { useAgentOptions } from '@/features/reference/hooks'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { errorMessage } from '@/lib/errors'
import { formatDateTime, formatPhone, formatRelative } from '@/lib/format'
import { INQUIRY_STATUSES, INQUIRY_TYPES, LEAD_SOURCES, labelOf, optionsOf, toneOf } from '@/lib/labels'
import type { InquiryStatus, InquiryType, LeadSource } from '@/types'
import { listInquiries, updateInquiry, type InquiryFilters, type InquiryRow } from '../api'
import { AssignedFilter } from '../components/AssignedFilter'
import { leadKeys, useInvalidateLeads } from '../hooks'

const PAGE_SIZE = 25
const TABS = [
  { key: 'new', label: 'Nouvelles' },
  { key: 'in_progress', label: 'En cours' },
  { key: 'answered', label: 'Répondues' },
  { key: 'closed', label: 'Clôturées' },
  { key: 'spam', label: 'Indésirables' },
  { key: 'all', label: 'Toutes' },
] as const

export function InquiriesPage() {
  const access = useAccess()
  const { can } = useAuth()
  const { values, set, page, setPage } = useUrlFilters({ tab: 'new', q: '', type: '', channel: '', assigned: '' })
  const [selected, setSelected] = useState<InquiryRow | null>(null)
  const filters: InquiryFilters = {
    q: values.q,
    status: values.tab === 'all' ? '' : (values.tab as InquiryStatus),
    type: values.type as InquiryType | '',
    channel: values.channel as LeadSource | '',
    assigned: values.assigned,
    me: access.user_id,
    page,
    pageSize: PAGE_SIZE,
  }
  const query = useQuery({ queryKey: leadKeys.inbox(filters), queryFn: () => listInquiries(filters), placeholderData: keepPreviousData })
  const invalidate = useInvalidateLeads()
  const statusMutation = useMutation({
    mutationFn: (v: { row: InquiryRow; status: InquiryStatus }) => updateInquiry(v.row.id, { status: v.status }),
    onSuccess: (row, v) => {
      invalidate(v.row.lead_id)
      toast.success(`Demande : ${labelOf(INQUIRY_STATUSES, row.status)}.`)
    },
    onError: (e) => toast.error('Demande non modifiée', { description: errorMessage(e) }),
  })
  const canUpdate = can('leads.update_all') || can('leads.access_assigned')

  const columns = useMemo<Array<ColumnDef<InquiryRow, unknown>>>(
    () => [
      {
        id: 'contact',
        header: 'Contact',
        cell: ({ row: { original: i } }) => (
          <button type="button" onClick={() => setSelected(i)} className="group text-left">
            <span className="font-semibold text-ink group-hover:text-navy-700 group-hover:underline">{i.lead?.full_name ?? '—'}</span>
            <span className="block text-xs text-mist-500">{[formatPhone(i.lead?.phone), i.lead?.email].filter((x) => x && x !== '—').join(' · ')}</span>
          </button>
        ),
      },
      {
        id: 'request',
        header: 'Demande',
        meta: { className: 'max-w-[340px]' } satisfies ColumnMeta,
        cell: ({ row: { original: i } }) => (
          <div className="min-w-0">
            <p className="text-sm font-medium">{labelOf(INQUIRY_TYPES, i.inquiry_type)}</p>
            <p className="truncate text-xs text-mist-500">{i.property ? `${i.property.reference} — ${i.property.title}` : i.message ?? '—'}</p>
          </div>
        ),
      },
      { id: 'channel', header: 'Canal', meta: { hideBelowLg: true } satisfies ColumnMeta, cell: ({ row: { original: i } }) => labelOf(LEAD_SOURCES, i.channel) },
      { id: 'agent', header: 'Agent', meta: { hideBelowLg: true } satisfies ColumnMeta, cell: ({ row: { original: i } }) => i.agent?.display_name ?? <em className="text-mist-400">Non affectée</em> },
      {
        id: 'created_at',
        header: 'Reçue',
        meta: { className: 'whitespace-nowrap' } satisfies ColumnMeta,
        cell: ({ row: { original: i } }) => <span title={formatDateTime(i.created_at)}>{formatRelative(i.created_at)}</span>,
      },
      {
        id: 'status',
        header: 'Statut',
        meta: { className: 'w-44' } satisfies ColumnMeta,
        cell: ({ row: { original: i } }) =>
          canUpdate ? (
            <Select
              aria-label={`Statut de la demande de ${i.lead?.full_name ?? ''}`}
              value={i.status}
              onChange={(e) => statusMutation.mutate({ row: i, status: e.target.value as InquiryStatus })}
              options={optionsOf(INQUIRY_STATUSES)}
              className="h-8 text-xs"
            />
          ) : (
            <Badge tone={toneOf(INQUIRY_STATUSES, i.status)}>{labelOf(INQUIRY_STATUSES, i.status)}</Badge>
          ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canUpdate],
  )

  return (
    <>
      <PageHeader title="Demandes" description="Demandes de renseignement reçues par le site et saisies par l’équipe." />
      <Card className="overflow-hidden">
        <Tabs label="Statut des demandes" items={TABS.map((t) => ({ key: t.key, label: t.label }))} value={values.tab as (typeof TABS)[number]['key']} onChange={(tab) => set({ tab })} className="px-4" />
        <div className="grid gap-3 border-b border-mist-100 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr]">
          <div className="sm:col-span-2 lg:col-span-1 lg:self-end">
            <SearchInput value={values.q} onChange={(q) => set({ q })} placeholder="Nom ou e-mail du contact…" />
          </div>
          <FilterSelect label="Type" value={values.type} onChange={(v) => set({ type: v })} options={optionsOf(INQUIRY_TYPES)} />
          <FilterSelect label="Canal" value={values.channel} onChange={(v) => set({ channel: v })} options={optionsOf(LEAD_SOURCES)} />
          <AssignedFilter value={values.assigned} onChange={(v) => set({ assigned: v })} />
        </div>
        <DataTable
          caption="Demandes de renseignement"
          data={query.data?.rows ?? []}
          columns={columns}
          loading={query.isFetching && !query.data ? true : query.isPlaceholderData}
          error={query.error}
          onRetry={() => void query.refetch()}
          getRowId={(r) => r.id}
          empty={<EmptyState icon={<Inbox className="h-6 w-6" />} title="Aucune demande" description="Rien à traiter dans cette catégorie." />}
          mobileCard={(i) => (
            <button type="button" onClick={() => setSelected(i)} className="block w-full px-4 py-3.5 text-left active:bg-mist-50">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{i.lead?.full_name ?? '—'}</p>
                <Badge tone={toneOf(INQUIRY_STATUSES, i.status)}>{labelOf(INQUIRY_STATUSES, i.status)}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-mist-500">
                {labelOf(INQUIRY_TYPES, i.inquiry_type)}
                {i.property ? ` · ${i.property.reference}` : ''} · {formatRelative(i.created_at)}
              </p>
              {i.message && <p className="mt-1 line-clamp-2 text-sm text-mist-700">{i.message}</p>}
            </button>
          )}
        />
        {(query.data?.total ?? 0) > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={query.data!.total} onPageChange={setPage} label="demandes" />}
      </Card>
      {selected && <InquiryDrawer inquiry={selected} onClose={() => setSelected(null)} />}
    </>
  )
}

function InquiryDrawer({ inquiry, onClose }: { inquiry: InquiryRow; onClose: () => void }) {
  const { can } = useAuth()
  const agents = useAgentOptions()
  const invalidate = useInvalidateLeads()
  const [status, setStatus] = useState<InquiryStatus>(inquiry.status)
  const [agentId, setAgentId] = useState(inquiry.assigned_agent_id ?? '')
  const canAssign = can('leads.assign')
  const mutation = useMutation({
    mutationFn: () =>
      updateInquiry(inquiry.id, {
        status,
        ...(canAssign && (agentId || null) !== inquiry.assigned_agent_id ? { assigned_agent_id: agentId || null } : {}),
      }),
    onSuccess: () => {
      invalidate(inquiry.lead_id)
      toast.success('Demande mise à jour.')
      onClose()
    },
    onError: (e) => toast.error('Demande non modifiée', { description: errorMessage(e) }),
  })
  const meta = (inquiry.submission_meta ?? {}) as Record<string, unknown>

  return (
    <Dialog
      open
      onClose={onClose}
      variant="drawer"
      title={inquiry.lead?.full_name ?? 'Demande'}
      description={`${labelOf(INQUIRY_TYPES, inquiry.inquiry_type)} · reçue le ${formatDateTime(inquiry.created_at)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {inquiry.message ? (
          <div className="rounded-xl bg-mist-50 p-4 text-sm leading-relaxed whitespace-pre-line">{inquiry.message}</div>
        ) : (
          <p className="text-sm text-mist-500">Aucun message.</p>
        )}
        <DetailList
          items={[
            { label: 'Téléphone', value: formatPhone(inquiry.lead?.phone) },
            { label: 'E-mail', value: inquiry.lead?.email ?? '—' },
            { label: 'Canal', value: labelOf(LEAD_SOURCES, inquiry.channel) },
            {
              label: 'Bien concerné',
              value: inquiry.property ? (
                <Link to={`/biens/${inquiry.property.id}`} className="text-navy-700 hover:underline">
                  {inquiry.property.reference}
                </Link>
              ) : (
                '—'
              ),
            },
            ...(typeof meta.page_url === 'string' ? [{ label: 'Page d’origine', value: <span className="break-all">{meta.page_url}</span>, full: true }] : []),
            ...(meta.entered_manually ? [{ label: 'Origine', value: 'Saisie manuelle' }] : []),
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Statut">
            <Select value={status} onChange={(e) => setStatus(e.target.value as InquiryStatus)} options={optionsOf(INQUIRY_STATUSES)} />
          </Field>
          {canAssign && (
            <Field label="Agent affecté">
              <Select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                placeholder="Non affectée"
                options={(agents.data ?? []).filter((a) => a.is_active || a.profile_id === inquiry.assigned_agent_id).map((a) => ({ value: a.profile_id, label: a.display_name }))}
              />
            </Field>
          )}
        </div>
        {inquiry.lead && (
          <ButtonLink to={`/prospects/${inquiry.lead.id}`} variant="secondary" className="w-full" icon={<ArrowRight className="h-4 w-4" />}>
            Ouvrir la fiche prospect (historique, notes, visites)
          </ButtonLink>
        )}
      </div>
    </Dialog>
  )
}
