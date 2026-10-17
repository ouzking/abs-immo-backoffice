import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowRightLeft,
  CalendarPlus,
  Cog,
  Handshake,
  Inbox,
  Lock,
  Mail,
  MapPinned,
  MessageCircle,

  Phone,
  Smartphone,
  StickyNote,
  UserCheck,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select, Textarea } from '@/components/ui/Form'
import { useAgentNames } from '@/features/reference/hooks'
import { cn } from '@/lib/cn'
import { errorMessage } from '@/lib/errors'
import { formatDate, formatDateTime, formatRelative } from '@/lib/format'
import { ACTIVITY_TYPES, INQUIRY_STATUSES, INQUIRY_TYPES, LEAD_STATUSES, TIME_SLOTS, VIEWING_STATUSES, labelOf } from '@/lib/labels'
import type { LeadActivityType } from '@/types'
import { addLeadActivity, type ActivityRow, type ManualActivityType } from '../api'
import { useInvalidateLeads } from '../hooks'

const ICONS: Record<LeadActivityType, LucideIcon> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  sms: Smartphone,
  meeting: Handshake,
  visit: MapPinned,
  status_change: ArrowRightLeft,
  assignment: UserCheck,
  inquiry_received: Inbox,
  viewing_requested: CalendarPlus,
  system: Cog,
}

const MANUAL: ManualActivityType[] = ['note', 'call', 'whatsapp', 'email', 'sms', 'meeting', 'visit']

/** Saisie d'une note interne ou d'une action de suivi (types manuels uniquement). */
export function ActivityComposer({ leadId }: { leadId: string }) {
  const invalidate = useInvalidateLeads()
  const [type, setType] = useState<ManualActivityType>('note')
  const [content, setContent] = useState('')
  const mutation = useMutation({
    mutationFn: () => addLeadActivity({ leadId, type, content }),
    onSuccess: () => {
      setContent('')
      invalidate(leadId)
      toast.success(type === 'note' ? 'Note interne ajoutée.' : 'Action de suivi enregistrée.')
    },
    onError: (e) => toast.error('Enregistrement impossible', { description: errorMessage(e) }),
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (content.trim()) mutation.mutate()
      }}
      className="rounded-xl border border-mist-200 bg-white p-3 shadow-xs"
    >
      <label htmlFor={`composer-${leadId}`} className="sr-only">
        Contenu du suivi
      </label>
      <Textarea
        id={`composer-${leadId}`}
        rows={3}
        maxLength={10000}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={type === 'note' ? 'Note interne (visible uniquement par l’équipe autorisée)…' : 'Résumé de l’échange, prochaine étape…'}
        className="border-0 shadow-none focus:ring-0"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && content.trim()) mutation.mutate()
        }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-mist-100 pt-2">
        <div className="w-44">
          <Select aria-label="Type de suivi" value={type} onChange={(e) => setType(e.target.value as ManualActivityType)} options={MANUAL.map((t) => ({ value: t, label: labelOf(ACTIVITY_TYPES, t) }))} />
        </div>
        <span className="flex items-center gap-1 text-xs text-mist-500">
          <Lock className="h-3 w-3" aria-hidden /> Privé, non modifiable après enregistrement
        </span>
        <Button type="submit" size="sm" className="ml-auto" loading={mutation.isPending} disabled={!content.trim()}>
          Enregistrer
        </Button>
      </div>
    </form>
  )
}

function statusLabel(entity: unknown, value: unknown): string {
  const v = typeof value === 'string' ? value : ''
  if (entity === 'inquiries') return labelOf(INQUIRY_STATUSES, v)
  if (entity === 'viewing_requests') return labelOf(VIEWING_STATUSES, v)
  return labelOf(LEAD_STATUSES, v)
}

const ENTITY_LABEL: Record<string, string> = { leads: 'du prospect', inquiries: 'de la demande', viewing_requests: 'de la visite' }

/** Historique : saisies manuelles et événements enregistrés par la base (non modifiables). */
export function ActivityTimeline({ items }: { items: ActivityRow[] }) {
  const agentNames = useAgentNames()
  if (items.length === 0) return <p className="py-6 text-center text-sm text-mist-500">Aucun historique pour le moment.</p>

  return (
    <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-mist-200">
      {items.map((a) => {
        const Icon = ICONS[a.activity_type] ?? Cog
        const meta = (a.metadata ?? {}) as Record<string, unknown>
        const manual = (MANUAL as string[]).includes(a.activity_type)
        let summary: string | null = null
        if (a.activity_type === 'status_change') {
          summary = `Statut ${ENTITY_LABEL[String(meta.entity)] ?? ''} : ${statusLabel(meta.entity, meta.from)} → ${statusLabel(meta.entity, meta.to)}`
        } else if (a.activity_type === 'assignment') {
          const to = typeof meta.to === 'string' ? (agentNames[meta.to] ?? 'un agent') : 'personne'
          summary = `${meta.entity === 'leads' ? 'Prospect' : meta.entity === 'inquiries' ? 'Demande' : 'Visite'} affecté(e) à ${to}`
        } else if (a.activity_type === 'inquiry_received') {
          summary = `Demande reçue : ${labelOf(INQUIRY_TYPES, String(meta.inquiry_type ?? 'general'))}`
        } else if (a.activity_type === 'viewing_requested') {
          summary = `Demande de visite${meta.preferred_date ? ` pour le ${formatDate(String(meta.preferred_date))}` : ''}${meta.preferred_time_slot ? ` (${labelOf(TIME_SLOTS, String(meta.preferred_time_slot))})` : ''}`
        } else if (a.activity_type === 'system' && meta.reason === 'duplicate_submission') {
          summary = 'Nouvelle soumission identique (doublon regroupé)'
        }
        return (
          <li key={a.id} className="relative flex gap-3 pl-0">
            <span
              className={cn(
                'relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white',
                manual ? 'bg-navy-700 text-white' : 'bg-mist-100 text-mist-600',
              )}
              aria-hidden
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-semibold text-ink">{labelOf(ACTIVITY_TYPES, a.activity_type)}</span>
                <span className="text-xs text-mist-500" title={formatDateTime(a.created_at)}>
                  {a.actor?.full_name ? `${a.actor.full_name} · ` : manual ? '' : 'Automatique · '}
                  {formatRelative(a.created_at)}
                </span>
              </p>
              {summary && <p className="mt-0.5 text-sm text-mist-700">{summary}</p>}
              {a.content && (
                <div className={cn('mt-1.5 rounded-lg px-3 py-2 text-sm whitespace-pre-line', a.activity_type === 'note' ? 'border border-warning-100 bg-warning-50/60' : 'bg-mist-50')}>
                  {a.content}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

