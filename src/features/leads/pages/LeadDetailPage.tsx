import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Mail, MessageCircle, Pencil, Phone, Trash2, UserCheck } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, DetailList } from '@/components/ui/Card'
import { useConfirm } from '@/components/ui/Confirm'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Form'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { useAccess, useAuth } from '@/features/auth/AuthProvider'
import { usePropertyTypeLabels } from '@/features/reference/hooks'
import { ViewingActions } from '@/features/viewings/ViewingActions'
import { errorMessage } from '@/lib/errors'
import { formatDate, formatDateTime, formatPhone, formatPrice, formatRelative } from '@/lib/format'
import {
  CONTACT_METHODS,
  INQUIRY_STATUSES,
  INQUIRY_TYPES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  TIME_SLOTS,
  TRANSACTION_TYPES,
  VIEWING_STATUSES,
  labelOf,
  optionsOf,
  toneOf,
} from '@/lib/labels'
import type { InquiryStatus, LeadStatus } from '@/types'
import { deleteLead, getLead, listLeadActivities, listLeadInquiries, listLeadViewings, updateInquiry, updateLead } from '../api'
import { ActivityComposer, ActivityTimeline } from '../components/Activity'
import { AssignDialog } from '../components/AssignDialog'
import { LeadFormDialog } from '../components/LeadFormDialog'
import { leadKeys, useInvalidateLeads } from '../hooks'

export function LeadDetailPage() {
  const { id = '' } = useParams()
  const { can } = useAuth()
  const access = useAccess()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const invalidate = useInvalidateLeads()
  const typeLabels = usePropertyTypeLabels()
  const [assignOpen, setAssignOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [lostOpen, setLostOpen] = useState(false)
  const [lostReason, setLostReason] = useState('')

  const lead = useQuery({ queryKey: leadKeys.detail(id), queryFn: () => getLead(id) })
  const activities = useQuery({ queryKey: leadKeys.activities(id), queryFn: () => listLeadActivities(id) })
  const inquiries = useQuery({ queryKey: leadKeys.inquiries(id), queryFn: () => listLeadInquiries(id) })
  const viewings = useQuery({ queryKey: leadKeys.viewings(id), queryFn: () => listLeadViewings(id) })

  const statusMutation = useMutation({
    mutationFn: (v: { status: LeadStatus; lost_reason?: string | null }) => updateLead(id, v),
    onSuccess: (row) => {
      invalidate(id)
      setLostOpen(false)
      toast.success(`Statut : ${labelOf(LEAD_STATUSES, row.status)}.`)
    },
    onError: (e) => toast.error('Statut non modifié', { description: errorMessage(e) }),
  })
  const inquiryMutation = useMutation({
    mutationFn: (v: { id: string; status: InquiryStatus }) => updateInquiry(v.id, { status: v.status }),
    onSuccess: () => {
      invalidate(id)
      toast.success('Demande mise à jour.')
    },
    onError: (e) => toast.error('Demande non modifiée', { description: errorMessage(e) }),
  })
  const removeMutation = useMutation({
    mutationFn: () => deleteLead(id),
    onSuccess: () => {
      invalidate()
      toast.success('Prospect et historique supprimés.')
      navigate('/prospects', { replace: true })
    },
    onError: (e) => toast.error('Suppression impossible', { description: errorMessage(e) }),
  })

  if (lead.error) return <ErrorState error={lead.error} onRetry={() => void lead.refetch()} />
  if (lead.isLoading || !lead.data) return <LoadingBlock label="Chargement du prospect…" />
  const l = lead.data

  const canUpdate = can('leads.update_all') || (can('leads.access_assigned') && l.assigned_agent_id === access.user_id)
  const canRequests = can('leads.update_all') || can('leads.access_assigned')

  const onStatus = (status: LeadStatus) => {
    if (status === l.status) return
    if (status === 'lost') {
      setLostReason(l.lost_reason ?? '')
      setLostOpen(true)
      return
    }
    statusMutation.mutate({ status })
  }

  const askDelete = async () => {
    const ok = await confirm({
      title: 'Supprimer ce prospect ?',
      description:
        'Droit à l’effacement : le prospect, ses demandes, ses visites et tout son historique seront supprimés définitivement. Cette action est irréversible.',
      confirmLabel: 'Supprimer définitivement',
      tone: 'danger',
      requireText: 'SUPPRIMER',
    })
    if (ok) removeMutation.mutate()
  }

  const phoneDigits = (l.whatsapp_phone ?? l.phone ?? '').replace(/\D/g, '')

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Prospects', to: '/prospects' }, { label: l.full_name }]}
        title={l.full_name}
        meta={
          <>
            <Badge tone={toneOf(LEAD_STATUSES, l.status)}>{labelOf(LEAD_STATUSES, l.status)}</Badge>
            <span className="text-sm text-mist-500">
              {labelOf(LEAD_SOURCES, l.source)} · créé le {formatDate(l.created_at)} · dernière activité {formatRelative(l.last_activity_at)}
            </span>
          </>
        }
        actions={
          <>
            {can('leads.assign') && (
              <Button variant="secondary" icon={<UserCheck className="h-4 w-4" />} onClick={() => setAssignOpen(true)}>
                Affecter
              </Button>
            )}
            {canUpdate && (
              <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditOpen(true)}>
                Modifier
              </Button>
            )}
            {can('leads.delete') && (
              <Button variant="danger-outline" icon={<Trash2 className="h-4 w-4" />} onClick={() => void askDelete()} loading={removeMutation.isPending}>
                Supprimer
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <Card>
            <CardHeader title="Suivi commercial" />
            <CardBody className="space-y-4">
              <Field label="Étape">
                <Select
                  value={l.status}
                  disabled={!canUpdate || statusMutation.isPending}
                  onChange={(e) => onStatus(e.target.value as LeadStatus)}
                  options={optionsOf(LEAD_STATUSES)}
                />
              </Field>
              {l.status === 'lost' && l.lost_reason && <p className="text-sm text-mist-600">Motif : {l.lost_reason}</p>}
              <DetailList
                className="sm:grid-cols-1"
                items={[{ label: 'Agent affecté', value: l.agent?.display_name ?? <em className="text-mist-400">Non affecté</em> }]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Coordonnées" />
            <CardBody className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {l.phone && (
                  <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-mist-200 px-3 py-1.5 text-sm font-semibold hover:bg-mist-50">
                    <Phone className="h-4 w-4 text-navy-600" /> Appeler
                  </a>
                )}
                {phoneDigits && (
                  <a
                    href={`https://wa.me/${phoneDigits}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-mist-200 px-3 py-1.5 text-sm font-semibold hover:bg-mist-50"
                  >
                    <MessageCircle className="h-4 w-4 text-success-600" /> WhatsApp
                  </a>
                )}
                {l.email && (
                  <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1.5 rounded-lg border border-mist-200 px-3 py-1.5 text-sm font-semibold hover:bg-mist-50">
                    <Mail className="h-4 w-4 text-navy-600" /> E-mail
                  </a>
                )}
              </div>
              <DetailList
                className="sm:grid-cols-1"
                items={[
                  { label: 'Téléphone', value: formatPhone(l.phone) },
                  { label: 'WhatsApp', value: formatPhone(l.whatsapp_phone) },
                  { label: 'E-mail', value: l.email ?? '—' },
                  { label: 'Contact préféré', value: l.preferred_contact ? labelOf(CONTACT_METHODS, l.preferred_contact) : '—' },
                  { label: 'Offres commerciales', value: l.consent_marketing ? `Accepté le ${formatDate(l.consent_at)}` : 'Non' },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Projet" />
            <CardBody>
              <DetailList
                className="sm:grid-cols-1"
                items={[
                  {
                    label: 'Recherche',
                    value:
                      [l.desired_transaction && labelOf(TRANSACTION_TYPES, l.desired_transaction), l.desired_property_type && (typeLabels[l.desired_property_type] ?? l.desired_property_type)]
                        .filter(Boolean)
                        .join(' · ') || '—',
                  },
                  {
                    label: 'Budget',
                    value:
                      l.budget_min || l.budget_max
                        ? `${l.budget_min ? formatPrice(l.budget_min) : '…'} → ${l.budget_max ? formatPrice(l.budget_max) : '…'}`
                        : '—',
                  },
                ]}
              />
            </CardBody>
          </Card>
        </aside>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title={`Demandes de renseignement (${inquiries.data?.length ?? 0})`} />
            {inquiries.error ? (
              <ErrorState error={inquiries.error} onRetry={() => void inquiries.refetch()} compact />
            ) : inquiries.isLoading ? (
              <div className="p-5">
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (inquiries.data ?? []).length === 0 ? (
              <p className="px-5 py-4 text-sm text-mist-500">Aucune demande.</p>
            ) : (
              <ul className="divide-y divide-mist-100">
                {inquiries.data!.map((i) => (
                  <li key={i.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {labelOf(INQUIRY_TYPES, i.inquiry_type)}
                        {i.property && (
                          <>
                            {' · '}
                            <Link to={`/biens/${i.property.id}`} className="text-navy-700 hover:underline">
                              {i.property.reference} — {i.property.title}
                            </Link>
                          </>
                        )}
                      </p>
                      <p className="text-xs text-mist-500">
                        {formatDateTime(i.created_at)} · {labelOf(LEAD_SOURCES, i.channel)}
                        {i.agent ? ` · ${i.agent.display_name}` : ''}
                      </p>
                      {i.message && <p className="mt-2 rounded-lg bg-mist-50 px-3 py-2 text-sm whitespace-pre-line">{i.message}</p>}
                    </div>
                    <div className="w-full shrink-0 sm:w-44">
                      <Select
                        aria-label="Statut de la demande"
                        value={i.status}
                        disabled={!canRequests || inquiryMutation.isPending}
                        onChange={(e) => inquiryMutation.mutate({ id: i.id, status: e.target.value as InquiryStatus })}
                        options={optionsOf(INQUIRY_STATUSES)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={`Visites (${viewings.data?.length ?? 0})`} />
            {viewings.error ? (
              <ErrorState error={viewings.error} onRetry={() => void viewings.refetch()} compact />
            ) : viewings.isLoading ? (
              <div className="p-5">
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (viewings.data ?? []).length === 0 ? (
              <p className="px-5 py-4 text-sm text-mist-500">Aucune demande de visite.</p>
            ) : (
              <ul className="divide-y divide-mist-100">
                {viewings.data!.map((v) => (
                  <li key={v.id} className="space-y-2 px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={toneOf(VIEWING_STATUSES, v.status)}>{labelOf(VIEWING_STATUSES, v.status)}</Badge>
                      {v.property && (
                        <Link to={`/biens/${v.property.id}`} className="text-sm font-semibold text-navy-700 hover:underline">
                          {v.property.reference} — {v.property.title}
                        </Link>
                      )}
                    </div>
                    <p className="text-sm text-mist-600">
                      {v.scheduled_at
                        ? `Rendez-vous : ${formatDateTime(v.scheduled_at)}`
                        : `Souhait : ${v.preferred_date ? formatDate(v.preferred_date) : 'date libre'} (${labelOf(TIME_SLOTS, v.preferred_time_slot)})`}
                      {v.agent ? ` · ${v.agent.display_name}` : ''}
                    </p>
                    {v.message && <p className="rounded-lg bg-mist-50 px-3 py-2 text-sm">{v.message}</p>}
                    {v.outcome_notes && <p className="text-sm text-mist-600">Compte rendu : {v.outcome_notes}</p>}
                    {v.cancellation_reason && <p className="text-sm text-mist-600">Motif d’annulation : {v.cancellation_reason}</p>}
                    <ViewingActions viewing={v} leadId={l.id} canEdit={canRequests} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Historique et notes internes" description="Les événements automatiques sont enregistrés par la base ; aucun ne peut être modifié." />
            <CardBody className="space-y-6">
              <ActivityComposer leadId={l.id} />
              {activities.error ? (
                <ErrorState error={activities.error} onRetry={() => void activities.refetch()} compact />
              ) : activities.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <ActivityTimeline items={activities.data ?? []} />
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {assignOpen && <AssignDialog open onClose={() => setAssignOpen(false)} leadId={l.id} leadName={l.full_name} currentAgentId={l.assigned_agent_id} />}
      {editOpen && <LeadFormDialog open onClose={() => setEditOpen(false)} lead={l} />}
      <Dialog
        open={lostOpen}
        onClose={() => setLostOpen(false)}
        size="sm"
        title="Marquer comme non abouti"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLostOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => statusMutation.mutate({ status: 'lost', lost_reason: lostReason.trim() || null })} loading={statusMutation.isPending}>
              Enregistrer
            </Button>
          </>
        }
      >
        <Field label="Motif (facultatif)" hint="Ex. budget insuffisant, a trouvé ailleurs…">
          <Input value={lostReason} maxLength={500} onChange={(e) => setLostReason(e.target.value)} />
        </Field>
      </Dialog>
    </>
  )
}
