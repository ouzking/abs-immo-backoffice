import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { KeyRound, Power, ShieldCheck, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useConfirm } from '@/components/ui/Confirm'
import { DataTable } from '@/components/ui/DataTable'
import { Dialog } from '@/components/ui/Dialog'
import { Checkbox, Field, Input, Select } from '@/components/ui/Form'
import { Avatar, SearchInput } from '@/components/ui/Misc'
import { PageHeader } from '@/components/ui/PageHeader'
import { Callout } from '@/components/ui/States'
import { useAccess, useAuth } from '@/features/auth/AuthProvider'
import { PasswordChecklist } from '@/features/auth/components/PasswordChecklist'
import { assignableRoles } from '@/features/auth/permissions'
import { passwordSchema } from '@/features/auth/schemas'
import { errorMessage, toAppError } from '@/lib/errors'
import { formatDate, formatRelative, normalizePhone } from '@/lib/format'
import { ROLES, labelOf } from '@/lib/labels'
import type { RoleCode, UserListItem } from '@/types'
import { assignRole, createUserWithPassword, inviteUser, listUsers, revokeRole, sendPasswordReset, setUserActive } from '../api'

export function UsersPage() {
  const { can } = useAuth()
  const access = useAccess()
  const confirm = useConfirm()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [rolesFor, setRolesFor] = useState<UserListItem | null>(null)
  const users = useQuery({ queryKey: ['users', 'list'], queryFn: listUsers })
  const canManage = can('users.manage')

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['users'] })
    void qc.invalidateQueries({ queryKey: ['agents'] })
    void qc.invalidateQueries({ queryKey: ['ref', 'agents'] })
  }

  const activeMutation = useMutation({
    mutationFn: (v: { user: UserListItem; active: boolean }) => setUserActive(v.user.id, v.active),
    onSuccess: (r) => {
      refresh()
      toast.success(r.is_active ? 'Compte réactivé.' : 'Compte désactivé : l’accès est coupé immédiatement.')
    },
    onError: (e) => toast.error('Opération refusée', { description: errorMessage(e) }),
  })
  const resetMutation = useMutation({
    mutationFn: (u: UserListItem) => sendPasswordReset(u.id),
    onSuccess: () => toast.success('E-mail de réinitialisation envoyé.'),
    onError: (e) => toast.error('Envoi impossible', { description: errorMessage(e) }),
  })

  const toggleActive = async (u: UserListItem) => {
    const active = !u.is_active
    const ok = await confirm({
      title: active ? `Réactiver ${u.full_name || u.email} ?` : `Désactiver ${u.full_name || u.email} ?`,
      description: active
        ? 'La personne pourra de nouveau se connecter. Sa fiche agent reste inactive tant qu’un administrateur ne la réactive pas.'
        : 'La connexion est bloquée et toute session en cours perd immédiatement ses droits. Sa fiche agent est désactivée ; ses biens et prospects sont conservés.',
      confirmLabel: active ? 'Réactiver' : 'Désactiver',
      tone: active ? 'primary' : 'danger',
    })
    if (ok) activeMutation.mutate({ user: u, active })
  }

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (users.data ?? []).filter((u) => !term || `${u.full_name} ${u.email ?? ''}`.toLowerCase().includes(term))
  }, [users.data, q])

  const columns = useMemo<Array<ColumnDef<UserListItem, unknown>>>(
    () => [
      {
        id: 'user',
        header: 'Utilisateur',
        cell: ({ row: { original: u } }) => (
          <div className="flex items-center gap-3">
            <Avatar name={u.full_name || u.email} size="sm" />
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {u.full_name || '—'} {u.id === access.user_id && <span className="text-xs font-normal text-mist-500">(vous)</span>}
              </p>
              <p className="truncate text-xs text-mist-500">{u.email}</p>
            </div>
          </div>
        ),
      },
      {
        id: 'roles',
        header: 'Rôles',
        cell: ({ row: { original: u } }) =>
          u.roles.length ? (
            <div className="flex flex-wrap gap-1">
              {u.roles.map((r) => (
                <Badge key={r} tone={r === 'super_admin' || r === 'admin' ? 'danger' : 'navy'} dot={false}>
                  {labelOf(ROLES, r)}
                </Badge>
              ))}
              {u.is_agent && <Badge dot={false}>Fiche agent</Badge>}
            </div>
          ) : (
            <Badge tone="warning">Aucun rôle</Badge>
          ),
      },
      {
        id: 'status',
        header: 'Statut',
        cell: ({ row: { original: u } }) => (u.is_active ? <Badge tone="success">Actif</Badge> : <Badge tone="muted">Désactivé</Badge>),
      },
      {
        id: 'last',
        header: 'Dernière connexion',
        meta: { hideBelowLg: true },
        cell: ({ row: { original: u } }) => <span className="text-mist-600">{u.last_sign_in_at ? formatRelative(u.last_sign_in_at) : 'Jamais'}</span>,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row: { original: u } }) =>
          canManage && u.can_manage ? (
            <div className="flex flex-wrap gap-1">
              {can('roles.assign') && (
                <Button size="sm" variant="secondary" icon={<ShieldCheck className="h-3.5 w-3.5" />} onClick={() => setRolesFor(u)}>
                  Rôles
                </Button>
              )}
              <Button size="sm" variant="ghost" icon={<KeyRound className="h-3.5 w-3.5" />} onClick={() => resetMutation.mutate(u)} disabled={!u.is_active}>
                Réinitialiser
              </Button>
              <Button
                size="sm"
                variant={u.is_active ? 'danger-outline' : 'secondary'}
                icon={<Power className="h-3.5 w-3.5" />}
                onClick={() => void toggleActive(u)}
              >
                {u.is_active ? 'Désactiver' : 'Réactiver'}
              </Button>
            </div>
          ) : (
            <span className="text-xs text-mist-400">{u.id === access.user_id ? 'Votre compte' : 'Rang supérieur ou égal'}</span>
          ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [access.user_id, canManage],
  )

  return (
    <>
      <PageHeader
        title="Utilisateurs"
        description="Comptes du personnel. Les rôles et activations sont contrôlés par la base : on ne gère que des comptes de rang inférieur au sien, jamais le sien."
        actions={
          canManage &&
          can('roles.assign') && (
            <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setInviteOpen(true)}>
              Inviter un utilisateur
            </Button>
          )
        }
      />
      <Card className="overflow-hidden">
        <div className="border-b border-mist-100 p-4">
          <SearchInput value={q} onChange={setQ} delay={0} placeholder="Nom ou e-mail…" />
        </div>
        <DataTable
          caption="Utilisateurs"
          data={rows}
          columns={columns}
          loading={users.isLoading}
          error={users.error}
          onRetry={() => void users.refetch()}
          getRowId={(u) => u.id}
          rowClassName={(u) => (!u.is_active ? 'opacity-60' : undefined)}
          mobileCard={(u) => (
            <div className="px-4 py-3.5">
              <p className="font-semibold">{u.full_name || u.email}</p>
              <p className="text-xs text-mist-500">
                {u.email} · {u.roles.map((r) => labelOf(ROLES, r)).join(', ') || 'Aucun rôle'} · {u.is_active ? 'Actif' : 'Désactivé'}
              </p>
              <p className="text-xs text-mist-500">Créé le {formatDate(u.created_at)}</p>
              {canManage && u.can_manage && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {can('roles.assign') && (
                    <Button size="sm" variant="secondary" onClick={() => setRolesFor(u)}>
                      Rôles
                    </Button>
                  )}
                  <Button size="sm" variant={u.is_active ? 'danger-outline' : 'secondary'} onClick={() => void toggleActive(u)}>
                    {u.is_active ? 'Désactiver' : 'Réactiver'}
                  </Button>
                </div>
              )}
            </div>
          )}
        />
      </Card>
      {inviteOpen && <InviteDialog onClose={() => setInviteOpen(false)} onDone={refresh} />}
      {rolesFor && <RolesDialog user={rolesFor} onClose={() => setRolesFor(null)} onDone={refresh} />}
    </>
  )
}

function RolesDialog({ user, onClose, onDone }: { user: UserListItem; onClose: () => void; onDone: () => void }) {
  const access = useAccess()
  const confirm = useConfirm()
  const allowed = assignableRoles(access)
  const [busy, setBusy] = useState<RoleCode | null>(null)
  const [roles, setRoles] = useState<RoleCode[]>(user.roles)

  const toggle = async (role: RoleCode, on: boolean) => {
    if (!on && roles.length === 1) {
      const ok = await confirm({
        title: 'Retirer le dernier rôle ?',
        description: 'Sans rôle, la personne ne pourra plus accéder au back-office.',
        confirmLabel: 'Retirer',
        tone: 'danger',
      })
      if (!ok) return
    }
    if (on && (role === 'admin' || role === 'super_admin')) {
      const ok = await confirm({
        title: `Attribuer le rôle « ${labelOf(ROLES, role)} » ?`,
        description: 'Ce rôle donne accès à l’administration des comptes, des paramètres et du journal d’audit.',
        confirmLabel: 'Attribuer',
        tone: 'danger',
      })
      if (!ok) return
    }
    setBusy(role)
    try {
      if (on) await assignRole(user.id, role)
      else await revokeRole(user.id, role)
      setRoles((r) => (on ? [...r, role] : r.filter((x) => x !== role)))
      onDone()
      toast.success(on ? 'Rôle attribué.' : 'Rôle retiré.')
    } catch (e) {
      toast.error('Modification refusée', { description: toAppError(e).message })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title="Rôles"
      description={user.full_name || user.email}
      footer={<Button onClick={onClose}>Terminé</Button>}
    >
      <div className="space-y-3">
        {(Object.keys(ROLES) as RoleCode[]).map((r) => (
          <Checkbox
            key={r}
            label={labelOf(ROLES, r)}
            description={allowed.includes(r) ? undefined : 'Rang supérieur ou égal au vôtre : non modifiable.'}
            checked={roles.includes(r)}
            disabled={!allowed.includes(r) || busy !== null}
            onChange={(e) => void toggle(r, e.target.checked)}
          />
        ))}
        <p className="pt-2 text-xs text-mist-500">Chaque changement est appliqué immédiatement et inscrit au journal d’audit.</p>
      </div>
    </Dialog>
  )
}

const inviteSchema = z
  .object({
    mode: z.enum(['invite', 'create']),
    email: z.string().trim().email('Adresse e-mail invalide.'),
    full_name: z.string().trim().min(2, 'Au moins 2 caractères.').max(120),
    role: z.enum(['super_admin', 'admin', 'sales_manager', 'agent']),
    phone: z.string().trim().refine((v) => normalizePhone(v) !== undefined, 'Numéro invalide.'),
    create_agent_profile: z.boolean(),
    password: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'create') {
      const r = passwordSchema.safeParse(v.password)
      if (!r.success) ctx.addIssue({ code: 'custom', path: ['password'], message: r.error.issues[0]?.message ?? 'Mot de passe invalide.' })
    }
  })
type InviteValues = z.infer<typeof inviteSchema>

function InviteDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const access = useAccess()
  const { can } = useAuth()
  const roles = assignableRoles(access)
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { mode: 'invite', email: '', full_name: '', role: roles.includes('agent') ? 'agent' : roles[0], phone: '', create_agent_profile: can('agents.manage'), password: '' },
  })
  const mode = useWatch({ control, name: 'mode' })
  const password = useWatch({ control, name: 'password' })
  const mutation = useMutation({
    mutationFn: (v: InviteValues) => {
      const base = {
        email: v.email.toLowerCase(),
        full_name: v.full_name,
        role: v.role,
        phone: normalizePhone(v.phone) ?? null,
        create_agent_profile: can('agents.manage') && v.create_agent_profile,
      }
      return v.mode === 'invite' ? inviteUser(base) : createUserWithPassword({ ...base, password: v.password })
    },
    onSuccess: (r, v) => {
      onDone()
      toast.success(v.mode === 'invite' ? `Invitation envoyée à ${r.email}.` : `Compte ${r.email} créé.`, r.warning ? { description: r.warning } : undefined)
      onClose()
    },
  })
  const fieldErrors = mutation.error ? toAppError(mutation.error).fields : undefined

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!mutation.isPending}
      title="Inviter un utilisateur"
      description="Le compte est créé par le serveur ; aucune inscription publique n’existe."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Annuler
          </Button>
          <Button onClick={handleSubmit((v) => mutation.mutate(v))} loading={mutation.isPending}>
            {mode === 'invite' ? 'Envoyer l’invitation' : 'Créer le compte'}
          </Button>
        </>
      }
    >
      <form noValidate className="space-y-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
        {mutation.error && <Callout tone="danger">{errorMessage(mutation.error)}</Callout>}
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Mode de création">
          {(
            [
              ['invite', 'Invitation par e-mail', 'Recommandé : la personne choisit son mot de passe.'],
              ['create', 'Mot de passe provisoire', 'À transmettre de façon sûre ; à changer à la 1re connexion.'],
            ] as const
          ).map(([value, label, desc]) => (
            <label key={value} className={`cursor-pointer rounded-xl border p-3 ${mode === value ? 'border-navy-500 bg-navy-50' : 'border-mist-200'}`}>
              <input type="radio" value={value} className="sr-only" {...register('mode')} />
              <span className="block text-sm font-semibold">{label}</span>
              <span className="block text-xs text-mist-500">{desc}</span>
            </label>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom complet" required error={errors.full_name?.message ?? fieldErrors?.full_name}>
            <Input {...register('full_name')} />
          </Field>
          <Field label="E-mail professionnel" required error={errors.email?.message ?? fieldErrors?.email}>
            <Input type="email" {...register('email')} />
          </Field>
          <Field label="Rôle" required hint="Seuls les rôles de rang inférieur au vôtre sont proposés." error={fieldErrors?.role}>
            <Select options={roles.map((r) => ({ value: r, label: labelOf(ROLES, r) }))} {...register('role')} />
          </Field>
          <Field label="Téléphone" error={errors.phone?.message ?? fieldErrors?.phone}>
            <Input type="tel" {...register('phone')} />
          </Field>
          {mode === 'create' && (
            <div className="space-y-2 sm:col-span-2">
              <Field label="Mot de passe provisoire" required error={errors.password?.message ?? fieldErrors?.password}>
                <Input type="password" autoComplete="new-password" {...register('password')} />
              </Field>
              <PasswordChecklist value={password} />
            </div>
          )}
          {can('agents.manage') && (
            <Checkbox className="sm:col-span-2" label="Créer aussi une fiche agent" description="Nécessaire pour être responsable de biens et recevoir des prospects." {...register('create_agent_profile')} />
          )}
        </div>
      </form>
    </Dialog>
  )
}
