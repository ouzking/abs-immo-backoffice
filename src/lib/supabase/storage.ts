import { env } from '@/config/env'
import { AppError, fromStorageError } from '@/lib/errors'
import { getSupabase } from './client'

/**
 * Les buckets `property-images` et `property-documents` sont PRIVÉS : on n'y
 * accède que par URL signée de courte durée (le personnel peut signer tout le
 * catalogue qu'il a le droit de lire). Signature par lot + cache mémoire.
 */
const TTL_SECONDS = 60 * 60
const REUSE_MARGIN_MS = 10 * 60 * 1000

type Bucket = 'property-images' | 'property-documents'
const cache = new Map<string, { url: string | null; expiresAt: number }>()

export async function signPaths(bucket: Bucket, paths: Array<string | null | undefined>): Promise<Map<string, string | null>> {
  const wanted = [...new Set(paths.filter((p): p is string => !!p))]
  const now = Date.now()
  const missing = wanted.filter((p) => {
    const hit = cache.get(`${bucket}:${p}`)
    return !hit || hit.expiresAt - REUSE_MARGIN_MS < now
  })
  if (missing.length > 0) {
    const { data, error } = await getSupabase().storage.from(bucket).createSignedUrls(missing, TTL_SECONDS)
    if (error) throw fromStorageError(error)
    const expiresAt = Date.now() + TTL_SECONDS * 1000
    for (const item of data ?? []) {
      if (item.path) cache.set(`${bucket}:${item.path}`, { url: item.error ? null : item.signedUrl, expiresAt })
    }
  }
  return new Map(wanted.map((p) => [p, cache.get(`${bucket}:${p}`)?.url ?? null]))
}

export function forgetSignedPath(bucket: Bucket, path: string): void {
  cache.delete(`${bucket}:${path}`)
}

export function publicUrl(bucket: 'agent-photos' | 'site-assets', path: string | null | undefined): string | null {
  if (!path) return null
  return getSupabase().storage.from(bucket).getPublicUrl(path).data.publicUrl
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

/**
 * Envoi d'un fichier avec suivi de progression (XMLHttpRequest sur l'API REST
 * Storage, authentifiée par le jeton de session : les politiques Storage du
 * backend s'appliquent exactement comme avec supabase-js).
 */
export async function uploadWithProgress(
  bucket: string,
  path: string,
  file: Blob,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { data } = await getSupabase().auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new AppError('auth', 'Votre session a expiré. Veuillez vous reconnecter.')
  if (!env.supabaseUrl || !env.supabaseKey) throw new AppError('config', 'Supabase non configuré.')

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${env.supabaseUrl}/storage/v1/object/${bucket}/${encodePath(path)}`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', env.supabaseKey!)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.setRequestHeader('cache-control', 'max-age=3600')
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1)
        resolve()
        return
      }
      let body: { message?: string; error?: string; statusCode?: string } = {}
      try {
        body = JSON.parse(xhr.responseText) as typeof body
      } catch {
        /* corps non JSON */
      }
      reject(fromStorageError({ message: body.message ?? body.error ?? xhr.statusText, statusCode: body.statusCode ?? String(xhr.status) }))
    }
    xhr.onerror = () => reject(new AppError('network', "Envoi interrompu : vérifiez votre connexion internet."))
    xhr.onabort = () => reject(new AppError('unknown', 'Envoi annulé.'))
    signal?.addEventListener('abort', () => xhr.abort())
    xhr.send(file)
  })
}

export async function removeFiles(bucket: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const { error } = await getSupabase().storage.from(bucket).remove(paths)
  if (error) throw fromStorageError(error)
}

/** Dimensions d'une image (pour width/height en base), null si illisible. */
export async function readImageSize(file: Blob): Promise<{ width: number; height: number } | null> {
  try {
    if (typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(file)
      const size = { width: bmp.width, height: bmp.height }
      bmp.close()
      return size
    }
  } catch {
    /* format non décodable (ex. AVIF sur un ancien navigateur) */
  }
  return null
}
