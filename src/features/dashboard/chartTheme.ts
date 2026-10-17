/**
 * Palette des graphiques, dérivée de la marque et validée (contraste ≥ 3:1,
 * séparation daltonisme et vision normale, toutes paires) avec le script du
 * guide de visualisation. Les couleurs suivent l'entité, jamais son rang.
 */
export const SERIES = {
  blue: '#2a6cc0',
  red: '#d4303c',
  teal: '#0b8f86',
} as const

export const CHART = {
  grid: '#e1e6ec',
  axis: '#9aa6b4',
  tick: '#5d6878',
  ink: '#0b1d2e',
  surface: '#ffffff',
  muted: '#cbd3dc',
} as const
