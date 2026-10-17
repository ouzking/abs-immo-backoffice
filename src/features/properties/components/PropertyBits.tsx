import { ImageOff } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { COMMERCIAL_STATUSES, PUBLICATION_STATUSES, labelOf, toneOf } from '@/lib/labels'
import type { CommercialStatus, PublicationStatus } from '@/types'

export function PublicationBadge({ status }: { status: PublicationStatus }) {
  return <Badge tone={toneOf(PUBLICATION_STATUSES, status)}>{labelOf(PUBLICATION_STATUSES, status)}</Badge>
}

export function CommercialBadge({ status }: { status: CommercialStatus }) {
  return <Badge tone={toneOf(COMMERCIAL_STATUSES, status)}>{labelOf(COMMERCIAL_STATUSES, status)}</Badge>
}

export function PropertyThumb({
  url,
  alt,
  className,
  loading,
}: {
  url: string | null | undefined
  alt: string
  className?: string
  loading?: boolean
}) {
  return (
    <div className={cn('relative shrink-0 overflow-hidden rounded-lg bg-mist-100', className)}>
      {url ? (
        <img src={url} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : loading ? (
        <div className="skeleton h-full w-full" aria-hidden />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-mist-400" title="Aucune photo disponible">
          <ImageOff className="h-5 w-5" aria-hidden />
          <span className="sr-only">Aucune photo</span>
        </div>
      )}
    </div>
  )
}

