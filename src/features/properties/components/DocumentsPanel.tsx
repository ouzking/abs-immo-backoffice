import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, FileText, Lock, Paperclip, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { useConfirm } from '@/components/ui/Confirm'
import { Field, Input, Select } from '@/components/ui/Form'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { errorMessage } from '@/lib/errors'
import { formatBytes, formatDate } from '@/lib/format'
import { DOCUMENT_TYPES, labelOf, optionsOf } from '@/lib/labels'
import type { DocumentType, PropertyDocument } from '@/types'
import { deletePropertyDocument, documentDownloadUrl, listPropertyDocuments, uploadPropertyDocument, validateDocumentFile } from '../api'
import { propertyKeys } from '../hooks'

/** Documents internes (titres, mandats…) : bucket privé, visibles par qui peut modifier le bien. */
export function DocumentsPanel({ propertyId }: { propertyId: string }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const docs = useQuery({ queryKey: propertyKeys.documents(propertyId), queryFn: () => listPropertyDocuments(propertyId) })
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<DocumentType>('other')
  const [progress, setProgress] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = async () => {
    if (!file) return
    const invalid = validateDocumentFile(file)
    if (invalid) {
      toast.error(invalid)
      return
    }
    setProgress(0)
    try {
      await uploadPropertyDocument(propertyId, file, { title: title || file.name, documentType: type }, setProgress)
      toast.success('Document ajouté.')
      setFile(null)
      setTitle('')
      setType('other')
      if (inputRef.current) inputRef.current.value = ''
      void qc.invalidateQueries({ queryKey: propertyKeys.documents(propertyId) })
    } catch (e) {
      toast.error('Envoi impossible', { description: errorMessage(e) })
    } finally {
      setProgress(null)
    }
  }

  const download = async (d: PropertyDocument) => {
    try {
      const ext = d.storage_path.split('.').pop() ?? ''
      window.open(await documentDownloadUrl(d.storage_path, `${d.title}.${ext}`), '_blank', 'noopener')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const remove = async (d: PropertyDocument) => {
    if (!(await confirm({ title: 'Supprimer ce document ?', description: `« ${d.title} » sera supprimé définitivement.`, confirmLabel: 'Supprimer', tone: 'danger' }))) return
    try {
      await deletePropertyDocument(d)
      toast.success('Document supprimé.')
      void qc.invalidateQueries({ queryKey: propertyKeys.documents(propertyId) })
    } catch (e) {
      toast.error('Suppression impossible', { description: errorMessage(e) })
    }
  }

  return (
    <Card>
      <CardHeader
        title="Documents internes"
        description="Titres, mandats, contrats, plans. Jamais publiés sur le site."
        icon={<Lock className="h-4 w-4" />}
      />
      {docs.error ? (
        <ErrorState error={docs.error} onRetry={() => void docs.refetch()} compact />
      ) : docs.isLoading ? (
        <div className="p-5">
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <ul className="divide-y divide-mist-100">
          {(docs.data ?? []).map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-5 py-3">
              <FileText className="h-5 w-5 shrink-0 text-navy-500" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{d.title}</p>
                <p className="text-xs text-mist-500">
                  {labelOf(DOCUMENT_TYPES, d.document_type)} · {formatBytes(d.size_bytes)} · {formatDate(d.created_at)}
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => void download(d)} aria-label={`Télécharger ${d.title}`}>
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => void remove(d)} aria-label={`Supprimer ${d.title}`}>
                <Trash2 className="h-4 w-4 text-brand-red-600" />
              </Button>
            </li>
          ))}
          {(docs.data ?? []).length === 0 && <li className="px-5 py-4 text-sm text-mist-500">Aucun document.</li>}
        </ul>
      )}
      <div className="space-y-3 border-t border-mist-100 bg-mist-50/50 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Intitulé">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={file?.name ?? 'Ex. Titre foncier n° …'} />
          </Field>
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as DocumentType)} options={optionsOf(DOCUMENT_TYPES)} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" icon={<Paperclip className="h-4 w-4" />} onClick={() => inputRef.current?.click()}>
            {file ? 'Changer de fichier' : 'Choisir un fichier'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            tabIndex={-1}
            aria-label="Choisir un document"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file && <span className="truncate text-xs text-mist-600">{file.name} ({formatBytes(file.size)})</span>}
          <Button size="sm" className="ml-auto" disabled={!file} loading={progress !== null} onClick={() => void upload()}>
            {progress !== null ? `${Math.round(progress * 100)} %` : 'Ajouter'}
          </Button>
        </div>
        <p className="text-xs text-mist-500">PDF, image ou DOCX · 20 Mo maximum.</p>
      </div>
    </Card>
  )
}
