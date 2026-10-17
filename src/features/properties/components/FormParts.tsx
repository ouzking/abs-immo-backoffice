import type { ReactNode } from 'react'
import { useFieldArray, useWatch, type Control, type UseFormRegister, type UseFormSetValue, type FieldErrors } from 'react-hook-form'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Checkbox, Field, Input, Select } from '@/components/ui/Form'
import { Skeleton } from '@/components/ui/States'
import { useAmenities, useLocalityTree } from '@/features/reference/hooks'
import { cn } from '@/lib/cn'
import { AMENITY_CATEGORIES, labelOf } from '@/lib/labels'
import type { PropertyFormValues } from '../schema'

/** Section numérotée du formulaire (ancre pour la navigation latérale). */
export function FormSection({
  id,
  index,
  title,
  description,
  children,
  hasError,
}: {
  id: string
  index: number
  title: string
  description?: ReactNode
  children: ReactNode
  hasError?: boolean
}) {
  return (
    <Card id={id} className="scroll-mt-24" aria-labelledby={`${id}-title`} role="region">
      <div className="flex items-start gap-3 border-b border-mist-100 px-5 py-4">
        <span
          className={cn(
            'tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
            hasError ? 'bg-brand-red-600 text-white' : 'bg-navy-700 text-white',
          )}
          aria-hidden
        >
          {index}
        </span>
        <div>
          <h2 id={`${id}-title`} className="text-[15px] font-bold">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-mist-500">{description}</p>}
        </div>
      </div>
      <div className="px-5 py-5">{children}</div>
    </Card>
  )
}

/**
 * Sélection en cascade région → ville → commune → quartier. La localité
 * enregistrée est la plus précise choisie ; la base déduit la chaîne complète.
 */
export function LocalityPicker({
  control,
  setValue,
  errors,
}: {
  control: Control<PropertyFormValues>
  setValue: UseFormSetValue<PropertyFormValues>
  errors: FieldErrors<PropertyFormValues>
}) {
  const { tree, isLoading } = useLocalityTree()
  const [regionId, cityId, communeId, neighborhoodId] = useWatch({
    control,
    name: ['region_id', 'city_id', 'commune_id', 'neighborhood_id'],
  })
  if (isLoading || !tree) return <Skeleton className="h-24 w-full" />

  const opts = (parent: string | null, level: 'region' | 'city' | 'commune' | 'neighborhood', current: string) =>
    tree
      .children(parent, level)
      .filter((l) => l.is_active || l.id === current)
      .map((l) => ({ value: l.id, label: l.is_active ? l.name : `${l.name} (désactivée)` }))

  const set = (name: 'region_id' | 'city_id' | 'commune_id' | 'neighborhood_id', value: string) =>
    setValue(name, value, { shouldDirty: true, shouldValidate: name === 'region_id' })

  const regions = opts(null, 'region', regionId)
  const cities = regionId ? opts(regionId, 'city', cityId) : []
  const communes = cityId ? opts(cityId, 'commune', communeId) : []
  // Un quartier dépend d'une commune, ou directement d'une ville.
  const neighborhoods = communeId ? opts(communeId, 'neighborhood', neighborhoodId) : cityId ? opts(cityId, 'neighborhood', neighborhoodId) : []

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Région" required error={errors.region_id?.message}>
        <Select
          value={regionId}
          placeholder="Choisir…"
          options={regions}
          onChange={(e) => {
            set('region_id', e.target.value)
            set('city_id', '')
            set('commune_id', '')
            set('neighborhood_id', '')
          }}
        />
      </Field>
      <Field label="Ville">
        <Select
          value={cityId}
          placeholder={regionId ? (cities.length ? 'Choisir…' : 'Aucune ville enregistrée') : 'Choisissez la région'}
          options={cities}
          disabled={!regionId || cities.length === 0}
          onChange={(e) => {
            set('city_id', e.target.value)
            set('commune_id', '')
            set('neighborhood_id', '')
          }}
        />
      </Field>
      <Field label="Commune" hint={cityId && communes.length === 0 ? 'Aucune commune enregistrée pour cette ville.' : undefined}>
        <Select
          value={communeId}
          placeholder={communes.length ? 'Choisir… (facultatif)' : '—'}
          options={communes}
          disabled={communes.length === 0}
          onChange={(e) => {
            set('commune_id', e.target.value)
            set('neighborhood_id', '')
          }}
        />
      </Field>
      <Field label="Quartier">
        <Select
          value={neighborhoodId}
          placeholder={neighborhoods.length ? 'Choisir… (facultatif)' : '—'}
          options={neighborhoods}
          disabled={neighborhoods.length === 0}
          onChange={(e) => set('neighborhood_id', e.target.value)}
        />
      </Field>
    </div>
  )
}

export function AmenitiesPicker({ control, setValue, disabled }: { control: Control<PropertyFormValues>; setValue: UseFormSetValue<PropertyFormValues>; disabled?: boolean }) {
  const amenities = useAmenities()
  const selected = useWatch({ control, name: 'amenities' })
  if (amenities.isLoading) return <Skeleton className="h-32 w-full" />
  const groups = new Map<string, NonNullable<typeof amenities.data>>()
  for (const a of amenities.data ?? []) {
    if (!a.is_active && !selected.includes(a.code)) continue
    groups.set(a.category, [...(groups.get(a.category) ?? []), a])
  }
  const toggle = (code: string, on: boolean) =>
    setValue('amenities', on ? [...selected, code] : selected.filter((c) => c !== code), { shouldDirty: true })

  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {[...groups.entries()].map(([category, list]) => (
        <fieldset key={category}>
          <legend className="mb-2 text-xs font-bold tracking-wide text-mist-500 uppercase">{labelOf(AMENITY_CATEGORIES, category)}</legend>
          <div className="space-y-2">
            {list.map((a) => (
              <Checkbox key={a.code} label={a.label} checked={selected.includes(a.code)} disabled={disabled} onChange={(e) => toggle(a.code, e.target.checked)} />
            ))}
          </div>
        </fieldset>
      ))}
      {groups.size === 0 && <p className="text-sm text-mist-500">Aucun équipement n’est configuré.</p>}
    </div>
  )
}

export function FeaturesEditor({
  control,
  register,
  errors,
  disabled,
}: {
  control: Control<PropertyFormValues>
  register: UseFormRegister<PropertyFormValues>
  errors: FieldErrors<PropertyFormValues>
  disabled?: boolean
}) {
  const { fields, append, remove, move } = useFieldArray({ control, name: 'features', keyName: 'key' })
  return (
    <div>
      <p className="mb-3 text-sm text-mist-500">Caractéristiques libres affichées sur l’annonce (ex. « Vue » : « Mer », « Orientation » : « Sud »).</p>
      {fields.length > 0 && (
        <ul className="mb-3 space-y-2">
          {fields.map((f, i) => (
            <li key={f.key} className="grid grid-cols-[1fr_1fr_auto] items-start gap-2">
              <Field label={<span className="sr-only">Libellé {i + 1}</span>} error={errors.features?.[i]?.label?.message}>
                <Input placeholder="Libellé" maxLength={80} disabled={disabled} {...register(`features.${i}.label`)} />
              </Field>
              <Field label={<span className="sr-only">Valeur {i + 1}</span>} error={errors.features?.[i]?.value?.message}>
                <Input placeholder="Valeur" maxLength={200} disabled={disabled} {...register(`features.${i}.value`)} />
              </Field>
              <div className="flex pt-[22px]">
                <Button variant="ghost" size="icon-sm" disabled={disabled || i === 0} onClick={() => move(i, i - 1)} aria-label="Monter">
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" disabled={disabled || i === fields.length - 1} onClick={() => move(i, i + 1)} aria-label="Descendre">
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" disabled={disabled} onClick={() => remove(i)} aria-label={`Supprimer la caractéristique ${i + 1}`}>
                  <Trash2 className="h-4 w-4 text-brand-red-600" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} disabled={disabled || fields.length >= 40} onClick={() => append({ label: '', value: '' })}>
        Ajouter une caractéristique
      </Button>
    </div>
  )
}

/** Compteur de caractères discret sous un champ texte. */
export function CharCount({ value, max, min }: { value: string; max: number; min?: number }) {
  const n = value?.length ?? 0
  return (
    <span className={cn('tabular text-xs', n > max ? 'text-brand-red-700' : min && n > 0 && n < min ? 'text-warning-700' : 'text-mist-400')}>
      {n} / {max}
    </span>
  )
}
