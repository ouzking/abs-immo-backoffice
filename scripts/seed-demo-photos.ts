/**
 * Ajoute de vraies photos aux biens de DÉMONSTRATION de la pile Supabase LOCALE
 * (seed d'abs-immo-backend), dont les photos n'ont pas de fichier dans Storage.
 *
 * Usage : npm run demo:photos [-- "C:\chemin\vers\photos"]
 * Par défaut : %USERPROFILE%\OneDrive\Images\immobilier
 *
 * Sécurité : refuse toute URL Supabase non locale ; utilise un compte du seed local.
 * Idempotent : un fichier déjà présent est remplacé, aucune photo n'est ajoutée deux fois.
 */
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const envFile = resolve(process.cwd(), '.env.local')
if (!existsSync(envFile)) {
  console.error('.env.local introuvable : voir docs/LOCAL_SETUP.md.')
  process.exit(1)
}
const envText = readFileSync(envFile, 'utf8')
const read = (name: string) => new RegExp(`^${name}=(.*)$`, 'm').exec(envText)?.[1]?.trim()
const url = read('VITE_SUPABASE_URL') ?? ''
const key = read('VITE_SUPABASE_PUBLISHABLE_KEY') ?? read('VITE_SUPABASE_ANON_KEY') ?? ''

if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  console.error(`Refusé : ${url || '(URL vide)'} n'est pas une pile Supabase locale.`)
  process.exit(1)
}

const source = process.argv[2] ?? join(homedir(), 'OneDrive', 'Images', 'immobilier')
if (!existsSync(source)) {
  console.error(`Dossier de photos introuvable : ${source}`)
  process.exit(1)
}

/** Titre du bien de démonstration → photos (dans l'ordre d'affichage). */
const PLAN: Array<{ title: string; files: string[] }> = [
  { title: 'Villa contemporaine avec piscine aux Almadies', files: ['APP333333.jpeg', 'app333.jpeg', 'APP33333.jpeg', 'app3.jpeg'] },
  { title: 'Appartement F4 meublé à Mermoz', files: ['App1.jpeg', 'app11.jpeg', 'app111.jpeg', 'APP1111.jpeg'] },
  { title: 'Maison familiale vendue à Ouakam', files: ['app7.jpeg', 'app77.jpeg', 'app777.jpeg', 'app7777.jpeg'] },
  { title: 'Villa en préparation à Ngor', files: ['app8.jpeg', 'app88.jpeg', 'app888.jpeg'] },
  { title: 'Local commercial au Point E', files: ['commerce1.jpeg', 'commerce2.jpeg', 'commerce3.jpeg', 'commerce4.jpeg'] },
  { title: 'Bureaux climatisés au Plateau', files: ['app33.jpeg', 'APP3333.jpeg'] },
]

const sb = createClient(url, key, { auth: { persistSession: false } })
const { error: authError } = await sb.auth.signInWithPassword({ email: 'superadmin@abs-immo.test', password: 'AbsImmo-Local-2026' })
if (authError) {
  console.error(`Connexion au compte de démonstration impossible : ${authError.message}`)
  process.exit(1)
}

let uploaded = 0
for (const { title, files } of PLAN) {
  const { data: property } = await sb.from('properties').select('id,title').eq('title', title).maybeSingle()
  if (!property) {
    console.warn(`- « ${title} » : bien absent (seed modifié ?), ignoré.`)
    continue
  }
  const { data: media } = await sb
    .from('property_media')
    .select('id,storage_path,sort_order')
    .eq('property_id', property.id)
    .order('sort_order')
  const existing = media ?? []

  for (const [i, file] of files.entries()) {
    const path = join(source, file)
    if (!existsSync(path)) {
      console.warn(`  · ${file} introuvable, ignoré.`)
      continue
    }
    const body = readFileSync(path)
    // Les premières photos remplacent les fichiers manquants du seed (mêmes chemins).
    const target = existing[i]?.storage_path ?? `${property.id}/demo-${i + 1}.jpg`
    const { error: upError } = await sb.storage
      .from('property-images')
      .upload(target, body, { contentType: 'image/jpeg', upsert: true })
    if (upError) {
      console.error(`  · ${file} : envoi refusé (${upError.message}).`)
      continue
    }
    if (!existing[i]) {
      const { error: rowError } = await sb.from('property_media').insert({
        property_id: property.id,
        storage_path: target,
        alt_text: property.title,
        sort_order: i,
        mime_type: 'image/jpeg',
        size_bytes: body.length,
      })
      if (rowError && rowError.code !== '23505') console.error(`  · ${file} : enregistrement refusé (${rowError.message}).`)
    }
    uploaded++
  }
  console.log(`✓ ${title} : ${files.length} photo(s)`)
}

await sb.auth.signOut()
console.log(`\n${uploaded} photo(s) en place. Rechargez le back-office.`)
