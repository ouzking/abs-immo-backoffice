import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Checkbox, Field, Select } from '@/components/ui/Form'
import { Callout } from '@/components/ui/States'
import { useAgentOptions } from '@/features/reference/hooks'
import { errorMessage } from '@/lib/errors'
import { assignLead } from '../api'
import { useInvalidateLeads } from '../hooks'

/** Affectation d'un prospect (RPC assign_lead, permission leads.assign). */
export function AssignDialog({
  open,
  onClose,
  leadId,
  leadName,
  currentAgentId,
}: {
  open: boolean
  onClose: () => void
  leadId: string
  leadName: string
  currentAgentId: string | null
}) {
  const agents = useAgentOptions()
  const invalidate = useInvalidateLeads()
  const [agentId, setAgentId] = useState(currentAgentId ?? '')
  const [includeOpen, setIncludeOpen] = useState(true)
  const mutation = useMutation({
    mutationFn: () => assignLead(leadId, agentId || null, includeOpen),
    onSuccess: () => {
      invalidate(leadId)
      toast.success(agentId ? 'Prospect affecté.' : 'Affectation retirée.')
      onClose()
    },
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!mutation.isPending}
      title="Affecter le prospect"
      description={leadName}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Annuler
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={(agentId || null) === currentAgentId && !includeOpen}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <Callout tone="danger">{errorMessage(mutation.error)}</Callout>}
        <Field label="Agent" hint="Seuls les agents actifs peuvent recevoir des prospects.">
          <Select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="Aucun agent (non affecté)"
            options={(agents.data ?? []).filter((a) => a.is_active).map((a) => ({ value: a.profile_id, label: a.display_name }))}
          />
        </Field>
        <Checkbox
          checked={includeOpen}
          onChange={(e) => setIncludeOpen(e.target.checked)}
          label="Réaffecter aussi les demandes et visites en cours"
          description="Demandes nouvelles ou en cours, visites demandées ou confirmées."
        />
      </div>
    </Dialog>
  )
}
