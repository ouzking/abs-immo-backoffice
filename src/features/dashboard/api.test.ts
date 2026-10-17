import { dakarLocalToIso, isoToDakarLocal } from '@/features/leads/hooks'
import { periodFromPreset } from './api'

describe('periodFromPreset', () => {
  const now = new Date('2026-10-17T15:30:00Z')
  it('choisit la granularité selon la durée', () => {
    expect(periodFromPreset('7d', now).interval).toBe('day')
    expect(periodFromPreset('90d', now).interval).toBe('week')
    expect(periodFromPreset('12m', now).interval).toBe('month')
  })
  it('couvre N jours pleins jusqu’à maintenant', () => {
    const p = periodFromPreset('7d', now)
    expect(p.from).toBe('2026-10-11T00:00:00.000Z')
    expect(p.to).toBe(now.toISOString())
  })
})

describe('heure de Dakar (UTC+0)', () => {
  it('convertit un champ datetime-local dans les deux sens', () => {
    expect(dakarLocalToIso('2026-10-20T15:00')).toBe('2026-10-20T15:00:00.000Z')
    expect(isoToDakarLocal('2026-10-20T15:00:00.000Z')).toBe('2026-10-20T15:00')
    expect(dakarLocalToIso('')).toBeNull()
  })
})
