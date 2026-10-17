/* eslint-disable react-refresh/only-export-components -- le fournisseur et son hook partagent le même contexte. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { onSessionExpired } from '@/lib/authEvents'
import { getSupabase } from '@/lib/supabase/client'
import type { MyAccess, PermissionCode } from '@/types'
import { fetchMyAccess, getAssuranceLevel, signOut as apiSignOut } from './api'
import { hasAnyPermission, hasPermission } from './permissions'

export type AuthStatus = 'loading' | 'signed_out' | 'mfa_required' | 'no_access' | 'error' | 'ready'

export interface AuthContextValue {
  status: AuthStatus
  session: Session | null
  /** Droits calculés par la base (`get_my_access`) : seule source d'autorité côté interface. */
  access: MyAccess | null
  /** Vrai si la dernière déconnexion n'a pas été demandée par l'utilisateur (session expirée, compte désactivé). */
  expired: boolean
  loadError: unknown
  can: (permission: PermissionCode) => boolean
  canAny: (permissions: readonly PermissionCode[]) => boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
  acknowledgeExpired: () => void
}

/** Exporté pour les tests de composants (voir src/test/render.tsx). */
export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const [access, setAccess] = useState<MyAccess | null>(null)
  const [expired, setExpired] = useState(false)
  const [loadError, setLoadError] = useState<unknown>(null)
  const manualSignOut = useRef(false)
  const loadSeq = useRef(0)

  const load = useCallback(async (s: Session | null) => {
    const seq = ++loadSeq.current
    if (!s) {
      setAccess(null)
      setStatus('signed_out')
      return
    }
    try {
      const aal = await getAssuranceLevel()
      if (seq !== loadSeq.current) return
      if (aal.next === 'aal2' && aal.current !== 'aal2') {
        setStatus('mfa_required')
        return
      }
      const a = await fetchMyAccess()
      if (seq !== loadSeq.current) return
      setAccess(a)
      setLoadError(null)
      setStatus(!a || !a.is_active || a.roles.length === 0 ? 'no_access' : 'ready')
    } catch (error) {
      if (seq !== loadSeq.current) return
      setLoadError(error)
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    const supabase = getSupabase()
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'SIGNED_OUT') {
        if (!manualSignOut.current) setExpired(true)
        manualSignOut.current = false
        loadSeq.current++
        queryClient.clear()
        setAccess(null)
        setStatus('signed_out')
        return
      }
      if (event === 'TOKEN_REFRESHED') return
      // Ne jamais attendre un appel Supabase dans ce rappel (verrou interne d'auth-js).
      window.setTimeout(() => void load(s), 0)
    })
    return () => data.subscription.unsubscribe()
  }, [load, queryClient])

  // Une requête a échoué pour cause de JWT expiré/invalide : déconnexion locale.
  useEffect(
    () =>
      onSessionExpired(() => {
        manualSignOut.current = false
        void apiSignOut()
      }),
    [],
  )

  const signOut = useCallback(async () => {
    manualSignOut.current = true
    setExpired(false)
    await apiSignOut()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      access,
      expired,
      loadError,
      can: (p) => hasPermission(access, p),
      canAny: (ps) => hasAnyPermission(access, ps),
      refresh: () => load(session),
      signOut,
      acknowledgeExpired: () => setExpired(false),
    }),
    [status, session, access, expired, loadError, load, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>.')
  return ctx
}

/** Accès garanti (à utiliser sous <RequireAuth>). */
export function useAccess(): MyAccess {
  const { access } = useAuth()
  if (!access) throw new Error('useAccess appelé sans session active.')
  return access
}
