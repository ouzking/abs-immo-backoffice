import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

/**
 * Filtres conservés dans l'URL (partageables, conservés au rechargement et au
 * retour arrière). Toute modification d'un filtre autre que `page` ramène à la page 0.
 */
export function useUrlFilters<K extends string>(defaults: Record<K, string>) {
  const [params, setParams] = useSearchParams()

  const values = useMemo(() => {
    const out = {} as Record<K, string>
    for (const key of Object.keys(defaults) as K[]) out[key] = params.get(key) ?? defaults[key]
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const set = useCallback(
    (patch: Partial<Record<K | 'page', string>>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(patch) as Array<[string, string | undefined]>) {
            const def = (defaults as Record<string, string>)[key] ?? ''
            if (value === undefined || value === def) next.delete(key)
            else next.set(key, value)
          }
          if (!('page' in patch)) next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setParams],
  )

  const page = Math.max(0, Number.parseInt(params.get('page') ?? '0', 10) || 0)
  const activeCount = (Object.keys(defaults) as K[]).filter((k) => values[k] !== defaults[k] && k !== ('sort' as K) && k !== ('dir' as K)).length

  return { values, set, page, setPage: (p: number) => set({ page: String(p) } as Partial<Record<K | 'page', string>>), activeCount }
}
