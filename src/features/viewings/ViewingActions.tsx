import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CalendarCheck, CalendarClock, CheckCheck, UserX, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/Confirm'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Textarea } from '@/components/ui/Form'
import { Callout } from '@/components/ui/States'
import { updateViewing, type ViewingPatch } from '@/features/leads/api'
import { dakarLocalToIso, isoToDakarLocal, useInvalidateLeads } from '@/features/leads/hooks'
import { errorMessage } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import type { TimeSlot, ViewingRequest } from '@/types'

const SLOT_HOUR: Record<TimeSlot, string> = { morning: '10:00', afternoon: '15:00', evening: '18:00', any: '10:00' }

type Mode = 'confirm' | 'reschedule' | 'complete' | 'cancel'

/**
 * Actions sur une demande de visite. Le statut « confirmée » n'est affiché
 * qu'après enregistrement effectif par la base (ligne relue après écriture).
 */
export function ViewingActions({
  viewing,
  leadId,
  canEdit,
  compact = false,
}: {
  viewing: Pick<ViewingRequest, 'id' | 'status' | 'scheduled_at' | 'preferred_date' | 'preferred_time_slot'>
  leadId: string | null
  canEdit: boolean
  compact?: boolean
}) {
  const confirm = useConfirm()
  const invalidate = useInvalidateLeads()
  const [mode, setMode] = useState<Mode | null>(null)
  const [when, setWhen] = useState('')
  const [text, setText] = useState('')

  const mutation = useMutation({
    mutationFn: (patch: ViewingPatch) => updateViewing(viewing.id, patch),
    onSuccess: (row) => {
      invalidate(leadId)
      const messages: Record<string, string> = {
        confirmed: `Visite confirmée pour le ${formatDateTime(row.scheduled_at)}.`,
        completed: 'Visite marquée comme réalisée.',
        cancelled: 'Visite annulée.',
        no_show: 'Absence enregistrée.',
      }
      toast.success(messages[row.status] ?? 'Visite mise à jour.')
      setMode(null)
    },
    onError: (e) => toast.error('Visite non mise à jour', { description: errorMessage(e) }),
  })

  if (!canEdit || !['requested', 'confirmed'].includes(viewing.status)) return null

  const open = (m: Mode) => {
    mutation.reset()
    setText('')
    if (m === 'confirm' || m === 'reschedule') {
      setWhen(
        viewing.scheduled_at
          ? isoToDakarLocal(viewing.scheduled_at)
          : viewing.preferred_date
            ? `${viewing.preferred_date}T${SLOT_HOUR[viewing.preferred_time_slot]}`
            : '',
      )
    }
    setMode(m)
  }

  const submit = () => {
    if (mode === 'confirm' || mode === 'reschedule') {
      const iso = dakarLocalToIso(when)
      if (!iso) return
      mutation.mutate({ status: 'confirmed', scheduled_at: iso })
    } else if (mode === 'complete') {
      mutation.mutate({ status: 'completed', outcome_notes: text.trim() || null })
    } else if (mode === 'cancel') {
      mutation.mutate({ status: 'cancelled', cancellation_reason: text.trim() || null })
    }
  }

  const noShow = async () => {
    if (await confirm({ title: 'Signaler une absence ?', description: 'Le prospect ne s’est pas présenté à la visite.', confirmLabel: 'Confirmer l’absence', tone: 'danger' })) {
      mutation.mutate({ status: 'no_show' })
    }
  }

  const size = compact ? 'sm' : 'sm'
  const titles: Record<Mode, string> = {
    confirm: 'Confirmer la visite',
    reschedule: 'Reprogrammer la visite',
    complete: 'Visite réalisée',
    cancel: 'Annuler la visite',
  }
  const needsDate = mode === 'confirm' || mode === 'reschedule'

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {viewing.status === 'requested' && (
          <Button size={size} onClick={() => open('confirm')} icon={<CalendarCheck className="h-4 w-4" />}>
            Confirmer
          </Button>
        )}
        {viewing.status === 'confirmed' && (
          <>
            <Button size={size} onClick={() => open('complete')} icon={<CheckCheck className="h-4 w-4" />}>
              Réalisée
            </Button>
            <Button size={size} variant="secondary" onClick={() => open('reschedule')} icon={<CalendarClock className="h-4 w-4" />}>
              Reprogrammer
            </Button>
            <Button size={size} variant="secondary" onClick={() => void noShow()} icon={<UserX className="h-4 w-4" />}>
              Absent
            </Button>
          </>
        )}
        <Button size={size} variant="ghost" onClick={() => open('cancel')} icon={<XCircle className="h-4 w-4" />}>
          Annuler
        </Button>
      </div>

      <Dialog
        open={mode !== null}
        onClose={() => setMode(null)}
        dismissible={!mutation.isPending}
        size="sm"
        title={mode ? titles[mode] : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMode(null)} disabled={mutation.isPending}>
              Fermer
            </Button>
            <Button
              variant={mode === 'cancel' ? 'danger' : 'primary'}
              onClick={submit}
              loading={mutation.isPending}
              disabled={needsDate && !dakarLocalToIso(when)}
            >
              {mode === 'cancel' ? 'Annuler la visite' : 'Enregistrer'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {mutation.error && <Callout tone="danger">{errorMessage(mutation.error)}</Callout>}
          {needsDate && (
            <Field label="Date et heure du rendez-vous" required hint="Heure de Dakar. Le prospect n’est pas notifié automatiquement : prévenez-le par téléphone ou WhatsApp.">
              <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </Field>
          )}
          {mode === 'complete' && (
            <Field label="Compte rendu (interne)" hint="Ressenti du prospect, suites à donner…">
              <Textarea rows={4} maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
          )}
          {mode === 'cancel' && (
            <Field label="Motif d’annulation">
              <Input maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
          )}
        </div>
      </Dialog>
    </>
  )
}
