import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { History, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Dialog } from '@/components/ui/Dialog'
import { FilterSelect } from '@/components/ui/Misc'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { Callout, EmptyState } from '@/components/ui/States'
import { useAgentNames } from '@/features/reference/hooks'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { formatDateTime } from '@/lib/format'
import {
  AUDIT_ACTIONS,
  AUDIT_FIELDS,
  AUDIT_TABLES,
  COMMERCIAL_STATUSES,
  LEAD_STATUSES,
  PUBLICATION_STATUSES,
  ROLES,
  labelOf,
  optionsOf,
  toneOf,
} from '@/lib/labels'
import type { AuditLog, Json } from '@/types'
import { fetchProfileNames, listAuditLogs, type AuditFilters } from './api'

const PAGE_SIZE = 30

function formatValue(field: string, value: Json | undefined, names: Record<string, string>): string {
  if (value === null || value === undefined) return '∅'
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
  if (typeof value === 'string') {
    if (field === 'publication_status') return labelOf(PUBLICATION_STATUSES, value)
    if (field === 'commercial_status') return labelOf(COMMERCIAL_STATUSES, value)
    if (field === 'role_code') return labelOf(ROLES, value)
    if (field === 'status' && value in LEAD_STATUSES) return labelOf(LEAD_STATUSES, value)
    if ((field === 'agent_id' || field === 'assigned_agent_id' || field === 'user_id') && names[value]) return names[value]!
    return value
  }
  if (typeof value === 'number') return new Intl.NumberFormat('fr-FR').format(value)
  return JSON.stringify(value)
}

function changedFields(log: AuditLog): string[] {
  const keys = new Set<string>()
  for (const src of [log.old_data, log.new_data]) {
    if (src && typeof src === 'object' && !Array.isArray(src)) Object.keys(src).forEach((k) => keys.add(k))
  }
  return [...keys]
}

function obj(v: Json | null): Record<string, Json | undefined> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, Json | undefined>) : {}
}

export function AuditPage() {
  const { values, set, page, setPage } = useUrlFilters({ table: '', action: '', from: '', to: '', record: '' })
  const [selected, setSelected] = useState<AuditLog | null>(null)
  const agentNames = useAgentNames()
  const filters: AuditFilters = { table: values.table, action: values.action, from: values.from, to: values.to, recordId: values.record, page, pageSize: PAGE_SIZE }
  const query = useQuery({ queryKey: ['audit', filters], queryFn: () => listAuditLogs(filters), placeholderData: keepPreviousData })
  const actorIds = (query.data?.rows ?? []).map((r) => r.actor_id).filter((x): x is string => !!x)
  const actors = useQuery({ queryKey: ['audit', 'actors', [...new Set(actorIds)].sort()], queryFn: () => fetchProfileNames(actorIds), enabled: actorIds.length > 0 })
  const names = useMemo(() => ({ ...agentNames, ...(actors.data ?? {}) }), [agentNames, actors.data])

  const columns = useMemo<Array<ColumnDef<AuditLog, unknown>>>(
    () => [
      { id: 'when', header: 'Date', meta: { className: 'whitespace-nowrap' }, cell: ({ row: { original: l } }) => formatDateTime(l.occurred_at) },
      {
        id: 'actor',
        header: 'Auteur',
        cell: ({ row: { original: l } }) => (l.actor_id ? (names[l.actor_id] ?? <span className="font-mono text-xs">{l.actor_id.slice(0, 8)}…</span>) : <em className="text-mist-500">Système</em>),
      },
      {
        id: 'action',
        header: 'Opération',
        cell: ({ row: { original: l } }) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={toneOf(AUDIT_ACTIONS, l.action)}>{labelOf(AUDIT_ACTIONS, l.action)}</Badge>
            <span className="text-sm">{labelOf(AUDIT_TABLES, l.table_name)}</span>
          </div>
        ),
      },
      {
        id: 'fields',
        header: 'Champs concernés',
        meta: { hideBelowLg: true, className: 'max-w-[320px]' },
        cell: ({ row: { original: l } }) => (
          <span className="line-clamp-2 text-xs text-mist-600">{changedFields(l).map((f) => labelOf(AUDIT_FIELDS, f)).join(', ') || '—'}</span>
        ),
      },
      {
        id: 'detail',
        header: '',
        cell: ({ row: { original: l } }) => (
          <Button size="sm" variant="ghost" onClick={() => setSelected(l)}>
            Détail
          </Button>
        ),
      },
    ],
    [names],
  )

  return (
    <>
      <PageHeader
        title="Journal d’audit"
        description="Opérations sensibles enregistrées automatiquement par la base de données. Le journal ne peut être ni modifié ni supprimé depuis l’application."
        meta={
          <span className="flex items-center gap-1.5 text-xs text-success-700">
            <ShieldCheck className="h-4 w-4" aria-hidden /> Source : déclencheurs PostgreSQL (lecture seule)
          </span>
        }
      />
      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 gap-3 border-b border-mist-100 p-4 md:grid-cols-5">
          <FilterSelect label="Domaine" value={values.table} onChange={(v) => set({ table: v })} options={Object.entries(AUDIT_TABLES).map(([value, label]) => ({ value, label }))} />
          <FilterSelect label="Opération" value={values.action} onChange={(v) => set({ action: v })} allLabel="Toutes" options={optionsOf(AUDIT_ACTIONS)} />
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold tracking-wide text-mist-500 uppercase">Du</span>
            <input type="date" value={values.from} onChange={(e) => set({ from: e.target.value })} className="h-9 rounded-lg border border-mist-300 px-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold tracking-wide text-mist-500 uppercase">Au</span>
            <input type="date" value={values.to} onChange={(e) => set({ to: e.target.value })} className="h-9 rounded-lg border border-mist-300 px-2 text-sm" />
          </label>
          <label className="col-span-2 flex flex-col gap-1 md:col-span-1">
            <span className="text-[11px] font-bold tracking-wide text-mist-500 uppercase">Identifiant d’élément</span>
            <input value={values.record} onChange={(e) => set({ record: e.target.value })} placeholder="UUID…" className="h-9 rounded-lg border border-mist-300 px-2 font-mono text-xs" />
          </label>
        </div>
        <DataTable
          caption="Journal d’audit"
          data={query.data?.rows ?? []}
          columns={columns}
          loading={query.isFetching && !query.data ? true : query.isPlaceholderData}
          error={query.error}
          onRetry={() => void query.refetch()}
          getRowId={(r) => String(r.id)}
          empty={<EmptyState icon={<History className="h-6 w-6" />} title="Aucun événement" description="Aucune opération ne correspond à ces critères." />}
          mobileCard={(l) => (
            <button type="button" onClick={() => setSelected(l)} className="block w-full px-4 py-3 text-left">
              <div className="flex items-center gap-2">
                <Badge tone={toneOf(AUDIT_ACTIONS, l.action)}>{labelOf(AUDIT_ACTIONS, l.action)}</Badge>
                <span className="text-sm font-semibold">{labelOf(AUDIT_TABLES, l.table_name)}</span>
              </div>
              <p className="mt-1 text-xs text-mist-500">
                {formatDateTime(l.occurred_at)} · {l.actor_id ? (names[l.actor_id] ?? 'Utilisateur') : 'Système'}
              </p>
            </button>
          )}
        />
        {(query.data?.total ?? 0) > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={query.data!.total} onPageChange={setPage} label="événements" />}
      </Card>

      {selected && (
        <Dialog
          open
          onClose={() => setSelected(null)}
          variant="drawer"
          size="lg"
          title={`${labelOf(AUDIT_ACTIONS, selected.action)} · ${labelOf(AUDIT_TABLES, selected.table_name)}`}
          description={`${formatDateTime(selected.occurred_at)} · ${selected.actor_id ? (names[selected.actor_id] ?? selected.actor_id) : 'Système'} (${selected.actor_role ?? '—'})`}
        >
          <div className="space-y-4">
            <p className="text-xs text-mist-500">
              Élément : <span className="font-mono break-all">{selected.record_id ?? '—'}</span>
            </p>
            {selected.action === 'UPDATE' && <Callout tone="neutral">Seules les colonnes modifiées sont enregistrées.</Callout>}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mist-200 text-left text-xs text-mist-500 uppercase">
                  <th className="py-2 pr-3">Champ</th>
                  <th className="py-2 pr-3">Avant</th>
                  <th className="py-2">Après</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist-100">
                {changedFields(selected).map((f) => (
                  <tr key={f} className="align-top">
                    <td className="py-2 pr-3 font-medium">{labelOf(AUDIT_FIELDS, f)}</td>
                    <td className="py-2 pr-3 break-all text-brand-red-700">{formatValue(f, obj(selected.old_data)[f], names)}</td>
                    <td className="py-2 break-all text-success-700">{formatValue(f, obj(selected.new_data)[f], names)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selected.context && Object.keys(obj(selected.context)).length > 0 && (
              <pre className="overflow-auto rounded-lg bg-mist-50 p-3 text-xs">{JSON.stringify(selected.context, null, 2)}</pre>
            )}
          </div>
        </Dialog>
      )}
    </>
  )
}
