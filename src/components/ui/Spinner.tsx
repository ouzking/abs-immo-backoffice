import { cn } from '@/lib/cn'

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <svg
      className={cn('h-5 w-5 animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/** Indicateur de chargement centré pour une zone ou une page. */
export function LoadingBlock({ label = 'Chargement…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex min-h-40 flex-col items-center justify-center gap-3 text-mist-500', className)} role="status">
      <Spinner className="h-6 w-6 text-navy-600" />
      <span className="text-sm">{label}</span>
    </div>
  )
}
