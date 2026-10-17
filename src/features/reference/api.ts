import { unwrap } from '@/lib/errors'
import { getSupabase } from '@/lib/supabase/client'
import type { Amenity, Locality, PropertyType } from '@/types'

/** Référentiels (lecture : tout le personnel actif, y compris les éléments désactivés). */
export async function fetchPropertyTypes(): Promise<PropertyType[]> {
  return unwrap(await getSupabase().from('property_types').select('*').order('sort_order').order('label'))
}

export async function fetchAmenities(): Promise<Amenity[]> {
  return unwrap(await getSupabase().from('amenities').select('*').order('category').order('sort_order').order('label'))
}

export type LocalityLite = Pick<Locality, 'id' | 'name' | 'level' | 'parent_id' | 'is_active' | 'sort_order' | 'country_code'>

export async function fetchLocalities(): Promise<LocalityLite[]> {
  return unwrap(
    await getSupabase()
      .from('localities')
      .select('id,name,level,parent_id,is_active,sort_order,country_code')
      .order('sort_order')
      .order('name')
      .limit(5000),
  )
}

export interface AgentOption {
  profile_id: string
  display_name: string
  is_active: boolean
  job_title: string | null
}

/** Fiches agents (lecture : personnel actif). */
export async function fetchAgentOptions(): Promise<AgentOption[]> {
  return unwrap(
    await getSupabase().from('agents').select('profile_id,display_name,is_active,job_title').order('display_name'),
  )
}
