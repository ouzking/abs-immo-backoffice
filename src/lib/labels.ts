import type {
  AddressVisibility,
  CommercialStatus,
  ContactMethod,
  DocumentType,
  InquiryStatus,
  InquiryType,
  LeadActivityType,
  LeadSource,
  LeadStatus,
  LegalStatus,
  PublicationStatus,
  RentPeriod,
  RoleCode,
  SurfaceUnit,
  TimeSlot,
  TransactionType,
  ViewingStatus,
} from '@/types'

/**
 * Libellés français des énumérations du backend. Les énumérations peuvent
 * s'enrichir (contrat § 5) : `labelOf` renvoie la valeur brute si elle est inconnue.
 */
export type Tone = 'neutral' | 'navy' | 'info' | 'success' | 'warning' | 'danger' | 'muted'

export interface EnumMeta {
  label: string
  tone: Tone
}

export function labelOf<K extends string>(map: Record<K, string> | Record<K, EnumMeta>, value: K | string | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const entry = (map as Record<string, string | EnumMeta>)[value]
  if (!entry) return value
  return typeof entry === 'string' ? entry : entry.label
}

export function toneOf<K extends string>(map: Record<K, EnumMeta>, value: K | string | null | undefined): Tone {
  if (!value) return 'neutral'
  return (map as Record<string, EnumMeta>)[value]?.tone ?? 'neutral'
}

export function optionsOf<K extends string>(map: Record<K, string> | Record<K, EnumMeta>): Array<{ value: K; label: string }> {
  return (Object.keys(map) as K[]).map((value) => ({ value, label: labelOf(map, value) }))
}

export const TRANSACTION_TYPES: Record<TransactionType, string> = { sale: 'Vente', rent: 'Location' }

export const RENT_PERIODS: Record<RentPeriod, string> = {
  day: 'Par jour',
  week: 'Par semaine',
  month: 'Par mois',
  year: 'Par an',
}

export const PUBLICATION_STATUSES: Record<PublicationStatus, EnumMeta> = {
  draft: { label: 'Brouillon', tone: 'neutral' },
  pending_review: { label: 'En validation', tone: 'warning' },
  published: { label: 'Publié', tone: 'success' },
  unpublished: { label: 'Retiré', tone: 'muted' },
  archived: { label: 'Archivé', tone: 'muted' },
}

export const COMMERCIAL_STATUSES: Record<CommercialStatus, EnumMeta> = {
  available: { label: 'Disponible', tone: 'success' },
  reserved: { label: 'Réservé', tone: 'warning' },
  sold: { label: 'Vendu', tone: 'danger' },
  rented: { label: 'Loué', tone: 'danger' },
}

export const SURFACE_UNITS: Record<SurfaceUnit, string> = { sqm: 'm²', are: 'are(s)', hectare: 'ha' }

export const ADDRESS_VISIBILITIES: Record<AddressVisibility, string> = {
  hidden: 'Masquée (aucune carte publique)',
  approximate: 'Approximative (zone d’environ 1 km)',
  exact: 'Exacte (adresse et point précis)',
}

export const LEGAL_STATUSES: Record<LegalStatus, string> = {
  titre_foncier: 'Titre foncier',
  bail: 'Bail',
  deliberation: 'Délibération',
  permis_occuper: "Permis d'occuper",
  autre: 'Autre',
}

export const DOCUMENT_TYPES: Record<DocumentType, string> = {
  title_deed: 'Titre de propriété',
  mandate: 'Mandat',
  contract: 'Contrat',
  plan: 'Plan',
  tax: 'Fiscalité',
  identity: "Pièce d'identité",
  other: 'Autre',
}

/** Statuts du prospect (pipeline commercial). */
export const LEAD_STATUSES: Record<LeadStatus, EnumMeta> = {
  new: { label: 'Nouveau', tone: 'info' },
  contacted: { label: 'Contacté', tone: 'navy' },
  qualified: { label: 'En cours', tone: 'navy' },
  visit_scheduled: { label: 'Visite programmée', tone: 'warning' },
  negotiation: { label: 'En négociation', tone: 'warning' },
  won: { label: 'Converti', tone: 'success' },
  lost: { label: 'Non abouti', tone: 'muted' },
}

export const LEAD_SOURCES: Record<LeadSource, string> = {
  website: 'Site web',
  whatsapp: 'WhatsApp',
  phone: 'Téléphone',
  email: 'E-mail',
  walk_in: 'Visite en agence',
  facebook: 'Facebook',
  instagram: 'Instagram',
  referral: 'Recommandation',
  partner: 'Partenaire',
  other: 'Autre',
}

export const CONTACT_METHODS: Record<ContactMethod, string> = { phone: 'Téléphone', whatsapp: 'WhatsApp', email: 'E-mail' }

export const INQUIRY_TYPES: Record<InquiryType, string> = {
  general: 'Demande générale',
  property_info: 'Information sur un bien',
  price: 'Question sur le prix',
  availability: 'Disponibilité',
  sell_property: 'Vendre un bien',
  rent_out_property: 'Mettre un bien en location',
  other: 'Autre',
}

export const INQUIRY_STATUSES: Record<InquiryStatus, EnumMeta> = {
  new: { label: 'Nouvelle', tone: 'info' },
  in_progress: { label: 'En cours', tone: 'warning' },
  answered: { label: 'Répondue', tone: 'success' },
  closed: { label: 'Clôturée', tone: 'muted' },
  spam: { label: 'Indésirable', tone: 'muted' },
}

export const VIEWING_STATUSES: Record<ViewingStatus, EnumMeta> = {
  requested: { label: 'Demandée', tone: 'info' },
  confirmed: { label: 'Confirmée', tone: 'success' },
  completed: { label: 'Réalisée', tone: 'navy' },
  cancelled: { label: 'Annulée', tone: 'muted' },
  no_show: { label: 'Absent', tone: 'danger' },
}

export const TIME_SLOTS: Record<TimeSlot, string> = {
  morning: 'Matin',
  afternoon: 'Après-midi',
  evening: 'Soirée',
  any: 'Indifférent',
}

export const ACTIVITY_TYPES: Record<LeadActivityType, string> = {
  note: 'Note interne',
  call: 'Appel',
  email: 'E-mail',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  meeting: 'Rendez-vous',
  visit: 'Visite',
  status_change: 'Changement de statut',
  assignment: 'Affectation',
  inquiry_received: 'Demande reçue',
  viewing_requested: 'Demande de visite',
  system: 'Système',
}

export const ROLES: Record<RoleCode, string> = {
  super_admin: 'Super administrateur',
  admin: 'Administrateur',
  sales_manager: 'Responsable commercial',
  agent: 'Agent immobilier',
}

export const AMENITY_CATEGORIES: Record<string, string> = {
  comfort: 'Confort',
  security: 'Sécurité',
  outdoor: 'Extérieur',
  services: 'Services',
  building: 'Immeuble',
  utilities: 'Équipements techniques',
}

export const AUDIT_ACTIONS: Record<string, EnumMeta> = {
  INSERT: { label: 'Création', tone: 'success' },
  UPDATE: { label: 'Modification', tone: 'info' },
  DELETE: { label: 'Suppression', tone: 'danger' },
  RPC: { label: 'Opération', tone: 'navy' },
}

export const AUDIT_TABLES: Record<string, string> = {
  properties: 'Biens',
  property_media: 'Photos',
  property_documents: 'Documents',
  leads: 'Prospects',
  user_roles: 'Rôles',
  profiles: 'Comptes',
  agents: 'Agents',
  agency_settings: "Paramètres de l'agence",
  app_settings: 'Paramètres techniques',
  localities: 'Localités',
  property_types: 'Types de biens',
  amenities: 'Équipements',
}

/** Libellés des colonnes les plus fréquentes dans le journal d'audit. */
export const AUDIT_FIELDS: Record<string, string> = {
  publication_status: 'Publication',
  commercial_status: 'Statut commercial',
  price_amount: 'Prix',
  price_on_request: 'Prix sur demande',
  agent_id: 'Agent responsable',
  assigned_agent_id: 'Agent affecté',
  is_featured: 'Mise en avant',
  transaction_type: 'Transaction',
  title: 'Titre',
  slug: 'Adresse web',
  address_visibility: "Visibilité de l'adresse",
  status: 'Statut',
  email: 'E-mail',
  phone: 'Téléphone',
  full_name: 'Nom',
  is_active: 'Actif',
  is_public: 'Public',
  display_name: 'Nom affiché',
  role_code: 'Rôle',
  public_phone: 'Téléphone public',
  whatsapp_phone: 'WhatsApp',
  public_email: 'E-mail public',
  storage_path: 'Fichier',
  operation: 'Opération',
}
