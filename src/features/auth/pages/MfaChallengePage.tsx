import { useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { LogOut, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Form'
import { Callout, ErrorState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { errorMessage } from '@/lib/errors'
import { listTotpFactors, verifyTotp } from '../api'
import { useAuth } from '../AuthProvider'
import { AuthLayout } from '../AuthLayout'

/** Second facteur (TOTP) pour les comptes qui l'ont activé. */
export function MfaChallengePage() {
  const { status, signOut, refresh } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const factors = useQuery({ queryKey: ['mfa', 'factors'], queryFn: listTotpFactors, enabled: status === 'mfa_required' })

  if (status === 'signed_out') return <Navigate to="/login" replace />
  if (status !== 'mfa_required' && status !== 'loading') return <Navigate to={from} replace />

  const factor = factors.data?.find((f) => f.status === 'verified')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!factor) return
    setBusy(true)
    setError(null)
    try {
      await verifyTotp(factor.id, code)
      await refresh()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Vérification en deux étapes"
      subtitle="Saisissez le code à 6 chiffres affiché par votre application d'authentification."
    >
      {factors.isLoading ? (
        <LoadingBlock />
      ) : factors.error ? (
        <ErrorState error={factors.error} onRetry={() => void factors.refetch()} compact />
      ) : (
        <form onSubmit={submit} className="space-y-5" noValidate>
          {error && <Callout tone="danger">{error}</Callout>}
          <Field label="Code de vérification">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              className="text-center font-mono text-xl tracking-[0.5em]"
              placeholder="000000"
            />
          </Field>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={busy}
            disabled={code.length !== 6 || !factor}
            icon={<ShieldCheck className="h-4 w-4" />}
          >
            Vérifier
          </Button>
        </form>
      )}
      <Button variant="ghost" className="mt-6" icon={<LogOut className="h-4 w-4" />} onClick={() => void signOut()}>
        Utiliser un autre compte
      </Button>
    </AuthLayout>
  )
}
