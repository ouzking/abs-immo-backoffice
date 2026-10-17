import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import { BarChart3, Table2 } from 'lucide-react'
import { formatMonth, formatNumber, formatShortDate } from '@/lib/format'
import type { InquiryTimeseriesRow } from '@/types'
import type { StatsInterval } from '../api'
import { CHART, SERIES } from '../chartTheme'

const LINES = [
  { key: 'inquiries', label: 'Demandes de renseignement', color: SERIES.blue },
  { key: 'viewing_requests', label: 'Demandes de visite', color: SERIES.red },
  { key: 'new_leads', label: 'Nouveaux prospects', color: SERIES.teal },
] as const

function bucketLabel(bucket: string, interval: StatsInterval, long = false): string {
  if (interval === 'month') return formatMonth(`${bucket}T12:00:00Z`)
  const d = formatShortDate(`${bucket}T12:00:00Z`)
  return interval === 'week' && long ? `Semaine du ${d}` : d
}

function ChartTooltip({ active, payload, label, interval }: TooltipContentProps<number, string> & { interval: StatsInterval }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-mist-200 bg-white px-3 py-2.5 text-xs shadow-lift">
      <p className="mb-1.5 font-semibold text-ink">{bucketLabel(String(label), interval, true)}</p>
      <ul className="space-y-1">
        {LINES.map((l) => {
          const item = payload.find((p) => p.dataKey === l.key)
          return (
            <li key={l.key} className="flex items-center gap-2 text-mist-600">
              <span className="h-0.5 w-3 rounded" style={{ background: l.color }} aria-hidden />
              <span className="flex-1">{l.label}</span>
              <span className="tabular font-bold text-ink">{formatNumber(Number(item?.value ?? 0))}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Évolution des demandes, visites et nouveaux prospects (données de get_inquiry_timeseries). */
export function ActivityChart({ data, interval }: { data: InquiryTimeseriesRow[]; interval: StatsInterval }) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const totals = LINES.map((l) => ({ ...l, total: data.reduce((s, r) => s + (r[l.key] ?? 0), 0) }))

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Légende">
          {totals.map((l) => (
            <li key={l.key} className="flex items-center gap-2 text-xs text-mist-600">
              <span className="h-[3px] w-4 rounded-full" style={{ background: l.color }} aria-hidden />
              {l.label}
              <span className="tabular font-bold text-ink">{formatNumber(l.total)}</span>
            </li>
          ))}
        </ul>
        <div className="flex rounded-lg border border-mist-200 p-0.5" role="group" aria-label="Affichage">
          {(
            [
              ['chart', 'Graphique', BarChart3],
              ['table', 'Tableau', Table2],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              aria-pressed={view === key}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${view === key ? 'bg-navy-700 text-white' : 'text-mist-600 hover:bg-mist-100'}`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'chart' ? (
        <div className="h-72" role="img" aria-label="Évolution des demandes, visites et nouveaux prospects sur la période">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke={CHART.grid} strokeDasharray="0" vertical={false} />
              <XAxis
                dataKey="bucket"
                tickFormatter={(v: string) => bucketLabel(v, interval)}
                tick={{ fill: CHART.tick, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: CHART.muted }}
                minTickGap={24}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: CHART.tick, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip
                content={(props) => <ChartTooltip {...(props as TooltipContentProps<number, string>)} interval={interval} />}
                cursor={{ stroke: CHART.axis, strokeWidth: 1 }}
              />
              {LINES.map((l) => (
                <Line
                  key={l.key}
                  type="monotone"
                  dataKey={l.key}
                  name={l.label}
                  stroke={l.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4.5, stroke: CHART.surface, strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="scroll-thin max-h-72 overflow-auto rounded-lg border border-mist-200">
          <table className="w-full text-sm">
            <caption className="sr-only">Activité par période</caption>
            <thead className="sticky top-0 bg-mist-50 text-xs text-mist-500">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-bold">
                  Période
                </th>
                {LINES.map((l) => (
                  <th key={l.key} scope="col" className="px-3 py-2 text-right font-bold">
                    {l.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-mist-100">
              {data.map((r) => (
                <tr key={r.bucket}>
                  <td className="px-3 py-1.5">{bucketLabel(r.bucket, interval, true)}</td>
                  {LINES.map((l) => (
                    <td key={l.key} className="tabular px-3 py-1.5 text-right">
                      {formatNumber(r[l.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
