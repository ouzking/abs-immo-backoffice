import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Camera, Save } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Checkbox, Field, Input, Textarea } from '@/components/ui/Form'
import { Avatar } from '@/components/ui/Misc'
import { Callout } from '@/components/ui/States'
import { errorMessage } from '@/lib/errors'
import { normalizePhone } from '@/lib/format'
import { publicUrl } from '@/lib/supabase/storage'
import type { Agent } from '@/types'
import { updateAgent, uploadAgentPhoto } from '../api'

const phone = z.string().trim().refine((v) => normalizePhone(v) !== undefined, 'Numéro invalide (ex. 77 123 45 67).')
const schema = z.object({
  display_name: z.string().trim().min(2, 'Au moins 2 caractères.').max(120),
  job_title: z.string().trim().max(120),
  bio: z.string().trim().max(2000),
  public_phone: phone,
  whatsapp_phone: phone,
  public_email: z.string().trim().refine((v) => v === '' || z.string().email().safeParse(v).success, 'E-mail invalide.'),
  languages: z.string().trim().max(200),
  license_number: z.string().trim().max(60),
  slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Minuscules, chiffres et tirets uniquement.'),
  is_public: z.boolean(),
  is_active: z.boolean(),
})
type Values = z.infer<typeof schema>

/**
 * Fiche commerciale d'un agent. Les informations publiques apparaissent sur le
 * site si la fiche est publique ; statut, visibilité et slug exigent agents.manage.
 */
export function AgentForm({ agent, canManage, canEdit }: { agent: Agent; canManage: boolean; canEdit: boolean }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      display_name: agent.display_name,
      job_title: agent.job_title ?? '',
      bio: agent.bio ?? '',
      public_phone: agent.public_phone ?? '',
      whatsapp_phone: agent.whatsapp_phone ?? '',
      public_email: agent.public_email ?? '',
      languages: agent.languages.join(', '),
      license_number: agent.license_number ?? '',
      slug: agent.slug,
      is_public: agent.is_public,
      is_active: agent.is_active,
    },
  })

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['agents'] })
    void qc.invalidateQueries({ queryKey: ['ref', 'agents'] })
  }

  const mutation = useMutation({
    mutationFn: (v: Values) =>
      updateAgent(
        agent.profile_id,
        {
          display_name: v.display_name,
          job_title: v.job_title || null,
          bio: v.bio || null,
          public_phone: normalizePhone(v.public_phone) ?? null,
          whatsapp_phone: normalizePhone(v.whatsapp_phone) ?? null,
          public_email: v.public_email ? v.public_email.toLowerCase() : null,
          languages: v.languages
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
          license_number: v.license_number || null,
          ...(canManage ? { slug: v.slug, is_public: v.is_public, is_active: v.is_active } : {}),
        },
        canManage,
      ),
    onSuccess: (row, v) => {
      refresh()
      reset({ ...v, languages: row.languages.join(', ') })
      toast.success('Fiche agent enregistrée.')
    },
  })

  const onPhoto = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      await uploadAgentPhoto(agent, file, canManage)
      refresh()
      toast.success('Photo mise à jour.')
    } catch (e) {
      toast.error('Photo non enregistrée', { description: errorMessage(e) })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="space-y-5">
      {mutation.error && <Callout tone="danger">{errorMessage(mutation.error)}</Callout>}
      <div className="flex items-center gap-4">
        <Avatar name={agent.display_name} src={publicUrl('agent-photos', agent.photo_path)} size="lg" />
        {canEdit && (
          <>
            <Button variant="secondary" size="sm" loading={uploading} icon={<Camera className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
              Changer la photo
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-label="Photo de l’agent"
              onChange={(e) => void onPhoto(e.target.files?.[0])}
            />
            <span className="text-xs text-mist-500">Publique · JPEG, PNG, WebP · 3 Mo max.</span>
          </>
        )}
      </div>
      <fieldset disabled={!canEdit || mutation.isPending} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom affiché" required error={errors.display_name?.message}>
          <Input {...register('display_name')} />
        </Field>
        <Field label="Fonction" error={errors.job_title?.message}>
          <Input placeholder="Conseiller immobilier" {...register('job_title')} />
        </Field>
        <Field label="Téléphone public" error={errors.public_phone?.message}>
          <Input type="tel" {...register('public_phone')} />
        </Field>
        <Field label="WhatsApp" error={errors.whatsapp_phone?.message}>
          <Input type="tel" {...register('whatsapp_phone')} />
        </Field>
        <Field label="E-mail public" error={errors.public_email?.message}>
          <Input type="email" {...register('public_email')} />
        </Field>
        <Field label="Langues" hint="Codes séparés par des virgules (fr, en, wo).">
          <Input {...register('languages')} />
        </Field>
        <Field label="N° de carte professionnelle" error={errors.license_number?.message}>
          <Input {...register('license_number')} />
        </Field>
        <Field label="Identifiant web (slug)" error={errors.slug?.message} hint={canManage ? undefined : 'Modifiable par un administrateur.'}>
          <Input className="font-mono text-[13px]" readOnly={!canManage} {...register('slug')} />
        </Field>
        <Field className="sm:col-span-2" label="Présentation" error={errors.bio?.message}>
          <Textarea rows={4} maxLength={2000} {...register('bio')} />
        </Field>
        {canManage && (
          <div className="space-y-3 sm:col-span-2">
            <Checkbox label="Fiche publique" description="Affichée sur le site (coordonnées publiques ci-dessus)." {...register('is_public')} />
            <Checkbox label="Agent actif" description="Un agent inactif ne peut plus être responsable de biens ni recevoir de prospects." {...register('is_active')} />
          </div>
        )}
      </fieldset>
      {canEdit && (
        <div className="flex justify-end">
          <Button type="submit" loading={mutation.isPending} disabled={!isDirty} icon={<Save className="h-4 w-4" />}>
            Enregistrer
          </Button>
        </div>
      )}
    </form>
  )
}
