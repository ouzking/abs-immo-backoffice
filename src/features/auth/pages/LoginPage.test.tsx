import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setSupabaseClientForTests } from '@/lib/supabase/client'
import { makeAuth, renderWithProviders } from '@/test/render'
import { LoginPage } from './LoginPage'

function mockClient(result: { error: unknown }) {
  const signInWithPassword = vi.fn().mockResolvedValue({ data: {}, ...result })
  setSupabaseClientForTests({ auth: { signInWithPassword } })
  return signInWithPassword
}

afterEach(() => setSupabaseClientForTests(null))

describe('LoginPage', () => {
  it('valide le formulaire avant tout appel', async () => {
    const signIn = mockClient({ error: null })
    renderWithProviders(<LoginPage />, { auth: makeAuth(null) })
    await userEvent.click(screen.getByRole('button', { name: /Se connecter/ }))
    expect(await screen.findByText('Saisissez votre e-mail.')).toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
  })

  it('affiche un message clair en cas d’identifiants invalides', async () => {
    const signIn = mockClient({ error: Object.assign(new Error('Invalid login credentials'), { code: 'invalid_credentials', status: 400 }) })
    renderWithProviders(<LoginPage />, { auth: makeAuth(null) })
    await userEvent.type(screen.getByLabelText('Adresse e-mail'), 'Agent1@ABS-immo.test')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'mauvais')
    await userEvent.click(screen.getByRole('button', { name: /Se connecter/ }))
    expect(await screen.findByText('E-mail ou mot de passe incorrect.')).toBeInTheDocument()
    expect(signIn).toHaveBeenCalledWith({ email: 'agent1@abs-immo.test', password: 'mauvais' })
  })

  it('signale une session expirée', () => {
    renderWithProviders(<LoginPage />, { auth: makeAuth(null, { expired: true }) })
    expect(screen.getByText('Session expirée')).toBeInTheDocument()
  })
})
