import { AppError, expectRow, unwrap, unwrapMaybe } from '@/lib/errors'
import { getSupabase } from '@/lib/supabase/client'
import { forgetSignedPath, readImageSize, removeFiles, uploadWithProgress } from '@/lib/supabase/storage'
import {
  STORAGE_BUCKETS,
  STORAGE_LIMITS,
  propertyFilePath,
  type CommercialStatus,
  type DocumentType,
  type Property,
  type PropertyDocument,
  type PropertyFeature,
  type PropertyInsert,
  type PropertyMedia,
  type PropertyUpdate,
  type PublicationStatus,
  type TransactionType,
} from '@/types'

// =============================================================================
// Liste
// =============================================================================
export type PropertySortKey = 'updated_at' | 'created_at' | 'price_amount' | 'title' | 'reference'

export interface PropertyFilters {
  q?: string
  propertyType?: string
  transaction?: TransactionType | ''
  cityId?: string
  /** '' = tous sauf archivés ; 'all' = tous ; sinon un statut précis. */
  publication?: PublicationStatus | '' | 'all'
  commercial?: CommercialStatus | ''
  agentId?: string
  sort?: PropertySortKey
  desc?: boolean
  page?: number
  pageSize?: number
}

const LIST_COLUMNS =
  'id,reference,slug,title,property_type,transaction_type,price_amount,price_on_request,rent_period,currency_code,' +
  'publication_status,commercial_status,is_featured,created_at,updated_at,agent_id,surface_area,surface_unit,bedrooms,title_en,' +
  'agent:agents!properties_agent_id_fkey(display_name),' +
  'city:localities!properties_city_id_fkey(name),' +
  'neighborhood:localities!properties_neighborhood_id_fkey(name),' +
  'cover:property_media(storage_path)'

export interface PropertyListRow {
  id: string
  reference: string
  slug: string
  title: string
  property_type: string
  transaction_type: TransactionType
  price_amount: number | null
  price_on_request: boolean
  rent_period: Property['rent_period']
  currency_code: string
  publication_status: PublicationStatus
  commercial_status: CommercialStatus
  is_featured: boolean
  created_at: string
  updated_at: string
  agent_id: string | null
  surface_area: number | null
  surface_unit: Property['surface_unit']
  bedrooms: number | null
  title_en: string | null
  agent: { display_name: string } | null
  city: { name: string } | null
  neighborhood: { name: string } | null
  cover: Array<{ storage_path: string }>
}

/** Neutralise les caractères réservés de la syntaxe `or=(…)` de PostgREST. */
export function sanitizeSearch(term: string): string {
  return term.replace(/[",()\\*%:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}

export async function listProperties(filters: PropertyFilters): Promise<{ rows: PropertyListRow[]; total: number }> {
  const page = filters.page ?? 0
  const pageSize = filters.pageSize ?? 20
  let query = getSupabase()
    .from('properties')
    .select(LIST_COLUMNS, { count: 'exact' })
    .eq('cover.is_cover', true)

  const term = sanitizeSearch(filters.q ?? '')
  if (term) query = query.or(`title.ilike."%${term}%",reference.ilike."%${term}%"`)
  if (filters.propertyType) query = query.eq('property_type', filters.propertyType)
  if (filters.transaction) query = query.eq('transaction_type', filters.transaction)
  if (filters.cityId) query = query.eq('city_id', filters.cityId)
  if (filters.commercial) query = query.eq('commercial_status', filters.commercial)
  if (filters.agentId) query = query.eq('agent_id', filters.agentId)
  if (!filters.publication) query = query.neq('publication_status', 'archived')
  else if (filters.publication !== 'all') query = query.eq('publication_status', filters.publication)

  const sort = filters.sort ?? 'updated_at'
  query = query.order(sort, { ascending: !(filters.desc ?? true), nullsFirst: false }).order('id')
  const result = await query.range(page * pageSize, page * pageSize + pageSize - 1)
  const rows = unwrap(result) as unknown as PropertyListRow[]
  return { rows, total: result.count ?? rows.length }
}

export async function listRecentProperties(limit = 6): Promise<PropertyListRow[]> {
  const result = await getSupabase()
    .from('properties')
    .select(LIST_COLUMNS)
    .eq('cover.is_cover', true)
    .order('updated_at', { ascending: false })
    .limit(limit)
  return unwrap(result) as unknown as PropertyListRow[]
}

// =============================================================================
// Détail
// =============================================================================
export type PropertyDetail = Property & {
  agent: { display_name: string; is_active: boolean } | null
  creator: { full_name: string } | null
}

export async function getProperty(id: string): Promise<PropertyDetail> {
  const result = await getSupabase()
    .from('properties')
    .select(
      '*,agent:agents!properties_agent_id_fkey(display_name,is_active),creator:profiles!properties_created_by_fkey(full_name)',
    )
    .eq('id', id)
    .maybeSingle()
  const row = unwrapMaybe(result)
  if (!row) throw new AppError('not_found', 'Ce bien est introuvable ou vous n’avez pas le droit de le consulter.')
  return row as unknown as PropertyDetail
}

export async function listPropertyMedia(propertyId: string): Promise<PropertyMedia[]> {
  return unwrap(
    await getSupabase()
      .from('property_media')
      .select('*')
      .eq('property_id', propertyId)
      .order('sort_order')
      .order('created_at'),
  )
}

export async function listPropertyFeatures(propertyId: string): Promise<PropertyFeature[]> {
  return unwrap(
    await getSupabase().from('property_features').select('*').eq('property_id', propertyId).order('sort_order').order('created_at'),
  )
}

export async function listPropertyAmenityCodes(propertyId: string): Promise<string[]> {
  const rows = unwrap(await getSupabase().from('property_amenities').select('amenity_code').eq('property_id', propertyId))
  return rows.map((r) => r.amenity_code)
}

// =============================================================================
// Écriture
// =============================================================================

/** Colonnes modifiables via l'API (GRANT UPDATE des migrations 0400 et 20261020000100). */
export const UPDATABLE_PROPERTY_COLUMNS = [
  'title', 'slug', 'short_description', 'description', 'property_type', 'transaction_type',
  'price_amount', 'currency_code', 'price_on_request', 'price_negotiable', 'rent_period', 'deposit_amount',
  'agency_fee_amount', 'surface_area', 'surface_unit', 'land_area', 'bedrooms', 'bathrooms', 'rooms', 'toilets',
  'floor', 'total_floors', 'parking_spaces', 'year_built', 'is_furnished', 'legal_status', 'locality_id',
  'location_label', 'address_line', 'latitude', 'longitude', 'address_visibility', 'commercial_status',
  'publication_status', 'is_featured', 'featured_rank', 'agent_id', 'seo_title', 'seo_description', 'internal_notes',
  // Contrat 1.1.0 : version anglaise
  'title_en', 'short_description_en', 'description_en', 'seo_title_en', 'seo_description_en',
] as const satisfies ReadonlyArray<keyof PropertyUpdate>

/** Ne conserve que les colonnes autorisées (une colonne non accordée ferait échouer toute la requête). */
export function pickUpdatable(patch: Record<string, unknown>): PropertyUpdate {
  const out: Record<string, unknown> = {}
  for (const key of UPDATABLE_PROPERTY_COLUMNS) if (key in patch) out[key] = patch[key]
  return out as PropertyUpdate
}

export async function createProperty(values: PropertyInsert): Promise<Property> {
  return expectRow(await getSupabase().from('properties').insert(values).select().single())
}

export async function updateProperty(id: string, patch: Record<string, unknown>): Promise<Property> {
  const clean = pickUpdatable(patch)
  if (Object.keys(clean).length === 0) throw new AppError('validation', 'Aucune modification à enregistrer.')
  return expectRow(await getSupabase().from('properties').update(clean).eq('id', id).select().maybeSingle())
}

export function setPublicationStatus(id: string, status: PublicationStatus): Promise<Property> {
  return updateProperty(id, { publication_status: status })
}

export function setCommercialStatus(id: string, status: CommercialStatus): Promise<Property> {
  return updateProperty(id, { commercial_status: status })
}

export function setFeatured(id: string, featured: boolean): Promise<Property> {
  return updateProperty(id, { is_featured: featured })
}

export async function setPropertyAmenities(propertyId: string, codes: string[]): Promise<void> {
  unwrap(await getSupabase().rpc('set_property_amenities', { p_property_id: propertyId, p_amenity_codes: codes }))
}

export interface FeatureDraft {
  id?: string
  label: string
  value: string
}

/** Calcule les opérations pour aligner les caractéristiques en base sur le brouillon. */
export function diffFeatures(current: PropertyFeature[], desired: FeatureDraft[]) {
  const cleaned = desired
    .map((f, i) => ({ ...f, label: f.label.trim(), value: f.value.trim(), sort_order: i }))
    .filter((f) => f.label.length > 0)
  const keepIds = new Set(cleaned.filter((f) => f.id).map((f) => f.id))
  const toDelete = current.filter((c) => !keepIds.has(c.id)).map((c) => c.id)
  const toInsert = cleaned.filter((f) => !f.id).map(({ label, value, sort_order }) => ({ label, value: value || null, sort_order }))
  const toUpdate = cleaned
    .filter((f) => {
      if (!f.id) return false
      const c = current.find((x) => x.id === f.id)
      return !!c && (c.label !== f.label || (c.value ?? '') !== f.value || c.sort_order !== f.sort_order)
    })
    .map(({ id, label, value, sort_order }) => ({ id: id!, label, value: value || null, sort_order }))
  return { toDelete, toInsert, toUpdate }
}

export async function syncFeatures(propertyId: string, current: PropertyFeature[], desired: FeatureDraft[]): Promise<void> {
  const sb = getSupabase()
  const { toDelete, toInsert, toUpdate } = diffFeatures(current, desired)
  if (toDelete.length) unwrap(await sb.from('property_features').delete().in('id', toDelete))
  for (const f of toUpdate) {
    expectRow(
      await sb.from('property_features').update({ label: f.label, value: f.value, sort_order: f.sort_order }).eq('id', f.id).select().maybeSingle(),
    )
  }
  if (toInsert.length) {
    unwrap(await sb.from('property_features').insert(toInsert.map((f) => ({ ...f, property_id: propertyId }))).select())
  }
}

/** Suppression définitive (permission properties.delete). Les fichiers sont retirés ensuite. */
export async function deleteProperty(id: string): Promise<{ orphanFiles: number }> {
  const sb = getSupabase()
  const media = await listPropertyMedia(id)
  const docs = unwrap(await sb.from('property_documents').select('storage_path').eq('property_id', id))
  expectRow(await sb.from('properties').delete().eq('id', id).select('id'))
  let orphanFiles = 0
  try {
    await removeFiles(STORAGE_BUCKETS.propertyImages, media.map((m) => m.storage_path))
  } catch {
    orphanFiles += media.length
  }
  try {
    await removeFiles(STORAGE_BUCKETS.propertyDocuments, docs.map((d) => d.storage_path))
  } catch {
    orphanFiles += docs.length
  }
  return { orphanFiles }
}

// =============================================================================
// Photos (bucket privé property-images)
// =============================================================================
const IMAGE_LIMITS = STORAGE_LIMITS['property-images']

/** Contrôle côté navigateur (le bucket et les politiques revérifient). */
export function validateImageFile(file: File): string | null {
  if (!(IMAGE_LIMITS.mime as readonly string[]).includes(file.type)) {
    return 'Format non accepté : JPEG, PNG, WebP ou AVIF uniquement.'
  }
  if (file.size > IMAGE_LIMITS.maxBytes) return 'Fichier trop volumineux (10 Mo maximum).'
  if (file.size === 0) return 'Fichier vide.'
  return null
}

export async function uploadPropertyImage(
  propertyId: string,
  file: File,
  options: { sortOrder: number; altText?: string; onProgress?: (fraction: number) => void; signal?: AbortSignal },
): Promise<PropertyMedia> {
  const invalid = validateImageFile(file)
  if (invalid) throw new AppError('validation', invalid)
  const path = propertyFilePath(propertyId, file.type)
  const size = await readImageSize(file)
  await uploadWithProgress(STORAGE_BUCKETS.propertyImages, path, file, options.onProgress, options.signal)
  try {
    return expectRow(
      await getSupabase()
        .from('property_media')
        .insert({
          property_id: propertyId,
          storage_path: path,
          alt_text: options.altText?.slice(0, 250) || null,
          sort_order: options.sortOrder,
          width: size?.width ?? null,
          height: size?.height ?? null,
          size_bytes: file.size,
          mime_type: file.type,
        })
        .select()
        .single(),
    )
  } catch (error) {
    // Pas de fichier orphelin si l'enregistrement est refusé.
    await removeFiles(STORAGE_BUCKETS.propertyImages, [path]).catch(() => undefined)
    throw error
  }
}

export async function setCoverMedia(mediaId: string): Promise<PropertyMedia> {
  return expectRow(await getSupabase().from('property_media').update({ is_cover: true }).eq('id', mediaId).select().maybeSingle())
}

export async function updateMediaAlt(mediaId: string, altText: string): Promise<PropertyMedia> {
  return expectRow(
    await getSupabase()
      .from('property_media')
      .update({ alt_text: altText.trim().slice(0, 250) || null })
      .eq('id', mediaId)
      .select()
      .maybeSingle(),
  )
}

export async function reorderMedia(propertyId: string, mediaIds: string[]): Promise<void> {
  unwrap(await getSupabase().rpc('reorder_property_media', { p_property_id: propertyId, p_media_ids: mediaIds }))
}

/** 1) ligne en base (garde-fou « dernière photo d'un bien publié »), 2) fichier. */
export async function deleteMedia(media: Pick<PropertyMedia, 'id' | 'storage_path'>): Promise<{ fileRemoved: boolean }> {
  expectRow(await getSupabase().from('property_media').delete().eq('id', media.id).select('id'))
  forgetSignedPath('property-images', media.storage_path)
  try {
    await removeFiles(STORAGE_BUCKETS.propertyImages, [media.storage_path])
    return { fileRemoved: true }
  } catch {
    return { fileRemoved: false }
  }
}

// =============================================================================
// Documents internes (bucket privé property-documents)
// =============================================================================
const DOC_LIMITS = STORAGE_LIMITS['property-documents']

export function validateDocumentFile(file: File): string | null {
  if (!(DOC_LIMITS.mime as readonly string[]).includes(file.type)) return 'Format non accepté : PDF, image ou DOCX.'
  if (file.size > DOC_LIMITS.maxBytes) return 'Fichier trop volumineux (20 Mo maximum).'
  return null
}

export async function listPropertyDocuments(propertyId: string): Promise<PropertyDocument[]> {
  return unwrap(
    await getSupabase().from('property_documents').select('*').eq('property_id', propertyId).order('created_at', { ascending: false }),
  )
}

export async function uploadPropertyDocument(
  propertyId: string,
  file: File,
  meta: { title: string; documentType: DocumentType },
  onProgress?: (fraction: number) => void,
): Promise<PropertyDocument> {
  const invalid = validateDocumentFile(file)
  if (invalid) throw new AppError('validation', invalid)
  const path = propertyFilePath(propertyId, file.type)
  await uploadWithProgress(STORAGE_BUCKETS.propertyDocuments, path, file, onProgress)
  try {
    return expectRow(
      await getSupabase()
        .from('property_documents')
        .insert({
          property_id: propertyId,
          storage_path: path,
          title: meta.title.trim().slice(0, 200) || file.name.slice(0, 200),
          document_type: meta.documentType,
          mime_type: file.type,
          size_bytes: file.size,
        })
        .select()
        .single(),
    )
  } catch (error) {
    await removeFiles(STORAGE_BUCKETS.propertyDocuments, [path]).catch(() => undefined)
    throw error
  }
}

export async function deletePropertyDocument(doc: Pick<PropertyDocument, 'id' | 'storage_path'>): Promise<void> {
  expectRow(await getSupabase().from('property_documents').delete().eq('id', doc.id).select('id'))
  await removeFiles(STORAGE_BUCKETS.propertyDocuments, [doc.storage_path]).catch(() => undefined)
}

/** URL de téléchargement signée (60 s) pour un document interne. */
export async function documentDownloadUrl(path: string, filename: string): Promise<string> {
  const { data, error } = await getSupabase().storage.from(STORAGE_BUCKETS.propertyDocuments).createSignedUrl(path, 60, { download: filename })
  if (error || !data) throw new AppError('forbidden', 'Téléchargement impossible : document inaccessible.')
  return data.signedUrl
}

/** Nombre maximal d'annonces « à la une » affichées sur l'accueil du site public. */
export const HOMEPAGE_FEATURED_LIMIT = 6

/** Annonces publiées actuellement mises en avant (périmètre RLS de l'utilisateur). */
export async function countFeaturedPublished(): Promise<number> {
  const result = await getSupabase()
    .from('properties')
    .select('id', { count: 'exact', head: true })
    .eq('is_featured', true)
    .eq('publication_status', 'published')
  unwrap(result)
  return result.count ?? 0
}
