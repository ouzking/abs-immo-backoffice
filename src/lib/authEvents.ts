/**
 * Canal minimal entre la couche données (React Query) et le fournisseur
 * d'authentification : une requête qui échoue pour cause de session expirée
 * le signale ici, sans dépendance circulaire.
 */
type Listener = () => void
const listeners = new Set<Listener>()

export function onSessionExpired(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function notifySessionExpired(): void {
  for (const l of listeners) l()
}
