import { DB_ERROR_CODES, type ApiErrorBody } from '@/types'

export type AppErrorKind =
  | 'config'
  | 'network'
  | 'auth' // session absente ou expirée
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'business' // règle métier refusée par la base (23514)
  | 'conflict'
  | 'rate_limited'
  | 'unknown'

/** Erreur normalisée, affichable telle quelle (messages en français). */
export class AppError extends Error {
  readonly kind: AppErrorKind
  readonly code?: string
  readonly hint?: string
  readonly fields?: Record<string, string>

  constructor(
    kind: AppErrorKind,
    message: string,
    options: { code?: string; hint?: string; fields?: Record<string, string>; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'AppError'
    this.kind = kind
    this.code = options.code
    this.hint = options.hint
    this.fields = options.fields
  }
}

export const DEFAULT_MESSAGES: Record<AppErrorKind, string> = {
  config: "L'application n'est pas configurée correctement.",
  network: 'Connexion au serveur impossible. Vérifiez votre connexion internet puis réessayez.',
  auth: 'Votre session a expiré. Veuillez vous reconnecter.',
  forbidden: "Action non autorisée : vos droits ne permettent pas cette opération.",
  not_found: "Élément introuvable ou non accessible avec vos droits.",
  validation: 'Certaines informations sont invalides.',
  business: "L'opération a été refusée par une règle métier.",
  conflict: 'Cette valeur est déjà utilisée.',
  rate_limited: 'Trop de tentatives. Patientez quelques instants avant de réessayer.',
  unknown: 'Une erreur inattendue est survenue.',
}

/**
 * Messages français pour les contraintes CHECK du schéma, dont le message
 * PostgreSQL brut est en anglais (« violates check constraint … »).
 */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  properties_price_required: 'Indiquez un prix ou cochez « Prix sur demande ».',
  properties_rent_period: 'La période de loyer est obligatoire pour une location, et interdite pour une vente.',
  properties_status_sale: 'Le statut « vendu » est réservé aux biens en vente.',
  properties_status_rent: 'Le statut « loué » est réservé aux biens en location.',
  properties_coordinates_pair: 'Renseignez la latitude et la longitude ensemble, ou aucune des deux.',
  properties_title_check: 'Le titre doit contenir entre 5 et 160 caractères.',
  properties_slug_check: "L'adresse web (slug) ne doit contenir que des minuscules, chiffres et tirets.",
  viewing_confirmed_requires_schedule: 'Une visite confirmée ou réalisée doit avoir une date et une heure planifiées.',
  leads_contact_required: 'Un e-mail ou un numéro de téléphone est obligatoire.',
  leads_budget_range: 'Le budget minimum doit être inférieur ou égal au budget maximum.',
  leads_phone_check: 'Numéro de téléphone invalide.',
  leads_email_check: 'Adresse e-mail invalide.',
  agents_slug_check: "L'identifiant web ne doit contenir que des minuscules, chiffres et tirets.",
  agents_public_phone_check: 'Téléphone public invalide (format international attendu, ex. +221771234567).',
  agents_whatsapp_phone_check: 'Numéro WhatsApp invalide (format international attendu).',
  agents_public_email_check: 'E-mail public invalide.',
  agency_settings_phone_check: 'Téléphone invalide (format international attendu, ex. +221338001122).',
  agency_settings_secondary_phone_check: 'Téléphone secondaire invalide (format international attendu).',
  agency_settings_whatsapp_phone_check: 'Numéro WhatsApp invalide (format international attendu).',
  agency_settings_email_check: 'Adresse e-mail invalide.',
  profiles_phone_check: 'Téléphone invalide (format international attendu, ex. +221771234567).',
  property_media_path_prefix: 'Chemin de fichier invalide pour ce bien.',
}

const UNIQUE_MESSAGES: Record<string, string> = {
  properties_slug_key: 'Cette adresse web (slug) est déjà utilisée par une autre annonce.',
  agents_slug_key: 'Cet identifiant web est déjà utilisé par un autre agent.',
  profiles_email_key: 'Cette adresse e-mail est déjà utilisée.',
}

interface PostgrestLikeError {
  code?: string
  message?: string
  details?: string | null
  hint?: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function looksLikeNetworkFailure(message: string): boolean {
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|ECONNREFUSED/i.test(message)
}

/** Convertit une erreur PostgREST (tables, vues, RPC) en AppError. */
export function fromPostgrestError(error: PostgrestLikeError): AppError {
  const code = error.code ?? ''
  const raw = error.message ?? ''
  const hint = error.hint ?? undefined
  const opts = { code, hint, cause: error }

  if (!code && looksLikeNetworkFailure(raw)) return new AppError('network', DEFAULT_MESSAGES.network, opts)
  if (code === 'PGRST301' || code === 'PGRST302' || /jwt expired/i.test(raw)) {
    return new AppError('auth', DEFAULT_MESSAGES.auth, opts)
  }

  switch (code) {
    case DB_ERROR_CODES.FORBIDDEN: {
      // Les garde-fous du backend lèvent des messages français explicites ;
      // le message PostgreSQL générique (« permission denied … ») est remplacé.
      const generic = /permission denied|row-level security/i.test(raw)
      return new AppError('forbidden', generic || !raw ? DEFAULT_MESSAGES.forbidden : raw, opts)
    }
    case DB_ERROR_CODES.BUSINESS_RULE: {
      const constraint = /check constraint "([^"]+)"/.exec(raw)?.[1]
      const message = constraint ? (CONSTRAINT_MESSAGES[constraint] ?? DEFAULT_MESSAGES.business) : raw
      return new AppError('business', message || DEFAULT_MESSAGES.business, opts)
    }
    case DB_ERROR_CODES.UNIQUE_VIOLATION: {
      const constraint = /constraint "([^"]+)"/.exec(raw)?.[1]
      return new AppError('conflict', (constraint && UNIQUE_MESSAGES[constraint]) || DEFAULT_MESSAGES.conflict, opts)
    }
    case DB_ERROR_CODES.FOREIGN_KEY:
      return new AppError('validation', 'Une valeur sélectionnée n’existe plus. Rechargez la page et réessayez.', opts)
    case DB_ERROR_CODES.NOT_FOUND:
    case DB_ERROR_CODES.NO_ROWS_FOR_SINGLE:
      return new AppError('not_found', code === 'P0002' && raw ? raw : DEFAULT_MESSAGES.not_found, opts)
    case DB_ERROR_CODES.INVALID_PARAMETER:
      return new AppError('validation', raw || DEFAULT_MESSAGES.validation, opts)
    case '22001':
      return new AppError('validation', 'Un des textes saisis est trop long.', opts)
    case '22P02':
      return new AppError('validation', 'Une valeur saisie a un format invalide.', opts)
    default:
      return new AppError('unknown', raw && !/^[A-Z0-9]+$/.test(raw) ? raw : DEFAULT_MESSAGES.unknown, opts)
  }
}

/** Convertit une erreur d'Edge Function (`supabase.functions.invoke`) en AppError. */
export async function fromFunctionsError(error: unknown): Promise<AppError> {
  if (!isRecord(error)) return new AppError('unknown', DEFAULT_MESSAGES.unknown, { cause: error })
  const name = typeof error.name === 'string' ? error.name : ''
  if (name === 'FunctionsFetchError' || name === 'FunctionsRelayError') {
    return new AppError('network', DEFAULT_MESSAGES.network, { cause: error })
  }
  const context = error.context
  if (context instanceof Response) {
    const body = (await context
      .clone()
      .json()
      .catch(() => null)) as ApiErrorBody | null
    const apiCode = body?.error?.code
    const message = body?.error?.message
    const fields = body?.error?.fields
    const status = context.status
    const opts = { code: apiCode, fields, cause: error }
    if (status === 401) return new AppError('auth', DEFAULT_MESSAGES.auth, opts)
    if (status === 403) return new AppError('forbidden', message ?? DEFAULT_MESSAGES.forbidden, opts)
    if (status === 404) return new AppError('not_found', message ?? DEFAULT_MESSAGES.not_found, opts)
    if (status === 409) return new AppError('conflict', message ?? DEFAULT_MESSAGES.conflict, opts)
    if (status === 422 || status === 400) return new AppError('validation', message ?? DEFAULT_MESSAGES.validation, opts)
    if (status === 429) return new AppError('rate_limited', message ?? DEFAULT_MESSAGES.rate_limited, opts)
    return new AppError('unknown', message ?? DEFAULT_MESSAGES.unknown, opts)
  }
  return new AppError('unknown', DEFAULT_MESSAGES.unknown, { cause: error })
}

/** Convertit une erreur Storage en AppError. */
export function fromStorageError(error: unknown): AppError {
  const message = isRecord(error) && typeof error.message === 'string' ? error.message : ''
  const status = isRecord(error) ? String(error.statusCode ?? error.status ?? '') : ''
  if (looksLikeNetworkFailure(message)) return new AppError('network', DEFAULT_MESSAGES.network, { cause: error })
  if (status === '403' || /row-level security|unauthorized|not allowed/i.test(message)) {
    return new AppError('forbidden', "Vous n'avez pas le droit d'envoyer ou de modifier ce fichier.", { cause: error })
  }
  if (status === '413' || /too large|maximum allowed size/i.test(message)) {
    return new AppError('validation', 'Fichier trop volumineux.', { cause: error })
  }
  if (status === '415' || /mime type|not supported/i.test(message)) {
    return new AppError('validation', 'Format de fichier non accepté.', { cause: error })
  }
  if (status === '409' || /already exists|duplicate/i.test(message)) {
    return new AppError('conflict', 'Un fichier portant ce nom existe déjà.', { cause: error })
  }
  if (status === '404' || /not found/i.test(message)) {
    return new AppError('not_found', 'Fichier introuvable.', { cause: error })
  }
  return new AppError('unknown', message || DEFAULT_MESSAGES.unknown, { cause: error })
}

/** Normalise n'importe quelle erreur (déjà AppError, PostgREST, réseau, autre). */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error
  if (error instanceof TypeError && looksLikeNetworkFailure(error.message)) {
    return new AppError('network', DEFAULT_MESSAGES.network, { cause: error })
  }
  if (isRecord(error) && ('code' in error || 'hint' in error) && 'message' in error) {
    return fromPostgrestError(error as PostgrestLikeError)
  }
  if (error instanceof Error && error.message) return new AppError('unknown', error.message, { cause: error })
  return new AppError('unknown', DEFAULT_MESSAGES.unknown, { cause: error })
}

export function errorMessage(error: unknown): string {
  return toAppError(error).message
}

/**
 * Lève une AppError si la réponse Supabase contient une erreur, sinon renvoie `data`
 * (non nul en l'absence d'erreur pour les listes, RPC et `.single()`).
 */
export function unwrap<T>(result: { data: T | null; error: PostgrestLikeError | null }): T {
  if (result.error) throw fromPostgrestError(result.error)
  return result.data as T
}

/** Variante pour `.maybeSingle()` : `null` signifie « aucune ligne visible ». */
export function unwrapMaybe<T>(result: { data: T | null; error: PostgrestLikeError | null }): T | null {
  if (result.error) throw fromPostgrestError(result.error)
  return result.data
}

/**
 * Pour les écritures : RLS ne lève pas d'erreur sur une ligne non autorisée, elle
 * affecte 0 ligne. On exige donc la ligne renvoyée par `.select()`.
 */
export function expectRow<T>(result: { data: T | null; error: PostgrestLikeError | null }): NonNullable<T> {
  if (result.error) throw fromPostgrestError(result.error)
  if (result.data === null || (Array.isArray(result.data) && result.data.length === 0)) {
    throw new AppError('forbidden', "Modification non enregistrée : l'élément n'existe plus ou vos droits ne le permettent pas.")
  }
  return result.data as NonNullable<T>
}
