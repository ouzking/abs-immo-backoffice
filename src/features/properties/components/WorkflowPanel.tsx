import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Archive, ArchiveRestore, Check, CircleAlert, EyeOff, Globe2, Send, Star, Trash2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { useConfirm } from '@/components/ui/Confirm'
import { Field, Select, Switch } from '@/components/ui/Form'
import { Callout } from '@/components/ui/States'
import { useAccess, useAuth } from '@/features/auth/AuthProvider'
import { cn } from '@/lib/cn'
import { toAppError } from '@/lib/errors'
import { COMMERCIAL_STATUSES, labelOf, optionsOf } from '@/lib/labels'
import { BUSINESS_RULE_HINTS, type CommercialStatus, type PropertyMedia, type PublicationStatus } from '@/types'
import { deleteProperty, setCommercialStatus, setFeatured, setPublicationStatus, type PropertyDetail } from '../api'
import { useInvalidateProperty } from '../hooks'
import { PublicationBadge } from './PropertyBits'

function publishErrorMessage(e: unknown): string {
  const err = toAppError(e)
  if (err.hint === BUSINESS_RULE_HINTS.PUBLISH_REQUIRES_COVER) return 'Ajoutez au moins une photo principale avant de publier.'
  if (err.hint === BUSINESS_RULE_HINTS.PUBLISH_REQUIRES_SHORT_DESCRIPTION) return 'La description courte doit contenir au moins 20 caractères.'
  return err.message
}

/** Actions de workflow : chaque bouton n'est proposé que si la base l'autoriserait. */
export function WorkflowPanel({ property, media }: { property: PropertyDetail; media: PropertyMedia[] | undefined }) {
  const { can } = useAuth()
  const access = useAccess()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const invalidate = useInvalidateProperty()
  const [suggestUnpublish, setSuggestUnpublish] = useState(false)

  const canPublish = can('properties.publish')
  const canEdit =
    (can('properties.update_all') || (can('properties.update_own') && property.agent_id === access.user_id)) &&
    (property.publication_status !== 'archived' || canPublish)
  const status = property.publication_status

  const hasCover = !!media?.some((m) => m.is_cover)
  const shortOk = (property.short_description?.trim().length ?? 0) >= 20
  const ready = hasCover && shortOk

  const changeStatus = useMutation({
    mutationFn: (next: PublicationStatus) => setPublicationStatus(property.id, next),
    onSuccess: (p) => {
      invalidate(property.id)
      const messages: Partial<Record<PublicationStatus, string>> = {
        published: 'Annonce publiée sur le site.',
        unpublished: 'Annonce retirée du site.',
        archived: 'Annonce archivée.',
        draft: 'Annonce repassée en brouillon.',
        pending_review: 'Annonce soumise à validation.',
      }
      toast.success(messages[p.publication_status] ?? 'Statut mis à jour.')
    },
    onError: (e) => toast.error('Changement de statut refusé', { description: publishErrorMessage(e) }),
  })

  const changeCommercial = useMutation({
    mutationFn: (next: CommercialStatus) => setCommercialStatus(property.id, next),
    onSuccess: (p) => {
      invalidate(property.id)
      toast.success(`Statut commercial : ${labelOf(COMMERCIAL_STATUSES, p.commercial_status)}.`)
      if ((p.commercial_status === 'sold' || p.commercial_status === 'rented') && p.publication_status === 'published' && canPublish) {
        setSuggestUnpublish(true)
      }
    },
    onError: (e) => toast.error('Statut commercial non modifié', { description: toAppError(e).message }),
  })

  const changeFeatured = useMutation({
    mutationFn: (v: boolean) => setFeatured(property.id, v),
    onSuccess: (p) => {
      invalidate(property.id)
      toast.success(p.is_featured ? 'Annonce mise en avant.' : 'Mise en avant retirée.')
    },
    onError: (e) => toast.error('Mise en avant impossible', { description: toAppError(e).message }),
  })

  const remove = useMutation({
    mutationFn: () => deleteProperty(property.id),
    onSuccess: ({ orphanFiles }) => {
      invalidate()
      toast.success('Bien supprimé définitivement.', orphanFiles ? { description: `${orphanFiles} fichier(s) n'ont pas pu être effacés du stockage.` } : undefined)
      navigate('/biens', { replace: true })
    },
    onError: (e) => toast.error('Suppression impossible', { description: toAppError(e).message }),
  })

  const ask = async (next: PublicationStatus) => {
    const texts: Partial<Record<PublicationStatus, { title: string; description: string; label: string; danger?: boolean }>> = {
      published: {
        title: 'Publier cette annonce ?',
        description: 'Elle sera immédiatement visible sur le site public, avec ses photos.',
        label: 'Publier',
      },
      unpublished: {
        title: 'Retirer l’annonce du site ?',
        description: 'Elle ne sera plus visible publiquement. Vous pourrez la republier plus tard.',
        label: 'Retirer du site',
        danger: true,
      },
      archived: {
        title: 'Archiver ce bien ?',
        description:
          'Le bien quitte le site et les statistiques du catalogue ; sa mise en avant est retirée. Seul un responsable pourra le modifier ou le restaurer.',
        label: 'Archiver',
        danger: true,
      },
      draft: { title: 'Repasser en brouillon ?', description: 'L’annonce ne sera pas visible sur le site.', label: 'Repasser en brouillon' },
      pending_review: {
        title: 'Soumettre à validation ?',
        description: 'Un responsable commercial pourra relire et publier l’annonce.',
        label: 'Soumettre',
      },
    }
    const t = texts[next]!
    if (await confirm({ title: t.title, description: t.description, confirmLabel: t.label, tone: t.danger ? 'danger' : 'primary' })) {
      changeStatus.mutate(next)
    }
  }

  const askCommercial = async (next: CommercialStatus) => {
    if (next === property.commercial_status) return
    const closing = next === 'sold' || next === 'rented'
    const ok = await confirm({
      title: `Passer le bien en « ${labelOf(COMMERCIAL_STATUSES, next)} » ?`,
      description: closing
        ? 'Le bien ne sera plus présenté comme disponible : le site affichera ce statut et n’acceptera plus de demande de visite.'
        : 'Le statut affiché sur le site sera mis à jour immédiatement.',
      confirmLabel: 'Confirmer',
      tone: closing ? 'danger' : 'primary',
    })
    if (ok) changeCommercial.mutate(next)
  }

  const askDelete = async () => {
    const ok = await confirm({
      title: 'Supprimer définitivement ce bien ?',
      description:
        'La fiche, ses photos, équipements, caractéristiques et documents seront effacés. Les demandes liées sont conservées sans référence au bien. Cette action est irréversible : préférez l’archivage.',
      confirmLabel: 'Supprimer définitivement',
      tone: 'danger',
      requireText: property.reference,
    })
    if (ok) remove.mutate()
  }

  const busy = changeStatus.isPending || changeCommercial.isPending || changeFeatured.isPending || remove.isPending

  return (
    <Card>
      <CardHeader title="Workflow" description="Publication et statut commercial sont indépendants." />
      <CardBody className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-mist-700">Publication</span>
          <PublicationBadge status={status} />
        </div>

        {status !== 'published' && status !== 'archived' && (
          <ul className="space-y-1.5 rounded-lg bg-mist-50 p-3 text-xs" aria-label="Conditions de publication">
            {[
              { ok: hasCover, label: 'Une photo principale' },
              { ok: shortOk, label: 'Description courte ≥ 20 caractères' },
            ].map((c) => (
              <li key={c.label} className={cn('flex items-center gap-2', c.ok ? 'text-success-700' : 'text-warning-700')}>
                {c.ok ? <Check className="h-3.5 w-3.5" aria-hidden /> : <CircleAlert className="h-3.5 w-3.5" aria-hidden />}
                {c.label}
                <span className="sr-only">{c.ok ? ' : rempli' : ' : manquant'}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2">
          {canPublish && status !== 'published' && status !== 'archived' && (
            <Button onClick={() => void ask('published')} disabled={busy || !ready} loading={changeStatus.isPending && changeStatus.variables === 'published'} icon={<Globe2 className="h-4 w-4" />}>
              Publier sur le site
            </Button>
          )}
          {canPublish && status === 'published' && (
            <Button variant="danger-outline" onClick={() => void ask('unpublished')} disabled={busy} icon={<EyeOff className="h-4 w-4" />}>
              Retirer du site
            </Button>
          )}
          {canEdit && !canPublish && status === 'draft' && (
            <Button onClick={() => void ask('pending_review')} disabled={busy} icon={<Send className="h-4 w-4" />}>
              Soumettre à validation
            </Button>
          )}
          {canEdit && status === 'pending_review' && (
            <Button variant="secondary" onClick={() => void ask('draft')} disabled={busy} icon={<Undo2 className="h-4 w-4" />}>
              Repasser en brouillon
            </Button>
          )}
          {canPublish && status !== 'archived' && (
            <Button variant="secondary" onClick={() => void ask('archived')} disabled={busy} icon={<Archive className="h-4 w-4" />}>
              Archiver
            </Button>
          )}
          {canPublish && status === 'archived' && (
            <Button variant="secondary" onClick={() => void ask('draft')} disabled={busy} icon={<ArchiveRestore className="h-4 w-4" />}>
              Restaurer en brouillon
            </Button>
          )}
          {!canPublish && status === 'pending_review' && (
            <p className="text-xs text-mist-500">En attente de relecture par un responsable commercial.</p>
          )}
        </div>

        <div className="border-t border-mist-100 pt-5">
          <Field label="Statut commercial">
            <Select
              value={property.commercial_status}
              disabled={!canEdit || busy}
              onChange={(e) => void askCommercial(e.target.value as CommercialStatus)}
              options={optionsOf(COMMERCIAL_STATUSES).filter(
                (o) => !(o.value === 'sold' && property.transaction_type !== 'sale') && !(o.value === 'rented' && property.transaction_type !== 'rent'),
              )}
            />
          </Field>
          {suggestUnpublish && property.publication_status === 'published' && (
            <Callout
              tone="info"
              className="mt-3"
              action={
                <Button size="sm" variant="secondary" onClick={() => void ask('unpublished')}>
                  Retirer
                </Button>
              }
            >
              L’annonce reste visible avec le statut « {labelOf(COMMERCIAL_STATUSES, property.commercial_status)} ». Souhaitez-vous la retirer du site ?
            </Callout>
          )}
        </div>

        {canPublish && status !== 'archived' && (
          <div className="border-t border-mist-100 pt-5">
            <Switch
              checked={property.is_featured}
              disabled={busy}
              onChange={(v) => changeFeatured.mutate(v)}
              label={
                <span className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-brand-red-600" aria-hidden /> Mise en avant
                </span>
              }
              description="Affichée dans la sélection « À la une » du site lorsqu’elle est publiée."
            />
          </div>
        )}

        {can('properties.delete') && (
          <div className="border-t border-mist-100 pt-5">
            <Button variant="danger-outline" size="sm" className="w-full" onClick={() => void askDelete()} disabled={busy} loading={remove.isPending} icon={<Trash2 className="h-4 w-4" />}>
              Supprimer définitivement
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
