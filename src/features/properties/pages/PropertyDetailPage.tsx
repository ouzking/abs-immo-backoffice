import { useMemo } from 'react'
import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Eye, Pencil, Star } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, DetailList } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { env } from '@/config/env'
import { useAccess, useAuth } from '@/features/auth/AuthProvider'
import { useAmenities, useLocalityTree, usePropertyTypeLabels } from '@/features/reference/hooks'
import { formatDateTime, formatNumber, formatPrice } from '@/lib/format'
import { ADDRESS_VISIBILITIES, LEGAL_STATUSES, SURFACE_UNITS, TRANSACTION_TYPES, labelOf } from '@/lib/labels'
import { getProperty, listPropertyAmenityCodes, listPropertyFeatures, listPropertyMedia } from '../api'
import { DocumentsPanel } from '../components/DocumentsPanel'
import { PhotoManager } from '../components/PhotoManager'
import { CommercialBadge, PublicationBadge } from '../components/PropertyBits'
import { WorkflowPanel } from '../components/WorkflowPanel'
import { propertyKeys } from '../hooks'

export function PropertyDetailPage() {
  const { id = '' } = useParams()
  const { can } = useAuth()
  const access = useAccess()
  const property = useQuery({ queryKey: propertyKeys.detail(id), queryFn: () => getProperty(id) })
  const media = useQuery({ queryKey: propertyKeys.media(id), queryFn: () => listPropertyMedia(id) })
  const features = useQuery({ queryKey: propertyKeys.features(id), queryFn: () => listPropertyFeatures(id) })
  const amenityCodes = useQuery({ queryKey: propertyKeys.amenities(id), queryFn: () => listPropertyAmenityCodes(id) })
  const amenities = useAmenities()
  const typeLabels = usePropertyTypeLabels()
  const { tree } = useLocalityTree()

  const amenityLabels = useMemo(() => {
    const map = new Map((amenities.data ?? []).map((a) => [a.code, a.label]))
    return (amenityCodes.data ?? []).map((c) => map.get(c) ?? c)
  }, [amenities.data, amenityCodes.data])

  if (property.error) return <ErrorState error={property.error} onRetry={() => void property.refetch()} />
  if (property.isLoading || !property.data) return <LoadingBlock label="Chargement du bien…" />
  const p = property.data

  const canEdit =
    (can('properties.update_all') || (can('properties.update_own') && p.agent_id === access.user_id)) &&
    (p.publication_status !== 'archived' || can('properties.publish'))
  const unit = labelOf(SURFACE_UNITS, p.surface_unit)

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Biens', to: '/biens' }, { label: p.reference }]}
        title={
          <span className="flex items-start gap-2">
            {p.title}
            {p.is_featured && <Star className="mt-2 h-5 w-5 shrink-0 fill-brand-red-600 text-brand-red-600" aria-label="Mis en avant" />}
          </span>
        }
        meta={
          <>
            <span className="font-mono text-sm text-mist-600">{p.reference}</span>
            <PublicationBadge status={p.publication_status} />
            <CommercialBadge status={p.commercial_status} />
          </>
        }
        actions={
          <>
            {p.publication_status === 'published' && env.publicSiteUrl && (
              <a
                href={`${env.publicSiteUrl}/biens/${p.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-navy-700 hover:bg-navy-50"
              >
                Voir sur le site <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <ButtonLink to={`/biens/${p.id}/apercu`} icon={<Eye className="h-4 w-4" />}>
              Prévisualiser
            </ButtonLink>
            {canEdit && (
              <ButtonLink to={`/biens/${p.id}/modifier`} variant="primary" icon={<Pencil className="h-4 w-4" />}>
                Modifier
              </ButtonLink>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Photographies" description={`${media.data?.length ?? 0} photo(s). La photo principale illustre l’annonce sur le site.`} />
            <CardBody>
              <PhotoManager propertyId={p.id} canEdit={canEdit} publicationStatus={p.publication_status} defaultAlt={p.title} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Présentation" />
            <CardBody className="space-y-5">
              <DetailList
                items={[
                  { label: 'Prix', value: <span className="tabular text-base font-bold">{formatPrice(p.price_amount, { rentPeriod: p.rent_period, onRequest: p.price_on_request })}</span> },
                  { label: 'Conditions', value: [p.price_negotiable && 'Négociable', p.deposit_amount && `Caution ${formatNumber(p.deposit_amount)} FCFA`, p.agency_fee_amount && `Honoraires ${formatNumber(p.agency_fee_amount)} FCFA`].filter(Boolean).join(' · ') || '—' },
                  { label: 'Type', value: `${typeLabels[p.property_type] ?? p.property_type} · ${labelOf(TRANSACTION_TYPES, p.transaction_type)}` },
                  { label: 'Statut juridique', value: p.legal_status ? labelOf(LEGAL_STATUSES, p.legal_status) : '—' },
                  { label: 'Description courte', value: p.short_description || <em className="text-mist-400">Non renseignée</em>, full: true },
                  { label: 'Description', value: p.description ? <p className="whitespace-pre-line">{p.description}</p> : <em className="text-mist-400">Non renseignée</em>, full: true },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Caractéristiques et équipements" />
            <CardBody className="space-y-6">
              <DetailList
                className="sm:grid-cols-3"
                items={[
                  { label: 'Surface', value: p.surface_area ? `${formatNumber(p.surface_area)} ${unit}` : '—' },
                  { label: 'Terrain', value: p.land_area ? `${formatNumber(p.land_area)} ${unit}` : '—' },
                  { label: 'Chambres', value: p.bedrooms ?? '—' },
                  { label: 'Salles de bain', value: p.bathrooms ?? '—' },
                  { label: 'Pièces', value: p.rooms ?? '—' },
                  { label: 'Toilettes', value: p.toilets ?? '—' },
                  { label: 'Étage', value: p.floor ?? '—' },
                  { label: 'Parking', value: p.parking_spaces ?? '—' },
                  { label: 'Meublé', value: p.is_furnished === null ? '—' : p.is_furnished ? 'Oui' : 'Non' },
                  { label: 'Construction', value: p.year_built ?? '—' },
                ]}
              />
              {amenityLabels.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-mist-500 uppercase">Équipements</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {amenityLabels.map((a) => (
                      <li key={a} className="rounded-full bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-700">
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(features.data ?? []).length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-mist-500 uppercase">Caractéristiques</p>
                  <dl className="grid gap-2 sm:grid-cols-2">
                    {features.data!.map((f) => (
                      <div key={f.id} className="flex justify-between gap-3 rounded-lg bg-mist-50 px-3 py-2 text-sm">
                        <dt className="text-mist-600">{f.label}</dt>
                        <dd className="font-semibold">{f.value ?? '—'}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Localisation" />
            <CardBody>
              <DetailList
                items={[
                  { label: 'Localité', value: tree?.label(p.locality_id) ?? '…' },
                  { label: 'Repère public', value: p.location_label ?? '—' },
                  { label: 'Adresse (interne)', value: p.address_line ?? '—' },
                  { label: 'Coordonnées', value: p.latitude !== null ? `${p.latitude}, ${p.longitude}` : '—' },
                  { label: 'Visibilité sur le site', value: labelOf(ADDRESS_VISIBILITIES, p.address_visibility), full: true },
                ]}
              />
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-6">
          <WorkflowPanel property={p} media={media.data} />
          <Card>
            <CardHeader title="Suivi" />
            <CardBody>
              <DetailList
                className="sm:grid-cols-1"
                items={[
                  { label: 'Agent responsable', value: p.agent?.display_name ?? <em className="text-mist-400">Non affecté</em> },
                  { label: 'Créé par', value: p.creator?.full_name || '—' },
                  { label: 'Création', value: formatDateTime(p.created_at) },
                  { label: 'Dernière modification', value: formatDateTime(p.updated_at) },
                  { label: 'Première publication', value: formatDateTime(p.published_at) },
                  { label: 'Statut commercial modifié', value: formatDateTime(p.status_changed_at) },
                ]}
              />
              {p.internal_notes && (
                <div className="mt-4 rounded-lg border border-warning-100 bg-warning-50 p-3 text-sm text-warning-700">
                  <p className="text-xs font-bold uppercase">Notes internes</p>
                  <p className="mt-1 whitespace-pre-line">{p.internal_notes}</p>
                </div>
              )}
            </CardBody>
          </Card>
          {canEdit && <DocumentsPanel propertyId={p.id} />}
        </aside>
      </div>
    </>
  )
}
