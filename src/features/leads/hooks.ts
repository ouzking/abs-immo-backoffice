import { useQueryClient } from '@tanstack/react-query'

export const leadKeys = {
  list: (f: unknown) => ['leads', 'list', f] as const,
  detail: (id: string) => ['leads', 'detail', id] as const,
  activities: (id: string) => ['leads', 'activities', id] as const,
  inquiries: (id: string) => ['leads', 'inquiries', id] as const,
  viewings: (id: string) => ['leads', 'viewings', id] as const,
  inbox: (f: unknown) => ['inquiries', 'list', f] as const,
  viewingList: (f: unknown) => ['viewings', 'list', f] as const,
}

/** Après une écriture commerciale : listes, fiche, compteurs et tableau de bord. */
export function useInvalidateLeads() {
  const qc = useQueryClient()
  return (leadId?: string | null) => {
    void qc.invalidateQueries({ queryKey: ['leads', 'list'] })
    void qc.invalidateQueries({ queryKey: ['inquiries'] })
    void qc.invalidateQueries({ queryKey: ['viewings'] })
    void qc.invalidateQueries({ queryKey: ['sidebar-counters'] })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
    if (leadId) {
      void qc.invalidateQueries({ queryKey: leadKeys.detail(leadId) })
      void qc.invalidateQueries({ queryKey: leadKeys.activities(leadId) })
      void qc.invalidateQueries({ queryKey: leadKeys.inquiries(leadId) })
      void qc.invalidateQueries({ queryKey: leadKeys.viewings(leadId) })
    }
  }
}

/** Valeur d'un champ datetime-local interprétée à l'heure de Dakar (UTC+0, sans heure d'été). */
export function dakarLocalToIso(value: string): string | null {
  if (!value) return null
  const d = new Date(`${value.length === 16 ? `${value}:00` : value}Z`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** ISO → valeur de champ datetime-local à l'heure de Dakar. */
export function isoToDakarLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 16)
}
