import { useMemo } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  Globe2,
  Handshake,
  Inbox,
  MailWarning,
  UsersRound,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { FilterSelect, StatTile } from '@/components/ui/Misc'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useAuth } from '@/features/auth/AuthProvider'
import { listRecentInquiries } from '@/features/leads/api'
import { listRecentProperties } from '@/features/properties/api'
import { CommercialBadge, PropertyThumb, PublicationBadge } from '@/features/properties/components/PropertyBits'
import { useSignedImageUrls } from '@/features/properties/hooks'
import { useAgentOptions, usePropertyTypeLabels } from '@/features/reference/hooks'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { cn } from '@/lib/cn'
import { formatDecimal, formatNumber, formatPrice, formatRelative } from '@/lib/format'
import { COMMERCIAL_STATUSES, INQUIRY_STATUSES, INQUIRY_TYPES, LEAD_STATUSES, labelOf, toneOf } from '@/lib/labels'
import type { LeadStatus } from '@/types'
import { PERIOD_PRESETS, fetchAgentPerformance, fetchDashboardStats, fetchTimeseries, periodFromPreset, type PeriodKey } from './api'
import { SERIES } from './chartTheme'
import { ActivityChart } from './components/ActivityChart'
import { DashboardHero } from './components/DashboardHero'
import { BarList, SplitBar, StackedTypeBars } from './components/Bars'

const LEAD_PIPELINE: LeadStatus[] = ['new', 'contacted', 'qualified', 'visit_scheduled', 'negotiation', 'won', 'lost']

function greeting(): string {
  const h = Number(new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', hour12: false, timeZone: 'Africa/Dakar' }).format(new Date()))
  return h < 18 ? 'Bonjour' : 'Bonsoir'
}

export function DashboardPage() {
  const { access, can } = useAuth()
  const canAll = can('stats.read_all')
  const { values, set } = useUrlFilters({ period: '30d', agent: '' })
  const periodKey = (PERIOD_PRESETS.some((p) => p.key === values.period) ? values.period : '30d') as PeriodKey
  // La période est recalculée à chaque changement de filtre (fin = maintenant).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const period = useMemo(() => periodFromPreset(periodKey), [periodKey, values.agent])
  const agentId = canAll ? values.agent || null : null

  const agents = useAgentOptions()
  const typeLabels = usePropertyTypeLabels()
  const stats = useQuery({ queryKey: ['dashboard', 'stats', periodKey, agentId], queryFn: () => fetchDashboardStats(period, agentId) })
  const series = useQuery({ queryKey: ['dashboard', 'series', periodKey, agentId], queryFn: () => fetchTimeseries(period, agentId) })
  const perf = useQuery({ queryKey: ['dashboard', 'perf', periodKey], queryFn: () => fetchAgentPerformance(period), enabled: canAll })
  const recentProps = useQuery({ queryKey: ['dashboard', 'recent-properties'], queryFn: () => listRecentProperties(6) })
  const canLeads = can('leads.access_assigned') || can('leads.read_all')
  const recentInq = useQuery({ queryKey: ['dashboard', 'recent-inquiries'], queryFn: () => listRecentInquiries(6), enabled: canLeads })
  const covers = useSignedImageUrls((recentProps.data ?? []).map((p) => p.cover[0]?.storage_path))

  const s = stats.data
  const loading = stats.isLoading
  const periodLabel = PERIOD_PRESETS.find((p) => p.key === periodKey)?.label ?? ''

  const typeRows = useMemo(() => {
    const map = new Map<string, { key: string; label: string; sale: number; rent: number }>()
    for (const r of s?.properties.by_type ?? []) {
      const row = map.get(r.property_type) ?? { key: r.property_type, label: typeLabels[r.property_type] ?? r.property_type, sale: 0, rent: 0 }
      if (r.transaction_type === 'sale') row.sale += r.total
      else row.rent += r.total
      map.set(r.property_type, row)
    }
    return [...map.values()].sort((a, b) => b.sale + b.rent - (a.sale + a.rent))
  }, [s, typeLabels])

  const firstName = (access?.full_name ?? '').split(' ')[0]

  return (
    <>
      <DashboardHero
        greeting={firstName ? `${greeting()}, ${firstName}` : greeting()}
        description={
          canAll
            ? "Vue d'ensemble de l'activité de l'agence, calculée en temps réel à partir des données enregistrées."
            : 'Vos biens, vos demandes et vos prospects, calculés en temps réel.'
        }
        pendingInquiries={s?.inquiries.pending}
        pendingViewings={s?.viewings.pending}
        canCreate={can('properties.create')}
        canLeads={canLeads}
      />
      {/* Filtres */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex rounded-lg border border-mist-200 bg-white p-0.5 shadow-xs" role="group" aria-label="Période">
          {PERIOD_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => set({ period: p.key })}
              aria-pressed={periodKey === p.key}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
                periodKey === p.key ? 'bg-navy-700 text-white' : 'text-mist-600 hover:bg-mist-100',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {canAll && (
          <FilterSelect
            label="Périmètre"
            className="w-56"
            value={values.agent}
            onChange={(v) => set({ agent: v })}
            allLabel="Toute l'agence"
            options={(agents.data ?? []).map((a) => ({ value: a.profile_id, label: a.display_name }))}
          />
        )}
      </div>

      {stats.error ? (
        <Card>
          <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Portefeuille */}
          <section aria-labelledby="kpi-portfolio">
            <h2 id="kpi-portfolio" className="mb-3 text-xs font-bold tracking-[0.14em] text-mist-500 uppercase">
              Portefeuille
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              <StatTile
                loading={loading}
                label="Biens au catalogue"
                value={formatNumber(s?.properties.total)}
                hint={s && `${formatNumber(s.properties.draft + s.properties.pending_review)} en préparation · ${formatNumber(s.properties.archived)} archivés`}
                icon={<Building2 className="h-4 w-4" />}
              />
              <StatTile
                loading={loading}
                label="Biens publiés"
                value={formatNumber(s?.properties.published)}
                hint={s && `${formatNumber(s.properties.published_in_period)} publiés sur ${periodLabel}`}
                icon={<Globe2 className="h-4 w-4" />}
                tone="success"
              />
              <StatTile
                loading={loading}
                label="Biens disponibles"
                value={formatNumber(s?.properties.available)}
                hint={s && `${formatNumber(s.properties.reserved)} réservés`}
                icon={<CheckCircle2 className="h-4 w-4" />}
                tone="navy"
              />
              <StatTile
                loading={loading}
                label="Vendus ou loués"
                value={formatNumber(s ? s.properties.sold + s.properties.rented : undefined)}
                hint={s && `${formatNumber(s.properties.sold_in_period + s.properties.rented_in_period)} sur ${periodLabel}`}
                icon={<Handshake className="h-4 w-4" />}
                tone="red"
              />
            </div>
          </section>

          {/* Activité commerciale */}
          <section aria-labelledby="kpi-commercial">
            <h2 id="kpi-commercial" className="mb-3 text-xs font-bold tracking-[0.14em] text-mist-500 uppercase">
              Activité commerciale · {periodLabel}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              <StatTile
                loading={loading}
                label="Nouvelles demandes"
                value={formatNumber(s?.inquiries.received_in_period)}
                hint={
                  s &&
                  (s.inquiries.median_response_hours !== null
                    ? `Délai médian de réponse : ${formatDecimal(s.inquiries.median_response_hours)} h`
                    : `${formatNumber(s.inquiries.answered_in_period)} répondues`)
                }
                icon={<Inbox className="h-4 w-4" />}
              />
              <StatTile
                loading={loading}
                label="Demandes en attente"
                value={formatNumber(s?.inquiries.pending)}
                hint={s && `${formatNumber(s.inquiries.in_progress)} en cours de traitement`}
                icon={<MailWarning className="h-4 w-4" />}
                tone={s && s.inquiries.pending > 0 ? 'warning' : 'neutral'}
              />
              <StatTile
                loading={loading}
                label="Visites demandées"
                value={formatNumber(s?.viewings.requested_in_period)}
                hint={s && `${formatNumber(s.viewings.pending)} à confirmer · ${formatNumber(s.viewings.upcoming)} à venir`}
                icon={<CalendarClock className="h-4 w-4" />}
                tone="navy"
              />
              <StatTile
                loading={loading}
                label="Prospects en suivi"
                value={formatNumber(s?.leads.open)}
                hint={s && `${formatNumber(s.leads.new_in_period)} nouveaux · ${formatNumber(s.leads.unassigned)} non affectés`}
                icon={<UsersRound className="h-4 w-4" />}
                tone="success"
              />
            </div>
          </section>

          {/* Évolution */}
          <Card>
            <CardHeader
              title="Évolution des demandes"
              description={`Demandes de renseignement, demandes de visite et nouveaux prospects — ${periodLabel}, par ${
                period.interval === 'day' ? 'jour' : period.interval === 'week' ? 'semaine' : 'mois'
              }.`}
            />
            <CardBody>
              {series.error ? (
                <ErrorState error={series.error} onRetry={() => void series.refetch()} compact />
              ) : series.isLoading ? (
                <Skeleton className="h-72 w-full" />
              ) : (
                <ActivityChart data={series.data ?? []} interval={period.interval} />
              )}
            </CardBody>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Biens par catégorie" description="Hors archives, par type et transaction." />
              <CardBody>{loading ? <Skeleton className="h-48 w-full" /> : <StackedTypeBars rows={typeRows} />}</CardBody>
            </Card>
            <div className="grid gap-6">
              <Card>
                <CardHeader title="Vente et location" description="Répartition du catalogue (hors archives)." />
                <CardBody>
                  {loading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : (
                    <SplitBar
                      parts={[
                        { key: 'sale', label: 'Vente', value: s?.properties.by_transaction.sale ?? 0, color: SERIES.blue },
                        { key: 'rent', label: 'Location', value: s?.properties.by_transaction.rent ?? 0, color: SERIES.red },
                      ]}
                    />
                  )}
                </CardBody>
              </Card>
              <Card>
                <CardHeader
                  title="Statuts commerciaux"
                  description={
                    s
                      ? `Situation actuelle. Sur ${periodLabel} : ${formatNumber(s.properties.sold_in_period)} vente(s) et ${formatNumber(
                          s.properties.rented_in_period,
                        )} location(s) conclues.`
                      : 'Situation actuelle du portefeuille.'
                  }
                />
                <CardBody>
                  {loading ? (
                    <Skeleton className="h-32 w-full" />
                  ) : (
                    <BarList
                      items={(['available', 'reserved', 'sold', 'rented'] as const).map((k) => ({
                        key: k,
                        label: labelOf(COMMERCIAL_STATUSES, k),
                        value: s?.properties[k] ?? 0,
                      }))}
                    />
                  )}
                </CardBody>
              </Card>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Pipeline des prospects" description="Répartition actuelle des prospects par étape." />
              <CardBody>
                {loading ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <BarList
                    color={SERIES.teal}
                    emptyLabel="Aucun prospect pour le moment."
                    items={LEAD_PIPELINE.map((k) => ({ key: k, label: labelOf(LEAD_STATUSES, k), value: s?.leads.by_status[k] ?? 0 }))}
                  />
                )}
              </CardBody>
            </Card>

            <RecentInquiries query={recentInq} enabled={canLeads} />
          </div>

          <Card>
            <CardHeader
              title="Dernières annonces modifiées"
              actions={
                <Link to="/biens" className="flex items-center gap-1 text-sm font-semibold text-navy-700 hover:underline">
                  Tous les biens <ArrowRight className="h-4 w-4" />
                </Link>
              }
            />
            {recentProps.error ? (
              <ErrorState error={recentProps.error} onRetry={() => void recentProps.refetch()} compact />
            ) : recentProps.isLoading ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (recentProps.data ?? []).length === 0 ? (
              <EmptyState title="Aucun bien enregistré" description="Les annonces créées apparaîtront ici." />
            ) : (
              <ul className="divide-y divide-mist-100">
                {recentProps.data!.map((p) => (
                  <li key={p.id}>
                    <Link to={`/biens/${p.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-mist-50">
                      <PropertyThumb
                        url={covers.data?.get(p.cover[0]?.storage_path ?? '')}
                        loading={covers.isLoading}
                        alt=""
                        className="h-12 w-16"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{p.title}</p>
                        <p className="truncate text-xs text-mist-500">
                          {p.reference} · {formatPrice(p.price_amount, { rentPeriod: p.rent_period, onRequest: p.price_on_request })}
                        </p>
                      </div>
                      <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                        <div className="flex gap-1.5">
                          <PublicationBadge status={p.publication_status} />
                          <CommercialBadge status={p.commercial_status} />
                        </div>
                        <span className="text-xs text-mist-500">Modifié {formatRelative(p.updated_at)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {canAll && (
            <Card>
              <CardHeader title="Performance par agent" description={`Sur ${periodLabel}. Biens et prospects ouverts : situation actuelle.`} />
              {perf.error ? (
                <ErrorState error={perf.error} onRetry={() => void perf.refetch()} compact />
              ) : perf.isLoading ? (
                <div className="p-5">
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : (
                <div className="scroll-thin overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <caption className="sr-only">Performance commerciale par agent</caption>
                    <thead>
                      <tr className="border-b border-mist-200 bg-mist-50/80 text-xs font-bold tracking-wide text-mist-500 uppercase">
                        <th scope="col" className="px-4 py-3 text-left">Agent</th>
                        <th scope="col" className="px-4 py-3 text-right">Biens</th>
                        <th scope="col" className="px-4 py-3 text-right">Publiés</th>
                        <th scope="col" className="px-4 py-3 text-right">Ventes / loc.</th>
                        <th scope="col" className="px-4 py-3 text-right">Prospects ouverts</th>
                        <th scope="col" className="px-4 py-3 text-right">Demandes (répondues)</th>
                        <th scope="col" className="px-4 py-3 text-right">Visites (réalisées)</th>
                        <th scope="col" className="px-4 py-3 text-right">Suivis saisis</th>
                        <th scope="col" className="px-4 py-3 text-right">Convertis</th>
                      </tr>
                    </thead>
                    <tbody className="tabular divide-y divide-mist-100">
                      {(perf.data ?? []).map((a) => (
                        <tr key={a.agent_id} className="hover:bg-mist-50/70">
                          <td className="px-4 py-2.5">
                            <Link to={`/agents/${a.agent_id}`} className="font-semibold text-ink hover:text-navy-700 hover:underline">
                              {a.display_name}
                            </Link>
                            {!a.is_active && <Badge tone="muted" className="ml-2">Inactif</Badge>}
                          </td>
                          <td className="px-4 py-2.5 text-right">{a.properties_total}</td>
                          <td className="px-4 py-2.5 text-right">{a.properties_published}</td>
                          <td className="px-4 py-2.5 text-right">{a.sold_in_period + a.rented_in_period}</td>
                          <td className="px-4 py-2.5 text-right">{a.leads_assigned_open}</td>
                          <td className="px-4 py-2.5 text-right">
                            {a.inquiries_received} <span className="text-mist-500">({a.inquiries_answered})</span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {a.viewings_requested} <span className="text-mist-500">({a.viewings_completed})</span>
                          </td>
                          <td className="px-4 py-2.5 text-right">{a.activities_logged}</td>
                          <td className="px-4 py-2.5 text-right font-bold">{a.leads_won}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(perf.data ?? []).length === 0 && <EmptyState title="Aucun agent" description="Aucune fiche agent n'est enregistrée." />}
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </>
  )
}

function RecentInquiries({ query, enabled }: { query: ReturnType<typeof useQuery<Awaited<ReturnType<typeof listRecentInquiries>>>>; enabled: boolean }) {
  return (
    <Card>
      <CardHeader
        title="Dernières demandes reçues"
        actions={
          enabled && (
            <Link to="/demandes" className="flex items-center gap-1 text-sm font-semibold text-navy-700 hover:underline">
              Toutes les demandes <ArrowRight className="h-4 w-4" />
            </Link>
          )
        }
      />
      {!enabled ? (
        <EmptyState title="Non disponible" description="Vos droits ne donnent pas accès aux demandes." />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} compact />
      ) : query.isLoading ? (
        <div className="space-y-3 p-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState icon={<Inbox className="h-6 w-6" />} title="Aucune demande" description="Les demandes envoyées depuis le site apparaîtront ici." />
      ) : (
        <ul className="divide-y divide-mist-100">
          {query.data!.map((i) => (
            <li key={i.id}>
              <Link to={i.lead ? `/prospects/${i.lead.id}` : '/demandes'} className="flex items-start gap-3 px-5 py-3 hover:bg-mist-50">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{i.lead?.full_name ?? 'Prospect'}</p>
                  <p className="truncate text-xs text-mist-500">
                    {labelOf(INQUIRY_TYPES, i.inquiry_type)}
                    {i.property ? ` · ${i.property.reference}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tone={toneOf(INQUIRY_STATUSES, i.status)}>{labelOf(INQUIRY_STATUSES, i.status)}</Badge>
                  <span className="text-xs text-mist-500">{formatRelative(i.created_at)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
