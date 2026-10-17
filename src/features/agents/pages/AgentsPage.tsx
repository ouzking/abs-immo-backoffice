import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { IdCard, Mail, Phone, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Form'
import { Avatar } from '@/components/ui/Misc'
import { PageHeader } from '@/components/ui/PageHeader'
import { Callout, EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useAuth } from '@/features/auth/AuthProvider'
import { errorMessage } from '@/lib/errors'
import { formatPhone, slugify } from '@/lib/format'
import { publicUrl } from '@/lib/supabase/storage'
import { createAgentProfile, listAgents, listUsers } from '../api'

export function AgentsPage() {
  const { can } = useAuth()
  const [createOpen, setCreateOpen] = useState(false)
  const agents = useQuery({ queryKey: ['agents', 'list'], queryFn: listAgents })

  return (
    <>
      <PageHeader
        title="Agents"
        description="Fiches commerciales des membres de l’équipe pouvant être responsables de biens et de prospects."
        actions={
          can('agents.manage') &&
          can('users.read') && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
              Créer une fiche agent
            </Button>
          )
        }
      />
      {agents.error ? (
        <Card>
          <ErrorState error={agents.error} onRetry={() => void agents.refetch()} />
        </Card>
      ) : agents.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-card" />
          ))}
        </div>
      ) : (agents.data ?? []).length === 0 ? (
        <Card>
          <EmptyState icon={<IdCard className="h-6 w-6" />} title="Aucune fiche agent" description="Créez une fiche pour qu’un collaborateur puisse être responsable de biens." />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {agents.data!.map((a) => (
            <li key={a.profile_id}>
              <Link
                to={`/agents/${a.profile_id}`}
                className="block h-full rounded-card border border-mist-200 bg-white p-5 shadow-soft transition-shadow hover:shadow-lift"
              >
                <div className="flex items-start gap-4">
                  <Avatar name={a.display_name} src={publicUrl('agent-photos', a.photo_path)} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink">{a.display_name}</p>
                    <p className="truncate text-sm text-mist-500">{a.job_title ?? 'Agent immobilier'}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {a.is_active && a.profile?.is_active !== false ? <Badge tone="success">Actif</Badge> : <Badge tone="muted">Inactif</Badge>}
                      {a.is_public ? <Badge tone="navy">Public</Badge> : <Badge tone="neutral">Non public</Badge>}
                    </div>
                  </div>
                </div>
                <ul className="mt-4 space-y-1 border-t border-mist-100 pt-3 text-sm text-mist-600">
                  <li className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" aria-hidden /> {formatPhone(a.public_phone)}
                  </li>
                  <li className="flex items-center gap-2 truncate">
                    <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden /> <span className="truncate">{a.public_email ?? a.profile?.email ?? '—'}</span>
                  </li>
                </ul>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {createOpen && <CreateAgentDialog onClose={() => setCreateOpen(false)} existing={new Set((agents.data ?? []).map((a) => a.profile_id))} />}
    </>
  )
}

function CreateAgentDialog({ onClose, existing }: { onClose: () => void; existing: Set<string> }) {
  const qc = useQueryClient()
  const users = useQuery({ queryKey: ['users', 'list'], queryFn: listUsers })
  const candidates = useMemo(() => (users.data ?? []).filter((u) => u.is_active && !existing.has(u.id)), [users.data, existing])
  const [userId, setUserId] = useState('')
  const [name, setName] = useState('')
  const mutation = useMutation({
    mutationFn: () => createAgentProfile({ profileId: userId, displayName: name.trim(), slug: `${slugify(name)}-${userId.slice(0, 6)}` }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agents'] })
      void qc.invalidateQueries({ queryKey: ['ref', 'agents'] })
      toast.success('Fiche agent créée.')
      onClose()
    },
  })
  return (
    <Dialog
      open
      onClose={onClose}
      title="Créer une fiche agent"
      description="Pour un compte existant. Pour un nouveau collaborateur, invitez-le depuis « Utilisateurs »."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!userId || name.trim().length < 2}>
            Créer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mutation.error && <Callout tone="danger">{errorMessage(mutation.error)}</Callout>}
        {users.error && <Callout tone="danger">{errorMessage(users.error)}</Callout>}
        <Field label="Compte" hint={candidates.length === 0 && !users.isLoading ? 'Tous les comptes actifs ont déjà une fiche.' : undefined}>
          <Select
            value={userId}
            placeholder="Choisir un compte…"
            options={candidates.map((u) => ({ value: u.id, label: `${u.full_name || u.email} (${u.email})` }))}
            onChange={(e) => {
              setUserId(e.target.value)
              const u = candidates.find((c) => c.id === e.target.value)
              if (u && !name) setName(u.full_name)
            }}
          />
        </Field>
        <Field label="Nom affiché">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </Field>
      </div>
    </Dialog>
  )
}
