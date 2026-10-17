import { unwrap } from '@/lib/errors'
import { getSupabase } from '@/lib/supabase/client'
import type { AgentPerformanceRow, DashboardStats, InquiryTimeseriesRow } from '@/types'

export type StatsInterval = 'day' | 'week' | 'month'

export interface StatsPeriod {
  from: string
  to: string
  interval: StatsInterval
}

export const PERIOD_PRESETS = [
  { key: '7d', label: '7 jours', days: 7 },
  { key: '30d', label: '30 jours', days: 30 },
  { key: '90d', label: '90 jours', days: 90 },
  { key: '12m', label: '12 mois', days: 365 },
] as const
export type PeriodKey = (typeof PERIOD_PRESETS)[number]['key']

/** Période semi-ouverte [from, to) se terminant maintenant ; granularité adaptée à la durée. */
export function periodFromPreset(key: PeriodKey, now: Date = new Date()): StatsPeriod {
  const preset = PERIOD_PRESETS.find((p) => p.key === key) ?? PERIOD_PRESETS[1]
  const from = new Date(now)
  from.setUTCHours(0, 0, 0, 0)
  from.setUTCDate(from.getUTCDate() - (preset.days - 1))
  const interval: StatsInterval = preset.days <= 31 ? 'day' : preset.days <= 120 ? 'week' : 'month'
  return { from: from.toISOString(), to: now.toISOString(), interval }
}

/** Indicateurs calculés par la base (définitions : docs/STATISTICS.md du backend). */
export async function fetchDashboardStats(period: StatsPeriod, agentId?: string | null): Promise<DashboardStats> {
  const data = unwrap(
    await getSupabase().rpc('get_dashboard_stats', {
      p_from: period.from,
      p_to: period.to,
      ...(agentId ? { p_agent_id: agentId } : {}),
    }),
  )
  return data as unknown as DashboardStats
}

export async function fetchTimeseries(period: StatsPeriod, agentId?: string | null): Promise<InquiryTimeseriesRow[]> {
  return unwrap(
    await getSupabase().rpc('get_inquiry_timeseries', {
      p_from: period.from,
      p_to: period.to,
      p_interval: period.interval,
      ...(agentId ? { p_agent_id: agentId } : {}),
    }),
  )
}

export async function fetchAgentPerformance(period: StatsPeriod): Promise<AgentPerformanceRow[]> {
  return unwrap(await getSupabase().rpc('get_agent_performance', { p_from: period.from, p_to: period.to }))
}
