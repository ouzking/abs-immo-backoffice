import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, Navigate, useLocation } from 'react-router'
import { Eye, EyeOff, LogIn, Mail } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Form'
import { Callout } from '@/components/ui/States'
import { errorMessage } from '@/lib/errors'
import { signIn } from '../api'
import { useAuth } from '../AuthProvider'
import { AuthLayout } from '../AuthLayout'
import { loginSchema, type LoginValues } from '../schemas'

export function LoginPage() {
  const { status, expired, acknowledgeExpired } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })

  if (status !== 'loading' && status !== 'signed_out') return <Navigate to={from} replace />

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    acknowledgeExpired()
    try {
      await signIn(values.email, values.password)
    } catch (e) {
      setError(errorMessage(e))
    }
  })

  return (
    <AuthLayout title="Connexion" subtitle="Accédez au back-office d'ABS IMMO & SERVICES avec vos identifiants professionnels.">
      {expired && !error && (
        <Callout tone="warning" className="mb-5" title="Session expirée">
          Pour votre sécurité, vous avez été déconnecté. Reconnectez-vous pour continuer.
        </Callout>
      )}
      {error && (
        <Callout tone="danger" className="mb-5">
          {error}
        </Callout>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <Field label="Adresse e-mail" error={errors.email?.message}>
          <Input
            type="email"
            autoComplete="username"
            inputMode="email"
            autoFocus
            leading={<Mail className="h-4 w-4" />}
            placeholder="prenom.nom@abs-immo.sn"
            {...register('email')}
          />
        </Field>
        <Field
          label="Mot de passe"
          htmlFor="login-password"
          error={errors.password?.message}
          labelAction={
            <Link to="/forgot-password" className="text-xs font-semibold text-navy-700 hover:underline">
              Mot de passe oublié ?
            </Link>
          }
        >
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="pr-11"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-mist-500 hover:bg-mist-100"
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting} icon={<LogIn className="h-4 w-4" />}>
          Se connecter
        </Button>
      </form>
      <p className="mt-8 text-center text-xs leading-relaxed text-mist-500">
        Les comptes sont créés par un administrateur de l'agence. Aucune inscription publique n'est possible.
      </p>
    </AuthLayout>
  )
}
