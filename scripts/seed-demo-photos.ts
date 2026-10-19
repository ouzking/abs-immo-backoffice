/**
 * Données de DÉMONSTRATION pour la pile Supabase LOCALE (seed d'abs-immo-backend) :
 *   1. ajoute de vraies photos aux biens du seed (dont les photos n'ont pas de fichier) ;
 *   2. crée des biens de démonstration supplémentaires (entrepôts, appartements…)
 *      pour que toutes les photos du dossier soient utilisées, puis les publie.
 *
 * Usage : npm run demo:photos [-- "C:\chemin\vers\photos"]
 * Par défaut : %USERPROFILE%\OneDrive\Images\immobilier
 *
 * Sécurité : refuse toute URL Supabase non locale ; utilise un compte du seed local.
 * Idempotent : un bien déjà créé n'est pas dupliqué, un fichier présent est remplacé.
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

// Agents du seed local.
const AGENT1 = '00000000-0000-4000-a000-000000000004'
const AGENT2 = '00000000-0000-4000-a000-000000000005'
const MANAGER = '00000000-0000-4000-a000-000000000003'
const DEMO_NOTE = 'Bien de démonstration (pile locale) — créé par npm run demo:photos.'

interface NewProperty {
  property_type: string
  transaction_type: 'sale' | 'rent'
  rent_period?: 'month'
  price_amount: number
  locality: string // slug de localité
  agent_id: string
  short_description: string
  description: string
  surface_area?: number
  bedrooms?: number
  bathrooms?: number
  parking_spaces?: number
  amenities?: string[]
  commercial_status?: 'available' | 'reserved'
  featured?: boolean
}

/** Titre du bien → photos (ordre d'affichage) ; `create` si le bien n'existe pas dans le seed. */
const PLAN: Array<{ title: string; files: string[]; create?: NewProperty }> = [
  // Biens du seed
  { title: 'Villa contemporaine avec piscine aux Almadies', files: ['APP333333.jpeg', 'app333.jpeg', 'APP33333.jpeg', 'app3.jpeg'] },
  { title: 'Appartement F4 meublé à Mermoz', files: ['App1.jpeg', 'app11.jpeg', 'app111.jpeg', 'APP1111.jpeg'] },
  {
    title: 'Maison familiale vendue à Ouakam',
    files: ['app7.jpeg', 'app77.jpeg', 'app777.jpeg', 'app7777.jpeg', 'app77777.jpeg', 'app777777.jpeg', 'app7777777.jpeg', 'app77777777.jpeg'],
  },
  { title: 'Villa en préparation à Ngor', files: ['app8.jpeg', 'app88.jpeg', 'app888.jpeg', 'app8888.jpeg', 'app88888.jpeg'] },
  { title: 'Local commercial au Point E', files: ['commerce1.jpeg', 'commerce2.jpeg', 'commerce3.jpeg', 'commerce4.jpeg'] },
  { title: 'Bureaux climatisés au Plateau', files: ['app33.jpeg', 'APP3333.jpeg'] },

  // Biens de démonstration supplémentaires
  {
    title: 'Appartement F3 avec cuisine équipée à Yoff',
    files: ['app2.jpeg', 'app22.jpeg', 'app222.jpeg', 'app2222.jpeg', 'APP22222.jpeg'],
    create: {
      property_type: 'apartment', transaction_type: 'rent', rent_period: 'month', price_amount: 450000, locality: 'yoff', agent_id: AGENT1,
      short_description: 'F3 lumineux avec cuisine équipée et balcon, au calme à Yoff.',
      description: 'Appartement de trois pièces : séjour, deux chambres, cuisine équipée ouverte sur un balcon. Immeuble récent, quartier calme proche des commerces.',
      surface_area: 95, bedrooms: 2, bathrooms: 1, amenities: ['furnished_kitchen', 'air_conditioning', 'internet'],
    },
  },
  {
    title: 'Appartement de standing à Fann Résidence',
    files: ['app4.jpeg', 'app44.jpeg', 'app444.jpeg'],
    create: {
      property_type: 'apartment', transaction_type: 'sale', price_amount: 185000000, locality: 'fann-residence', agent_id: MANAGER,
      short_description: 'Appartement haut de gamme aux finitions soignées, salles de bain en marbre.',
      description: 'Appartement de standing dans une résidence sécurisée de Fann Résidence : grandes pièces de vie, salles de bain contemporaines, double vasque, rangements intégrés.',
      surface_area: 160, bedrooms: 3, bathrooms: 3, parking_spaces: 1, amenities: ['air_conditioning', 'elevator', 'security_guard', 'parking'],
      featured: true,
    },
  },
  {
    title: 'Appartement neuf dans résidence moderne aux Almadies',
    files: ['app5.jpeg', 'app55.jpeg', 'app555.jpeg', 'app5555.jpeg'],
    create: {
      property_type: 'apartment', transaction_type: 'sale', price_amount: 240000000, locality: 'almadies', agent_id: AGENT1,
      short_description: 'Appartement neuf dans une résidence moderne avec parking et gardiennage.',
      description: 'Résidence contemporaine aux Almadies : appartements neufs avec balcons, ascenseur, parking en sous-sol et gardiennage 24 h/24.',
      surface_area: 140, bedrooms: 3, bathrooms: 2, parking_spaces: 1, amenities: ['elevator', 'parking', 'security_guard', 'air_conditioning'],
      commercial_status: 'reserved',
    },
  },
  {
    title: 'Villa avec piscine et cuisine ouverte à Ngor',
    files: ['app6.jpeg', 'app66.jpeg', 'app666.jpeg'],
    create: {
      property_type: 'villa', transaction_type: 'rent', rent_period: 'month', price_amount: 3500000, locality: 'ngor-village', agent_id: AGENT2,
      short_description: 'Villa contemporaine avec piscine, jardin et grande cuisine ouverte.',
      description: 'Villa récente : vaste séjour ouvert sur la piscine et le jardin, cuisine avec îlot central, suites parentales, finitions modernes.',
      surface_area: 350, bedrooms: 4, bathrooms: 4, parking_spaces: 2, amenities: ['swimming_pool', 'garden', 'air_conditioning', 'parking', 'security_guard'],
      featured: true,
    },
  },
  {
    title: 'Entrepôt couvert de 600 m² à Rufisque',
    files: ['hangar1.jpeg', 'hangar11.jpeg', 'hangar111.jpeg'],
    create: {
      property_type: 'warehouse', transaction_type: 'rent', rent_period: 'month', price_amount: 1800000, locality: 'rufisque', agent_id: AGENT2,
      short_description: 'Entrepôt couvert à charpente métallique, accès poids lourds.',
      description: 'Entrepôt de 600 m² sous charpente métallique, sol bétonné, grande hauteur sous plafond, accès facile pour les camions.',
      surface_area: 600, parking_spaces: 4, amenities: ['parking', 'security_guard'],
    },
  },
  {
    title: 'Grand entrepôt de 1 000 m² à Diamniadio',
    files: ['hangar2.jpeg', 'hangar22.jpeg', 'hangar222.jpeg', 'hangar2222.jpeg'],
    create: {
      property_type: 'warehouse', transaction_type: 'rent', rent_period: 'month', price_amount: 3000000, locality: 'diamniadio', agent_id: MANAGER,
      short_description: 'Entrepôt de 1 000 m² éclairé, idéal stockage ou logistique.',
      description: 'Grand entrepôt avec éclairage zénithal, murs maçonnés et toiture métallique, à proximité des axes routiers de Diamniadio.',
      surface_area: 1000, parking_spaces: 6, amenities: ['parking', 'security_guard'],
    },
  },
  {
    title: 'Hangar neuf en charpente métallique à Sébikotane',
    files: ['hangar3.jpeg', 'hangar33.jpeg', 'hangar333.jpeg'],
    create: {
      property_type: 'warehouse', transaction_type: 'sale', price_amount: 250000000, locality: 'sebikotane', agent_id: AGENT1,
      short_description: 'Hangar neuf avec portail coulissant et grande hauteur sous plafond.',
      description: 'Hangar neuf en charpente métallique, bardage isolé, portail coulissant, éclairage naturel : adapté à l’industrie légère ou au stockage.',
      surface_area: 800, parking_spaces: 5, amenities: ['parking'],
    },
  },
  {
    title: 'Atelier équipé à Pikine',
    files: ['hangar4.jpeg', 'hangar44.jpeg', 'hangar444.jpeg', 'hangar4444.jpeg'],
    create: {
      property_type: 'warehouse', transaction_type: 'rent', rent_period: 'month', price_amount: 1500000, locality: 'pikine', agent_id: AGENT2,
      short_description: 'Atelier de 500 m² avec mezzanine, prêt à l’exploitation.',
      description: 'Atelier en activité avec mezzanine, alimentation électrique adaptée aux machines et accès véhicules.',
      surface_area: 500, parking_spaces: 3, amenities: ['parking'],
    },
  },
]

const sb = createClient(url, key, { auth: { persistSession: false } })
const { error: authError } = await sb.auth.signInWithPassword({ email: 'superadmin@abs-immo.test', password: 'AbsImmo-Local-2026' })
if (authError) {
  console.error(`Connexion au compte de démonstration impossible : ${authError.message}`)
  process.exit(1)
}

async function findLocality(slug: string): Promise<string | null> {
  const { data } = await sb.from('localities').select('id,level').eq('slug', slug).order('level', { ascending: false }).limit(1)
  return data?.[0]?.id ?? null
}

async function createProperty(title: string, spec: NewProperty): Promise<string | null> {
  const localityId = (await findLocality(spec.locality)) ?? (await findLocality('dakar'))
  if (!localityId) {
    console.error(`  · localité « ${spec.locality} » introuvable.`)
    return null
  }
  const { data, error } = await sb
    .from('properties')
    .insert({
      title,
      property_type: spec.property_type,
      transaction_type: spec.transaction_type,
      rent_period: spec.rent_period ?? null,
      price_amount: spec.price_amount,
      locality_id: localityId,
      agent_id: spec.agent_id,
      short_description: spec.short_description,
      description: spec.description,
      surface_area: spec.surface_area ?? null,
      bedrooms: spec.bedrooms ?? null,
      bathrooms: spec.bathrooms ?? null,
      parking_spaces: spec.parking_spaces ?? null,
      address_visibility: 'approximate',
      internal_notes: DEMO_NOTE,
      publication_status: 'draft',
    })
    .select('id')
    .single()
  if (error || !data) {
    console.error(`  · création refusée : ${error?.message}`)
    return null
  }
  if (spec.amenities?.length) {
    await sb.rpc('set_property_amenities', { p_property_id: data.id, p_amenity_codes: spec.amenities })
  }
  return data.id
}

let uploaded = 0
let created = 0
for (const { title, files, create } of PLAN) {
  let { data: property } = await sb.from('properties').select('id,title,publication_status').eq('title', title).maybeSingle()
  if (!property && create) {
    const id = await createProperty(title, create)
    if (!id) continue
    created++
    property = { id, title, publication_status: 'draft' }
  }
  if (!property) {
    console.warn(`- « ${title} » : bien absent (seed modifié ?), ignoré.`)
    continue
  }
  const { data: media } = await sb.from('property_media').select('id,storage_path,sort_order').eq('property_id', property.id).order('sort_order')
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
    const { error: upError } = await sb.storage.from('property-images').upload(target, body, { contentType: 'image/jpeg', upsert: true })
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

  // Les nouveaux biens sont publiés une fois leurs photos en place.
  if (create && property.publication_status === 'draft') {
    const { error } = await sb
      .from('properties')
      .update({ publication_status: 'published', commercial_status: create.commercial_status ?? 'available', is_featured: !!create.featured })
      .eq('id', property.id)
    if (error) console.error(`  · publication refusée : ${error.message}`)
  }
  console.log(`✓ ${title} : ${files.length} photo(s)`)
}

await sb.auth.signOut()
console.log(`\n${created} bien(s) créé(s), ${uploaded} photo(s) en place. Rechargez le back-office et le site.`)
