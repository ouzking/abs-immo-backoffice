import { Link } from 'react-router'
import { ArrowRight, CalendarClock, Inbox, Plus } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { formatNumber } from '@/lib/format'

const today = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Dakar' })

/** Bandeau d'accueil : salutation, date et priorités du moment (chiffres réels). */
export function DashboardHero({
  greeting,
  description,
  pendingInquiries,
  pendingViewings,
  canCreate,
  canLeads,
}: {
  greeting: string
  description: string
  pendingInquiries: number | undefined
  pendingViewings: number | undefined
  canCreate: boolean
  canLeads: boolean
}) {
  return (
    <section className="relative mb-6 overflow-hidden rounded-card bg-navy-900 text-white shadow-lift">
      <picture>
        <source media="(max-width: 640px)" srcSet="/media/residence-vue-480.webp" />
        <img
          src="/media/residence-vue.webp"
          alt=""
          aria-hidden
          className="absolute inset-y-0 right-0 h-full w-full object-cover opacity-80 sm:w-3/5"
        />
      </picture>
      <div className="absolute inset-0 bg-linear-to-r from-navy-950 via-navy-900/90 to-navy-900/10" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 h-1 bg-brand-red-600" aria-hidden />

      <div className="relative flex flex-col gap-6 px-6 py-7 sm:px-8 sm:py-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <p className="text-xs font-bold tracking-[0.18em] text-brand-red-200 uppercase first-letter:uppercase">{today.format(new Date())}</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-[34px]">{greeting}</h1>
          <p className="mt-2 text-sm leading-relaxed text-navy-100">{description}</p>
          {canCreate && (
            <ButtonLink to="/biens/nouveau" variant="accent" className="mt-5" icon={<Plus className="h-4 w-4" />}>
              Nouveau bien
            </ButtonLink>
          )}
        </div>

        {canLeads && (
          <div className="grid grid-cols-2 gap-3 sm:w-[380px]">
            <Link
              to="/demandes"
              className="group rounded-xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/15"
            >
              <span className="flex items-center gap-2 text-xs font-semibold text-navy-100">
                <Inbox className="h-4 w-4" aria-hidden /> À traiter
              </span>
              <span className="tabular mt-1 block text-3xl font-extrabold">{formatNumber(pendingInquiries)}</span>
              <span className="mt-1 flex items-center gap-1 text-xs text-navy-200 group-hover:text-white">
                Nouvelles demandes <ArrowRight className="h-3 w-3" aria-hidden />
              </span>
            </Link>
            <Link
              to="/visites"
              className="group rounded-xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/15"
            >
              <span className="flex items-center gap-2 text-xs font-semibold text-navy-100">
                <CalendarClock className="h-4 w-4" aria-hidden /> À confirmer
              </span>
              <span className="tabular mt-1 block text-3xl font-extrabold">{formatNumber(pendingViewings)}</span>
              <span className="mt-1 flex items-center gap-1 text-xs text-navy-200 group-hover:text-white">
                Demandes de visite <ArrowRight className="h-3 w-3" aria-hidden />
              </span>
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
