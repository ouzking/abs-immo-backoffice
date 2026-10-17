import { useRef, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Clock, ImageUp, Mail, MapPin, MessageCircle, Phone, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Field, Input, Switch, Textarea } from '@/components/ui/Form'
import { PageHeader } from '@/components/ui/PageHeader'
import { Callout, ErrorState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { Tabs } from '@/components/ui/Tabs'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { errorMessage } from '@/lib/errors'
import { formatDateTime, formatPhone, normalizePhone } from '@/lib/format'
import { publicUrl } from '@/lib/supabase/storage'
import type { AgencySettings, AppSetting } from '@/types'
import { SOCIAL_NETWORKS, getAgencySettings, listAppSettings, parseOpeningHours, parseSocialLinks, updateAgencySettings, updateAppSetting, uploadLogo } from './api'

const phone = z.string().trim().refine((v) => normalizePhone(v) !== undefined, 'Numéro invalide (ex. 33 800 11 22 ou +221…).')
const url = z.string().trim().refine((v) => v === '' || /^https:\/\/[^\s]+\.[^\s]+$/.test(v), 'Adresse https:// complète attendue.')
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM')

const schema = z.object({
  agency_name: z.string().trim().min(2, 'Au moins 2 caractères.').max(120),
  legal_name: z.string().trim().max(200),
  tagline: z.string().trim().max(200),
  description: z.string().trim().max(4000),
  phone,
  secondary_phone: phone,
  whatsapp_phone: phone,
  email: z.string().trim().refine((v) => v === '' || z.string().email().safeParse(v).success, 'E-mail invalide.'),
  address_line: z.string().trim().max(300),
  ninea: z.string().trim().max(30),
  rccm: z.string().trim().max(60),
  seo_default_title: z.string().trim().max(120),
  seo_default_description: z.string().trim().max(320),
  opening_hours: z.array(z.object({ days: z.string().trim().min(1, 'Requis').max(60), open: time, close: time })).max(10),
  social: z.record(z.string(), url),
})
type Values = z.infer<typeof schema>

function toValues(s: AgencySettings): Values {
  const social = parseSocialLinks(s.social_links)
  return {
    agency_name: s.agency_name,
    legal_name: s.legal_name ?? '',
    tagline: s.tagline ?? '',
    description: s.description ?? '',
    phone: s.phone ?? '',
    secondary_phone: s.secondary_phone ?? '',
    whatsapp_phone: s.whatsapp_phone ?? '',
    email: s.email ?? '',
    address_line: s.address_line ?? '',
    ninea: s.ninea ?? '',
    rccm: s.rccm ?? '',
    seo_default_title: s.seo_default_title ?? '',
    seo_default_description: s.seo_default_description ?? '',
    opening_hours: parseOpeningHours(s.opening_hours),
    social: Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n.key, social[n.key] ?? ''])),
  }
}

export function SettingsPage() {
  const [tab, setTab] = useState<'agency' | 'operations'>('agency')
  return (
    <>
      <PageHeader title="Paramètres" description="Informations publiques de l’agence (affichées sur le site) et réglages de fonctionnement." />
      <Tabs
        label="Sections des paramètres"
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[
          { key: 'agency', label: 'Agence (public)' },
          { key: 'operations', label: 'Fonctionnement' },
        ]}
      />
      {tab === 'agency' ? <AgencySection /> : <OperationsSection />}
    </>
  )
}

function AgencySection() {
  const settings = useQuery({ queryKey: ['settings', 'agency'], queryFn: getAgencySettings })
  if (settings.error) return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
  if (!settings.data) return <LoadingBlock />
  return <AgencyForm key={settings.data.updated_at} settings={settings.data} />
}

function AgencyForm({ settings }: { settings: AgencySettings }) {
  const qc = useQueryClient()
  const logoRef = useRef<HTMLInputElement>(null)
  const [logoBusy, setLogoBusy] = useState(false)
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(settings) })
  const hours = useFieldArray({ control, name: 'opening_hours' })
  const live = useWatch({ control })
  useUnsavedChangesGuard(isDirty)

  const mutation = useMutation({
    mutationFn: (v: Values) => {
      const social = Object.fromEntries(Object.entries(v.social).filter(([, link]) => link))
      // Conserver les réseaux non gérés par ce formulaire.
      const extra = Object.fromEntries(Object.entries(parseSocialLinks(settings.social_links)).filter(([k]) => !SOCIAL_NETWORKS.some((n) => n.key === k)))
      return updateAgencySettings({
        agency_name: v.agency_name,
        legal_name: v.legal_name || null,
        tagline: v.tagline || null,
        description: v.description || null,
        phone: normalizePhone(v.phone) ?? null,
        secondary_phone: normalizePhone(v.secondary_phone) ?? null,
        whatsapp_phone: normalizePhone(v.whatsapp_phone) ?? null,
        email: v.email ? v.email.toLowerCase() : null,
        address_line: v.address_line || null,
        ninea: v.ninea || null,
        rccm: v.rccm || null,
        seo_default_title: v.seo_default_title || null,
        seo_default_description: v.seo_default_description || null,
        opening_hours: v.opening_hours,
        social_links: { ...extra, ...social },
      })
    },
    onSuccess: (row) => {
      qc.setQueryData(['settings', 'agency'], row)
      reset(toValues(row))
      toast.success('Paramètres publiés sur le site.')
    },
    onError: (e) => toast.error('Enregistrement impossible', { description: errorMessage(e) }),
  })

  const onLogo = async (file: File | undefined) => {
    if (!file) return
    setLogoBusy(true)
    try {
      const row = await uploadLogo(file, settings.logo_path)
      void qc.invalidateQueries({ queryKey: ['settings', 'agency'] })
      toast.success('Logo mis à jour.', { description: row.logo_path ?? undefined })
    } catch (e) {
      toast.error('Logo non enregistré', { description: errorMessage(e) })
    } finally {
      setLogoBusy(false)
      if (logoRef.current) logoRef.current.value = ''
    }
  }

  const logoUrl = publicUrl('site-assets', settings.logo_path)

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        <Callout tone="info">Toutes ces informations sont publiques. N’y saisissez jamais de mot de passe, de clé ou de donnée confidentielle.</Callout>
        <Card>
          <CardHeader title="Identité" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom commercial" required error={errors.agency_name?.message}>
              <Input {...register('agency_name')} />
            </Field>
            <Field label="Raison sociale" error={errors.legal_name?.message}>
              <Input {...register('legal_name')} />
            </Field>
            <Field className="sm:col-span-2" label="Accroche" error={errors.tagline?.message}>
              <Input {...register('tagline')} />
            </Field>
            <Field className="sm:col-span-2" label="Texte de présentation" error={errors.description?.message}>
              <Textarea rows={5} maxLength={4000} {...register('description')} />
            </Field>
            <Field label="NINEA" error={errors.ninea?.message}>
              <Input {...register('ninea')} />
            </Field>
            <Field label="RCCM" error={errors.rccm?.message}>
              <Input {...register('rccm')} />
            </Field>
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-[13px] font-semibold text-mist-700">Logo</p>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-20 w-40 items-center justify-center rounded-xl border border-mist-200 bg-white p-2">
                  {logoUrl ? <img src={logoUrl} alt="Logo actuel" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-mist-400">Aucun logo</span>}
                </div>
                <Button variant="secondary" size="sm" loading={logoBusy} icon={<ImageUp className="h-4 w-4" />} onClick={() => logoRef.current?.click()}>
                  Remplacer le logo
                </Button>
                <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-label="Logo" onChange={(e) => void onLogo(e.target.files?.[0])} />
                <span className="text-xs text-mist-500">PNG, JPEG ou WebP · 5 Mo max. (SVG refusé pour raison de sécurité).</span>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Coordonnées et contact" description="Utilisées par le site lorsqu’un agent n’a pas de fiche publique." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Téléphone principal" error={errors.phone?.message}>
              <Input type="tel" {...register('phone')} />
            </Field>
            <Field label="Téléphone secondaire" error={errors.secondary_phone?.message}>
              <Input type="tel" {...register('secondary_phone')} />
            </Field>
            <Field label="WhatsApp" error={errors.whatsapp_phone?.message}>
              <Input type="tel" {...register('whatsapp_phone')} />
            </Field>
            <Field label="E-mail de contact" error={errors.email?.message}>
              <Input type="email" {...register('email')} />
            </Field>
            <Field className="sm:col-span-2" label="Adresse" error={errors.address_line?.message}>
              <Input {...register('address_line')} />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Horaires d’ouverture" />
          <CardBody className="space-y-3">
            {hours.fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-[1fr_96px_96px_auto] items-start gap-2">
                <Field label={<span className={i ? 'sr-only' : ''}>Jours</span>} error={errors.opening_hours?.[i]?.days?.message}>
                  <Input placeholder="Lundi - Vendredi" {...register(`opening_hours.${i}.days`)} />
                </Field>
                <Field label={<span className={i ? 'sr-only' : ''}>Ouverture</span>} error={errors.opening_hours?.[i]?.open?.message}>
                  <Input type="time" {...register(`opening_hours.${i}.open`)} />
                </Field>
                <Field label={<span className={i ? 'sr-only' : ''}>Fermeture</span>} error={errors.opening_hours?.[i]?.close?.message}>
                  <Input type="time" {...register(`opening_hours.${i}.close`)} />
                </Field>
                <Button variant="ghost" size="icon" className={i ? '' : 'mt-[22px]'} onClick={() => hours.remove(i)} aria-label={`Supprimer la ligne ${i + 1}`}>
                  <Trash2 className="h-4 w-4 text-brand-red-600" />
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => hours.append({ days: '', open: '09:00', close: '18:00' })}>
              Ajouter une plage
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Réseaux sociaux" description="Adresses complètes (https://…). Laissez vide pour masquer." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            {SOCIAL_NETWORKS.map((n) => (
              <Field key={n.key} label={n.label} error={errors.social?.[n.key]?.message}>
                <Input type="url" placeholder="https://" {...register(`social.${n.key}`)} />
              </Field>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Référencement par défaut" />
          <CardBody className="grid gap-4">
            <Field label="Titre SEO par défaut" error={errors.seo_default_title?.message}>
              <Input maxLength={120} {...register('seo_default_title')} />
            </Field>
            <Field label="Description SEO par défaut" error={errors.seo_default_description?.message}>
              <Textarea rows={2} maxLength={320} {...register('seo_default_description')} />
            </Field>
          </CardBody>
        </Card>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <Card>
          <CardHeader title="Aperçu public" description="Pied de page et page contact du site." />
          <CardBody>
            <div className="rounded-xl bg-navy-900 p-5 text-sm text-navy-100">
              {logoUrl && (
                <div className="mb-4 inline-flex rounded-lg bg-white p-2">
                  <img src={logoUrl} alt="" className="h-8" />
                </div>
              )}
              <p className="text-base font-bold text-white">{live.agency_name || '—'}</p>
              {live.tagline && <p className="mt-1 text-navy-200">{live.tagline}</p>}
              <ul className="mt-4 space-y-2">
                {live.address_line && (
                  <li className="flex gap-2">
                    <MapPin className="h-4 w-4 shrink-0" aria-hidden /> {live.address_line}
                  </li>
                )}
                {live.phone && (
                  <li className="flex gap-2">
                    <Phone className="h-4 w-4 shrink-0" aria-hidden /> {formatPhone(normalizePhone(live.phone) ?? live.phone)}
                  </li>
                )}
                {live.whatsapp_phone && (
                  <li className="flex gap-2">
                    <MessageCircle className="h-4 w-4 shrink-0" aria-hidden /> {formatPhone(normalizePhone(live.whatsapp_phone) ?? live.whatsapp_phone)}
                  </li>
                )}
                {live.email && (
                  <li className="flex gap-2">
                    <Mail className="h-4 w-4 shrink-0" aria-hidden /> {live.email}
                  </li>
                )}
              </ul>
              {(live.opening_hours ?? []).length > 0 && (
                <ul className="mt-4 space-y-1 border-t border-white/10 pt-3">
                  {(live.opening_hours ?? []).map((h, i) => (
                    <li key={i} className="flex gap-2">
                      <Clock className="h-4 w-4 shrink-0" aria-hidden />
                      <span>
                        {h?.days} : {h?.open} – {h?.close}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="mt-3 text-xs text-mist-500">Dernière mise à jour : {formatDateTime(settings.updated_at)}</p>
          </CardBody>
        </Card>
        <Button type="submit" size="lg" className="w-full" loading={mutation.isPending} disabled={!isDirty} icon={<Save className="h-4 w-4" />}>
          Enregistrer et publier
        </Button>
      </aside>
    </form>
  )
}

const OPERATION_LABELS: Record<string, { label: string; kind: 'int' | 'bool'; hint: string }> = {
  'leads.auto_assign_to_property_agent': {
    label: 'Affectation automatique des demandes',
    kind: 'bool',
    hint: 'Une demande portant sur un bien est affectée à l’agent responsable de ce bien.',
  },
  'rate_limit.per_ip_10min': { label: 'Formulaires : envois max. par appareil / 10 min', kind: 'int', hint: 'Protection anti-abus des formulaires publics.' },
  'rate_limit.per_ip_day': { label: 'Formulaires : envois max. par appareil / 24 h', kind: 'int', hint: 'Protection anti-abus des formulaires publics.' },
  'rate_limit.per_contact_day': { label: 'Formulaires : envois max. par contact / 24 h', kind: 'int', hint: 'Par e-mail ou téléphone.' },
}

function OperationsSection() {
  const qc = useQueryClient()
  const settings = useQuery({ queryKey: ['settings', 'app'], queryFn: listAppSettings })
  const mutation = useMutation({
    mutationFn: (v: { key: string; value: boolean | number }) => updateAppSetting(v.key, v.value),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings', 'app'] })
      toast.success('Réglage enregistré.')
    },
    onError: (e) => toast.error('Réglage non enregistré', { description: errorMessage(e) }),
  })
  if (settings.error) return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
  if (!settings.data) return <LoadingBlock />
  return (
    <Card className="max-w-3xl">
      <CardHeader title="Fonctionnement" description="Réglages internes non publics. Aucun secret n’est stocké ici." />
      <ul className="divide-y divide-mist-100">
        {settings.data.map((s) => (
          <OperationRow key={s.key} setting={s} busy={mutation.isPending} onSave={(value) => mutation.mutate({ key: s.key, value })} />
        ))}
      </ul>
    </Card>
  )
}

function OperationRow({ setting, onSave, busy }: { setting: AppSetting; onSave: (v: boolean | number) => void; busy: boolean }) {
  const meta = OPERATION_LABELS[setting.key]
  const [draft, setDraft] = useState(String(setting.value))
  if (meta?.kind === 'bool' || typeof setting.value === 'boolean') {
    return (
      <li className="px-5 py-4">
        <Switch checked={setting.value === true} disabled={busy} onChange={onSave} label={meta?.label ?? setting.key} description={meta?.hint ?? setting.description} />
      </li>
    )
  }
  const n = Number(draft)
  const valid = Number.isInteger(n) && n >= 1 && n <= 10000
  return (
    <li className="flex flex-wrap items-end gap-3 px-5 py-4">
      <Field className="min-w-0 flex-1" label={meta?.label ?? setting.key} hint={meta?.hint ?? setting.description ?? undefined} error={valid ? undefined : 'Entier entre 1 et 10 000.'}>
        <Input inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value)} className="max-w-32" />
      </Field>
      <Button variant="secondary" size="sm" disabled={!valid || draft === String(setting.value) || busy} onClick={() => onSave(n)}>
        Enregistrer
      </Button>
    </li>
  )
}
