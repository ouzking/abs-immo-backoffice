/**
 * Parcours réels du back-office contre la pile Supabase locale (seed de démonstration).
 * Chaque assertion porte sur une règle appliquée PAR LA BASE (RLS, garde-fous,
 * politiques Storage) et sur la façon dont l'interface la restitue.
 */
import { env } from '@/config/env'
import { fetchMyAccess, signIn, signOut } from '@/features/auth/api'
import { listUsers, setUserActive } from '@/features/agents/api'
import { listAuditLogs } from '@/features/audit/api'
import { fetchDashboardStats, periodFromPreset } from '@/features/dashboard/api'
import {
  addLeadActivity,
  createLead,
  createViewing,
  deleteLead,
  getLead,
  listLeads,
  updateViewing,
} from '@/features/leads/api'
import {
  createProperty,
  deleteMedia,
  deleteProperty,
  getProperty,
  listProperties,
  setCommercialStatus,
  setPublicationStatus,
  updateProperty,
  uploadPropertyImage,
} from '@/features/properties/api'
import { fetchLocalities } from '@/features/reference/api'
import { getAgencySettings, updateAgencySettings } from '@/features/settings/api'
import { AppError, toAppError } from '@/lib/errors'
import { getSupabase } from '@/lib/supabase/client'
import { signPaths } from '@/lib/supabase/storage'

const PASSWORD = 'AbsImmo-Local-2026'
const USERS = {
  superadmin: 'superadmin@abs-immo.test',
  admin: 'admin@abs-immo.test',
  manager: 'manager@abs-immo.test',
  agent1: 'agent1@abs-immo.test',
  agent2: 'agent2@abs-immo.test',
}
const AGENT1_ID = '00000000-0000-4000-a000-000000000004'
const AGENT2_ID = '00000000-0000-4000-a000-000000000005'
const SUPERADMIN_ID = '00000000-0000-4000-a000-000000000001'

const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(env.supabaseUrl ?? '')

async function as(user: keyof typeof USERS) {
  await signOut()
  await signIn(USERS[user], PASSWORD)
}

async function expectError(promise: Promise<unknown>, kind: AppError['kind'], hint?: string) {
  try {
    await promise
  } catch (e) {
    const err = toAppError(e)
    expect(err.kind).toBe(kind)
    if (hint) expect(err.hint).toBe(hint)
    return err
  }
  throw new Error(`Une erreur « ${kind} » était attendue`)
}

/** PNG 1×1 valide. */
function tinyPng(): File {
  const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return new File([bytes], 'photo.png', { type: 'image/png' })
}

describe.skipIf(!isLocal)('Back-office × Supabase local', () => {
  let localityId = ''
  let propertyId = ''
  let leadId = ''

  beforeAll(async () => {
    await as('agent1')
    const localities = await fetchLocalities()
    localityId = localities.find((l) => l.level === 'neighborhood')?.id ?? localities[0]!.id
  })

  afterAll(async () => {
    // Nettoyage : suppression définitive (super administrateur uniquement).
    await as('superadmin')
    if (propertyId) await deleteProperty(propertyId).catch(() => undefined)
    if (leadId) await deleteLead(leadId).catch(() => undefined)
    await signOut()
  })

  it('charge les droits calculés par la base (get_my_access)', async () => {
    await as('agent1')
    const access = await fetchMyAccess()
    expect(access?.roles).toEqual(['agent'])
    expect(access?.permissions).toContain('properties.create')
    expect(access?.permissions).not.toContain('properties.publish')
  })

  it('un agent crée un brouillon dont il devient responsable, sans pouvoir le publier', async () => {
    await as('agent1')
    const created = await createProperty({
      title: `Test intégration back-office ${Date.now()}`,
      property_type: 'apartment',
      transaction_type: 'rent',
      rent_period: 'month',
      price_amount: 750000,
      locality_id: localityId,
      publication_status: 'draft',
    })
    propertyId = created.id
    expect(created.agent_id).toBe(AGENT1_ID)
    expect(created.reference).toMatch(/^ABS-L-/)
    expect(created.publication_status).toBe('draft')

    await expectError(setPublicationStatus(propertyId, 'published'), 'forbidden')
    const submitted = await setPublicationStatus(propertyId, 'pending_review')
    expect(submitted.publication_status).toBe('pending_review')
  })

  it('recherche par référence et filtre par agent', async () => {
    await as('agent1')
    const p = await getProperty(propertyId)
    const { rows, total } = await listProperties({ q: p.reference, agentId: AGENT1_ID, publication: 'all' })
    expect(total).toBe(1)
    expect(rows[0]?.id).toBe(propertyId)
  })

  it('un autre agent peut lire le catalogue mais pas modifier ce bien (0 ligne → refus explicite)', async () => {
    await as('agent2')
    expect((await getProperty(propertyId)).id).toBe(propertyId)
    await expectError(updateProperty(propertyId, { title: 'Tentative de modification' }), 'forbidden')
  })

  it('envoie une photo dans le bucket privé, avec progression, et la signe', async () => {
    await as('agent1')
    const progress: number[] = []
    const media = await uploadPropertyImage(propertyId, tinyPng(), { sortOrder: 0, onProgress: (p) => progress.push(p) })
    expect(media.is_cover).toBe(true)
    expect(media.storage_path.startsWith(`${propertyId}/`)).toBe(true)
    expect(progress.at(-1)).toBe(1)
    const urls = await signPaths('property-images', [media.storage_path])
    expect(urls.get(media.storage_path)).toMatch(/^http/)
  })

  it('le site public (anon) ne peut pas lire la photo d’un bien non publié', async () => {
    await signOut()
    const { data } = await getSupabase().from('property_media').select('storage_path').eq('property_id', propertyId)
    expect(data ?? []).toHaveLength(0)
  })

  it('un responsable publie seulement si les conditions sont remplies', async () => {
    await as('manager')
    await expectError(setPublicationStatus(propertyId, 'published'), 'business', 'PUBLISH_REQUIRES_SHORT_DESCRIPTION')
    await updateProperty(propertyId, { short_description: 'Appartement lumineux proche de toutes commodités.' })
    const published = await setPublicationStatus(propertyId, 'published')
    expect(published.publication_status).toBe('published')
    expect(published.published_at).not.toBeNull()
  })

  it('version anglaise : saisie au back-office, exposée au site public (contrat 1.1.0)', async () => {
    await as('agent1')
    await updateProperty(propertyId, { title_en: 'Bright apartment for rent', short_description_en: 'Bright apartment close to all amenities.' })
    await signOut()
    const { data } = await getSupabase().from('public_properties').select('title_en,has_english').eq('id', propertyId).single()
    expect(data).toEqual({ title_en: 'Bright apartment for rent', has_english: true })
  })

  it('la dernière photo d’une annonce publiée est protégée', async () => {
    await as('agent1')
    const { data } = await getSupabase().from('property_media').select('id,storage_path').eq('property_id', propertyId)
    await expectError(deleteMedia(data![0]!), 'business', 'LAST_MEDIA_OF_PUBLISHED_PROPERTY')
  })

  it('statut commercial : « vendu » interdit en location, « loué » accepté', async () => {
    await as('agent1')
    await expectError(setCommercialStatus(propertyId, 'sold'), 'business')
    expect((await setCommercialStatus(propertyId, 'rented')).commercial_status).toBe('rented')
  })

  it('cloisonne les prospects par agent', async () => {
    await as('manager')
    const lead = await createLead({ full_name: 'Prospect Intégration', phone: '+221770009999', source: 'phone', assigned_agent_id: AGENT1_ID })
    leadId = lead.id

    await as('agent2')
    await expectError(getLead(leadId), 'not_found')
    const { rows } = await listLeads({ q: 'Prospect Intégration', status: '' })
    expect(rows.map((r) => r.id)).not.toContain(leadId)

    await as('agent1')
    expect((await getLead(leadId)).full_name).toBe('Prospect Intégration')
  })

  it('notes internes : saisie manuelle acceptée, types système refusés', async () => {
    await as('agent1')
    const note = await addLeadActivity({ leadId, type: 'note', content: 'Rappeler jeudi matin.' })
    expect(note.actor_id).toBe(AGENT1_ID)
    const forged = await getSupabase().from('lead_activities').insert({ lead_id: leadId, activity_type: 'status_change', content: 'faux' }).select()
    expect(forged.error?.code).toBe('42501')
  })

  it('une visite n’est confirmée qu’avec une date enregistrée par la base', async () => {
    await as('agent1')
    const viewing = await createViewing({ lead_id: leadId, property_id: propertyId, preferred_time_slot: 'morning' })
    await expectError(updateViewing(viewing.id, { status: 'confirmed' }), 'validation')
    const direct = await getSupabase().from('viewing_requests').update({ status: 'confirmed' }).eq('id', viewing.id).select()
    expect(direct.error?.code).toBe('23514')

    const scheduled = new Date(Date.now() + 3 * 86_400_000).toISOString()
    const confirmed = await updateViewing(viewing.id, { status: 'confirmed', scheduled_at: scheduled })
    expect(confirmed.status).toBe('confirmed')
    expect((await getLead(leadId)).status).toBe('visit_scheduled')
  })

  it('statistiques : un agent est limité à son propre périmètre', async () => {
    await as('agent1')
    const period = periodFromPreset('30d')
    const stats = await fetchDashboardStats(period)
    expect(stats.scope.agent_id).toBe(AGENT1_ID)
    await expectError(fetchDashboardStats(period, AGENT2_ID), 'forbidden')
  })

  it('journal d’audit : invisible pour un agent, alimenté par la base pour un administrateur', async () => {
    await as('agent1')
    expect((await listAuditLogs({ recordId: propertyId })).total).toBe(0)
    await as('admin')
    const { rows } = await listAuditLogs({ table: 'properties', recordId: propertyId })
    expect(rows.some((r) => r.action === 'UPDATE')).toBe(true)
  })

  it('paramètres de l’agence : refusés à un agent, modifiables par un administrateur', async () => {
    await as('agent1')
    await expectError(updateAgencySettings({ tagline: 'Piratage' }), 'forbidden')
    await as('admin')
    const before = await getAgencySettings()
    const updated = await updateAgencySettings({ tagline: 'Test intégration' })
    expect(updated.tagline).toBe('Test intégration')
    await updateAgencySettings({ tagline: before.tagline })
  })

  it('comptes : règle de rang appliquée par le serveur (admin-users)', async () => {
    await as('agent1')
    expect(await listUsers()).toEqual([])
    await expectError(setUserActive(AGENT2_ID, false), 'forbidden')

    await as('admin')
    const users = await listUsers()
    expect(users.find((u) => u.id === SUPERADMIN_ID)?.can_manage).toBe(false)
    expect(users.find((u) => u.id === AGENT2_ID)?.can_manage).toBe(true)
    await expectError(setUserActive(SUPERADMIN_ID, false), 'forbidden')
  })
})
