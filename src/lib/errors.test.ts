import { AppError, expectRow, fromFunctionsError, fromPostgrestError, fromStorageError, toAppError } from './errors'

describe('fromPostgrestError', () => {
  it('traduit un refus RLS générique en message clair', () => {
    const e = fromPostgrestError({ code: '42501', message: 'permission denied for table leads' })
    expect(e.kind).toBe('forbidden')
    expect(e.message).toMatch(/non autorisée/)
  })

  it('conserve le message français des garde-fous du backend', () => {
    const e = fromPostgrestError({ code: '42501', message: 'Permission properties.publish requise pour passer de draft à published.' })
    expect(e.message).toBe('Permission properties.publish requise pour passer de draft à published.')
  })

  it('expose le hint des règles de publication', () => {
    const e = fromPostgrestError({
      code: '23514',
      message: 'Publication impossible : le bien doit avoir au moins une photo de couverture.',
      hint: 'PUBLISH_REQUIRES_COVER',
    })
    expect(e.kind).toBe('business')
    expect(e.hint).toBe('PUBLISH_REQUIRES_COVER')
  })

  it('traduit les contraintes CHECK connues', () => {
    const e = fromPostgrestError({ code: '23514', message: 'new row for relation "properties" violates check constraint "properties_rent_period"' })
    expect(e.message).toMatch(/période de loyer/)
  })

  it('gère unicité, introuvable et session expirée', () => {
    expect(fromPostgrestError({ code: '23505', message: 'duplicate key value violates unique constraint "properties_slug_key"' }).message).toMatch(/slug/)
    expect(fromPostgrestError({ code: 'PGRST116', message: 'JSON object requested' }).kind).toBe('not_found')
    expect(fromPostgrestError({ code: 'PGRST301', message: 'JWT expired' }).kind).toBe('auth')
  })

  it('reconnaît une coupure réseau', () => {
    expect(fromPostgrestError({ code: '', message: 'TypeError: Failed to fetch' }).kind).toBe('network')
  })
})

describe('fromFunctionsError', () => {
  it('lit le corps { error } renvoyé par admin-users', async () => {
    const context = new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Vous ne pouvez attribuer que des rôles de rang inférieur au vôtre.' } }), { status: 403 })
    const e = await fromFunctionsError({ name: 'FunctionsHttpError', context })
    expect(e.kind).toBe('forbidden')
    expect(e.message).toMatch(/rang inférieur/)
  })

  it('remonte les erreurs par champ', async () => {
    const context = new Response(JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Requête invalide.', fields: { email: 'E-mail invalide.' } } }), { status: 422 })
    const e = await fromFunctionsError({ name: 'FunctionsHttpError', context })
    expect(e.kind).toBe('validation')
    expect(e.fields).toEqual({ email: 'E-mail invalide.' })
  })

  it('traite 401 comme une session expirée et les erreurs de transport comme réseau', async () => {
    expect((await fromFunctionsError({ name: 'FunctionsHttpError', context: new Response('{}', { status: 401 }) })).kind).toBe('auth')
    expect((await fromFunctionsError({ name: 'FunctionsFetchError' })).kind).toBe('network')
  })
})

describe('fromStorageError', () => {
  it('classe les refus de politique et les fichiers trop gros', () => {
    expect(fromStorageError({ message: 'new row violates row-level security policy', statusCode: '403' }).kind).toBe('forbidden')
    expect(fromStorageError({ message: 'The object exceeded the maximum allowed size', statusCode: '413' }).kind).toBe('validation')
  })
})

describe('expectRow', () => {
  it('refuse une écriture sans ligne renvoyée (filtrage RLS silencieux)', () => {
    expect(() => expectRow({ data: null, error: null })).toThrow(AppError)
    expect(() => expectRow({ data: [], error: null })).toThrow(/vos droits/)
    expect(expectRow({ data: { id: 1 }, error: null })).toEqual({ id: 1 })
  })
})

describe('toAppError', () => {
  it('laisse passer une AppError et normalise le reste', () => {
    const e = new AppError('conflict', 'x')
    expect(toAppError(e)).toBe(e)
    expect(toAppError(new TypeError('Failed to fetch')).kind).toBe('network')
    expect(toAppError('boom').kind).toBe('unknown')
  })
})
