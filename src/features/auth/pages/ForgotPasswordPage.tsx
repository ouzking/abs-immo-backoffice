import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Mail, MailCheck } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Form'
import { Callout } from '@/components/ui/States'
import { errorMessage } from '@/lib/errors'
import { requestPasswordReset } from '../api'
import { AuthLayout } from '../AuthLayout'
import { forgotSchema, type ForgotValues } from '../schemas'

export function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } })

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null)
    try {
      await requestPasswordReset(email)
      setSentTo(email)
    } catch (e) {
      setError(errorMessage(e))
    }
  })

  return (
    <AuthLayout
      title="Mot de passe oublié"
      subtitle="Saisissez votre adresse professionnelle : vous recevrez un lien pour choisir un nouveau mot de passe."
    >
      {sentTo ? (
        <Callout tone="success" icon={<MailCheck className="h-5 w-5" />} title="Vérifiez votre messagerie">
          Si un compte existe pour <strong>{sentTo}</strong>, un e-mail contenant un lien de réinitialisation vient
          d'être envoyé. Le lien est valable pour une durée limitée.
        </Callout>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {error && <Callout tone="danger">{error}</Callout>}
          <Field label="Adresse e-mail" error={errors.email?.message}>
            <Input type="email" autoComplete="username" autoFocus leading={<Mail className="h-4 w-4" />} {...register('email')} />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
            Envoyer le lien
          </Button>
        </form>
      )}
      <ButtonLink to="/login" variant="ghost" className="mt-6" icon={<ArrowLeft className="h-4 w-4" />}>
        Retour à la connexion
      </ButtonLink>
    </AuthLayout>
  )
}
