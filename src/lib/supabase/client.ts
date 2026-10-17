import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/config/env'
import { AppError } from '@/lib/errors'
import type { Database } from '@/types'

export type AbsSupabaseClient = SupabaseClient<Database>

let client: AbsSupabaseClient | null = null

/**
 * Client Supabase unique du back-office (rôle `authenticated` après connexion,
 * clé publique uniquement). Les composants n'appellent jamais ce client
 * directement : ils passent par les services de `src/features/<domaine>/api.ts`.
 *
 * Flux d'authentification « implicit » (valeur par défaut de supabase-js) :
 * les invitations envoyées par l'Edge Function `admin-users` (côté serveur)
 * reviennent avec des jetons dans le fragment d'URL, ce qu'un client PKCE refuse.
 */
export function getSupabase(): AbsSupabaseClient {
  if (client) return client
  if (!env.isSupabaseConfigured) {
    throw new AppError(
      'config',
      'Supabase non configuré : définissez VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY.',
    )
  }
  client = createClient<Database>(env.supabaseUrl!, env.supabaseKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'abs-immo-backoffice-auth',
    },
    global: { headers: { 'x-client-info': 'abs-immo-backoffice' } },
  })
  return client
}

/** Réservé aux tests : remplace le client par un double (null pour réinitialiser). */
export function setSupabaseClientForTests(mock: unknown): void {
  client = mock as AbsSupabaseClient | null
}
