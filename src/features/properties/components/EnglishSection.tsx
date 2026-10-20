import { useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import { Languages } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Field, Input, Textarea } from '@/components/ui/Form'
import type { PropertyFormValues } from '../schema'
import { translationStatus } from '../translation'
import { CharCount, FormSection } from './FormParts'

/**
 * Version anglaise de l'annonce (contrat 1.1.0), affichée par le site anglais (/en).
 * Champs facultatifs : vides, le site montre le français avec « not translated yet ».
 */
export function EnglishSection({
  register,
  control,
  errors,
  hasError,
}: {
  register: UseFormRegister<PropertyFormValues>
  control: Control<PropertyFormValues>
  errors: FieldErrors<PropertyFormValues>
  hasError: boolean
}) {
  const [title, titleEn, shortEn, descriptionEn, seoTitleEn, seoDescriptionEn] = useWatch({
    control,
    name: ['title', 'title_en', 'short_description_en', 'description_en', 'seo_title_en', 'seo_description_en'],
  })
  const status = translationStatus({ title_en: titleEn, short_description_en: shortEn, description_en: descriptionEn })

  return (
    <FormSection
      id="anglais"
      index={11}
      title="Version anglaise"
      hasError={hasError}
      description="Lue par la diaspora et la clientèle internationale (site /en). Facultative : un champ vide affiche le texte français avec la mention « not translated yet »."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Languages className="h-4 w-4 text-navy-600" aria-hidden />
        <span className="text-sm font-semibold text-mist-700">État de la traduction :</span>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <div className="space-y-4">
        <Field
          label="Title (EN)"
          error={errors.title_en?.message}
          hint={!titleEn && title ? `Sans titre anglais, le site affiche : « ${title} »` : 'Entre 5 et 160 caractères.'}
          labelAction={<CharCount value={titleEn} max={160} min={5} />}
        >
          <Input lang="en" maxLength={160} placeholder="e.g. Contemporary villa with pool in Almadies" {...register('title_en')} />
        </Field>
        <Field label="Short description (EN)" error={errors.short_description_en?.message} labelAction={<CharCount value={shortEn} max={300} />}>
          <Textarea lang="en" rows={2} maxLength={300} {...register('short_description_en')} />
        </Field>
        <Field label="Description (EN)" error={errors.description_en?.message} labelAction={<CharCount value={descriptionEn} max={20000} />}>
          <Textarea lang="en" rows={6} {...register('description_en')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SEO title (EN)" error={errors.seo_title_en?.message} labelAction={<CharCount value={seoTitleEn} max={120} />}>
            <Input lang="en" maxLength={120} {...register('seo_title_en')} />
          </Field>
          <Field label="SEO description (EN)" error={errors.seo_description_en?.message} labelAction={<CharCount value={seoDescriptionEn} max={320} />}>
            <Textarea lang="en" rows={2} maxLength={320} {...register('seo_description_en')} />
          </Field>
        </div>
      </div>
    </FormSection>
  )
}

