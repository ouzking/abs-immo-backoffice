import { screen } from '@testing-library/react'
import { Outlet } from 'react-router'
import { makeAccess, makeAuth, renderWithProviders } from '@/test/render'
import { RequireAuth, RequirePermission } from './guards'

describe('RequirePermission', () => {
  it('affiche « Accès refusé » sans la permission requise', () => {
    renderWithProviders(
      <RequirePermission anyOf={['settings.manage']}>
        <p>Paramètres</p>
      </RequirePermission>,
      { auth: makeAuth(makeAccess('agent')) },
    )
    expect(screen.getByRole('heading', { name: 'Accès refusé' })).toBeInTheDocument()
    expect(screen.queryByText('Paramètres')).not.toBeInTheDocument()
  })

  it('affiche le contenu avec la permission', () => {
    renderWithProviders(
      <RequirePermission anyOf={['settings.manage']}>
        <p>Paramètres</p>
      </RequirePermission>,
      { auth: makeAuth(makeAccess('admin')) },
    )
    expect(screen.getByText('Paramètres')).toBeInTheDocument()
  })

  it('ne se fie qu’aux permissions renvoyées par la base, pas au rôle affiché', () => {
    // Un rôle « admin » sans permissions (ex. compte désactivé côté base) n'ouvre rien.
    const forged = makeAccess('admin', { permissions: [] })
    renderWithProviders(
      <RequirePermission anyOf={['audit.read']}>
        <p>Journal</p>
      </RequirePermission>,
      { auth: makeAuth(forged) },
    )
    expect(screen.queryByText('Journal')).not.toBeInTheDocument()
  })
})

describe('RequireAuth', () => {
  function Shell() {
    return (
      <div>
        <p>Zone protégée</p>
        <Outlet />
      </div>
    )
  }

  it('redirige vers la connexion sans session', async () => {
    const { router } = renderWithProviders(<RequireAuth />, { auth: makeAuth(null) })
    expect(screen.queryByText('Zone protégée')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('bloque un compte désactivé', () => {
    renderWithProviders(<RequireAuth />, { auth: makeAuth(makeAccess('agent', { is_active: false, permissions: [] }), { status: 'no_access' }) })
    expect(screen.getByText(/désactivé par un administrateur/)).toBeInTheDocument()
  })

  it('laisse passer un membre actif', () => {
    renderWithProviders(<Shell />, { auth: makeAuth(makeAccess('agent')) })
    expect(screen.getByText('Zone protégée')).toBeInTheDocument()
  })
})
