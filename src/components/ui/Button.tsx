import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline' | 'accent'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-150 select-none disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-500'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-navy-700 text-white shadow-sm hover:bg-navy-800 active:bg-navy-900',
  accent: 'bg-brand-red-600 text-white shadow-sm hover:bg-brand-red-700 active:bg-brand-red-800',
  secondary: 'border border-mist-300 bg-white text-ink shadow-xs hover:border-mist-400 hover:bg-mist-50',
  ghost: 'text-mist-700 hover:bg-mist-100 hover:text-ink',
  danger: 'bg-brand-red-600 text-white shadow-sm hover:bg-brand-red-700',
  'danger-outline': 'border border-brand-red-200 bg-white text-brand-red-700 hover:bg-brand-red-50',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-[15px]',
  icon: 'h-10 w-10',
  'icon-sm': 'h-8 w-8',
}

function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string): string {
  return cn(base, variants[variant], sizes[size], className)
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner className="h-4 w-4" /> : icon}
      {children}
    </button>
  )
})

export interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
}

export function ButtonLink({ variant = 'secondary', size = 'md', icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  )
}
