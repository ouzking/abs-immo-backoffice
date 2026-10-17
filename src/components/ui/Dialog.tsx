import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from './Button'

/**
 * Fenêtre modale basée sur l'élément natif <dialog> : piège du focus, touche
 * Échap et inertie du reste de la page sont fournis par le navigateur.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  variant = 'modal',
  dismissible = true,
  bare = false,
  className,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** « drawer » : panneau latéral droit plein écran en hauteur. */
  variant?: 'modal' | 'drawer'
  /** false pendant une opération en cours : Échap et clic extérieur sont ignorés. */
  dismissible?: boolean
  /** Sans en-tête ni marges : le contenu occupe tout le panneau (titre conservé pour les lecteurs d'écran). */
  bare?: boolean
  className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      if (typeof el.showModal === 'function') el.showModal()
      else el.setAttribute('open', '')
    } else if (!open && el.open) {
      if (typeof el.close === 'function') el.close()
      else el.removeAttribute('open')
    }
  }, [open])

  if (!open) return null

  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }[size]

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault()
        if (dismissible) onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose()
      }}
      className={cn(
        'm-0 max-h-none max-w-none bg-transparent p-0 text-ink backdrop:bg-transparent',
        variant === 'modal'
          ? 'fixed inset-0 hidden h-full w-full items-end justify-center open:flex sm:items-center sm:p-6'
          : 'fixed inset-0 hidden h-full w-full justify-end open:flex',
      )}
    >
      <div
        className={cn(
          'flex w-full flex-col bg-white shadow-lift',
          variant === 'modal'
            ? cn('max-h-[92dvh] animate-fade-up rounded-t-2xl sm:rounded-2xl', widths)
            : cn('h-full animate-slide-in-right', { sm: 'max-w-xs', md: 'sm:max-w-xl', lg: 'sm:max-w-2xl', xl: 'sm:max-w-3xl' }[size]),
          className,
        )}
      >
        {bare ? (
          <>
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
            <div className="min-h-0 flex-1">{children}</div>
          </>
        ) : (
          <>
        <header className="flex items-start justify-between gap-4 border-b border-mist-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-ink">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-mist-500">
                {description}
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} disabled={!dismissible} aria-label="Fermer">
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && (
          <footer className="flex flex-col-reverse gap-2 border-t border-mist-100 bg-mist-50/60 px-5 py-3.5 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </footer>
        )}
          </>
        )}
      </div>
    </dialog>
  )
}
