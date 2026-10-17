import type { AuthError, Factor } from '@supabase/supabase-js'
import { AppError, fromPostgrestError } from '@/lib/errors'
import { getSupabase } from '@/lib/supabase/client'
import type { MyAccess } from '@/types'

function fromAuthError(error: AuthError | Error): AppError {
  const code = 'code' in error && typeof error.code === 'string' ? error.code : ''
  const status = 'status' in error ? Number(error.status) : 0
  const msg = error.message ?? ''
  if (/failed to fetch|network/i.test(msg) || error.name === 'AuthRetryableFetchError') {
    return new AppError('network', 'Connexion au serveur impossible. Vérifiez votre connexion internet.', { cause: error })
  }
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) {
    return new AppError('validation', 'E-mail ou mot de passe incorrect.', { code, cause: error })
  }
  if (code === 'email_not_confirmed') {
    return new AppError('validation', "Votre adresse e-mail n'a pas encore été confirmée.", { code, cause: error })
  }
  if (code === 'user_banned' || /banned/i.test(msg)) {
    return new AppError('forbidden', 'Ce compte a été désactivé. Contactez un administrateur.', { code, cause: error })
  }
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || status === 429) {
    return new AppError('rate_limited', 'Trop de tentatives. Patientez quelques minutes avant de réessayer.', { code, cause: error })
  }
  if (code === 'weak_password' || /weak|password should/i.test(msg)) {
    return new AppError(
      'validation',
      'Mot de passe trop faible : au moins 10 caractères, avec minuscule, majuscule et chiffre.',
      { code, cause: error },
    )
  }
  if (code === 'same_password') {
    return new AppError('validation', "Le nouveau mot de passe doit être différent de l'actuel.", { code, cause: error })
  }
  if (code === 'session_not_found' || code === 'session_expired' || /auth session missing/i.test(msg)) {
    return new AppError('auth', 'Lien expiré ou session absente. Demandez un nouveau lien.', { code, cause: error })
  }
  if (code === 'mfa_verification_failed' || /invalid totp|invalid code/i.test(msg)) {
    return new AppError('validation', 'Code de vérification incorrect ou expiré.', { code, cause: error })
  }
  return new AppError('unknown', msg || 'Erreur d’authentification.', { code, cause: error })
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error) throw fromAuthError(error)
}

export async function signOut(): Promise<void> {
  // scope 'local' : déconnecte ce navigateur même si le serveur est injoignable.
  await getSupabase().auth.signOut({ scope: 'local' })
}

/** URL de retour des e-mails de réinitialisation et d'invitation. */
export function resetPasswordRedirectUrl(params = ''): string {
  return `${window.location.origin}/reset-password${params}`
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: resetPasswordRedirectUrl(),
  })
  // Réponse identique que le compte existe ou non (pas d'énumération), sauf erreurs techniques.
  if (error) {
    const e = fromAuthError(error)
    if (e.kind === 'network' || e.kind === 'rate_limited') throw e
  }
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await getSupabase().auth.updateUser({ password })
  if (error) throw fromAuthError(error)
}

/** Droits effectifs de l'utilisateur courant, calculés par la base (source d'autorité). */
export async function fetchMyAccess(): Promise<MyAccess | null> {
  const { data, error } = await getSupabase().rpc('get_my_access')
  if (error) throw fromPostgrestError(error)
  return (data as unknown as MyAccess | null) ?? null
}

// ----------------------------------------------------------------------------
// MFA (TOTP)
// ----------------------------------------------------------------------------
export async function getAssuranceLevel(): Promise<{ current: string | null; next: string | null }> {
  const { data, error } = await getSupabase().auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) throw fromAuthError(error)
  return { current: data.currentLevel, next: data.nextLevel }
}

export async function listTotpFactors(): Promise<Factor[]> {
  const { data, error } = await getSupabase().auth.mfa.listFactors()
  if (error) throw fromAuthError(error)
  return data.totp
}

export async function enrollTotp(): Promise<{ factorId: string; qrCode: string; secret: string }> {
  const { data, error } = await getSupabase().auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `ABS IMMO ${new Date().toISOString().slice(0, 10)}`,
  })
  if (error) throw fromAuthError(error)
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

export async function verifyTotp(factorId: string, code: string): Promise<void> {
  const { error } = await getSupabase().auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, '') })
  if (error) throw fromAuthError(error)
}

export async function unenrollFactor(factorId: string): Promise<void> {
  const { error } = await getSupabase().auth.mfa.unenroll({ factorId })
  if (error) throw fromAuthError(error)
}
