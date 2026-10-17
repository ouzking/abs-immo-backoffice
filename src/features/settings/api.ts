import { AppError, expectRow, unwrap } from '@/lib/errors'
import { getSupabase } from '@/lib/supabase/client'
import { removeFiles, uploadWithProgress } from '@/lib/supabase/storage'
import { STORAGE_BUCKETS, STORAGE_LIMITS, type AgencySettings, type AppSetting, type Json, type TablesUpdate } from '@/types'

export interface OpeningHour {
  days: string
  open: string
  close: string
}

export const SOCIAL_NETWORKS = [
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'x', label: 'X (Twitter)' },
] as const

export async function getAgencySettings(): Promise<AgencySettings> {
  return unwrap(await getSupabase().from('agency_settings').select('*').single())
}

/** Colonnes modifiables (GRANT UPDATE de la migration 0600) — toutes publiques. */
const AGENCY_COLUMNS = [
  'agency_name', 'legal_name', 'tagline', 'description', 'phone', 'secondary_phone', 'whatsapp_phone', 'email',
  'address_line', 'locality_id', 'latitude', 'longitude', 'opening_hours', 'social_links', 'logo_path',
  'default_currency', 'default_country', 'ninea', 'rccm', 'seo_default_title', 'seo_default_description',
] as const

export async function updateAgencySettings(patch: Record<string, unknown>): Promise<AgencySettings> {
  const clean: Record<string, unknown> = {}
  for (const k of AGENCY_COLUMNS) if (k in patch) clean[k] = patch[k]
  return expectRow(
    await getSupabase().from('agency_settings').update(clean as TablesUpdate<'agency_settings'>).eq('id', true).select().maybeSingle(),
  )
}

const LOGO_EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

/** Logo public (bucket site-assets). SVG interdit par le backend (risque XSS). */
export async function uploadLogo(file: File, previousPath: string | null): Promise<AgencySettings> {
  const ext = LOGO_EXT[file.type]
  if (!ext) throw new AppError('validation', 'Format non accepté : PNG, JPEG ou WebP (SVG interdit).')
  if (file.size > STORAGE_LIMITS['site-assets'].maxBytes) throw new AppError('validation', 'Fichier trop volumineux (5 Mo maximum).')
  const path = `branding/logo-${crypto.randomUUID()}.${ext}`
  await uploadWithProgress(STORAGE_BUCKETS.siteAssets, path, file)
  let saved: AgencySettings
  try {
    saved = await updateAgencySettings({ logo_path: path })
  } catch (e) {
    await removeFiles(STORAGE_BUCKETS.siteAssets, [path]).catch(() => undefined)
    throw e
  }
  if (previousPath?.startsWith('branding/')) await removeFiles(STORAGE_BUCKETS.siteAssets, [previousPath]).catch(() => undefined)
  return saved
}

export async function listAppSettings(): Promise<AppSetting[]> {
  return unwrap(await getSupabase().from('app_settings').select('*').order('key'))
}

export async function updateAppSetting(key: string, value: Json): Promise<AppSetting> {
  return expectRow(await getSupabase().from('app_settings').update({ value: value as NonNullable<Json> }).eq('key', key).select().maybeSingle())
}

export function parseOpeningHours(value: Json): OpeningHour[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is Record<string, Json> => typeof v === 'object' && v !== null && !Array.isArray(v))
    .map((v) => ({ days: String(v.days ?? ''), open: String(v.open ?? ''), close: String(v.close ?? '') }))
}

export function parseSocialLinks(value: Json): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === 'string')) as Record<string, string>
}
