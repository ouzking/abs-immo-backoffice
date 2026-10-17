import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { AlertCircle, ArrowLeft, ArrowRight, GripVertical, ImagePlus, RotateCcw, Star, Trash2, UploadCloud, X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/Confirm'
import { Callout, ErrorState, Skeleton } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { errorMessage, toAppError } from '@/lib/errors'
import { formatBytes } from '@/lib/format'
import { BUSINESS_RULE_HINTS, type PropertyMedia, type PublicationStatus } from '@/types'
import { deleteMedia, listPropertyMedia, reorderMedia, setCoverMedia, updateMediaAlt, uploadPropertyImage, validateImageFile } from '../api'
import { propertyKeys } from '../hooks'
import {  } from './PropertyBits'
import { useSignedImageUrls } from '../hooks'

interface UploadItem {
  key: string
  file: File
  preview: string
  progress: number
  status: 'queued' | 'uploading' | 'error'
  error?: string
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif'
const CONCURRENCY = 2

export function PhotoManager({
  propertyId,
  canEdit,
  publicationStatus,
  defaultAlt,
}: {
  propertyId: string
  canEdit: boolean
  publicationStatus: PublicationStatus
  defaultAlt: string
}) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const inputRef = useRef<HTMLInputElement>(null)
  const media = useQuery({ queryKey: propertyKeys.media(propertyId), queryFn: () => listPropertyMedia(propertyId) })
  const signed = useSignedImageUrls((media.data ?? []).map((m) => m.storage_path))
  const [order, setOrder] = useState<PropertyMedia[] | null>(null)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const queue = useRef<UploadItem[]>([])
  const active = useRef(0)
  const nextOrder = useRef(0)

  const items = order ?? media.data ?? []
  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: propertyKeys.media(propertyId) })
    void qc.invalidateQueries({ queryKey: ['properties', 'list'] })
  }, [qc, propertyId])

  // File d'envoi : la référence est la source de vérité (mises à jour synchrones),
  // l'état React n'en est que le reflet pour l'affichage.
  const commit = (next: UploadItem[]) => {
    queue.current = next
    setUploads(next)
  }
  const patch = (key: string, changes: Partial<UploadItem>) =>
    commit(queue.current.map((u) => (u.key === key ? { ...u, ...changes } : u)))

  // Libère les aperçus locaux au démontage.
  useEffect(() => () => queue.current.forEach((u) => URL.revokeObjectURL(u.preview)), [])

  const startNext = () => {
    while (active.current < CONCURRENCY) {
      const next = queue.current.find((u) => u.status === 'queued')
      if (!next) return
      active.current++
      patch(next.key, { status: 'uploading', progress: 0 })
      const sortOrder = nextOrder.current++
      uploadPropertyImage(propertyId, next.file, {
        sortOrder,
        altText: defaultAlt,
        onProgress: (p) => patch(next.key, { progress: p }),
      })
        .then(() => {
          URL.revokeObjectURL(next.preview)
          commit(queue.current.filter((u) => u.key !== next.key))
          refresh()
        })
        .catch((e: unknown) => patch(next.key, { status: 'error', error: errorMessage(e) }))
        .finally(() => {
          active.current--
          startNext()
        })
    }
  }

  const addFiles = (files: FileList | File[]) => {
    const accepted: UploadItem[] = []
    const rejected: string[] = []
    for (const file of Array.from(files)) {
      const invalid = validateImageFile(file)
      if (invalid) rejected.push(`${file.name} : ${invalid}`)
      else accepted.push({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file), progress: 0, status: 'queued' })
    }
    if (rejected.length) toast.error(`${rejected.length} fichier(s) refusé(s)`, { description: rejected.join(' · ') })
    if (accepted.length === 0) return
    if (active.current === 0) {
      nextOrder.current = Math.max(-1, ...(media.data ?? []).map((m) => m.sort_order)) + 1
    }
    commit([...queue.current, ...accepted])
    startNext()
  }

  const retry = (key: string) => {
    patch(key, { status: 'queued', error: undefined, progress: 0 })
    startNext()
  }

  const dismiss = (key: string) => {
    const item = queue.current.find((u) => u.key === key)
    if (item) URL.revokeObjectURL(item.preview)
    commit(queue.current.filter((u) => u.key !== key))
  }

  const persistOrder = async (next: PropertyMedia[]) => {
    const previous = items
    setOrder(next)
    try {
      await reorderMedia(propertyId, next.map((m) => m.id))
      await qc.invalidateQueries({ queryKey: propertyKeys.media(propertyId) })
    } catch (e) {
      setOrder(previous)
      toast.error('Ordre non enregistré', { description: errorMessage(e) })
    } finally {
      setOrder(null)
    }
  }

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= items.length) return
    void persistOrder(arrayMove(items, index, target))
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const from = items.findIndex((m) => m.id === e.active.id)
    const to = items.findIndex((m) => m.id === e.over!.id)
    if (from >= 0 && to >= 0) void persistOrder(arrayMove(items, from, to))
  }

  const makeCover = async (m: PropertyMedia) => {
    setBusyId(m.id)
    try {
      await setCoverMedia(m.id)
      refresh()
      toast.success('Photo principale mise à jour.')
    } catch (e) {
      toast.error('Impossible de changer la photo principale', { description: errorMessage(e) })
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (m: PropertyMedia) => {
    const ok = await confirm({
      title: 'Supprimer cette photo ?',
      description: m.is_cover
        ? 'Il s’agit de la photo principale : la photo suivante deviendra la couverture. Cette action est définitive.'
        : 'La photo sera supprimée définitivement.',
      confirmLabel: 'Supprimer',
      tone: 'danger',
    })
    if (!ok) return
    setBusyId(m.id)
    try {
      const { fileRemoved } = await deleteMedia(m)
      refresh()
      toast.success('Photo supprimée.', fileRemoved ? undefined : { description: 'Le fichier sera nettoyé ultérieurement.' })
    } catch (e) {
      const err = toAppError(e)
      toast.error('Suppression impossible', {
        description:
          err.hint === BUSINESS_RULE_HINTS.LAST_MEDIA_OF_PUBLISHED_PROPERTY
            ? 'C’est la dernière photo d’une annonce publiée : retirez d’abord la publication ou ajoutez une autre photo.'
            : err.message,
      })
    } finally {
      setBusyId(null)
    }
  }

  const saveAlt = async (m: PropertyMedia, value: string) => {
    if ((m.alt_text ?? '') === value.trim()) return
    try {
      await updateMediaAlt(m.id, value)
      refresh()
    } catch (e) {
      toast.error('Description non enregistrée', { description: errorMessage(e) })
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (canEdit && e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  if (media.error) return <ErrorState error={media.error} onRetry={() => void media.refetch()} compact />

  return (
    <div className="space-y-4">
      {publicationStatus === 'published' && items.length <= 1 && (
        <Callout tone="info">Une annonce publiée doit conserver au moins une photo : la dernière ne peut pas être supprimée.</Callout>
      )}

      {canEdit && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
            dragOver ? 'border-navy-500 bg-navy-50' : 'border-mist-300 bg-mist-50/60',
          )}
        >
          <UploadCloud className="h-8 w-8 text-navy-500" aria-hidden />
          <p className="mt-2 text-sm font-semibold text-ink">Glissez vos photos ici</p>
          <p className="mt-0.5 text-xs text-mist-500">JPEG, PNG, WebP ou AVIF · 10 Mo maximum par photo · envoi multiple possible</p>
          <Button variant="secondary" size="sm" className="mt-4" icon={<ImagePlus className="h-4 w-4" />} onClick={() => inputRef.current?.click()}>
            Choisir des photos
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-label="Choisir des photos"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
      )}

      {uploads.length > 0 && (
        <ul className="space-y-2" aria-label="Envois en cours">
          {uploads.map((u) => (
            <li key={u.key} className="flex items-center gap-3 rounded-lg border border-mist-200 bg-white p-2.5">
              <img src={u.preview} alt="" className="h-12 w-16 shrink-0 rounded object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{u.file.name}</p>
                {u.status === 'error' ? (
                  <p className="flex items-center gap-1 text-xs text-brand-red-700">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {u.error}
                  </p>
                ) : (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-mist-100"
                      role="progressbar"
                      aria-valuenow={Math.round(u.progress * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Envoi de ${u.file.name}`}
                    >
                      <div className="h-full rounded-full bg-navy-600 transition-[width]" style={{ width: `${u.progress * 100}%` }} />
                    </div>
                    <span className="tabular w-20 text-right text-xs text-mist-500">
                      {u.status === 'queued' ? 'En attente' : `${Math.round(u.progress * 100)} % · ${formatBytes(u.file.size)}`}
                    </span>
                  </div>
                )}
              </div>
              {u.status === 'error' && (
                <>
                  <Button variant="ghost" size="icon-sm" onClick={() => retry(u.key)} aria-label={`Réessayer l’envoi de ${u.file.name}`}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => dismiss(u.key)} aria-label={`Retirer ${u.file.name}`}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {media.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="aspect-4/3 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-mist-200 bg-white px-4 py-6 text-center text-sm text-mist-500">
          Aucune photo pour le moment. La première photo envoyée deviendra la photo principale (obligatoire pour publier).
        </p>
      ) : (
        <>
          {canEdit && items.length > 1 && (
            <p className="text-xs text-mist-500">
              Faites glisser les photos (ou utilisez les flèches) pour définir l’ordre d’affichage sur le site.
            </p>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((m) => m.id)} strategy={rectSortingStrategy}>
              <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {items.map((m, i) => (
                  <SortablePhoto
                    key={m.id}
                    media={m}
                    index={i}
                    count={items.length}
                    url={signed.data?.get(m.storage_path) ?? null}
                    urlLoading={signed.isLoading}
                    canEdit={canEdit}
                    busy={busyId === m.id}
                    onMove={(d) => move(i, d)}
                    onCover={() => void makeCover(m)}
                    onDelete={() => void remove(m)}
                    onAlt={(v) => void saveAlt(m, v)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  )
}

function SortablePhoto({
  media,
  index,
  count,
  url,
  urlLoading,
  canEdit,
  busy,
  onMove,
  onCover,
  onDelete,
  onAlt,
}: {
  media: PropertyMedia
  index: number
  count: number
  url: string | null
  urlLoading: boolean
  canEdit: boolean
  busy: boolean
  onMove: (delta: number) => void
  onCover: () => void
  onDelete: () => void
  onAlt: (value: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: media.id, disabled: !canEdit })
  const [alt, setAlt] = useState(media.alt_text ?? '')
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group overflow-hidden rounded-xl border bg-white shadow-xs',
        media.is_cover ? 'border-navy-400 ring-2 ring-navy-100' : 'border-mist-200',
        isDragging && 'z-10 shadow-lift',
        busy && 'opacity-60',
      )}
    >
      <div className="relative aspect-4/3 bg-mist-100">
        {url ? (
          <img src={url} alt={media.alt_text ?? ''} className="h-full w-full object-cover" loading="lazy" draggable={false} />
        ) : urlLoading ? (
          <div className="skeleton h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-center text-xs text-mist-500">Fichier indisponible</div>
        )}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <span className="tabular rounded-md bg-ink/75 px-1.5 py-0.5 text-[11px] font-bold text-white">{index + 1}</span>
          {media.is_cover && (
            <Badge tone="navy" className="bg-white" dot={false}>
              <Star className="h-3 w-3 fill-current" aria-hidden /> Principale
            </Badge>
          )}
        </div>
        {canEdit && (
          <button
            type="button"
            className="absolute top-2 right-2 flex h-8 w-8 cursor-grab items-center justify-center rounded-md bg-white/90 text-mist-600 shadow-sm active:cursor-grabbing"
            aria-label={`Déplacer la photo ${index + 1} (glisser-déposer ou flèches du clavier)`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="space-y-2 p-2.5">
        {canEdit ? (
          <input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            onBlur={() => onAlt(alt)}
            maxLength={250}
            placeholder="Description (accessibilité, SEO)"
            aria-label={`Description de la photo ${index + 1}`}
            className="h-8 w-full rounded-md border border-mist-200 px-2 text-xs focus:border-navy-500 focus:ring-2 focus:ring-navy-100 focus:outline-none"
          />
        ) : (
          media.alt_text && <p className="truncate text-xs text-mist-600">{media.alt_text}</p>
        )}
        <p className="text-[11px] text-mist-400">
          {media.width && media.height ? `${media.width} × ${media.height} px · ` : ''}
          {formatBytes(media.size_bytes)}
        </p>
        {canEdit && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" disabled={index === 0 || busy} onClick={() => onMove(-1)} aria-label="Avancer la photo">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" disabled={index === count - 1 || busy} onClick={() => onMove(1)} aria-label="Reculer la photo">
              <ArrowRight className="h-4 w-4" />
            </Button>
            {!media.is_cover && (
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={busy}
                onClick={onCover}
                aria-label={`Définir la photo ${index + 1} comme photo principale`}
                title="Définir comme photo principale"
              >
                <Star className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              className="ml-auto text-brand-red-600 hover:bg-brand-red-50 hover:text-brand-red-700"
              disabled={busy}
              onClick={onDelete}
              aria-label={`Supprimer la photo ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </li>
  )
}
