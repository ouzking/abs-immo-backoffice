import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  cloneElement,
  isValidElement,
} from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

const control =
  'block w-full rounded-lg border bg-white text-sm text-ink shadow-xs transition-colors placeholder:text-mist-400 hover:border-mist-400 focus:border-navy-500 focus:ring-2 focus:ring-navy-100 focus:outline-none disabled:cursor-not-allowed disabled:bg-mist-50 disabled:text-mist-500 read-only:bg-mist-50'

function controlClass(invalid: boolean | undefined, className?: string) {
  return cn(control, invalid ? 'border-brand-red-500 focus:border-brand-red-600 focus:ring-brand-red-100' : 'border-mist-300', className)
}

type ControlProps = { 'aria-invalid'?: boolean; 'aria-describedby'?: string; id?: string }

/**
 * Libellé + aide + message d'erreur, reliés au contrôle par aria-describedby.
 * L'enfant unique reçoit automatiquement id / aria-invalid / aria-describedby
 * (sauf si htmlFor est fourni : l'appelant passe alors id et aria-* au contrôle).
 */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  labelAction,
  htmlFor,
}: {
  label: ReactNode
  hint?: ReactNode
  error?: string
  required?: boolean
  children: ReactNode
  className?: string
  labelAction?: ReactNode
  htmlFor?: string
}) {
  const autoId = useId()
  const childId = isValidElement<ControlProps>(children) ? children.props.id : undefined
  const id = htmlFor ?? childId ?? autoId
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  // Seuls les contrôles de formulaire sont reliés au libellé ; avec htmlFor explicite,
  // l'appelant relie lui-même le contrôle (ex. champ enveloppé).
  const linkable =
    !!htmlFor ||
    (isValidElement(children) && (typeof children.type !== 'string' || ['input', 'select', 'textarea'].includes(children.type)))
  const control = !htmlFor && linkable && isValidElement<ControlProps>(children)
    ? cloneElement(children as ReactElement<ControlProps>, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })
    : children

  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        {linkable ? (
          <label htmlFor={id} className="text-[13px] font-semibold text-mist-700">
            {label}
            {required && (
              <span className="ml-0.5 text-brand-red-600" aria-hidden>
                *
              </span>
            )}
          </label>
        ) : (
          <span className="text-[13px] font-semibold text-mist-700">{label}</span>
        )}
        {labelAction}
      </div>
      {control}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs leading-relaxed text-mist-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-xs font-medium text-brand-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leading?: ReactNode
  trailing?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, leading, trailing, ...rest }, ref) {
  const invalid = rest['aria-invalid'] === true || rest['aria-invalid'] === 'true'
  if (!leading && !trailing) {
    return <input ref={ref} className={controlClass(invalid, cn('h-10 px-3', className))} {...rest} />
  }
  return (
    <div className="relative">
      {leading && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-mist-400">{leading}</span>
      )}
      <input
        ref={ref}
        className={controlClass(invalid, cn('h-10', leading ? 'pl-9' : 'pl-3', trailing ? 'pr-14' : 'pr-3', className))}
        {...rest}
      />
      {trailing && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-mist-500">
          {trailing}
        </span>
      )}
    </div>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 4, ...rest },
  ref,
) {
  const invalid = rest['aria-invalid'] === true || rest['aria-invalid'] === 'true'
  return <textarea ref={ref} rows={rows} className={controlClass(invalid, cn('px-3 py-2.5 leading-relaxed', className))} {...rest} />
})

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options?: Array<{ value: string; label: string; disabled?: boolean }>
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, options, placeholder, children, ...rest },
  ref,
) {
  const invalid = rest['aria-invalid'] === true || rest['aria-invalid'] === 'true'
  return (
    <div className="relative">
      <select ref={ref} className={controlClass(invalid, cn('h-10 appearance-none pr-9 pl-3', className))} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options?.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-mist-400" aria-hidden />
    </div>
  )
})

export const Checkbox = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode; description?: ReactNode }
>(function Checkbox({ label, description, className, id, ...rest }, ref) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <label htmlFor={inputId} className={cn('flex cursor-pointer items-start gap-2.5 text-sm', rest.disabled && 'cursor-not-allowed opacity-60', className)}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-mist-300 accent-navy-700"
        {...rest}
      />
      <span className="min-w-0">
        <span className="font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-mist-500">{description}</span>}
      </span>
    </label>
  )
})

/** Interrupteur accessible (role="switch"), contrôlé. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
  id?: string
}) {
  const autoId = useId()
  const switchId = id ?? autoId
  return (
    <div className={cn('flex items-start justify-between gap-4', disabled && 'opacity-60')}>
      <label htmlFor={switchId} className="min-w-0 cursor-pointer text-sm">
        <span className="font-semibold text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-mist-500">{description}</span>}
      </label>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed',
          checked ? 'bg-navy-700' : 'bg-mist-300',
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5.5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  )
}

/** Regroupe des champs avec un intitulé (fieldset). */
export function FieldGroup({
  legend,
  description,
  children,
  className,
}: {
  legend: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="text-sm font-bold text-ink">{legend}</legend>
      {description && <p className="mt-0.5 text-xs text-mist-500">{description}</p>}
      <div className="mt-3">{children}</div>
    </fieldset>
  )
}
