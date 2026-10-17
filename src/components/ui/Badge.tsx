import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { Tone } from '@/lib/labels'

const tones: Record<Tone, { box: string; dot: string }> = {
  neutral: { box: 'bg-mist-100 text-mist-700 ring-mist-200', dot: 'bg-mist-400' },
  muted: { box: 'bg-mist-50 text-mist-500 ring-mist-200', dot: 'bg-mist-300' },
  navy: { box: 'bg-navy-50 text-navy-700 ring-navy-100', dot: 'bg-navy-500' },
  info: { box: 'bg-info-50 text-info-700 ring-info-100', dot: 'bg-info-600' },
  success: { box: 'bg-success-50 text-success-700 ring-success-100', dot: 'bg-success-600' },
  warning: { box: 'bg-warning-50 text-warning-700 ring-warning-100', dot: 'bg-warning-600' },
  danger: { box: 'bg-brand-red-50 text-brand-red-700 ring-brand-red-100', dot: 'bg-brand-red-600' },
}

export function Badge({
  tone = 'neutral',
  dot = true,
  children,
  className,
}: {
  tone?: Tone
  dot?: boolean
  children: ReactNode
  className?: string
}) {
  const t = tones[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset',
        t.box,
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', t.dot)} aria-hidden />}
      {children}
    </span>
  )
}
