import { screen } from '@testing-library/react'
import { makeAccess, makeAuth, renderWithProviders } from '@/test/render'
import { Sidebar } from './Sidebar'

vi.mock('@/features/leads/api', () => ({
  fetchSidebarCounters: vi.fn().mockResolvedValue({ inquiries: 3, viewings: 0 }),
}))

describe('Sidebar', () => {
  it('n’affiche à un agent que les espaces autorisés', async () => {
    renderWithProviders(<Sidebar collapsed={false} />, { auth: makeAuth(makeAccess('agent')) })
    expect(screen.getByRole('link', { name: /Biens immobiliers/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Prospects/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Utilisateurs/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Journal d'audit/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Paramètres/ })).not.toBeInTheDocument()
    expect(await screen.findByLabelText('3 en attente')).toBeInTheDocument()
  })

  it('affiche l’administration à un administrateur', () => {
    renderWithProviders(<Sidebar collapsed={false} />, { auth: makeAuth(makeAccess('admin')) })
    expect(screen.getByRole('link', { name: /Utilisateurs/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Journal d'audit/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Paramètres de l'agence/ })).toBeInTheDocument()
  })
})
