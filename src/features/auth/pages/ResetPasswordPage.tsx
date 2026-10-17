import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { KeyRound } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Form'
import { Callout } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { errorMessage } from '@/lib/errors'
import { updatePassword } from '../api'
import { useAuth } from '../AuthProvider'
import { AuthLayout } from '../AuthLayout'
import { PasswordChecklist } from '../components/PasswordChecklist'
import { newPasswordSchema, type NewPasswordValues } from '../schemas'

/**
 * Cible des liens de réinitialisation ET d'invitation (`?invite=1`) :
 * supabase-js ouvre la session à partir du lien, puis l'utilisateur choisit son mot de passe.
 */
export function ResetPasswordPage() {
  const { status, session } = useAuth()
  const [params] = useSearchParams()
  const isInvite = params.get('invite') === '1'
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordValues>({ resolver: zodResolver(newPasswordSchema), defaultValues: { password: '', confirm: '' } })
  const password = useWatch({ control, name: 'password' })

  const title = isInvite ? 'Bienvenue ! Choisissez votre mot de passe' : 'Nouveau mot de passe'

  if (status === 'loading') {
    return (
      <AuthLayout title={title}>
        <LoadingBlock label="Vérification du lien…" />
      </AuthLayout>
    )
  }

  if (!session) {
    return (
      <AuthLayout title="Lien invalide ou expiré">
        <Callout tone="warning">
          Ce lien n'est plus valable (il a peut-être déjà été utilisé). Demandez un nouveau lien de réinitialisation.
        </Callout>
        <ButtonLink to="/forgot-password" variant="primary" className="mt-6 w-full">
          Demander un nouveau lien
        </ButtonLink>
      </AuthLayout>
    )
  }

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null)
    try {
      await updatePassword(password)
      toast.success('Mot de passe enregistré.')
      navigate('/', { replace: true })
    } catch (e) {
      setError(errorMessage(e))
    }
  })

  return (
    <AuthLayout
      title={title}
      subtitle={
        <>
          Compte : <strong className="text-ink">{session.user.email}</strong>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {error && <Callout tone="danger">{error}</Callout>}
        <Field label="Nouveau mot de passe" error={errors.password?.message}>
          <Input type="password" autoComplete="new-password" autoFocus {...register('password')} />
        </Field>
        <PasswordChecklist value={password} />
        <Field label="Confirmation" error={errors.confirm?.message}>
          <Input type="password" autoComplete="new-password" {...register('confirm')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting} icon={<KeyRound className="h-4 w-4" />}>
          Enregistrer le mot de passe
        </Button>
      </form>
    </AuthLayout>
  )
}
