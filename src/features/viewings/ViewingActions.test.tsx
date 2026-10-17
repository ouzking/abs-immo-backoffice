import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { updateViewing } from '@/features/leads/api'
import { ViewingActions } from './ViewingActions'

vi.mock('@/features/leads/api', () => ({ updateViewing: vi.fn() }))

const viewing = { id: 'v1', status: 'requested' as const, scheduled_at: null, preferred_date: null, preferred_time_slot: 'any' as const }

describe('ViewingActions', () => {
  it('n’autorise la confirmation qu’avec une date de rendez-vous, puis enregistre en base', async () => {
    vi.mocked(updateViewing).mockResolvedValue({ status: 'confirmed', scheduled_at: '2026-10-20T15:00:00.000Z' } as never)
    renderWithProviders(<ViewingActions viewing={viewing} leadId="l1" canEdit />)
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
    const save = await screen.findByRole('button', { name: 'Enregistrer' })
    expect(save).toBeDisabled()

    await userEvent.type(screen.getByLabelText(/Date et heure du rendez-vous/), '2026-10-20T15:00')
    expect(save).toBeEnabled()
    await userEvent.click(save)
    await waitFor(() =>
      expect(updateViewing).toHaveBeenCalledWith('v1', { status: 'confirmed', scheduled_at: '2026-10-20T15:00:00.000Z' }),
    )
  })

  it('ne propose aucune action sans droit ou sur une visite terminée', () => {
    const { container } = renderWithProviders(<ViewingActions viewing={{ ...viewing, status: 'completed' }} leadId="l1" canEdit />)
    expect(container.querySelector('button')).toBeNull()
  })
})
