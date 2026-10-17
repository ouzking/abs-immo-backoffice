import { Compass } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/States'

export function NotFoundPage() {
  return (
    <EmptyState
      icon={<Compass className="h-6 w-6" />}
      title="Page introuvable"
      description="L'adresse demandée n'existe pas ou a été déplacée."
      action={
        <ButtonLink to="/" variant="primary">
          Retour au tableau de bord
        </ButtonLink>
      }
    />
  )
}
