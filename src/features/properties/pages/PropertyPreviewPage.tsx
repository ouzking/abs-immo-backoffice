import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Bath, BedDouble, ChevronLeft, ChevronRight, Eye, MapPin, Maximize2 } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Callout, ErrorState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { useAmenities, useLocalityTree, usePropertyTypes } from '@/features/reference/hooks'
import { formatNumber, formatPrice } from '@/lib/format'
import { COMMERCIAL_STATUSES, SURFACE_UNITS, TRANSACTION_TYPES, labelOf, toneOf } from '@/lib/labels'
import type { CommercialStatus } from '@/types'
import { Badge } from '@/components/ui/Badge'

const COMMERCIAL_EN: Record<CommercialStatus, string> = { available: 'Available', reserved: 'Under offer', sold: 'Sold', rented: 'Rented' }
import { getProperty, listPropertyAmenityCodes, listPropertyFeatures, listPropertyMedia } from '../api'
import { CommercialBadge, PublicationBadge } from '../components/PropertyBits'
import { propertyKeys, useSignedImageUrls } from '../hooks'

/**
 * Aperçu interne, proche du rendu public : seules les informations destinées
 * au site sont affichées (pas de notes internes, adresse selon sa visibilité).
 */
export function PropertyPreviewPage() {
  const { id = '' } = useParams()
  const property = useQuery({ queryKey: propertyKeys.detail(id), queryFn: () => getProperty(id) })
  const media = useQuery({ queryKey: propertyKeys.media(id), queryFn: () => listPropertyMedia(id) })
  const features = useQuery({ queryKey: propertyKeys.features(id), queryFn: () => listPropertyFeatures(id) })
  const amenityCodes = useQuery({ queryKey: propertyKeys.amenities(id), queryFn: () => listPropertyAmenityCodes(id) })
  const amenities = useAmenities()
  const types = usePropertyTypes()
  const { tree } = useLocalityTree()
  const signed = useSignedImageUrls((media.data ?? []).map((m) => m.storage_path))
  const [index, setIndex] = useState(0)
  // Aperçu de la version française ou anglaise (contrat 1.1.0), avec le même repli que le site.
  const [lang, setLang] = useState<'fr' | 'en'>('fr')

  const photos = useMemo(() => {
    const list = [...(media.data ?? [])]
    list.sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order)
    return list
  }, [media.data])

  if (property.error) return <ErrorState error={property.error} onRetry={() => void property.refetch()} />
  if (property.isLoading || !property.data) return <LoadingBlock />
  const p = property.data
  const current = photos[index]
  const currentUrl = current ? signed.data?.get(current.storage_path) : null
  const place = tree ? tree.chain(p.locality_id).map((l) => l.name).reverse().slice(0, 2).join(', ') : ''
  const en = lang === 'en'
  const amenityMap = new Map((amenities.data ?? []).map((a) => [a.code, (en && a.label_en) || a.label]))
  const type = types.data?.find((t) => t.code === p.property_type)
  const typeLabel = (en && type?.label_en) || type?.label || p.property_type
  const pick = (fr: string | null, english: string | null) => (en ? (english ?? fr) : fr)
  const missing = (english: string | null, fr: string | null) => en && !english && !!fr
  const notTranslated = <span className="ml-2 rounded bg-warning-50 px-1.5 py-0.5 align-middle font-sans text-[11px] font-semibold text-warning-700">not translated yet</span>
  const unit = labelOf(SURFACE_UNITS, p.surface_unit)

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Biens', to: '/biens' }, { label: p.reference, to: `/biens/${p.id}` }, { label: 'Aperçu' }]}
        title="Aperçu de l’annonce"
        meta={<PublicationBadge status={p.publication_status} />}
        actions={
          <>
            <div className="flex rounded-lg border border-mist-200 bg-white p-0.5 shadow-xs" role="group" aria-label="Langue de l’aperçu">
              {(['fr', 'en'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold ${lang === l ? 'bg-navy-700 text-white' : 'text-mist-600 hover:bg-mist-100'}`}
                >
                  {l === 'fr' ? 'Français' : 'English'}
                </button>
              ))}
            </div>
            <ButtonLink to={`/biens/${p.id}`}>Retour à la fiche</ButtonLink>
          </>
        }
      />
      {p.publication_status !== 'published' && (
        <Callout tone="info" icon={<Eye className="h-4 w-4" />} className="mb-6">
          Aperçu interne : cette annonce n’est pas visible sur le site public.
        </Callout>
      )}

      <article className="overflow-hidden rounded-card border border-mist-200 bg-white shadow-soft">
        <div className="relative aspect-[16/8] max-h-[520px] w-full bg-mist-100">
          {currentUrl ? (
            <img src={currentUrl} alt={current?.alt_text ?? p.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-mist-500">{photos.length ? 'Photo indisponible' : 'Aucune photo'}</div>
          )}
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)}
                className="absolute top-1/2 left-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow"
                aria-label="Photo précédente"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setIndex((i) => (i + 1) % photos.length)}
                className="absolute top-1/2 right-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow"
                aria-label="Photo suivante"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <span className="tabular absolute right-3 bottom-3 rounded-md bg-ink/75 px-2 py-1 text-xs font-semibold text-white">
                {index + 1} / {photos.length}
              </span>
            </>
          )}
          <div className="absolute top-3 left-3 flex gap-2">
            <span className="rounded-md bg-navy-800 px-2.5 py-1 text-xs font-bold text-white">{en ? (p.transaction_type === 'rent' ? 'For rent' : 'For sale') : labelOf(TRANSACTION_TYPES, p.transaction_type)}</span>
            {en ? (
              <Badge tone={toneOf(COMMERCIAL_STATUSES, p.commercial_status)}>{COMMERCIAL_EN[p.commercial_status]}</Badge>
            ) : (
              <CommercialBadge status={p.commercial_status} />
            )}
          </div>
        </div>

        <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:p-8">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-red-600">{typeLabel}</p>
            <h2 lang={en && p.title_en ? 'en' : 'fr'} className="mt-1 font-display text-3xl font-semibold text-ink">
              {pick(p.title, p.title_en)}
              {missing(p.title_en, p.title) && notTranslated}
            </h2>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-mist-600">
              <MapPin className="h-4 w-4" aria-hidden />
              {[p.location_label, place].filter(Boolean).join(' · ')}
              {p.address_visibility === 'exact' && p.address_line ? ` — ${p.address_line}` : ''}
            </p>
            <ul className="mt-5 flex flex-wrap gap-5 text-sm text-mist-700">
              {p.surface_area && (
                <li className="flex items-center gap-1.5">
                  <Maximize2 className="h-4 w-4 text-navy-500" aria-hidden /> {formatNumber(p.surface_area)} {unit}
                </li>
              )}
              {p.bedrooms !== null && (
                <li className="flex items-center gap-1.5">
                  <BedDouble className="h-4 w-4 text-navy-500" aria-hidden /> {p.bedrooms} chambre(s)
                </li>
              )}
              {p.bathrooms !== null && (
                <li className="flex items-center gap-1.5">
                  <Bath className="h-4 w-4 text-navy-500" aria-hidden /> {p.bathrooms} salle(s) de bain
                </li>
              )}
            </ul>
            {p.short_description && (
              <p className="mt-6 text-lg leading-relaxed text-mist-700">
                {pick(p.short_description, p.short_description_en)}
                {missing(p.short_description_en, p.short_description) && notTranslated}
              </p>
            )}
            {p.description && (
              <p className="mt-4 leading-relaxed whitespace-pre-line text-mist-700">
                {pick(p.description, p.description_en)}
                {missing(p.description_en, p.description) && notTranslated}
              </p>
            )}
            {(amenityCodes.data ?? []).length > 0 && (
              <>
                <h3 className="mt-8 font-bold">Équipements</h3>
                <ul className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                  {amenityCodes.data!.map((c) => (
                    <li key={c} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-red-600" aria-hidden />
                      {amenityMap.get(c) ?? c}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {(features.data ?? []).length > 0 && (
              <>
                <h3 className="mt-8 font-bold">Caractéristiques</h3>
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  {features.data!.map((f) => (
                    <div key={f.id} className="flex justify-between border-b border-mist-100 py-1.5 text-sm">
                      <dt className="text-mist-600">{f.label}</dt>
                      <dd className="font-semibold">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </div>
          <aside>
            <div className="rounded-xl border border-mist-200 bg-mist-50 p-5">
              <p className="text-xs font-semibold text-mist-500 uppercase">{p.transaction_type === 'rent' ? (en ? 'Rent' : 'Loyer') : en ? 'Price' : 'Prix'}</p>
              <p className="tabular mt-1 text-2xl font-extrabold text-navy-800">
                {formatPrice(p.price_amount, { rentPeriod: p.rent_period, onRequest: p.price_on_request })}
              </p>
              {p.price_negotiable && <p className="mt-1 text-xs text-mist-500">{en ? 'Negotiable' : 'Prix négociable'}</p>}
              <p className="mt-4 font-mono text-xs text-mist-500">Réf. {p.reference}</p>
            </div>
          </aside>
        </div>
      </article>
    </>
  )
}
