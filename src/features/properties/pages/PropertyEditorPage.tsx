import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Eye, Globe2, ImagePlus, Lock, Save, Send } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Form'
import { PageHeader } from '@/components/ui/PageHeader'
import { Callout, ErrorState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { useAccess, useAuth } from '@/features/auth/AuthProvider'
import { useAgentOptions, usePropertyTypes } from '@/features/reference/hooks'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { cn } from '@/lib/cn'
import { toAppError } from '@/lib/errors'
import { formatPrice } from '@/lib/format'
import {
  ADDRESS_VISIBILITIES,
  COMMERCIAL_STATUSES,
  LEGAL_STATUSES,
  PUBLICATION_STATUSES,
  RENT_PERIODS,
  SURFACE_UNITS,
  TRANSACTION_TYPES,
  labelOf,
  optionsOf,
} from '@/lib/labels'
import { BUSINESS_RULE_HINTS, type Property, type PropertyFeature, type PropertyInsert, type PublicationStatus } from '@/types'
import {
  createProperty,
  getProperty,
  listPropertyAmenityCodes,
  listPropertyFeatures,
  setPropertyAmenities,
  setPublicationStatus,
  syncFeatures,
  updateProperty,
  type PropertyDetail,
} from '../api'
import { EnglishSection } from '../components/EnglishSection'
import { AmenitiesPicker, CharCount, FeaturesEditor, FormSection, LocalityPicker } from '../components/FormParts'
import { PhotoManager } from '../components/PhotoManager'
import { PublicationBadge } from '../components/PropertyBits'
import { propertyKeys, useInvalidateProperty } from '../hooks'
import { emptyPropertyForm, propertyFormSchema, propertyToForm, toPropertyPayload, type PropertyFormValues } from '../schema'

const SECTIONS = [
  { id: 'general', title: 'Informations générales', fields: ['agent_id', 'internal_notes'] },
  { id: 'texte', title: 'Titre et description', fields: ['title', 'short_description', 'description'] },
  { id: 'type', title: 'Type de bien', fields: ['property_type'] },
  { id: 'transaction', title: 'Vente ou location', fields: ['transaction_type', 'rent_period'] },
  { id: 'prix', title: 'Prix et conditions', fields: ['price_amount', 'deposit_amount', 'agency_fee_amount'] },
  { id: 'localisation', title: 'Localisation', fields: ['region_id', 'location_label', 'address_line', 'latitude', 'longitude'] },
  {
    id: 'caracteristiques',
    title: 'Surface et caractéristiques',
    fields: ['surface_area', 'land_area', 'bedrooms', 'bathrooms', 'rooms', 'toilets', 'floor', 'total_floors', 'parking_spaces', 'year_built', 'features'],
  },
  { id: 'equipements', title: 'Équipements', fields: [] },
  { id: 'photos', title: 'Photographies', fields: [] },
  { id: 'seo', title: 'Référencement SEO', fields: ['seo_title', 'seo_description', 'slug'] },
  { id: 'anglais', title: 'Version anglaise', fields: ['title_en', 'short_description_en', 'description_en', 'seo_title_en', 'seo_description_en'] },
  { id: 'publication', title: 'Publication', fields: ['commercial_status'] },
] as const

function sectionHasError(errors: FieldErrors<PropertyFormValues>, fields: readonly string[]): boolean {
  return fields.some((f) => f in errors)
}

export function PropertyEditorPage() {
  const { id } = useParams()
  return id ? <EditExisting key={id} id={id} /> : <PropertyForm />
}

function EditExisting({ id }: { id: string }) {
  const property = useQuery({ queryKey: propertyKeys.detail(id), queryFn: () => getProperty(id) })
  const amenities = useQuery({ queryKey: propertyKeys.amenities(id), queryFn: () => listPropertyAmenityCodes(id) })
  const features = useQuery({ queryKey: propertyKeys.features(id), queryFn: () => listPropertyFeatures(id) })
  const all = [property, amenities, features]
  const error = all.find((r) => r.error)?.error
  if (error) return <ErrorState error={error} onRetry={() => all.forEach((r) => void r.refetch())} />
  if (!property.data || !amenities.data || !features.data) return <LoadingBlock label="Chargement du bien…" />
  return (
    <PropertyForm
      key={`${property.data.id}-${property.data.updated_at}`}
      property={property.data}
      amenities={amenities.data}
      features={features.data}
    />
  )
}

function PropertyForm({ property, amenities, features }: { property?: PropertyDetail; amenities?: string[]; features?: PropertyFeature[] }) {
  const isCreate = !property
  const access = useAccess()
  const { can } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const invalidate = useInvalidateProperty()
  const types = usePropertyTypes()
  const agents = useAgentOptions()
  const [saving, setSaving] = useState<null | 'save' | PublicationStatus>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const canPublish = can('properties.publish')
  const canAssignAgent = can('properties.update_all')
  const canEdit = isCreate
    ? can('properties.create')
    : (can('properties.update_all') || (can('properties.update_own') && property.agent_id === access.user_id)) &&
      (property.publication_status !== 'archived' || canPublish)

  const defaults = useMemo<PropertyFormValues>(() => {
    if (property) return propertyToForm(property, amenities ?? [], (features ?? []).map((f) => ({ id: f.id, label: f.label, value: f.value ?? '' })))
    return { ...emptyPropertyForm(), agent_id: access.is_agent ? access.user_id : '' }
  }, [property, amenities, features, access])

  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<PropertyFormValues>({ resolver: zodResolver(propertyFormSchema), defaultValues: defaults, mode: 'onTouched' })

  useUnsavedChangesGuard(isDirty && saving === null)

  // Arrivée sur une ancre (ex. #photos après la création du brouillon).
  const location = useLocation()
  useEffect(() => {
    if (!location.hash) return
    const t = window.setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 150)
    return () => window.clearTimeout(t)
  }, [location.hash])

  const [transaction, priceOnRequest, propertyType, title, shortDesc, description, seoTitle, seoDescription, slug, priceAmount, rentPeriod] = useWatch({
    control,
    name: ['transaction_type', 'price_on_request', 'property_type', 'title', 'short_description', 'description', 'seo_title', 'seo_description', 'slug', 'price_amount', 'rent_period'],
  })
  const typeInfo = types.data?.find((t) => t.code === propertyType)
  const isLand = !!typeInfo?.is_land

  const save = async (values: PropertyFormValues, then: 'save' | PublicationStatus) => {
    setFormError(null)
    setSaving(then)
    const payload = toPropertyPayload(values, { isLand, canAssignAgent, canPublish, isCreate })
    let saved: Property
    try {
      if (isCreate) {
        saved = await createProperty({ ...payload, publication_status: 'draft' } as PropertyInsert)
      } else {
        saved = await updateProperty(property.id, payload)
      }
    } catch (e) {
      setSaving(null)
      const err = toAppError(e)
      setFormError(err.message)
      toast.error('Enregistrement impossible', { description: err.message })
      return
    }

    // Équipements et caractéristiques : tables liées, enregistrées après le bien.
    const warnings: string[] = []
    try {
      const before = [...(amenities ?? [])].sort().join(',')
      if (isCreate ? values.amenities.length > 0 : before !== [...values.amenities].sort().join(',')) {
        await setPropertyAmenities(saved.id, values.amenities)
      }
    } catch (e) {
      warnings.push(`Équipements non enregistrés : ${toAppError(e).message}`)
    }
    try {
      await syncFeatures(saved.id, features ?? [], values.features)
    } catch (e) {
      warnings.push(`Caractéristiques non enregistrées : ${toAppError(e).message}`)
    }

    // Changement de statut demandé après l'enregistrement.
    if (then !== 'save' && saved.publication_status !== then) {
      try {
        saved = await setPublicationStatus(saved.id, then)
        toast.success(then === 'published' ? 'Annonce enregistrée et publiée.' : 'Annonce enregistrée et soumise à validation.')
      } catch (e) {
        const err = toAppError(e)
        const msg =
          err.hint === BUSINESS_RULE_HINTS.PUBLISH_REQUIRES_COVER
            ? 'Ajoutez au moins une photo (section 9) avant de publier.'
            : err.hint === BUSINESS_RULE_HINTS.PUBLISH_REQUIRES_SHORT_DESCRIPTION
              ? 'La description courte doit contenir au moins 20 caractères pour publier.'
              : err.message
        warnings.push(`Modifications enregistrées, mais ${then === 'published' ? 'publication' : 'soumission'} refusée : ${msg}`)
      }
    } else {
      toast.success(isCreate ? 'Brouillon créé.' : 'Modifications enregistrées.', {
        description: isCreate ? 'Ajoutez maintenant les photos du bien.' : undefined,
      })
    }
    if (warnings.length) toast.warning('Enregistrement partiel', { description: warnings.join(' · '), duration: 10000 })

    invalidate(saved.id)
    void qc.invalidateQueries({ queryKey: propertyKeys.features(saved.id) })
    void qc.invalidateQueries({ queryKey: propertyKeys.amenities(saved.id) })
    reset(values)
    setSaving(null)
    if (isCreate) navigate(`/biens/${saved.id}/modifier#photos`, { replace: true })
  }

  const onInvalid = () => {
    setFormError('Certains champs sont à corriger (sections signalées en rouge).')
    toast.error('Formulaire incomplet', { description: 'Corrigez les champs signalés avant d’enregistrer.' })
  }

  const submit = (then: 'save' | PublicationStatus) => handleSubmit((v) => save(v, then), onInvalid)
  const status = property?.publication_status ?? 'draft'
  const typeOptions = (types.data ?? []).filter((t) => t.is_active || t.code === propertyType).map((t) => ({ value: t.code, label: t.label }))

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Biens', to: '/biens' },
          ...(property ? [{ label: property.reference, to: `/biens/${property.id}` }] : []),
          { label: isCreate ? 'Nouveau bien' : 'Modifier' },
        ]}
        title={isCreate ? 'Nouveau bien' : property.title}
        description={
          isCreate
            ? 'Le bien est créé en brouillon : il n’apparaît sur le site qu’après publication par un responsable.'
            : 'Les modifications d’une annonce publiée sont visibles sur le site dès leur enregistrement.'
        }
        meta={property && <PublicationBadge status={property.publication_status} />}
        actions={
          property && (
            <ButtonLink to={`/biens/${property.id}/apercu`} icon={<Eye className="h-4 w-4" />}>
              Prévisualiser
            </ButtonLink>
          )
        }
      />

      {!canEdit && (
        <Callout tone="warning" icon={<Lock className="h-4 w-4" />} className="mb-6" title="Lecture seule">
          {property?.publication_status === 'archived'
            ? 'Ce bien est archivé : seul un responsable peut le modifier.'
            : 'Vous ne pouvez modifier que les biens dont vous êtes l’agent responsable.'}
        </Callout>
      )}

      <form onSubmit={submit('save')} noValidate className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Navigation entre sections */}
        <nav aria-label="Sections du formulaire" className="hidden lg:block">
          <ol className="sticky top-24 space-y-0.5">
            {SECTIONS.map((s, i) => {
              const bad = sectionHasError(errors, s.fields)
              return (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium hover:bg-white',
                      bad ? 'text-brand-red-700' : 'text-mist-600 hover:text-ink',
                    )}
                  >
                    <span
                      className={cn(
                        'tabular flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                        bad ? 'bg-brand-red-600 text-white' : 'bg-mist-200 text-mist-700',
                      )}
                    >
                      {i + 1}
                    </span>
                    {s.title}
                  </a>
                </li>
              )
            })}
          </ol>
        </nav>

        <fieldset disabled={!canEdit || saving !== null} className="min-w-0 space-y-6">
          {formError && <Callout tone="danger">{formError}</Callout>}

          {/* 1 */}
          <FormSection id="general" index={1} title="Informations générales" hasError={sectionHasError(errors, SECTIONS[0].fields)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Référence" hint="Générée automatiquement à la création (ex. ABS-V-2600001).">
                <Input value={property?.reference ?? 'Attribuée à l’enregistrement'} readOnly className="font-mono" />
              </Field>
              <Field
                label="Agent responsable"
                hint={canAssignAgent ? 'Seuls les agents actifs peuvent être responsables.' : 'Seul un responsable peut changer l’agent.'}
                error={errors.agent_id?.message}
              >
                {canAssignAgent ? (
                  <Select
                    placeholder="Aucun agent"
                    options={(agents.data ?? []).filter((a) => a.is_active || a.profile_id === property?.agent_id).map((a) => ({ value: a.profile_id, label: a.display_name }))}
                    {...register('agent_id')}
                  />
                ) : (
                  <Input value={property?.agent?.display_name ?? (access.is_agent ? access.full_name : 'Non affecté')} readOnly />
                )}
              </Field>
              <Field
                className="sm:col-span-2"
                label="Notes internes"
                hint="Visibles uniquement dans le back-office, jamais sur le site."
                error={errors.internal_notes?.message}
              >
                <Textarea rows={3} {...register('internal_notes')} />
              </Field>
            </div>
          </FormSection>

          {/* 2 */}
          <FormSection id="texte" index={2} title="Titre et description" hasError={sectionHasError(errors, SECTIONS[1].fields)}>
            <div className="space-y-4">
              <Field label="Titre de l’annonce" required error={errors.title?.message} labelAction={<CharCount value={title} max={160} min={5} />}>
                <Input placeholder="Ex. Villa contemporaine avec piscine aux Almadies" maxLength={160} {...register('title')} />
              </Field>
              <Field
                label="Description courte"
                hint="Résumé affiché sur les cartes du site. Au moins 20 caractères pour pouvoir publier."
                error={errors.short_description?.message}
                labelAction={<CharCount value={shortDesc} max={300} min={20} />}
              >
                <Textarea rows={2} maxLength={300} {...register('short_description')} />
              </Field>
              <Field label="Description détaillée" error={errors.description?.message} labelAction={<CharCount value={description} max={20000} />}>
                <Textarea rows={8} {...register('description')} />
              </Field>
            </div>
          </FormSection>

          {/* 3 */}
          <FormSection id="type" index={3} title="Type de bien" hasError={sectionHasError(errors, SECTIONS[2].fields)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type" required error={errors.property_type?.message} hint={isLand ? 'Terrain : chambres et salles de bain ne s’appliquent pas.' : undefined}>
                <Select placeholder="Choisir…" options={typeOptions} {...register('property_type')} />
              </Field>
              <Field label="Statut juridique">
                <Select placeholder="Non renseigné" options={optionsOf(LEGAL_STATUSES)} {...register('legal_status')} />
              </Field>
            </div>
          </FormSection>

          {/* 4 */}
          <FormSection id="transaction" index={4} title="Vente ou location" hasError={sectionHasError(errors, SECTIONS[3].fields)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Transaction" required>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Transaction">
                  {(['sale', 'rent'] as const).map((t) => (
                    <label
                      key={t}
                      className={cn(
                        'flex h-10 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold',
                        transaction === t ? 'border-navy-600 bg-navy-50 text-navy-800' : 'border-mist-300 bg-white text-mist-700 hover:bg-mist-50',
                      )}
                    >
                      <input type="radio" value={t} className="sr-only" {...register('transaction_type')} />
                      {labelOf(TRANSACTION_TYPES, t)}
                    </label>
                  ))}
                </div>
              </Field>
              {transaction === 'rent' && (
                <Field label="Période du loyer" required error={errors.rent_period?.message}>
                  <Select placeholder="Choisir…" options={optionsOf(RENT_PERIODS)} {...register('rent_period')} />
                </Field>
              )}
            </div>
            {property && property.transaction_type !== transaction && (
              <Callout tone="warning" className="mt-4">
                La référence ({property.reference}) reste inchangée après un changement de transaction.
              </Callout>
            )}
          </FormSection>

          {/* 5 */}
          <FormSection id="prix" index={5} title="Prix et conditions" description="Montants en FCFA, sans décimales." hasError={sectionHasError(errors, SECTIONS[4].fields)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={transaction === 'rent' ? 'Loyer' : 'Prix de vente'}
                required={!priceOnRequest}
                error={errors.price_amount?.message}
                hint={!priceOnRequest && priceAmount ? `Affiché : ${formatPrice(Number(priceAmount.replace(/\s/g, '')) || null, { rentPeriod: transaction === 'rent' ? rentPeriod || null : null })}` : undefined}
              >
                <Input inputMode="numeric" trailing="FCFA" disabled={priceOnRequest} placeholder="Ex. 150 000 000" {...register('price_amount')} />
              </Field>
              <div className="space-y-3 sm:pt-7">
                <Checkbox label="Prix sur demande" description="Le prix n’est pas affiché sur le site." {...register('price_on_request')} />
                <Checkbox label="Prix négociable" {...register('price_negotiable')} />
              </div>
              {transaction === 'rent' && (
                <Field label="Caution / dépôt de garantie" error={errors.deposit_amount?.message}>
                  <Input inputMode="numeric" trailing="FCFA" {...register('deposit_amount')} />
                </Field>
              )}
              <Field label="Honoraires d’agence" error={errors.agency_fee_amount?.message}>
                <Input inputMode="numeric" trailing="FCFA" {...register('agency_fee_amount')} />
              </Field>
            </div>
          </FormSection>

          {/* 6 */}
          <FormSection id="localisation" index={6} title="Localisation" hasError={sectionHasError(errors, SECTIONS[5].fields)}>
            <div className="space-y-4">
              <LocalityPicker control={control} setValue={setValue} errors={errors} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Repère public" hint="Affiché sur le site, ex. « Proche VDN »." error={errors.location_label?.message}>
                  <Input maxLength={160} {...register('location_label')} />
                </Field>
                <Field label="Adresse exacte" hint="Interne ; publiée seulement si la visibilité est « exacte »." error={errors.address_line?.message}>
                  <Input maxLength={300} {...register('address_line')} />
                </Field>
                <Field label="Latitude" error={errors.latitude?.message}>
                  <Input inputMode="decimal" placeholder="14.7167" {...register('latitude')} />
                </Field>
                <Field label="Longitude" error={errors.longitude?.message}>
                  <Input inputMode="decimal" placeholder="-17.4677" {...register('longitude')} />
                </Field>
                <Field className="sm:col-span-2" label="Visibilité de l’adresse sur le site">
                  <Select options={optionsOf(ADDRESS_VISIBILITIES)} {...register('address_visibility')} />
                </Field>
              </div>
            </div>
          </FormSection>

          {/* 7 */}
          <FormSection id="caracteristiques" index={7} title="Surface et caractéristiques" hasError={sectionHasError(errors, SECTIONS[6].fields)}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Field className="col-span-2 md:col-span-1" label="Surface" error={errors.surface_area?.message}>
                <Input inputMode="decimal" {...register('surface_area')} />
              </Field>
              <Field label="Unité">
                <Select options={optionsOf(SURFACE_UNITS)} {...register('surface_unit')} />
              </Field>
              <Field label="Surface du terrain" error={errors.land_area?.message}>
                <Input inputMode="decimal" {...register('land_area')} />
              </Field>
              <Field label="Année de construction" error={errors.year_built?.message}>
                <Input inputMode="numeric" {...register('year_built')} />
              </Field>
              {!isLand && (
                <>
                  <Field label="Chambres" error={errors.bedrooms?.message}>
                    <Input inputMode="numeric" {...register('bedrooms')} />
                  </Field>
                  <Field label="Salles de bain" error={errors.bathrooms?.message}>
                    <Input inputMode="numeric" {...register('bathrooms')} />
                  </Field>
                  <Field label="Pièces" error={errors.rooms?.message}>
                    <Input inputMode="numeric" {...register('rooms')} />
                  </Field>
                  <Field label="Toilettes" error={errors.toilets?.message}>
                    <Input inputMode="numeric" {...register('toilets')} />
                  </Field>
                </>
              )}
              <Field label="Étage" error={errors.floor?.message}>
                <Input inputMode="numeric" {...register('floor')} />
              </Field>
              <Field label="Nombre d’étages" error={errors.total_floors?.message}>
                <Input inputMode="numeric" {...register('total_floors')} />
              </Field>
              <Field label="Places de parking" error={errors.parking_spaces?.message}>
                <Input inputMode="numeric" {...register('parking_spaces')} />
              </Field>
              <Field label="Meublé">
                <Select
                  options={[
                    { value: '', label: 'Non précisé' },
                    { value: 'true', label: 'Oui' },
                    { value: 'false', label: 'Non' },
                  ]}
                  {...register('is_furnished')}
                />
              </Field>
            </div>
            <div className="mt-6 border-t border-mist-100 pt-5">
              <FeaturesEditor control={control} register={register} errors={errors} disabled={!canEdit} />
            </div>
          </FormSection>

          {/* 8 */}
          <FormSection id="equipements" index={8} title="Équipements">
            <AmenitiesPicker control={control} setValue={setValue} disabled={!canEdit} />
          </FormSection>

          {/* 9 */}
          <FormSection
            id="photos"
            index={9}
            title="Photographies"
            description="Stockées dans un espace privé : elles ne deviennent visibles sur le site qu’une fois l’annonce publiée."
          >
            {property ? (
              <PhotoManager propertyId={property.id} canEdit={canEdit} publicationStatus={property.publication_status} defaultAlt={property.title} />
            ) : (
              <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-mist-300 bg-mist-50/60 p-5 sm:flex-row sm:items-center">
                <ImagePlus className="h-6 w-6 shrink-0 text-navy-500" aria-hidden />
                <p className="flex-1 text-sm text-mist-600">Les photos s’ajoutent une fois le brouillon enregistré (elles sont rangées dans le dossier du bien).</p>
                <Button type="submit" variant="secondary" loading={saving === 'save'} icon={<Save className="h-4 w-4" />}>
                  Enregistrer et ajouter des photos
                </Button>
              </div>
            )}
          </FormSection>

          {/* 10 */}
          <FormSection id="seo" index={10} title="Référencement SEO" description="Facultatif : à défaut, le titre et la description courte sont utilisés." hasError={sectionHasError(errors, SECTIONS[9].fields)}>
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="space-y-4">
                <Field label="Titre SEO" error={errors.seo_title?.message} labelAction={<CharCount value={seoTitle} max={120} />}>
                  <Input maxLength={120} placeholder={title} {...register('seo_title')} />
                </Field>
                <Field label="Description SEO" error={errors.seo_description?.message} labelAction={<CharCount value={seoDescription} max={320} />}>
                  <Textarea rows={3} maxLength={320} placeholder={shortDesc} {...register('seo_description')} />
                </Field>
                {property && (
                  <Field
                    label="Adresse web (slug)"
                    error={errors.slug?.message}
                    hint="Changer le slug d’une annonce publiée casse les liens déjà partagés."
                  >
                    <Input className="font-mono text-[13px]" {...register('slug')} />
                  </Field>
                )}
              </div>
              <div>
                <p className="mb-1.5 text-[13px] font-semibold text-mist-700">Aperçu dans les résultats de recherche</p>
                <div className="rounded-xl border border-mist-200 bg-white p-4">
                  <p className="truncate text-xs text-success-700">abs-immo.sn › biens › {slug || '…'}</p>
                  <p className="mt-1 line-clamp-1 text-lg text-info-700">{seoTitle || title || 'Titre de l’annonce'}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-mist-600">{seoDescription || shortDesc || 'Description courte de l’annonce.'}</p>
                </div>
              </div>
            </div>
          </FormSection>

          {/* 11 */}
          <EnglishSection register={register} control={control} errors={errors} hasError={sectionHasError(errors, SECTIONS[10].fields)} />

          {/* 12 */}
          <FormSection id="publication" index={12} title="Publication" hasError={sectionHasError(errors, SECTIONS[11].fields)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Statut de publication" hint="Les changements de publication se font avec les boutons ci-dessous ou depuis la fiche du bien.">
                <div className="flex h-10 items-center">
                  <PublicationBadge status={status} />
                </div>
              </Field>
              <Field
                label="Statut commercial"
                error={errors.commercial_status?.message}
                hint="Un bien vendu ou loué reste visible sur le site avec ce statut, jamais comme disponible."
              >
                <Select
                  options={optionsOf(COMMERCIAL_STATUSES).filter(
                    (o) => !(o.value === 'sold' && transaction !== 'sale') && !(o.value === 'rented' && transaction !== 'rent'),
                  )}
                  {...register('commercial_status')}
                />
              </Field>
              {canPublish && (
                <div className="sm:col-span-2">
                  <Checkbox
                    label="Mettre en avant sur le site"
                    description="L’annonce apparaît dans la sélection « À la une » lorsqu’elle est publiée."
                    {...register('is_featured')}
                  />
                </div>
              )}
            </div>
            {!isCreate && status !== 'published' && (
              <p className="mt-4 text-sm text-mist-500">
                Pour publier : description courte d’au moins 20 caractères et au moins une photo principale.
              </p>
            )}
          </FormSection>
        </fieldset>

        {/* Barre d'actions */}
        {canEdit && (
          <div className="sticky bottom-0 z-10 -mx-4 border-t border-mist-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:col-span-2 lg:-mx-8 lg:px-8">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              <p className="mr-auto hidden text-xs text-mist-500 sm:block">
                {isDirty ? (
                  <Badge tone="warning">Modifications non enregistrées</Badge>
                ) : (
                  'Aucune modification en attente.'
                )}
              </p>
              <Button variant="ghost" onClick={() => navigate(property ? `/biens/${property.id}` : '/biens')} disabled={saving !== null}>
                Annuler
              </Button>
              <Button type="submit" variant="secondary" loading={saving === 'save'} disabled={saving !== null} icon={<Save className="h-4 w-4" />}>
                {isCreate ? 'Enregistrer le brouillon' : 'Enregistrer'}
              </Button>
              {!isCreate && !canPublish && status === 'draft' && (
                <Button onClick={submit('pending_review')} loading={saving === 'pending_review'} disabled={saving !== null} icon={<Send className="h-4 w-4" />}>
                  Enregistrer et soumettre
                </Button>
              )}
              {!isCreate && canPublish && status !== 'published' && (
                <Button onClick={submit('published')} loading={saving === 'published'} disabled={saving !== null} icon={<Globe2 className="h-4 w-4" />}>
                  Enregistrer et publier
                </Button>
              )}
            </div>
          </div>
        )}
      </form>

      {!isCreate && (
        <p className="mt-4 text-center text-xs text-mist-500">
          Statut : {labelOf(PUBLICATION_STATUSES, status)} ·{' '}
          <Link to={`/biens/${property.id}`} className="font-semibold text-navy-700 hover:underline">
            Retour à la fiche du bien
          </Link>
        </p>
      )}
    </>
  )
}
