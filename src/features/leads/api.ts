import { AppError, expectRow, unwrap, unwrapMaybe } from '@/lib/errors'
import { getSupabase } from '@/lib/supabase/client'
import { sanitizeSearch } from '@/features/properties/api'
import type {
  ContactMethod,
  Inquiry,
  InquiryStatus,
  InquiryType,
  Lead,
  TablesUpdate,
  LeadActivity,
  LeadSource,
  LeadStatus,
  TimeSlot,
  TransactionType,
  ViewingRequest,
  ViewingStatus,
} from '@/types'

/** Compteurs de la navigation (périmètre appliqué par RLS : un agent ne compte que les siens). */
export async function fetchSidebarCounters(): Promise<{ inquiries: number; viewings: number }> {
  const sb = getSupabase()
  const [inq, vis] = await Promise.all([
    sb.from('inquiries').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    sb.from('viewing_requests').select('id', { count: 'exact', head: true }).eq('status', 'requested'),
  ])
  unwrap(inq)
  unwrap(vis)
  return { inquiries: inq.count ?? 0, viewings: vis.count ?? 0 }
}

/** Filtre d'affectation commun : '' = tous, 'me' = moi, 'none' = non affecté, sinon id d'agent. */
export type AssignedFilter = string

type Filterable = {
  eq: (column: string, value: unknown) => Filterable
  is: (column: string, value: null) => Filterable
}

function applyAssigned<T>(query: T, column: string, assigned: AssignedFilter | undefined, me: string | undefined): T {
  const q = query as unknown as Filterable
  if (!assigned) return query
  if (assigned === 'none') return q.is(column, null) as unknown as T
  if (assigned === 'me') return (me ? q.eq(column, me) : q) as unknown as T
  return q.eq(column, assigned) as unknown as T
}

// =============================================================================
// Prospects
// =============================================================================
export interface LeadFilters {
  q?: string
  status?: LeadStatus | '' | 'open'
  source?: LeadSource | ''
  assigned?: AssignedFilter
  me?: string
  sort?: 'last_activity_at' | 'created_at' | 'full_name'
  desc?: boolean
  page?: number
  pageSize?: number
}

export type LeadListRow = Lead & { agent: { display_name: string } | null }

const LEAD_COLUMNS = '*,agent:agents!leads_assigned_agent_id_fkey(display_name)'

export async function listLeads(filters: LeadFilters): Promise<{ rows: LeadListRow[]; total: number }> {
  const page = filters.page ?? 0
  const pageSize = filters.pageSize ?? 25
  let query = getSupabase().from('leads').select(LEAD_COLUMNS, { count: 'exact' })
  const term = sanitizeSearch(filters.q ?? '')
  if (term) {
    const digits = term.replace(/\D/g, '')
    const parts = [`full_name.ilike."%${term}%"`, `email.ilike."%${term.toLowerCase()}%"`]
    if (digits.length >= 4) parts.push(`phone.ilike."%${digits}%"`)
    query = query.or(parts.join(','))
  }
  if (filters.status === 'open') query = query.not('status', 'in', '(won,lost)')
  else if (filters.status) query = query.eq('status', filters.status)
  if (filters.source) query = query.eq('source', filters.source)
  query = applyAssigned(query, 'assigned_agent_id', filters.assigned, filters.me)
  query = query.order(filters.sort ?? 'last_activity_at', { ascending: !(filters.desc ?? true) }).order('id')
  const result = await query.range(page * pageSize, page * pageSize + pageSize - 1)
  const rows = unwrap(result) as unknown as LeadListRow[]
  return { rows, total: result.count ?? rows.length }
}

export async function getLead(id: string): Promise<LeadListRow> {
  const row = unwrapMaybe(await getSupabase().from('leads').select(LEAD_COLUMNS).eq('id', id).maybeSingle())
  if (!row) throw new AppError('not_found', 'Ce prospect est introuvable ou ne vous est pas affecté.')
  return row as unknown as LeadListRow
}

/** Colonnes modifiables (GRANT UPDATE de la migration 0500). */
const LEAD_UPDATABLE = [
  'full_name', 'email', 'phone', 'whatsapp_phone', 'preferred_contact', 'source', 'status', 'assigned_agent_id',
  'budget_min', 'budget_max', 'desired_transaction', 'desired_property_type', 'desired_locality_id',
  'consent_marketing', 'lost_reason',
] as const

export interface LeadPatch {
  full_name?: string
  email?: string | null
  phone?: string | null
  whatsapp_phone?: string | null
  preferred_contact?: ContactMethod | null
  source?: LeadSource
  status?: LeadStatus
  budget_min?: number | null
  budget_max?: number | null
  desired_transaction?: TransactionType | null
  desired_property_type?: string | null
  desired_locality_id?: string | null
  consent_marketing?: boolean
  lost_reason?: string | null
}

export async function updateLead(id: string, patch: LeadPatch): Promise<Lead> {
  const clean: Record<string, unknown> = {}
  for (const k of LEAD_UPDATABLE) if (k in patch) clean[k] = (patch as Record<string, unknown>)[k]
  return expectRow(await getSupabase().from('leads').update(clean as TablesUpdate<'leads'>).eq('id', id).select().maybeSingle())
}

export async function createLead(values: LeadPatch & { full_name: string; assigned_agent_id?: string | null }): Promise<Lead> {
  return expectRow(await getSupabase().from('leads').insert(values).select().single())
}

/** Effacement (droit à l'oubli) : demandes, visites et historique supprimés en cascade. */
export async function deleteLead(id: string): Promise<void> {
  expectRow(await getSupabase().from('leads').delete().eq('id', id).select('id'))
}

/** Affectation groupée (permission leads.assign) : prospect + demandes et visites ouvertes. */
export async function assignLead(leadId: string, agentId: string | null, includeOpenRequests = true): Promise<void> {
  unwrap(
    await getSupabase().rpc('assign_lead', {
      p_lead_id: leadId,
      p_agent_id: agentId as string,
      p_include_open_requests: includeOpenRequests,
    }),
  )
}

// =============================================================================
// Historique et notes internes
// =============================================================================
export type ActivityRow = LeadActivity & { actor: { full_name: string } | null }

export async function listLeadActivities(leadId: string): Promise<ActivityRow[]> {
  const rows = unwrap(
    await getSupabase()
      .from('lead_activities')
      .select('*,actor:profiles!lead_activities_actor_id_fkey(full_name)')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(200),
  )
  return rows as unknown as ActivityRow[]
}

export type ManualActivityType = 'note' | 'call' | 'email' | 'whatsapp' | 'sms' | 'meeting' | 'visit'

export async function addLeadActivity(input: {
  leadId: string
  type: ManualActivityType
  content: string
  inquiryId?: string | null
  viewingRequestId?: string | null
}): Promise<LeadActivity> {
  const content = input.content.trim()
  if (!content) throw new AppError('validation', 'Le contenu ne peut pas être vide.')
  return expectRow(
    await getSupabase()
      .from('lead_activities')
      .insert({
        lead_id: input.leadId,
        activity_type: input.type,
        content: content.slice(0, 10000),
        inquiry_id: input.inquiryId ?? null,
        viewing_request_id: input.viewingRequestId ?? null,
      })
      .select()
      .single(),
  )
}

// =============================================================================
// Demandes de renseignement
// =============================================================================
const PROPERTY_REF = 'property:properties!inquiries_property_id_fkey(id,reference,title,slug)'

export type InquiryRow = Inquiry & {
  lead: { id: string; full_name: string; email: string | null; phone: string | null; status: LeadStatus } | null
  property: { id: string; reference: string; title: string; slug: string } | null
  agent: { display_name: string } | null
}

export interface InquiryFilters {
  q?: string
  status?: InquiryStatus | '' | 'open'
  type?: InquiryType | ''
  channel?: LeadSource | ''
  assigned?: AssignedFilter
  me?: string
  page?: number
  pageSize?: number
  desc?: boolean
}

export async function listInquiries(filters: InquiryFilters): Promise<{ rows: InquiryRow[]; total: number }> {
  const page = filters.page ?? 0
  const pageSize = filters.pageSize ?? 25
  const term = sanitizeSearch(filters.q ?? '')
  const leadEmbed = term
    ? 'lead:leads!inquiries_lead_id_fkey!inner(id,full_name,email,phone,status)'
    : 'lead:leads!inquiries_lead_id_fkey(id,full_name,email,phone,status)'
  let query = getSupabase()
    .from('inquiries')
    .select(`*,${leadEmbed},${PROPERTY_REF},agent:agents!inquiries_assigned_agent_id_fkey(display_name)`, { count: 'exact' })
  if (term) query = query.or(`full_name.ilike."%${term}%",email.ilike."%${term.toLowerCase()}%"`, { referencedTable: 'lead' })
  if (filters.status === 'open') query = query.in('status', ['new', 'in_progress'])
  else if (filters.status) query = query.eq('status', filters.status)
  if (filters.type) query = query.eq('inquiry_type', filters.type)
  if (filters.channel) query = query.eq('channel', filters.channel)
  query = applyAssigned(query, 'assigned_agent_id', filters.assigned, filters.me)
  query = query.order('created_at', { ascending: !(filters.desc ?? true) }).order('id')
  const result = await query.range(page * pageSize, page * pageSize + pageSize - 1)
  const rows = unwrap(result) as unknown as InquiryRow[]
  return { rows, total: result.count ?? rows.length }
}

export async function listLeadInquiries(leadId: string): Promise<InquiryRow[]> {
  const rows = unwrap(
    await getSupabase()
      .from('inquiries')
      .select(`*,${PROPERTY_REF},agent:agents!inquiries_assigned_agent_id_fkey(display_name)`)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false }),
  )
  return rows as unknown as InquiryRow[]
}

export async function listRecentInquiries(limit = 6): Promise<InquiryRow[]> {
  return (await listInquiries({ page: 0, pageSize: limit })).rows
}

export async function updateInquiry(
  id: string,
  patch: { status?: InquiryStatus; inquiry_type?: InquiryType; assigned_agent_id?: string | null; property_id?: string | null },
): Promise<Inquiry> {
  return expectRow(await getSupabase().from('inquiries').update(patch as TablesUpdate<'inquiries'>).eq('id', id).select().maybeSingle())
}

export async function createInquiry(values: {
  lead_id: string
  property_id?: string | null
  inquiry_type: InquiryType
  channel: LeadSource
  message?: string | null
  assigned_agent_id?: string | null
}): Promise<Inquiry> {
  return expectRow(await getSupabase().from('inquiries').insert(values).select().single())
}

// =============================================================================
// Visites
// =============================================================================
export type ViewingRow = ViewingRequest & {
  lead: { id: string; full_name: string; email: string | null; phone: string | null; status: LeadStatus } | null
  property: { id: string; reference: string; title: string; slug: string } | null
  agent: { display_name: string } | null
}

export interface ViewingFilters {
  q?: string
  status?: ViewingStatus | '' | 'open'
  assigned?: AssignedFilter
  me?: string
  /** 'upcoming' : confirmées à venir, triées par date de visite. */
  when?: '' | 'upcoming' | 'past'
  page?: number
  pageSize?: number
}

export async function listViewings(filters: ViewingFilters): Promise<{ rows: ViewingRow[]; total: number }> {
  const page = filters.page ?? 0
  const pageSize = filters.pageSize ?? 25
  const term = sanitizeSearch(filters.q ?? '')
  const leadEmbed = term
    ? 'lead:leads!viewing_requests_lead_id_fkey!inner(id,full_name,email,phone,status)'
    : 'lead:leads!viewing_requests_lead_id_fkey(id,full_name,email,phone,status)'
  let query = getSupabase()
    .from('viewing_requests')
    .select(
      `*,${leadEmbed},property:properties!viewing_requests_property_id_fkey(id,reference,title,slug),agent:agents!viewing_requests_assigned_agent_id_fkey(display_name)`,
      { count: 'exact' },
    )
  if (term) query = query.or(`full_name.ilike."%${term}%",email.ilike."%${term.toLowerCase()}%"`, { referencedTable: 'lead' })
  if (filters.status === 'open') query = query.in('status', ['requested', 'confirmed'])
  else if (filters.status) query = query.eq('status', filters.status)
  query = applyAssigned(query, 'assigned_agent_id', filters.assigned, filters.me)
  const nowIso = new Date().toISOString()
  if (filters.when === 'upcoming') {
    query = query.eq('status', 'confirmed').gte('scheduled_at', nowIso).order('scheduled_at', { ascending: true })
  } else if (filters.when === 'past') {
    query = query.lt('scheduled_at', nowIso).order('scheduled_at', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }
  const result = await query.order('id').range(page * pageSize, page * pageSize + pageSize - 1)
  const rows = unwrap(result) as unknown as ViewingRow[]
  return { rows, total: result.count ?? rows.length }
}

export async function listLeadViewings(leadId: string): Promise<ViewingRow[]> {
  const rows = unwrap(
    await getSupabase()
      .from('viewing_requests')
      .select('*,property:properties!viewing_requests_property_id_fkey(id,reference,title,slug),agent:agents!viewing_requests_assigned_agent_id_fkey(display_name)')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false }),
  )
  return rows as unknown as ViewingRow[]
}

export interface ViewingPatch {
  status?: ViewingStatus
  scheduled_at?: string | null
  preferred_date?: string | null
  preferred_time_slot?: TimeSlot
  alternative_date?: string | null
  assigned_agent_id?: string | null
  outcome_notes?: string | null
  cancellation_reason?: string | null
  property_id?: string | null
}

/**
 * Mise à jour d'une visite. La ligne renvoyée par la base fait foi : l'interface
 * n'affiche « confirmée » que si la base a effectivement enregistré ce statut.
 */
export async function updateViewing(id: string, patch: ViewingPatch): Promise<ViewingRequest> {
  if (patch.status === 'confirmed' && !patch.scheduled_at) {
    throw new AppError('validation', 'Indiquez la date et l’heure de la visite pour la confirmer.')
  }
  const row: ViewingRequest = expectRow(await getSupabase().from('viewing_requests').update(patch as TablesUpdate<'viewing_requests'>).eq('id', id).select().maybeSingle())
  if (patch.status && row.status !== patch.status) {
    throw new AppError('unknown', "Le statut n'a pas été enregistré. Rechargez la page et réessayez.")
  }
  return row
}

export async function createViewing(values: {
  lead_id: string
  property_id: string
  preferred_date?: string | null
  preferred_time_slot?: TimeSlot
  message?: string | null
  assigned_agent_id?: string | null
}): Promise<ViewingRequest> {
  return expectRow(await getSupabase().from('viewing_requests').insert(values).select().single())
}

/** Recherche de biens pour les sélecteurs (titre ou référence). */
export async function searchPropertyOptions(term: string): Promise<Array<{ id: string; reference: string; title: string }>> {
  const t = sanitizeSearch(term)
  let query = getSupabase().from('properties').select('id,reference,title').neq('publication_status', 'archived')
  if (t) query = query.or(`title.ilike."%${t}%",reference.ilike."%${t}%"`)
  return unwrap(await query.order('updated_at', { ascending: false }).limit(12))
}
