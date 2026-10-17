import { cn } from '@/lib/cn'

/** Logo officiel ABS IMMO & SERVICES (fond transparent). */
export function Logo({ className, variant = 'color' }: { className?: string; variant?: 'color' | 'mono-light' }) {
  return (
    <picture>
      <source srcSet="/brand/logo-abs-immo-services-160.webp" type="image/webp" />
      <img
        src="/brand/logo-abs-immo-services-160.png"
        alt="ABS IMMO & SERVICES"
        width={282}
        height={160}
        className={cn('h-10 w-auto object-contain', variant === 'mono-light' && 'brightness-0 invert', className)}
      />
    </picture>
  )
}
