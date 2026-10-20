// Version anglaise des annonces (contrat 1.1.0).
/** Synthèse de traduction, réutilisée dans la fiche et la liste. */
export function translationStatus(p: {
  title_en: string | null | undefined
  short_description_en: string | null | undefined
  description_en: string | null | undefined
}): { label: string; tone: 'success' | 'warning' | 'muted' } {
  const filled = [p.title_en, p.short_description_en, p.description_en].filter((v) => v && v.trim()).length
  if (filled === 3) return { label: 'Traduite', tone: 'success' }
  if (filled > 0) return { label: 'Partielle', tone: 'warning' }
  return { label: 'Non traduite', tone: 'muted' }
}

