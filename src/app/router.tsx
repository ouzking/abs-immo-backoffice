import { createBrowserRouter, type RouteObject } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { RequireAuth, RequirePermission } from '@/features/auth/guards'
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { MfaChallengePage } from '@/features/auth/pages/MfaChallengePage'
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RouteErrorPage } from '@/pages/RouteErrorPage'

/**
 * Les écrans métier sont chargés à la demande (un fichier par domaine).
 * Les gardes de permission ne sont qu'un confort d'interface : RLS protège les données.
 */
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/mfa', element: <MfaChallengePage /> },
  {
    element: <RequireAuth />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AppShell />,
        errorElement: <RouteErrorPage />,
        children: [
          {
            element: <RequirePermission anyOf={['stats.read_own', 'stats.read_all']} />,
            children: [{ index: true, lazy: async () => ({ Component: (await import('@/features/dashboard/DashboardPage')).DashboardPage }) }],
          },
          {
            path: 'biens',
            element: <RequirePermission anyOf={['properties.read_all', 'properties.create']} />,
            children: [
              { index: true, lazy: async () => ({ Component: (await import('@/features/properties/pages/PropertiesListPage')).PropertiesListPage }) },
              {
                path: 'nouveau',
                element: <RequirePermission anyOf={['properties.create']} />,
                children: [{ index: true, lazy: async () => ({ Component: (await import('@/features/properties/pages/PropertyEditorPage')).PropertyEditorPage }) }],
              },
              { path: ':id', lazy: async () => ({ Component: (await import('@/features/properties/pages/PropertyDetailPage')).PropertyDetailPage }) },
              { path: ':id/modifier', lazy: async () => ({ Component: (await import('@/features/properties/pages/PropertyEditorPage')).PropertyEditorPage }) },
              { path: ':id/apercu', lazy: async () => ({ Component: (await import('@/features/properties/pages/PropertyPreviewPage')).PropertyPreviewPage }) },
            ],
          },
          {
            element: <RequirePermission anyOf={['leads.access_assigned', 'leads.read_all']} />,
            children: [
              { path: 'demandes', lazy: async () => ({ Component: (await import('@/features/leads/pages/InquiriesPage')).InquiriesPage }) },
              { path: 'visites', lazy: async () => ({ Component: (await import('@/features/viewings/ViewingsPage')).ViewingsPage }) },
              { path: 'prospects', lazy: async () => ({ Component: (await import('@/features/leads/pages/LeadsListPage')).LeadsListPage }) },
              { path: 'prospects/:id', lazy: async () => ({ Component: (await import('@/features/leads/pages/LeadDetailPage')).LeadDetailPage }) },
            ],
          },
          { path: 'agents', lazy: async () => ({ Component: (await import('@/features/agents/pages/AgentsPage')).AgentsPage }) },
          { path: 'agents/:id', lazy: async () => ({ Component: (await import('@/features/agents/pages/AgentDetailPage')).AgentDetailPage }) },
          {
            path: 'utilisateurs',
            element: <RequirePermission anyOf={['users.read']} />,
            children: [{ index: true, lazy: async () => ({ Component: (await import('@/features/agents/pages/UsersPage')).UsersPage }) }],
          },
          {
            path: 'parametres',
            element: <RequirePermission anyOf={['settings.manage']} />,
            children: [{ index: true, lazy: async () => ({ Component: (await import('@/features/settings/SettingsPage')).SettingsPage }) }],
          },
          {
            path: 'journal',
            element: <RequirePermission anyOf={['audit.read']} />,
            children: [{ index: true, lazy: async () => ({ Component: (await import('@/features/audit/AuditPage')).AuditPage }) }],
          },
          { path: 'profil', lazy: async () => ({ Component: (await import('@/features/profile/ProfilePage')).ProfilePage }) },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(routes)
