import type { RentPeriod } from '@/types'

const NBSP = /[\u00a0\u202f]/g
const numberFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const decimalFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

/** 150000000 -> « 150 000 000 » (espaces ordinaires pour un rendu stable). */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return numberFormat.format(value).replace(NBSP, ' ')
}

export function formatDecimal(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return decimalFormat.format(value).replace(NBSP, ' ')
}

const RENT_SUFFIX: Record<RentPeriod, string> = { day: ' / jour', week: ' / semaine', month: ' / mois', year: ' / an' }

/** Prix en FCFA. `null` ou « sur demande » → « Prix sur demande ». */
export function formatPrice(
  amount: number | null | undefined,
  options: { rentPeriod?: RentPeriod | null; onRequest?: boolean; currency?: string } = {},
): string {
  if (options.onRequest || amount === null || amount === undefined) return 'Prix sur demande'
  const currency = !options.currency || options.currency === 'XOF' ? 'FCFA' : options.currency
  return `${formatNumber(amount)} ${currency}${options.rentPeriod ? RENT_SUFFIX[options.rentPeriod] : ''}`
}

/** Montant compact pour les axes et tuiles : 450 000 000 → « 450 M ». */
export function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${formatDecimal(value / 1_000_000_000)} Md`
  if (Math.abs(value) >= 1_000_000) return `${formatDecimal(value / 1_000_000)} M`
  if (Math.abs(value) >= 10_000) return `${formatDecimal(value / 1_000)} k`
  return formatNumber(value)
}

const TZ = 'Africa/Dakar'
const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ })
const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TZ,
})
const shortDateFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', timeZone: TZ })
const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit', timeZone: TZ })
const relativeFormat = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' })

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatDate(value: string | Date | null | undefined): string {
  const d = toDate(value)
  return d ? dateFormat.format(d).replace(NBSP, ' ') : '—'
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const d = toDate(value)
  return d ? dateTimeFormat.format(d).replace(NBSP, ' ') : '—'
}

export function formatShortDate(value: string | Date | null | undefined): string {
  const d = toDate(value)
  return d ? shortDateFormat.format(d).replace(NBSP, ' ') : '—'
}

export function formatMonth(value: string | Date | null | undefined): string {
  const d = toDate(value)
  return d ? monthFormat.format(d).replace(NBSP, ' ') : '—'
}

/** « il y a 3 heures », « hier », « dans 2 jours ». */
export function formatRelative(value: string | Date | null | undefined, now: Date = new Date()): string {
  const d = toDate(value)
  if (!d) return '—'
  const seconds = Math.round((d.getTime() - now.getTime()) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return "à l'instant"
  if (abs < 3600) return relativeFormat.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return relativeFormat.format(Math.round(seconds / 3600), 'hour')
  if (abs < 86400 * 30) return relativeFormat.format(Math.round(seconds / 86400), 'day')
  return formatDate(d)
}

/** +221771234567 → « +221 77 123 45 67 » (autres pays : inchangé). */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return '—'
  const m = /^\+221(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(value)
  return m ? `+221 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : value
}

/**
 * Normalise une saisie libre en E.164 (format exigé par la base) :
 * « 77 123 45 67 » → +221771234567 ; « 00221… » → +221… ; « +33 6… » → +336…
 * Renvoie null si la saisie est vide, undefined si elle est invalide.
 */
export function normalizePhone(input: string | null | undefined, defaultPrefix = '+221'): string | null | undefined {
  if (input === null || input === undefined) return null
  const trimmed = input.trim()
  if (trimmed === '') return null
  let digits = trimmed.replace(/[\s.\-()/]/g, '')
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`
  if (!digits.startsWith('+')) {
    if (!/^\d+$/.test(digits)) return undefined
    digits = digits.length === 9 ? `${defaultPrefix}${digits}` : `+${digits}`
  }
  return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : undefined
}

/** Taille de fichier lisible : 2 400 000 → « 2,3 Mo ». */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return '—'
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${formatDecimal(bytes / 1024)} Ko`
  return `${formatDecimal(bytes / (1024 * 1024))} Mo`
}

/** Initiales pour les avatars : « Aminata Sow » → « AS ». */
export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? [parts[0]![0], parts[parts.length - 1]![0]] : [parts[0]?.[0], parts[0]?.[1]]
  return letters.filter(Boolean).join('').toUpperCase() || '?'
}

/** Slug compatible avec la contrainte de la base (^[a-z0-9]+(-[a-z0-9]+)*$). */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count > 1 ? plural : singular}`
}
