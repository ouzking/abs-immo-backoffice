import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Form'
import { Callout } from '@/components/ui/States'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAgentOptions, usePropertyTypes } from '@/features/reference/hooks'
import { errorMessage } from '@/lib/errors'
import { normalizePhone } from '@/lib/format'
import { CONTACT_METHODS, LEAD_SOURCES, TRANSACTION_TYPES, optionsOf } from '@/lib/labels'
import type { Lead } from '@/types'
import { addLeadActivity, createLead, updateLead, type LeadPatch } from '../api'
import { useInvalidateLeads } from '../hooks'

const phoneField = z
  .string()
  .trim()
  .refine((v) => normalizePhone(v) !== undefined, 'Numéro invalide (ex. 77 123 45 67 ou +33 6 12 34 56 78).')
const budgetField = z.string().trim().refine((v) => v === '' || /^\d[\d\s]*$/.test(v), 'Montant en FCFA, chiffres uniquement.')

const schema = z
  .object({
    full_name: z.string().trim().min(2, 'Au moins 2 caractères.').max(120),
    phone: phoneField,
    whatsapp_phone: phoneField,
    email: z.string().trim().max(254).refine((v) => v === '' || z.string().email().safeParse(v).success, 'Adresse e-mail invalide.'),
    preferred_contact: z.enum(['', 'phone', 'whatsapp', 'email']),
    source: z.enum(['website', 'whatsapp', 'phone', 'email', 'walk_in', 'facebook', 'instagram', 'referral', 'partner', 'other']),
    desired_transaction: z.enum(['', 'sale', 'rent']),
    desired_property_type: z.string(),
    budget_min: budgetField,
    budget_max: budgetField,
    consent_marketing: z.boolean(),
    assigned_agent_id: z.string(),
    note: z.string().max(10000),
  })
  .superRefine((v, ctx) => {
    if (!v.email && !v.phone) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Un téléphone ou un e-mail est obligatoire.' })
    const min = v.budget_min ? Number(v.budget_min.replace(/\s/g, '')) : null
    const max = v.budget_max ? Number(v.budget_max.replace(/\s/g, '')) : null
    if (min !== null && max !== null && min > max) ctx.addIssue({ code: 'custom', path: ['budget_max'], message: 'Doit être supérieur au budget minimum.' })
  })
type Values = z.infer<typeof schema>

const num = (v: string) => (v ? Number(v.replace(/\s/g, '')) : null)

/** Création manuelle (leads.create) ou modification des coordonnées et critères d'un prospect. */
export function LeadFormDialog({ open, onClose, lead, onCreated }: { open: boolean; onClose: () => void; lead?: Lead; onCreated?: (id: string) => void }) {
  const { can, access } = useAuth()
  const agents = useAgentOptions()
  const types = usePropertyTypes()
  const invalidate = useInvalidateLeads()
  const canAssign = can('leads.assign')
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: lead?.full_name ?? '',
      phone: lead?.phone ?? '',
      whatsapp_phone: lead?.whatsapp_phone ?? '',
      email: lead?.email ?? '',
      preferred_contact: lead?.preferred_contact ?? '',
      source: lead?.source ?? 'phone',
      desired_transaction: lead?.desired_transaction ?? '',
      desired_property_type: lead?.desired_property_type ?? '',
      budget_min: lead?.budget_min?.toString() ?? '',
      budget_max: lead?.budget_max?.toString() ?? '',
      consent_marketing: lead?.consent_marketing ?? false,
      assigned_agent_id: lead?.assigned_agent_id ?? (access?.is_agent ? access.user_id : ''),
      note: '',
    },
  })

  const mutation = useMutation({
    mutationFn: async (v: Values) => {
      const patch: LeadPatch = {
        full_name: v.full_name,
        phone: normalizePhone(v.phone) ?? null,
        whatsapp_phone: normalizePhone(v.whatsapp_phone) ?? null,
        email: v.email ? v.email.toLowerCase() : null,
        preferred_contact: v.preferred_contact || null,
        source: v.source,
        desired_transaction: v.desired_transaction || null,
        desired_property_type: v.desired_property_type || null,
        budget_min: num(v.budget_min),
        budget_max: num(v.budget_max),
        consent_marketing: v.consent_marketing,
      }
      if (lead) return updateLead(lead.id, patch)
      const created = await createLead({ ...patch, full_name: v.full_name, ...(canAssign ? { assigned_agent_id: v.assigned_agent_id || null } : {}) })
      if (v.note.trim()) await addLeadActivity({ leadId: created.id, type: 'note', content: v.note })
      return created
    },
    onSuccess: (row) => {
      invalidate(row.id)
      toast.success(lead ? 'Prospect mis à jour.' : 'Prospect créé.')
      onClose()
      if (!lead) onCreated?.(row.id)
    },
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!mutation.isPending}
      size="lg"
      title={lead ? 'Modifier le prospect' : 'Nouveau prospect'}
      description={lead ? undefined : 'Saisie d’un contact reçu par téléphone, en agence, sur les réseaux sociaux…'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Annuler
          </Button>
          <Button onClick={handleSubmit((v) => mutation.mutate(v))} loading={mutation.isPending}>
            {lead ? 'Enregistrer' : 'Créer le prospect'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="space-y-4">
        {mutation.error && <Callout tone="danger">{errorMessage(mutation.error)}</Callout>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field className="sm:col-span-2" label="Nom complet" required error={errors.full_name?.message}>
            <Input autoComplete="off" {...register('full_name')} />
          </Field>
          <Field label="Téléphone" error={errors.phone?.message} hint="Format libre : 77 123 45 67, +221…">
            <Input type="tel" inputMode="tel" {...register('phone')} />
          </Field>
          <Field label="WhatsApp" error={errors.whatsapp_phone?.message}>
            <Input type="tel" inputMode="tel" {...register('whatsapp_phone')} />
          </Field>
          <Field label="E-mail" error={errors.email?.message}>
            <Input type="email" {...register('email')} />
          </Field>
          <Field label="Contact préféré">
            <Select placeholder="Non précisé" options={optionsOf(CONTACT_METHODS)} {...register('preferred_contact')} />
          </Field>
          <Field label="Canal d’origine">
            <Select options={optionsOf(LEAD_SOURCES)} {...register('source')} />
          </Field>
          {!lead && canAssign && (
            <Field label="Agent affecté">
              <Select
                placeholder="Non affecté"
                options={(agents.data ?? []).filter((a) => a.is_active).map((a) => ({ value: a.profile_id, label: a.display_name }))}
                {...register('assigned_agent_id')}
              />
            </Field>
          )}
        </div>
        <fieldset className="grid gap-4 border-t border-mist-100 pt-4 sm:grid-cols-2">
          <legend className="mb-3 text-sm font-bold">Projet du prospect</legend>
          <Field label="Recherche">
            <Select placeholder="Non précisé" options={optionsOf(TRANSACTION_TYPES)} {...register('desired_transaction')} />
          </Field>
          <Field label="Type de bien">
            <Select placeholder="Non précisé" options={(types.data ?? []).map((t) => ({ value: t.code, label: t.label }))} {...register('desired_property_type')} />
          </Field>
          <Field label="Budget minimum" error={errors.budget_min?.message}>
            <Input inputMode="numeric" trailing="FCFA" {...register('budget_min')} />
          </Field>
          <Field label="Budget maximum" error={errors.budget_max?.message}>
            <Input inputMode="numeric" trailing="FCFA" {...register('budget_max')} />
          </Field>
          <Checkbox className="sm:col-span-2" label="Accepte de recevoir des offres" description="Consentement marketing, horodaté automatiquement." {...register('consent_marketing')} />
        </fieldset>
        {!lead && (
          <Field label="Note interne initiale" hint="Facultatif. Visible uniquement par l’équipe autorisée.">
            <Textarea rows={3} {...register('note')} />
          </Field>
        )}
      </form>
    </Dialog>
  )
}
