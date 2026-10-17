import type { ReactElement, ReactNode } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { ConfirmProvider } from '@/components/ui/Confirm'
import { AuthContext, type AuthContextValue } from '@/features/auth/AuthProvider'
import { hasAnyPermission, hasPermission } from '@/features/auth/permissions'
import type { MyAccess, PermissionCode, RoleCode } from '@/types'

const ROLE_PERMISSIONS: Record<RoleCode, PermissionCode[]> = {
  agent: ['properties.read_all', 'properties.create', 'properties.update_own', 'leads.access_assigned', 'leads.create', 'stats.read_own'],
  sales_manager: [
    'properties.read_all', 'properties.create', 'properties.update_own', 'properties.update_all', 'properties.publish',
    'leads.access_assigned', 'leads.read_all', 'leads.create', 'leads.update_all', 'leads.assign', 'users.read', 'stats.read_own', 'stats.read_all',
  ],
  admin: [
    'properties.read_all', 'properties.create', 'properties.update_own', 'properties.update_all', 'properties.publish',
    'leads.access_assigned', 'leads.read_all', 'leads.create', 'leads.update_all', 'leads.assign', 'leads.delete',
    'agents.manage', 'users.read', 'users.manage', 'roles.assign', 'catalog.manage', 'settings.manage', 'stats.read_own', 'stats.read_all', 'audit.read',
  ],
  super_admin: [],
}

export function makeAccess(role: RoleCode, overrides: Partial<MyAccess> = {}): MyAccess {
  const ranks: Record<RoleCode, number> = { super_admin: 100, admin: 80, sales_manager: 60, agent: 40 }
  return {
    user_id: '00000000-0000-4000-a000-000000000004',
    email: `${role}@abs-immo.test`,
    full_name: 'Ousmane Faye',
    is_active: true,
    is_agent: role === 'agent' || role === 'sales_manager',
    rank: ranks[role],
    roles: [role],
    permissions: ROLE_PERMISSIONS[role],
    ...overrides,
  }
}

export function makeAuth(access: MyAccess | null, overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: access ? 'ready' : 'signed_out',
    session: null,
    access,
    expired: false,
    loadError: null,
    can: (p) => hasPermission(access, p),
    canAny: (ps) => hasAnyPermission(access, ps),
    refresh: async () => undefined,
    signOut: async () => undefined,
    acknowledgeExpired: () => undefined,
    ...overrides,
  }
}

export function renderWithProviders(
  element: ReactElement,
  { auth = makeAuth(makeAccess('agent')), path = '/', route = '/' }: { auth?: AuthContextValue; path?: string; route?: string } = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter([{ path, element }, { path: '*', element: <p>Autre page</p> }], { initialEntries: [route] })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <ConfirmProvider>{children}</ConfirmProvider>
      </AuthContext.Provider>
    </QueryClientProvider>
  )
  return { ...render(<RouterProvider router={router} />, { wrapper }), router, queryClient }
}
