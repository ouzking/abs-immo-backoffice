import { emptyPropertyForm, propertyFormSchema, toPropertyPayload, type PropertyFormValues } from './schema'
import { diffFeatures, pickUpdatable, sanitizeSearch, validateImageFile } from './api'

function valid(overrides: Partial<PropertyFormValues> = {}): PropertyFormValues {
  return {
    ...emptyPropertyForm(),
    title: 'Villa avec piscine aux Almadies',
    property_type: 'villa',
    price_amount: '450 000 000',
    region_id: 'r1',
    city_id: 'c1',
    ...overrides,
  }
}

const errorsOf = (v: PropertyFormValues) => {
  const r = propertyFormSchema.safeParse(v)
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'))
}

describe('propertyFormSchema', () => {
  it('accepte un brouillon minimal valide', () => {
    expect(errorsOf(valid())).toEqual([])
  })
  it('exige un prix sauf « prix sur demande »', () => {
    expect(errorsOf(valid({ price_amount: '' }))).toContain('price_amount')
    expect(errorsOf(valid({ price_amount: '', price_on_request: true }))).toEqual([])
  })
  it('exige la période de loyer pour une location', () => {
    expect(errorsOf(valid({ transaction_type: 'rent' }))).toContain('rent_period')
    expect(errorsOf(valid({ transaction_type: 'rent', rent_period: 'month' }))).toEqual([])
  })
  it('refuse « vendu » pour une location et « loué » pour une vente', () => {
    expect(errorsOf(valid({ transaction_type: 'rent', rent_period: 'month', commercial_status: 'sold' }))).toContain('commercial_status')
    expect(errorsOf(valid({ commercial_status: 'rented' }))).toContain('commercial_status')
  })
  it('exige latitude et longitude ensemble', () => {
    expect(errorsOf(valid({ latitude: '14.7' }))).toContain('longitude')
    expect(errorsOf(valid({ latitude: '14.7', longitude: '-17.4' }))).toEqual([])
  })
  it('exige une région', () => {
    expect(errorsOf(valid({ region_id: '', city_id: '' }))).toContain('region_id')
  })
})

describe('toPropertyPayload', () => {
  const opts = { isLand: false, canAssignAgent: false, canPublish: false, isCreate: true }

  it('convertit les nombres et retient la localité la plus précise', () => {
    const p = toPropertyPayload(valid({ commune_id: 'co1', bedrooms: '4', surface_area: '250,5' }), opts)
    expect(p.price_amount).toBe(450000000)
    expect(p.locality_id).toBe('co1')
    expect(p.bedrooms).toBe(4)
    expect(p.surface_area).toBe(250.5)
    expect(p.rent_period).toBeNull()
    expect(p.currency_code).toBe('XOF')
  })

  it('n’envoie jamais agent_id, is_featured ni slug sans le droit correspondant', () => {
    const p = toPropertyPayload(valid({ agent_id: 'x', is_featured: true, slug: 'abc' }), opts)
    expect(p).not.toHaveProperty('agent_id')
    expect(p).not.toHaveProperty('is_featured')
    expect(p).not.toHaveProperty('slug')
    const q = toPropertyPayload(valid({ agent_id: 'x', is_featured: true, slug: 'abc' }), { ...opts, canAssignAgent: true, canPublish: true, isCreate: false })
    expect(q).toMatchObject({ agent_id: 'x', is_featured: true, slug: 'abc' })
  })

  it('vide les pièces pour un terrain et le prix si « sur demande »', () => {
    const p = toPropertyPayload(valid({ bedrooms: '3', price_on_request: true }), { ...opts, isLand: true })
    expect(p.bedrooms).toBeNull()
    expect(p.price_amount).toBeNull()
  })
})

describe('pickUpdatable', () => {
  it('écarte les colonnes non accordées (reference, created_by, published_at…)', () => {
    const p = pickUpdatable({ title: 'Titre', reference: 'X', created_by: 'u', published_at: 'now', search_vector: 'v' })
    expect(p).toEqual({ title: 'Titre' })
  })
})

describe('diffFeatures', () => {
  const current = [
    { id: 'a', label: 'Vue', value: 'Mer', sort_order: 0, property_id: 'p', created_at: '' },
    { id: 'b', label: 'Orientation', value: 'Sud', sort_order: 1, property_id: 'p', created_at: '' },
  ]
  it('calcule suppressions, modifications et ajouts', () => {
    const d = diffFeatures(current, [
      { id: 'b', label: 'Orientation', value: 'Nord' },
      { label: 'Gardien', value: '24h/24' },
      { label: '  ', value: '' },
    ])
    expect(d.toDelete).toEqual(['a'])
    expect(d.toUpdate).toEqual([{ id: 'b', label: 'Orientation', value: 'Nord', sort_order: 0 }])
    expect(d.toInsert).toEqual([{ label: 'Gardien', value: '24h/24', sort_order: 1 }])
  })
})

describe('sanitizeSearch / validateImageFile', () => {
  it('neutralise la syntaxe or=(…) de PostgREST', () => {
    expect(sanitizeSearch('villa,title.eq.x)(*')).toBe('villa title.eq.x')
  })
  it('contrôle type et taille des photos', () => {
    expect(validateImageFile(new File(['x'], 'a.gif', { type: 'image/gif' }))).toMatch(/Format/)
    expect(validateImageFile(new File(['x'], 'a.jpg', { type: 'image/jpeg' }))).toBeNull()
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'b.jpg', { type: 'image/jpeg' })
    expect(validateImageFile(big)).toMatch(/10 Mo/)
  })
})

describe('version anglaise (contrat 1.1.0)', () => {
  it('est facultative mais un titre anglais fait 5 à 160 caractères', () => {
    expect(errorsOf(valid({ title_en: '' }))).toEqual([])
    expect(errorsOf(valid({ title_en: 'Abc' }))).toContain('title_en')
    expect(errorsOf(valid({ title_en: 'Villa with pool in Almadies' }))).toEqual([])
  })
  it('envoie null pour un champ vide (le site affiche alors le français)', () => {
    const p = toPropertyPayload(valid({ title_en: 'Villa with pool', short_description_en: '  ' }), {
      isLand: false,
      canAssignAgent: false,
      canPublish: false,
      isCreate: false,
    })
    expect(p.title_en).toBe('Villa with pool')
    expect(p.short_description_en).toBeNull()
    expect(pickUpdatable(p)).toHaveProperty('title_en', 'Villa with pool')
  })
})
