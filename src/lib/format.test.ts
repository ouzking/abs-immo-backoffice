import { formatPhone, formatPrice, initials, normalizePhone, slugify } from './format'

describe('formatPrice', () => {
  it('formate un prix en FCFA avec séparateurs ordinaires', () => {
    expect(formatPrice(150000000)).toBe('150 000 000 FCFA')
  })
  it('ajoute la période de loyer', () => {
    expect(formatPrice(850000, { rentPeriod: 'month' })).toBe('850 000 FCFA / mois')
  })
  it('affiche « Prix sur demande » si demandé ou absent', () => {
    expect(formatPrice(1000, { onRequest: true })).toBe('Prix sur demande')
    expect(formatPrice(null)).toBe('Prix sur demande')
  })
})

describe('normalizePhone', () => {
  it.each([
    ['77 123 45 67', '+221771234567'],
    ['+221 77 123 45 67', '+221771234567'],
    ['00221771234567', '+221771234567'],
    ['+33 6 12 34 56 78', '+33612345678'],
    ['33-800-11-22', '+221338001122'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })
  it('renvoie null pour une saisie vide et undefined si invalide', () => {
    expect(normalizePhone('  ')).toBeNull()
    expect(normalizePhone('abc')).toBeUndefined()
    expect(normalizePhone('123')).toBeUndefined()
  })
})

describe('formatPhone', () => {
  it('met en forme un numéro sénégalais', () => {
    expect(formatPhone('+221771234567')).toBe('+221 77 123 45 67')
    expect(formatPhone('+33612345678')).toBe('+33612345678')
    expect(formatPhone(null)).toBe('—')
  })
})

describe('slugify / initials', () => {
  it('produit un slug compatible avec la contrainte de la base', () => {
    expect(slugify('  Villa Épurée à Ngor !  ')).toBe('villa-epuree-a-ngor')
    expect(slugify('Mariama Bâ')).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })
  it('calcule des initiales', () => {
    expect(initials('Aminata Sow')).toBe('AS')
    expect(initials('')).toBe('?')
  })
})
