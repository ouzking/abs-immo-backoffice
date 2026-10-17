import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { StatTile } from '@/components/ui/Misc'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { useAccess, useAuth } from '@/features/auth/AuthProvider'
import { fetchAgentPerformance, periodFromPreset } from '@/features/dashboard/api'
import { listLeads } from '@/features/leads/api'
import { formatNumber, formatRelative } from '@/lib/format'
import { LEAD_STATUSES, labelOf, toneOf } from '@/lib/labels'
import { getAgent } from '../api'
import { AgentForm } from '../components/AgentForm'

export function AgentDetailPage() {
  const { id = '' } = useParams()
  const { can } = useAuth()
  const access = useAccess()
  const isSelf = id === access.user_id
  const canStats = can('stats.read_all') || isSelf
  const canLeads = can('leads.read_all') || isSelf
  const period = useMemo(() => periodFromPreset('30d'), [])

  const agent = useQuery({ queryKey: ['agents', 'detail', id], queryFn: () => getAgent(id) })
  const perf = useQuery({ queryKey: ['agents', 'perf', id], queryFn: () => fetchAgentPerformance(period), enabled: canStats })
  const leads = useQuery({
    queryKey: ['leads', 'list', { agent: id, open: true }],
    queryFn: () => listLeads({ assigned: id, status: 'open', pageSize: 8 }),
    enabled: canLeads,
  })

  if (agent.error) return <ErrorState error={agent.error} onRetry={() => void agent.refetch()} />
  if (agent.isLoading || !agent.data) return <LoadingBlock />
  const a = agent.data
  const p = perf.data?.find((r) => r.agent_id === id)
  const canManage = can('agents.manage')

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Agents', to: '/agents' }, { label: a.display_name }]}
        title={a.display_name}
        meta={
          <>
            {a.is_active ? <Badge tone="success">Actif</Badge> : <Badge tone="muted">Inactif</Badge>}
            {a.is_public ? <Badge tone="navy">Fiche publique</Badge> : <Badge>Non publique</Badge>}
            {a.profile?.email && <span className="text-sm text-mist-500">{a.profile.email}</span>}
          </>
        }
        actions={
          <ButtonLink to={`/biens?agent=${id}`} icon={<ArrowRight className="h-4 w-4" />}>
            Biens de l’agent
          </ButtonLink>
        }
      />

      {canStats && (
        <section className="mb-6" aria-label="Activité sur 30 jours">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatTile loading={perf.isLoading} label="Biens (publiés)" value={p ? `${formatNumber(p.properties_total)} (${formatNumber(p.properties_published)})` : '—'} />
            <StatTile loading={perf.isLoading} label="Prospects ouverts" value={formatNumber(p?.leads_assigned_open)} />
            <StatTile loading={perf.isLoading} label="Demandes reçues · 30 j" value={formatNumber(p?.inquiries_received)} hint={p && `${p.inquiries_answered} répondues`} />
            <StatTile loading={perf.isLoading} label="Visites réalisées · 30 j" value={formatNumber(p?.viewings_completed)} hint={p && `${p.leads_won} prospect(s) converti(s)`} tone="success" />
          </div>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title="Fiche commerciale" description="Les coordonnées publiques apparaissent sur le site lorsque la fiche est publique." />
          <CardBody>
            <AgentForm key={a.updated_at} agent={a} canManage={canManage} canEdit={canManage || isSelf} />
          </CardBody>
        </Card>
        {canLeads && (
          <Card>
            <CardHeader title="Prospects en cours" description="Affectés à cet agent." />
            {leads.error ? (
              <ErrorState error={leads.error} compact />
            ) : leads.isLoading ? (
              <div className="p-5">
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (leads.data?.rows ?? []).length === 0 ? (
              <p className="px-5 py-4 text-sm text-mist-500">Aucun prospect en cours.</p>
            ) : (
              <ul className="divide-y divide-mist-100">
                {leads.data!.rows.map((l) => (
                  <li key={l.id}>
                    <Link to={`/prospects/${l.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-mist-50">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{l.full_name}</span>
                        <span className="text-xs text-mist-500">{formatRelative(l.last_activity_at)}</span>
                      </span>
                      <Badge tone={toneOf(LEAD_STATUSES, l.status)}>{labelOf(LEAD_STATUSES, l.status)}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {(leads.data?.total ?? 0) > 8 && (
              <div className="border-t border-mist-100 px-5 py-3 text-sm">
                <Link to={`/prospects?assigned=${id}`} className="font-semibold text-navy-700 hover:underline">
                  Voir les {leads.data!.total} prospects
                </Link>
              </div>
            )}
          </Card>
        )}
      </div>
    </>
  )
}
