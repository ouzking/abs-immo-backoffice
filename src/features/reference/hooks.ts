import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAgentOptions, fetchAmenities, fetchLocalities, fetchPropertyTypes, type LocalityLite } from './api'

const LONG = 10 * 60_000

export const referenceKeys = {
  propertyTypes: ['ref', 'property-types'] as const,
  amenities: ['ref', 'amenities'] as const,
  localities: ['ref', 'localities'] as const,
  agents: ['ref', 'agents'] as const,
}

export function usePropertyTypes() {
  return useQuery({ queryKey: referenceKeys.propertyTypes, queryFn: fetchPropertyTypes, staleTime: LONG })
}

export function useAmenities() {
  return useQuery({ queryKey: referenceKeys.amenities, queryFn: fetchAmenities, staleTime: LONG })
}

export function useLocalities() {
  return useQuery({ queryKey: referenceKeys.localities, queryFn: fetchLocalities, staleTime: LONG })
}

export function useAgentOptions() {
  return useQuery({ queryKey: referenceKeys.agents, queryFn: fetchAgentOptions, staleTime: 5 * 60_000 })
}

/** Index des libellés de types de biens : code → libellé. */
export function usePropertyTypeLabels(): Record<string, string> {
  const { data } = usePropertyTypes()
  return useMemo(() => Object.fromEntries((data ?? []).map((t) => [t.code, t.label])), [data])
}

/** Index des agents : profile_id → nom affiché. */
export function useAgentNames(): Record<string, string> {
  const { data } = useAgentOptions()
  return useMemo(() => Object.fromEntries((data ?? []).map((a) => [a.profile_id, a.display_name])), [data])
}

export interface LocalityTree {
  byId: Map<string, LocalityLite>
  children: (parentId: string | null, level?: LocalityLite['level']) => LocalityLite[]
  /** Chaîne de la région jusqu'à la localité donnée. */
  chain: (id: string | null | undefined) => LocalityLite[]
  label: (id: string | null | undefined) => string
}

export function buildLocalityTree(list: LocalityLite[]): LocalityTree {
  const byId = new Map(list.map((l) => [l.id, l]))
  const byParent = new Map<string | null, LocalityLite[]>()
  for (const l of list) {
    const key = l.parent_id ?? null
    const arr = byParent.get(key) ?? []
    arr.push(l)
    byParent.set(key, arr)
  }
  const chain = (id: string | null | undefined) => {
    const out: LocalityLite[] = []
    let cur = id ? byId.get(id) : undefined
    let guard = 0
    while (cur && guard++ < 10) {
      out.unshift(cur)
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
    }
    return out
  }
  return {
    byId,
    children: (parentId, level) => (byParent.get(parentId) ?? []).filter((l) => !level || l.level === level),
    chain,
    // Du plus précis au plus large, sans répéter un nom identique (ex. ville et région « Dakar »).
    label: (id) =>
      chain(id)
        .map((l) => l.name)
        .reverse()
        .filter((name, i, all) => all.indexOf(name) === i)
        .join(', ') || '—',
  }
}

export function useLocalityTree(): { tree: LocalityTree | null; isLoading: boolean; error: unknown } {
  const q = useLocalities()
  const tree = useMemo(() => (q.data ? buildLocalityTree(q.data) : null), [q.data])
  return { tree, isLoading: q.isLoading, error: q.error }
}
