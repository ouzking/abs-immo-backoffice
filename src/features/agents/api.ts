import { AppError, expectRow, fromFunctionsError, unwrap, unwrapMaybe } from '@/lib/errors'
import { getSupabase } from '@/lib/supabase/client'
import { removeFiles, uploadWithProgress } from '@/lib/supabase/storage'
import { resetPasswordRedirectUrl } from '@/features/auth/api'
import { STORAGE_BUCKETS, STORAGE_LIMITS, type AdminUsersRequest, type Agent, type Profile, type RoleCode, type TablesUpdate, type UserListItem } from '@/types'

// =============================================================================
// Fiches agents
// =============================================================================
export type AgentRow = Agent & { profile: { email: string | null; is_active: boolean } | null }

const AGENT_COLUMNS = '*,profile:profiles!agents_profile_id_fkey(email,is_active)'

export async function listAgents(): Promise<AgentRow[]> {
  return unwrap(await getSupabase().from('agents').select(AGENT_COLUMNS).order('display_name')) as unknown as AgentRow[]
}

export async function getAgent(profileId: string): Promise<AgentRow> {
  const row = unwrapMaybe(await getSupabase().from('agents').select(AGENT_COLUMNS).eq('profile_id', profileId).maybeSingle())
  if (!row) throw new AppError('not_found', 'Fiche agent introuvable.')
  return row as unknown as AgentRow
}

/** Colonnes modifiables par l'agent lui-même (les autres exigent agents.manage). */
export const AGENT_SELF_COLUMNS = ['display_name', 'job_title', 'bio', 'public_phone', 'whatsapp_phone', 'public_email', 'photo_path', 'languages', 'license_number'] as const
export const AGENT_MANAGER_COLUMNS = [...AGENT_SELF_COLUMNS, 'is_public', 'is_active', 'slug'] as const

export async function updateAgent(profileId: string, patch: Record<string, unknown>, canManage: boolean): Promise<Agent> {
  const allowed: readonly string[] = canManage ? AGENT_MANAGER_COLUMNS : AGENT_SELF_COLUMNS
  const clean: Record<string, unknown> = {}
  for (const k of allowed) if (k in patch) clean[k] = patch[k]
  return expectRow(
    await getSupabase().from('agents').update(clean as TablesUpdate<'agents'>).eq('profile_id', profileId).select().maybeSingle(),
  )
}

/** Création d'une fiche agent pour un compte existant (agents.manage). */
export async function createAgentProfile(input: { profileId: string; displayName: string; slug: string }): Promise<Agent> {
  return expectRow(
    await getSupabase()
      .from('agents')
      .insert({ profile_id: input.profileId, display_name: input.displayName, slug: input.slug })
      .select()
      .single(),
  )
}

const PHOTO_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export function validateAgentPhoto(file: File): string | null {
  const limits = STORAGE_LIMITS['agent-photos']
  if (!(limits.mime as readonly string[]).includes(file.type)) return 'Format non accepté : JPEG, PNG ou WebP.'
  if (file.size > limits.maxBytes) return 'Photo trop volumineuse (3 Mo maximum).'
  return null
}

/** Photo publique (bucket agent-photos, dossier = id du profil). */
export async function uploadAgentPhoto(agent: Pick<Agent, 'profile_id' | 'photo_path'>, file: File, canManage: boolean): Promise<Agent> {
  const invalid = validateAgentPhoto(file)
  if (invalid) throw new AppError('validation', invalid)
  const path = `${agent.profile_id}/${crypto.randomUUID()}.${PHOTO_EXT[file.type]}`
  await uploadWithProgress(STORAGE_BUCKETS.agentPhotos, path, file)
  let updated: Agent
  try {
    updated = await updateAgent(agent.profile_id, { photo_path: path }, canManage)
  } catch (e) {
    await removeFiles(STORAGE_BUCKETS.agentPhotos, [path]).catch(() => undefined)
    throw e
  }
  if (agent.photo_path) await removeFiles(STORAGE_BUCKETS.agentPhotos, [agent.photo_path]).catch(() => undefined)
  return updated
}

// =============================================================================
// Comptes utilisateurs
// =============================================================================
export async function listUsers(): Promise<UserListItem[]> {
  return unwrap(await getSupabase().rpc('list_users')) as unknown as UserListItem[]
}

export async function assignRole(userId: string, role: RoleCode): Promise<void> {
  unwrap(await getSupabase().rpc('assign_role', { p_user_id: userId, p_role_code: role }))
}

export async function revokeRole(userId: string, role: RoleCode): Promise<void> {
  unwrap(await getSupabase().rpc('revoke_role', { p_user_id: userId, p_role_code: role }))
}

/**
 * Opérations privilégiées sur les comptes : Edge Function `admin-users`
 * (clé service_role côté serveur uniquement ; droits revérifiés en base).
 */
async function adminUsers<T>(body: AdminUsersRequest): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke('admin-users', { body })
  if (error) throw await fromFunctionsError(error)
  return (data as { data: T }).data
}

export function inviteUser(input: { email: string; full_name: string; role: RoleCode; phone?: string | null; create_agent_profile?: boolean }) {
  return adminUsers<{ user_id: string; email: string; agent_profile_created: boolean; warning?: string }>({
    action: 'invite',
    ...input,
    redirect_to: resetPasswordRedirectUrl('?invite=1'),
  })
}

export function createUserWithPassword(input: {
  email: string
  password: string
  full_name: string
  role: RoleCode
  phone?: string | null
  create_agent_profile?: boolean
}) {
  return adminUsers<{ user_id: string; email: string; agent_profile_created: boolean; warning?: string }>({ action: 'create', ...input })
}

export function setUserActive(userId: string, active: boolean) {
  return adminUsers<{ user_id: string; is_active: boolean }>({ action: active ? 'reactivate' : 'deactivate', user_id: userId })
}

export function sendPasswordReset(userId: string) {
  return adminUsers<{ user_id: string; email_sent: true }>({ action: 'send_password_reset', user_id: userId, redirect_to: resetPasswordRedirectUrl() })
}

// =============================================================================
// Profil personnel
// =============================================================================
export async function getMyProfile(userId: string): Promise<Profile> {
  const row = unwrapMaybe(await getSupabase().from('profiles').select('*').eq('id', userId).maybeSingle())
  if (!row) throw new AppError('not_found', 'Profil introuvable.')
  return row
}

export async function updateMyProfile(userId: string, patch: { full_name: string; phone: string | null }) {
  return expectRow(await getSupabase().from('profiles').update(patch).eq('id', userId).select().maybeSingle())
}
