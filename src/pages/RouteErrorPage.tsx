import { isRouteErrorResponse, useRouteError } from 'react-router'
import { RefreshCw } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/States'

/** Erreur de rendu ou de chargement d'un écran (ex. nouvelle version déployée). */
export function RouteErrorPage() {
  const error = useRouteError()
  const chunkFailed = error instanceof Error && /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(error.message)
  if (chunkFailed) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-lg font-bold">Nouvelle version disponible</h1>
        <p className="mt-2 text-sm text-mist-600">L'application a été mise à jour. Rechargez la page pour continuer.</p>
        <Button className="mt-5" icon={<RefreshCw className="h-4 w-4" />} onClick={() => window.location.reload()}>
          Recharger
        </Button>
      </div>
    )
  }
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error
  return (
    <div className="mx-auto max-w-lg py-10">
      <ErrorState error={message instanceof Error || typeof message === 'object' ? message : new Error(String(message))} />
      <div className="text-center">
        <ButtonLink to="/" variant="secondary">
          Retour au tableau de bord
        </ButtonLink>
      </div>
    </div>
  )
}
