import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { KeyRound, Save, ShieldCheck, ShieldOff, Smartphone } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, DetailList } from '@/components/ui/Card'
import { useConfirm } from '@/components/ui/Confirm'
import { Field, Input } from '@/components/ui/Form'
import { PageHeader } from '@/components/ui/PageHeader'
import { Callout, ErrorState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { getAgent, getMyProfile, updateMyProfile } from '@/features/agents/api'
import { AgentForm } from '@/features/agents/components/AgentForm'
import { enrollTotp, listTotpFactors, unenrollFactor, updatePassword, verifyTotp } from '@/features/auth/api'
import { useAccess, useAuth } from '@/features/auth/AuthProvider'
import { PasswordChecklist } from '@/features/auth/components/PasswordChecklist'
import { newPasswordSchema, type NewPasswordValues } from '@/features/auth/schemas'
import { errorMessage } from '@/lib/errors'
import { formatDate, formatDateTime, normalizePhone } from '@/lib/format'
import { ROLES, labelOf } from '@/lib/labels'

const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'Au moins 2 caractères.').max(120),
  phone: z.string().trim().refine((v) => normalizePhone(v) !== undefined, 'Numéro invalide.'),
})

export function ProfilePage() {
  const access = useAccess()
  const { can } = useAuth()
  const profile = useQuery({ queryKey: ['profile', access.user_id], queryFn: () => getMyProfile(access.user_id) })
  const agent = useQuery({ queryKey: ['agents', 'detail', access.user_id], queryFn: () => getAgent(access.user_id), enabled: access.is_agent, retry: false })

  return (
    <>
      <PageHeader title="Mon profil et sécurité" description="Vos informations personnelles, votre mot de passe et la double authentification." />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          {profile.error ? <ErrorState error={profile.error} /> : !profile.data ? <LoadingBlock /> : <ProfileCard key={profile.data.updated_at} fullName={profile.data.full_name} phone={profile.data.phone} />}
          <Card>
            <CardHeader title="Accès" description="Attribués par un administrateur ; vous ne pouvez pas les modifier vous-même." />
            <CardBody>
              <DetailList
                items={[
                  { label: 'E-mail', value: access.email },
                  { label: 'Rôles', value: access.roles.map((r) => labelOf(ROLES, r)).join(', ') },
                  { label: 'Compte créé le', value: formatDate(profile.data?.created_at) },
                  { label: 'Dernière connexion', value: formatDateTime(profile.data?.last_sign_in_at) },
                ]}
              />
            </CardBody>
          </Card>
          <PasswordCard />
        </div>
        <div className="space-y-6">
          <MfaCard recommended={can('users.manage') || can('settings.manage')} />
          {access.is_agent && agent.data && (
            <Card>
              <CardHeader title="Ma fiche agent" />
              <CardBody>
                <AgentForm key={agent.data.updated_at} agent={agent.data} canManage={can('agents.manage')} canEdit />
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

function ProfileCard({ fullName, phone }: { fullName: string; phone: string | null }) {
  const access = useAccess()
  const { refresh } = useAuth()
  const qc = useQueryClient()
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(profileSchema), defaultValues: { full_name: fullName, phone: phone ?? '' } })
  const mutation = useMutation({
    mutationFn: (v: z.infer<typeof profileSchema>) => updateMyProfile(access.user_id, { full_name: v.full_name, phone: normalizePhone(v.phone) ?? null }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] })
      void refresh()
      toast.success('Profil mis à jour.')
    },
    onError: (e) => toast.error('Profil non enregistré', { description: errorMessage(e) }),
  })
  return (
    <Card>
      <CardHeader title="Informations personnelles" />
      <CardBody>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="space-y-4">
          <Field label="Nom complet" error={errors.full_name?.message}>
            <Input {...register('full_name')} />
          </Field>
          <Field label="Téléphone" error={errors.phone?.message}>
            <Input type="tel" {...register('phone')} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={mutation.isPending} disabled={!isDirty} icon={<Save className="h-4 w-4" />}>
              Enregistrer
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

function PasswordCard() {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<NewPasswordValues>({ resolver: zodResolver(newPasswordSchema), defaultValues: { password: '', confirm: '' } })
  const password = useWatch({ control, name: 'password' })
  const mutation = useMutation({
    mutationFn: (v: NewPasswordValues) => updatePassword(v.password),
    onSuccess: () => {
      reset()
      toast.success('Mot de passe modifié.')
    },
  })
  return (
    <Card>
      <CardHeader title="Mot de passe" icon={<KeyRound className="h-4 w-4" />} />
      <CardBody>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="space-y-4">
          {mutation.error && <Callout tone="danger">{errorMessage(mutation.error)}</Callout>}
          <Field label="Nouveau mot de passe" error={errors.password?.message}>
            <Input type="password" autoComplete="new-password" {...register('password')} />
          </Field>
          <PasswordChecklist value={password} />
          <Field label="Confirmation" error={errors.confirm?.message}>
            <Input type="password" autoComplete="new-password" {...register('confirm')} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={mutation.isPending}>
              Changer le mot de passe
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

function MfaCard({ recommended }: { recommended: boolean }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const factors = useQuery({ queryKey: ['mfa', 'factors'], queryFn: listTotpFactors })
  const [enrollment, setEnrollment] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const verified = (factors.data ?? []).filter((f) => f.status === 'verified')

  const start = useMutation({
    mutationFn: async () => {
      // Nettoie une inscription précédente non terminée.
      for (const f of (factors.data ?? []).filter((x) => x.status !== 'verified')) await unenrollFactor(f.id)
      return enrollTotp()
    },
    onSuccess: (e) => {
      setEnrollment(e)
      setCode('')
    },
    onError: (e) => toast.error('Activation impossible', { description: errorMessage(e) }),
  })
  const verify = useMutation({
    mutationFn: () => verifyTotp(enrollment!.factorId, code),
    onSuccess: () => {
      setEnrollment(null)
      void qc.invalidateQueries({ queryKey: ['mfa'] })
      toast.success('Double authentification activée.')
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => unenrollFactor(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mfa'] })
      toast.success('Double authentification désactivée.')
    },
    onError: (e) => toast.error('Désactivation impossible', { description: errorMessage(e) }),
  })

  return (
    <Card>
      <CardHeader
        title="Double authentification (TOTP)"
        icon={<Smartphone className="h-4 w-4" />}
        actions={verified.length > 0 ? <Badge tone="success">Activée</Badge> : <Badge tone="warning">Désactivée</Badge>}
      />
      <CardBody className="space-y-4">
        {factors.error && <Callout tone="danger">{errorMessage(factors.error)}</Callout>}
        {verified.length === 0 && recommended && !enrollment && (
          <Callout tone="warning" icon={<ShieldOff className="h-4 w-4" />}>
            Fortement recommandée pour les comptes administrateurs.
          </Callout>
        )}
        <p className="text-sm text-mist-600">
          Un code à 6 chiffres, généré par une application (Google Authenticator, Microsoft Authenticator, 1Password…), vous sera demandé à chaque connexion.
        </p>
        {verified.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded-lg border border-mist-200 px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-success-600" aria-hidden />
              {f.friendly_name ?? 'Application d’authentification'} · ajoutée le {formatDate(f.created_at)}
            </span>
            <Button
              size="sm"
              variant="danger-outline"
              loading={remove.isPending}
              onClick={async () => {
                if (await confirm({ title: 'Désactiver la double authentification ?', description: 'Votre compte ne sera plus protégé que par le mot de passe.', confirmLabel: 'Désactiver', tone: 'danger' })) {
                  remove.mutate(f.id)
                }
              }}
            >
              Désactiver
            </Button>
          </div>
        ))}
        {verified.length === 0 && !enrollment && (
          <Button onClick={() => start.mutate()} loading={start.isPending} icon={<ShieldCheck className="h-4 w-4" />}>
            Activer la double authentification
          </Button>
        )}
        {enrollment && (
          <div className="space-y-4 rounded-xl border border-navy-100 bg-navy-50/50 p-4">
            <p className="text-sm font-semibold">1. Scannez ce QR code avec votre application</p>
            <img src={enrollment.qrCode} alt="QR code de configuration TOTP" className="h-44 w-44 rounded-lg bg-white p-2" />
            <p className="text-xs text-mist-600">
              Ou saisissez la clé : <code className="rounded bg-white px-1.5 py-0.5 font-mono break-all">{enrollment.secret}</code>
            </p>
            <p className="text-sm font-semibold">2. Saisissez le code affiché</p>
            {verify.error && <Callout tone="danger">{errorMessage(verify.error)}</Callout>}
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label="Code de vérification"
                className="max-w-40 text-center font-mono tracking-[0.3em]"
                placeholder="000000"
              />
              <Button onClick={() => verify.mutate()} loading={verify.isPending} disabled={code.length !== 6}>
                Vérifier
              </Button>
              <Button variant="ghost" onClick={() => setEnrollment(null)}>
                Annuler
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
