import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { LogOut, ShieldOff } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import type { PermissionCode } from '@/types'
import { useAuth } from './AuthProvider'

function FullScreen({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center bg-mist-50 p-6">{children}</div>
}

/** Accès réservé aux membres actifs du personnel. */
export function RequireAuth() {
  const { status, loadError, refresh, signOut } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <FullScreen>
        <LoadingBlock label="Vérification de la session…" />
      </FullScreen>
    )
  }
  if (status === 'signed_out') {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }
  if (status === 'mfa_required') {
    return <Navigate to="/mfa" replace state={{ from: `${location.pathname}${location.search}` }} />
  }
  if (status === 'error') {
    return (
      <FullScreen>
        <div className="w-full max-w-md rounded-card border border-mist-200 bg-white shadow-soft">
          <ErrorState error={loadError} onRetry={() => void refresh()} title="Impossible de charger vos droits" />
          <div className="border-t border-mist-100 p-4 text-center">
            <Button variant="ghost" size="sm" icon={<LogOut className="h-4 w-4" />} onClick={() => void signOut()}>
              Se déconnecter
            </Button>
          </div>
        </div>
      </FullScreen>
    )
  }
  if (status === 'no_access') return <NoAccessScreen />
  return <Outlet />
}

/** Compte authentifié mais sans rôle ou désactivé : aucun accès aux données. */
export function NoAccessScreen() {
  const { signOut, access } = useAuth()
  return (
    <FullScreen>
      <div className="w-full max-w-md rounded-card border border-mist-200 bg-white p-8 text-center shadow-soft">
        <Logo className="mx-auto h-12" />
        <span className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-red-50 text-brand-red-600">
          <ShieldOff className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-lg font-bold">Accès au back-office indisponible</h1>
        <p className="mt-2 text-sm leading-relaxed text-mist-600">
          {access && !access.is_active
            ? 'Ce compte a été désactivé par un administrateur.'
            : "Votre compte n'a encore aucun rôle attribué."}{' '}
          Contactez un administrateur d'ABS IMMO &amp; SERVICES.
        </p>
        <Button className="mt-6" variant="secondary" icon={<LogOut className="h-4 w-4" />} onClick={() => void signOut()}>
          Se déconnecter
        </Button>
      </div>
    </FullScreen>
  )
}

/**
 * Masque une page si l'utilisateur n'a aucune des permissions requises.
 * Complément d'interface : la base refuserait de toute façon les données.
 */
export function RequirePermission({ anyOf, children }: { anyOf: readonly PermissionCode[]; children?: ReactNode }) {
  const { canAny } = useAuth()
  if (!canAny(anyOf)) return <AccessDenied />
  return children ? <>{children}</> : <Outlet />
}

export function AccessDenied() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-red-50 text-brand-red-600">
        <ShieldOff className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-bold">Accès refusé</h1>
      <p className="mt-2 text-sm leading-relaxed text-mist-600">
        Vos droits ne permettent pas d'afficher cette page. Si vous pensez qu'il s'agit d'une erreur, demandez à un
        administrateur de vérifier votre rôle.
      </p>
      <ButtonLink to="/" variant="primary" className="mt-6">
        Retour au tableau de bord
      </ButtonLink>
    </div>
  )
}
