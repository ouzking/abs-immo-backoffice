import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

/** Photos de biens de l'agence (optimisées en WebP, dossier public/media). */
const BRAND_PHOTOS = [
  { src: '/media/residence-vue.webp', alt: 'Chambre lumineuse avec baie vitrée et vue dégagée' },
  { src: '/media/residence-cuisine.webp', alt: 'Cuisine équipée aux finitions marbre' },
  { src: '/media/residence-chambre.webp', alt: 'Chambre avec placard intégré et sol en marbre' },
  { src: '/media/residence-couloir.webp', alt: 'Couloir aux sols en marbre et éclairage indirect' },
] as const

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * Diaporama décoratif : fondu enchaîné + zoom lent (effet « Ken Burns »).
 * Statique si l'utilisateur a demandé moins d'animations ; en pause onglet masqué.
 */
export function HeroSlideshow({ interval = 6500, className }: { interval?: number; className?: string }) {
  const [index, setIndex] = useState(0)
  const [still] = useState(prefersReducedMotion)

  useEffect(() => {
    if (still) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') setIndex((i) => (i + 1) % BRAND_PHOTOS.length)
    }, interval)
    return () => window.clearInterval(id)
  }, [interval, still])

  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)} aria-hidden>
      {BRAND_PHOTOS.map((photo, i) => (
        <img
          key={photo.src}
          src={photo.src}
          alt=""
          decoding="async"
          fetchPriority={i === 0 ? 'high' : 'low'}
          loading={i === 0 ? 'eager' : 'lazy'}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-[1600ms] ease-out',
            i === index ? 'opacity-100' : 'opacity-0',
            i === index && !still && 'animate-ken-burns',
          )}
        />
      ))}
    </div>
  )
}

