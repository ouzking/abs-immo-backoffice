/**
 * Variables d'environnement publiques (préfixe VITE_), lues une seule fois et validées.
 * Aucune valeur secrète ne doit transiter par ce module : tout ce qui est ici est
 * intégré au bundle livré aux navigateurs.
 */
const raw = import.meta.env

function clean(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const v = value.trim()
  return v === '' ? undefined : v
}

function stripTrailingSlash(url: string | undefined): string | undefined {
  return url?.replace(/\/+$/, '')
}

function jwtPayload(key: string): string {
  const part = key.split('.')[1]
  if (!part) return ''
  try {
    return atob(part.replace(/-/g, '+').replace(/_/g, '/'))
  } catch {
    return ''
  }
}

/** Détecte une clé secrète (nouveau format `sb_secret_` ou ancien JWT `service_role`). */
export function looksLikeSecretKey(key: string | undefined): boolean {
  if (!key) return false
  return key.startsWith('sb_secret_') || /"role"\s*:\s*"service_role"/.test(jwtPayload(key))
}

const supabaseUrl = stripTrailingSlash(clean(raw.VITE_SUPABASE_URL))
const supabaseKey = clean(raw.VITE_SUPABASE_PUBLISHABLE_KEY) ?? clean(raw.VITE_SUPABASE_ANON_KEY)

if (looksLikeSecretKey(supabaseKey)) {
  throw new Error(
    'Clé Supabase secrète détectée dans la configuration du back-office. Utilisez uniquement la clé publique (publishable ou anon).',
  )
}

export const env = {
  supabaseUrl,
  supabaseKey,
  isSupabaseConfigured: !!supabaseUrl && !!supabaseKey,
  publicSiteUrl: stripTrailingSlash(clean(raw.VITE_PUBLIC_SITE_URL)),
  isDev: raw.DEV,
} as const

/** Version du contrat backend avec laquelle ce back-office a été écrit et testé. */
export const CONTRACT_VERSION_EXPECTED = '1.0.0'
