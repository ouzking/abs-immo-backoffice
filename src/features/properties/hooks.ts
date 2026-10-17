import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocalityTree } from '@/features/reference/hooks'
import { signPaths } from '@/lib/supabase/storage'

export const propertyKeys = {
  all: ['properties'] as const,
  list: (filters: unknown) => ['properties', 'list', filters] as const,
  detail: (id: string) => ['properties', 'detail', id] as const,
  media: (id: string) => ['properties', 'media', id] as const,
  features: (id: string) => ['properties', 'features', id] as const,
  amenities: (id: string) => ['properties', 'amenities', id] as const,
  documents: (id: string) => ['properties', 'documents', id] as const,
}

/** Invalide tout ce qui dépend d'un bien (liste, fiche, tableau de bord). */
export function useInvalidateProperty() {
  const qc = useQueryClient()
  return (id?: string) => {
    void qc.invalidateQueries({ queryKey: ['properties'] })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
    if (id) void qc.invalidateQueries({ queryKey: propertyKeys.detail(id) })
  }
}

/** Villes connues, pour le filtre de la liste. */
export function useCityOptions() {
  const { tree } = useLocalityTree()
  return useMemo(() => {
    if (!tree) return []
    return [...tree.byId.values()]
      .filter((l) => l.level === 'city')
      .map((l) => ({ value: l.id, label: l.name }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  }, [tree])
}

/** URL signées (bucket privé) pour un lot de chemins, mises en cache. */
export function useSignedImageUrls(paths: Array<string | null | undefined>) {
  const wanted = [...new Set(paths.filter((p): p is string => !!p))].sort()
  return useQuery({
    queryKey: ['signed', 'property-images', wanted],
    queryFn: () => signPaths('property-images', wanted),
    enabled: wanted.length > 0,
    staleTime: 30 * 60_000,
  })
}
