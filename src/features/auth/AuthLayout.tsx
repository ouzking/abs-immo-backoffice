import type { ReactNode } from 'react'
import { BarChart3, Building2, ShieldCheck, Users } from 'lucide-react'
import { HeroSlideshow } from '@/components/layout/HeroSlideshow'
import { Logo } from '@/components/layout/Logo'

const HIGHLIGHTS = [
  { icon: Building2, text: 'Annonces, photos et publication sur le site' },
  { icon: Users, text: 'Prospects, demandes et visites suivis de bout en bout' },
  { icon: BarChart3, text: "Indicateurs calculés en temps réel sur l'activité" },
  { icon: ShieldCheck, text: 'Accès cloisonnés selon le rôle de chacun' },
]

/** Mise en page des écrans d'authentification : panneau de marque + formulaire. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden overflow-hidden bg-navy-950 text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <HeroSlideshow />
        {/* Voile marine : lisibilité du texte sur la photo. */}
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-navy-950 via-navy-950/70 to-navy-900/30" aria-hidden />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-navy-950/60 to-transparent" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-brand-red-600" aria-hidden />
        <div className="relative">
          <div className="inline-flex rounded-2xl bg-white px-5 py-3 shadow-lift">
            <Logo className="h-14" />
          </div>
        </div>
        <div className="relative max-w-md">
          <p className="text-xs font-bold tracking-[0.2em] text-brand-red-200 uppercase">Espace professionnel</p>
          <h2 className="mt-3 font-display text-4xl leading-tight font-semibold xl:text-[44px]">
            Pilotez votre activité immobilière, en toute sérénité.
          </h2>
          <ul className="mt-10 space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[15px] text-navy-100">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-navy-300">© {new Date().getFullYear()} ABS IMMO &amp; SERVICES — accès réservé au personnel.</p>
      </aside>

      <main className="flex flex-col items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[420px] animate-fade-up">
          <div className="relative mb-8 h-36 overflow-hidden rounded-2xl bg-navy-900 shadow-lift lg:hidden">
            <HeroSlideshow />
            <div className="absolute inset-0 bg-linear-to-t from-navy-950/85 to-navy-900/10" aria-hidden />
            <div className="absolute bottom-3 left-3 rounded-xl bg-white px-3 py-1.5 shadow-lift">
              <Logo className="h-9" />
            </div>
          </div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-2 text-sm leading-relaxed text-mist-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  )
}
