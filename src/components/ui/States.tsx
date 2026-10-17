import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, Lock, RefreshCw, WifiOff } from 'lucide-react'
import { cn } from '@/lib/cn'
import { toAppError } from '@/lib/errors'
import { Button } from './Button'

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-50 text-navy-600">
        {icon ?? <Inbox className="h-6 w-6" aria-hidden />}
      </span>
      <h3 className="mt-4 text-base font-bold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm leading-relaxed text-mist-500">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

/** Affiche une erreur normalisée, avec un message adapté à sa nature. */
export function ErrorState({
  error,
  onRetry,
  title,
  className,
  compact = false,
}: {
  error: unknown
  onRetry?: () => void
  title?: string
  className?: string
  compact?: boolean
}) {
  const e = toAppError(error)
  const Icon = e.kind === 'network' ? WifiOff : e.kind === 'forbidden' ? Lock : AlertTriangle
  const heading =
    title ??
    (e.kind === 'network'
      ? 'Connexion impossible'
      : e.kind === 'forbidden'
        ? 'Accès non autorisé'
        : e.kind === 'not_found'
          ? 'Élément introuvable'
          : 'Une erreur est survenue')
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-4 py-6' : 'px-6 py-14',
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-red-50 text-brand-red-600">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="mt-3 text-base font-bold text-ink">{heading}</h3>
      <p className="mt-1 max-w-md text-sm text-mist-600">{e.message}</p>
      {onRetry && e.kind !== 'forbidden' && (
        <Button variant="secondary" size="sm" className="mt-4" icon={<RefreshCw className="h-4 w-4" />} onClick={onRetry}>
          Réessayer
        </Button>
      )}
    </div>
  )
}

/** Bandeau d'information/alerte en ligne. */
export function Callout({
  tone = 'info',
  title,
  children,
  icon,
  className,
  action,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success' | 'neutral'
  title?: ReactNode
  children?: ReactNode
  icon?: ReactNode
  className?: string
  action?: ReactNode
}) {
  const styles = {
    info: 'border-info-100 bg-info-50 text-info-700',
    warning: 'border-warning-100 bg-warning-50 text-warning-700',
    danger: 'border-brand-red-100 bg-brand-red-50 text-brand-red-700',
    success: 'border-success-100 bg-success-50 text-success-700',
    neutral: 'border-mist-200 bg-mist-50 text-mist-700',
  }[tone]
  return (
    <div className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', styles, className)} role={tone === 'danger' ? 'alert' : undefined}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn('leading-relaxed', title && 'mt-0.5 opacity-90')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-md', className)} aria-hidden />
}
