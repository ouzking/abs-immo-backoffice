import { unwrap } from '@/lib/errors'
import { getSupabase } from '@/lib/supabase/client'
import type { AuditLog } from '@/types'

export interface AuditFilters {
  table?: string
  action?: string
  actorId?: string
  recordId?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

/** Journal immuable écrit par la base (déclencheurs) ; lecture seule, permission audit.read. */
export async function listAuditLogs(f: AuditFilters): Promise<{ rows: AuditLog[]; total: number }> {
  const page = f.page ?? 0
  const pageSize = f.pageSize ?? 30
  let q = getSupabase().from('audit_logs').select('*', { count: 'exact' })
  if (f.table) q = q.eq('table_name', f.table)
  if (f.action) q = q.eq('action', f.action)
  if (f.actorId) q = q.eq('actor_id', f.actorId)
  if (f.recordId) q = q.eq('record_id', f.recordId.trim())
  if (f.from) q = q.gte('occurred_at', `${f.from}T00:00:00Z`)
  if (f.to) q = q.lt('occurred_at', new Date(Date.parse(`${f.to}T00:00:00Z`) + 86_400_000).toISOString())
  const result = await q.order('occurred_at', { ascending: false }).order('id', { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1)
  const rows = unwrap(result)
  return { rows, total: result.count ?? rows.length }
}

/** Noms des auteurs (profils lisibles par le personnel actif). */
export async function fetchProfileNames(ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids)].filter(Boolean)
  if (unique.length === 0) return {}
  const rows = unwrap(await getSupabase().from('profiles').select('id,full_name,email').in('id', unique))
  return Object.fromEntries(rows.map((r) => [r.id, r.full_name || r.email || r.id]))
}
