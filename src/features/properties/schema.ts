import { z } from 'zod'
import type { Property } from '@/types'
import type { FeatureDraft } from './api'

/**
 * Formulaire d'un bien. Les nombres sont saisis comme du texte (espaces de
 * milliers tolérés) puis convertis par `toPropertyPayload`. Les règles reprennent
 * les contraintes de la base (migration 0400) pour signaler les erreurs avant l'envoi ;
 * la base reste l'arbitre final.
 */
const intText = z.string().trim().refine((v) => v === '' || /^\d[\d\s]*$/.test(v), 'Nombre entier attendu.')
const decimalText = z.string().trim().refine((v) => v === '' || /^\d+([.,]\d+)?$/.test(v.replace(/\s/g, '')), 'Nombre attendu.')
const signedIntText = z.string().trim().refine((v) => v === '' || /^-?\d+$/.test(v), 'Nombre entier attendu.')
const coordText = z.string().trim().refine((v) => v === '' || /^-?\d{1,3}([.,]\d+)?$/.test(v), 'Coordonnée invalide (ex. 14.7167).')

export const propertyFormSchema = z
  .object({
    title: z.string().trim().min(5, 'Au moins 5 caractères.').max(160, '160 caractères maximum.'),
    short_description: z.string().trim().max(300, '300 caractères maximum.'),
    description: z.string().trim().max(20000, '20 000 caractères maximum.'),
    property_type: z.string().min(1, 'Choisissez un type de bien.'),
    transaction_type: z.enum(['sale', 'rent']),
    rent_period: z.enum(['', 'day', 'week', 'month', 'year']),
    price_on_request: z.boolean(),
    price_amount: intText,
    price_negotiable: z.boolean(),
    deposit_amount: intText,
    agency_fee_amount: intText,
    region_id: z.string(),
    city_id: z.string(),
    commune_id: z.string(),
    neighborhood_id: z.string(),
    location_label: z.string().trim().max(160, '160 caractères maximum.'),
    address_line: z.string().trim().max(300, '300 caractères maximum.'),
    latitude: coordText,
    longitude: coordText,
    address_visibility: z.enum(['hidden', 'approximate', 'exact']),
    surface_area: decimalText,
    surface_unit: z.enum(['sqm', 'are', 'hectare']),
    land_area: decimalText,
    bedrooms: intText,
    bathrooms: intText,
    rooms: intText,
    toilets: intText,
    floor: signedIntText,
    total_floors: intText,
    parking_spaces: intText,
    year_built: intText,
    is_furnished: z.enum(['', 'true', 'false']),
    legal_status: z.enum(['', 'titre_foncier', 'bail', 'deliberation', 'permis_occuper', 'autre']),
    amenities: z.array(z.string()),
    features: z.array(
      z.object({
        id: z.string().optional(),
        label: z.string().trim().max(80, '80 caractères maximum.'),
        value: z.string().trim().max(200, '200 caractères maximum.'),
      }),
    ),
    seo_title: z.string().trim().max(120, '120 caractères maximum.'),
    seo_description: z.string().trim().max(320, '320 caractères maximum.'),
    slug: z
      .string()
      .trim()
      .max(200, '200 caractères maximum.')
      .refine((v) => v === '' || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v), 'Minuscules, chiffres et tirets uniquement.'),
    // Version anglaise (contrat 1.1.0) : facultative ; vide => le site affiche le français.
    title_en: z.string().trim().refine((v) => v === '' || (v.length >= 5 && v.length <= 160), 'Entre 5 et 160 caractères (ou laisser vide).'),
    short_description_en: z.string().trim().max(300, '300 caractères maximum.'),
    description_en: z.string().trim().max(20000, '20 000 caractères maximum.'),
    seo_title_en: z.string().trim().max(120, '120 caractères maximum.'),
    seo_description_en: z.string().trim().max(320, '320 caractères maximum.'),
    agent_id: z.string(),
    internal_notes: z.string().trim().max(10000, '10 000 caractères maximum.'),
    commercial_status: z.enum(['available', 'reserved', 'sold', 'rented']),
    is_featured: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.transaction_type === 'rent' && !v.rent_period) {
      ctx.addIssue({ code: 'custom', path: ['rent_period'], message: 'Précisez la période du loyer.' })
    }
    if (!v.price_on_request) {
      const n = parseIntText(v.price_amount)
      if (n === null || n <= 0) ctx.addIssue({ code: 'custom', path: ['price_amount'], message: 'Indiquez un prix en FCFA, ou cochez « Prix sur demande ».' })
    }
    if (!v.region_id) ctx.addIssue({ code: 'custom', path: ['region_id'], message: 'Choisissez au moins la région.' })
    if ((v.latitude === '') !== (v.longitude === '')) {
      ctx.addIssue({ code: 'custom', path: [v.latitude === '' ? 'latitude' : 'longitude'], message: 'Latitude et longitude vont ensemble.' })
    }
    const lat = parseDecimalText(v.latitude)
    const lng = parseDecimalText(v.longitude)
    if (lat !== null && (lat < -90 || lat > 90)) ctx.addIssue({ code: 'custom', path: ['latitude'], message: 'Entre -90 et 90.' })
    if (lng !== null && (lng < -180 || lng > 180)) ctx.addIssue({ code: 'custom', path: ['longitude'], message: 'Entre -180 et 180.' })
    if (v.commercial_status === 'sold' && v.transaction_type !== 'sale') {
      ctx.addIssue({ code: 'custom', path: ['commercial_status'], message: '« Vendu » est réservé aux biens en vente.' })
    }
    if (v.commercial_status === 'rented' && v.transaction_type !== 'rent') {
      ctx.addIssue({ code: 'custom', path: ['commercial_status'], message: '« Loué » est réservé aux biens en location.' })
    }
    const year = parseIntText(v.year_built)
    if (year !== null && (year < 1800 || year > 2200)) ctx.addIssue({ code: 'custom', path: ['year_built'], message: 'Année invalide.' })
    const floor = v.floor === '' ? null : Number(v.floor)
    if (floor !== null && (floor < -5 || floor > 200)) ctx.addIssue({ code: 'custom', path: ['floor'], message: 'Entre -5 et 200.' })
    for (const [key, max] of [
      ['bedrooms', 200],
      ['bathrooms', 200],
      ['toilets', 200],
      ['rooms', 500],
      ['total_floors', 200],
      ['parking_spaces', 1000],
    ] as const) {
      const n = parseIntText(v[key])
      if (n !== null && n > max) ctx.addIssue({ code: 'custom', path: [key], message: `${max} maximum.` })
    }
    v.features.forEach((f, i) => {
      if (!f.label && f.value) ctx.addIssue({ code: 'custom', path: ['features', i, 'label'], message: 'Libellé requis.' })
    })
  })

export type PropertyFormValues = z.infer<typeof propertyFormSchema>

export function parseIntText(v: string): number | null {
  const s = v.replace(/\s/g, '')
  if (s === '') return null
  const n = Number.parseInt(s, 10)
  return Number.isFinite(n) ? n : null
}

export function parseDecimalText(v: string): number | null {
  const s = v.replace(/\s/g, '').replace(',', '.')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const str = (v: string | null | undefined) => v ?? ''
const num = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v))

export function emptyPropertyForm(): PropertyFormValues {
  return {
    title: '',
    short_description: '',
    description: '',
    property_type: '',
    transaction_type: 'sale',
    rent_period: '',
    price_on_request: false,
    price_amount: '',
    price_negotiable: false,
    deposit_amount: '',
    agency_fee_amount: '',
    region_id: '',
    city_id: '',
    commune_id: '',
    neighborhood_id: '',
    location_label: '',
    address_line: '',
    latitude: '',
    longitude: '',
    address_visibility: 'approximate',
    surface_area: '',
    surface_unit: 'sqm',
    land_area: '',
    bedrooms: '',
    bathrooms: '',
    rooms: '',
    toilets: '',
    floor: '',
    total_floors: '',
    parking_spaces: '',
    year_built: '',
    is_furnished: '',
    legal_status: '',
    amenities: [],
    features: [],
    seo_title: '',
    seo_description: '',
    slug: '',
    title_en: '',
    short_description_en: '',
    description_en: '',
    seo_title_en: '',
    seo_description_en: '',
    agent_id: '',
    internal_notes: '',
    commercial_status: 'available',
    is_featured: false,
  }
}

export function propertyToForm(p: Property, amenities: string[], features: FeatureDraft[]): PropertyFormValues {
  return {
    title: p.title,
    short_description: str(p.short_description),
    description: str(p.description),
    property_type: p.property_type,
    transaction_type: p.transaction_type,
    rent_period: p.rent_period ?? '',
    price_on_request: p.price_on_request,
    price_amount: num(p.price_amount),
    price_negotiable: p.price_negotiable,
    deposit_amount: num(p.deposit_amount),
    agency_fee_amount: num(p.agency_fee_amount),
    region_id: str(p.region_id),
    city_id: str(p.city_id),
    commune_id: str(p.commune_id),
    neighborhood_id: str(p.neighborhood_id),
    location_label: str(p.location_label),
    address_line: str(p.address_line),
    latitude: num(p.latitude),
    longitude: num(p.longitude),
    address_visibility: p.address_visibility,
    surface_area: num(p.surface_area),
    surface_unit: p.surface_unit,
    land_area: num(p.land_area),
    bedrooms: num(p.bedrooms),
    bathrooms: num(p.bathrooms),
    rooms: num(p.rooms),
    toilets: num(p.toilets),
    floor: num(p.floor),
    total_floors: num(p.total_floors),
    parking_spaces: num(p.parking_spaces),
    year_built: num(p.year_built),
    is_furnished: p.is_furnished === null ? '' : p.is_furnished ? 'true' : 'false',
    legal_status: p.legal_status ?? '',
    amenities,
    features,
    seo_title: str(p.seo_title),
    seo_description: str(p.seo_description),
    slug: p.slug,
    title_en: str(p.title_en),
    short_description_en: str(p.short_description_en),
    description_en: str(p.description_en),
    seo_title_en: str(p.seo_title_en),
    seo_description_en: str(p.seo_description_en),
    agent_id: str(p.agent_id),
    internal_notes: str(p.internal_notes),
    commercial_status: p.commercial_status,
    is_featured: p.is_featured,
  }
}

const nullIfEmpty = (v: string) => (v.trim() === '' ? null : v.trim())

/**
 * Convertit le formulaire en colonnes `properties`. Les champs réservés à
 * certaines permissions ne sont inclus que si l'utilisateur peut les modifier,
 * pour ne jamais envoyer une valeur que la base refuserait.
 */
export function toPropertyPayload(
  v: PropertyFormValues,
  options: { isLand: boolean; canAssignAgent: boolean; canPublish: boolean; isCreate: boolean },
): Record<string, unknown> {
  const locality = v.neighborhood_id || v.commune_id || v.city_id || v.region_id
  const lat = parseDecimalText(v.latitude)
  const lng = parseDecimalText(v.longitude)
  const payload: Record<string, unknown> = {
    title: v.title.trim(),
    short_description: nullIfEmpty(v.short_description),
    description: nullIfEmpty(v.description),
    property_type: v.property_type,
    transaction_type: v.transaction_type,
    rent_period: v.transaction_type === 'rent' ? v.rent_period || null : null,
    price_on_request: v.price_on_request,
    price_amount: v.price_on_request ? null : parseIntText(v.price_amount),
    price_negotiable: v.price_negotiable,
    deposit_amount: parseIntText(v.deposit_amount),
    agency_fee_amount: parseIntText(v.agency_fee_amount),
    currency_code: 'XOF',
    locality_id: locality,
    location_label: nullIfEmpty(v.location_label),
    address_line: nullIfEmpty(v.address_line),
    latitude: lat !== null && lng !== null ? lat : null,
    longitude: lat !== null && lng !== null ? lng : null,
    address_visibility: v.address_visibility,
    surface_area: parseDecimalText(v.surface_area),
    surface_unit: v.surface_unit,
    land_area: parseDecimalText(v.land_area),
    bedrooms: options.isLand ? null : parseIntText(v.bedrooms),
    bathrooms: options.isLand ? null : parseIntText(v.bathrooms),
    rooms: options.isLand ? null : parseIntText(v.rooms),
    toilets: options.isLand ? null : parseIntText(v.toilets),
    floor: v.floor === '' ? null : Number(v.floor),
    total_floors: parseIntText(v.total_floors),
    parking_spaces: parseIntText(v.parking_spaces),
    year_built: parseIntText(v.year_built),
    is_furnished: v.is_furnished === '' ? null : v.is_furnished === 'true',
    legal_status: v.legal_status || null,
    seo_title: nullIfEmpty(v.seo_title),
    seo_description: nullIfEmpty(v.seo_description),
    title_en: nullIfEmpty(v.title_en),
    short_description_en: nullIfEmpty(v.short_description_en),
    description_en: nullIfEmpty(v.description_en),
    seo_title_en: nullIfEmpty(v.seo_title_en),
    seo_description_en: nullIfEmpty(v.seo_description_en),
    internal_notes: nullIfEmpty(v.internal_notes),
    commercial_status: v.commercial_status,
  }
  // Le slug est généré par la base à la création ; modifiable ensuite.
  if (!options.isCreate && v.slug) payload.slug = v.slug
  if (options.canAssignAgent) payload.agent_id = v.agent_id || null
  if (options.canPublish) payload.is_featured = v.is_featured
  return payload
}
