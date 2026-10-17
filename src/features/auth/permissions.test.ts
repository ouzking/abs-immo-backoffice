import type { MyAccess } from '@/types'
import { assignableRoles, hasAnyPermission, hasPermission } from './permissions'

const base: MyAccess = {
  user_id: 'u1',
  email: 'a@b.sn',
  full_name: 'Test',
  is_active: true,
  is_agent: true,
  rank: 40,
  roles: ['agent'],
  permissions: ['properties.read_all', 'properties.create', 'properties.update_own', 'leads.access_assigned', 'leads.create', 'stats.read_own'],
}

describe('hasPermission', () => {
  it('lit les permissions calculées par la base', () => {
    expect(hasPermission(base, 'properties.create')).toBe(true)
    expect(hasPermission(base, 'properties.publish')).toBe(false)
    expect(hasAnyPermission(base, ['users.read', 'stats.read_own'])).toBe(true)
  })

  it('refuse tout à un compte désactivé ou absent', () => {
    expect(hasPermission({ ...base, is_active: false }, 'properties.create')).toBe(false)
    expect(hasPermission(null, 'properties.create')).toBe(false)
  })
})

describe('assignableRoles', () => {
  it('ne propose que des rangs inférieurs', () => {
    const admin: MyAccess = { ...base, rank: 80, roles: ['admin'], permissions: ['roles.assign', 'users.manage'] }
    expect(assignableRoles(admin)).toEqual(['sales_manager', 'agent'])
  })
  it('super_admin peut tout attribuer ; sans roles.assign, rien', () => {
    expect(assignableRoles({ ...base, rank: 100, roles: ['super_admin'], permissions: ['roles.assign'] })).toHaveLength(4)
    expect(assignableRoles(base)).toEqual([])
  })
})
