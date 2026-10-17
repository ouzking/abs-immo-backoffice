import { FilterSelect } from '@/components/ui/Misc'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAgentOptions } from '@/features/reference/hooks'

/**
 * Filtre « agent affecté ». Un agent ne voit de toute façon que son périmètre
 * (RLS) : le filtre n'est proposé qu'aux utilisateurs qui lisent tout.
 */
export function AssignedFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { can, access } = useAuth()
  const agents = useAgentOptions()
  if (!can('leads.read_all')) return null
  return (
    <FilterSelect
      label="Agent"
      value={value}
      onChange={onChange}
      options={[
        ...(access?.is_agent ? [{ value: 'me', label: 'Moi' }] : []),
        { value: 'none', label: 'Non affectés' },
        ...(agents.data ?? []).map((a) => ({ value: a.profile_id, label: a.display_name })),
      ]}
    />
  )
}
