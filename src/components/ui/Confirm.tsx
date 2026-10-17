/* eslint-disable react-refresh/only-export-components -- le fournisseur et son hook partagent le même contexte. */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { Field, Input } from './Form'

export interface ConfirmOptions {
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  /** Texte à recopier pour valider (opérations irréversibles). */
  requireText?: string
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/** Fournit `useConfirm()` : une confirmation explicite avant les opérations sensibles. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [typed, setTyped] = useState('')
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    resolver.current?.(false)
    setTyped('')
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setOptions(null)
  }

  const blocked = !!options?.requireText && typed.trim() !== options.requireText

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={!!options}
        onClose={() => close(false)}
        size="sm"
        title={
          <span className="flex items-center gap-2.5">
            {options?.tone === 'danger' && (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-red-50 text-brand-red-600">
                <AlertTriangle className="h-4 w-4" aria-hidden />
              </span>
            )}
            {options?.title}
          </span>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              {options?.cancelLabel ?? 'Annuler'}
            </Button>
            <Button
              variant={options?.tone === 'danger' ? 'danger' : 'primary'}
              disabled={blocked}
              onClick={() => close(true)}
              autoFocus={!options?.requireText}
            >
              {options?.confirmLabel ?? 'Confirmer'}
            </Button>
          </>
        }
      >
        {options?.description && <div className="text-sm leading-relaxed text-mist-700">{options.description}</div>}
        {options?.requireText && (
          <Field
            className="mt-4"
            label={
              <>
                Pour confirmer, saisissez <strong className="font-mono text-ink">{options.requireText}</strong>
              </>
            }
          >
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
          </Field>
        )}
      </Dialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm doit être utilisé dans <ConfirmProvider>.')
  return ctx
}
