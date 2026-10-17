import type { LucideIcon } from 'lucide-react'
import {
  Building2,
  CalendarCheck,
  History,
  Inbox,
  LayoutDashboard,
  Settings,
  UserCog,
  Users,
  IdCard,
} from 'lucide-react'
import type { PermissionCode } from '@/types'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Au moins une de ces permissions (vide = tout membre actif). */
  anyOf: readonly PermissionCode[]
  end?: boolean
  counter?: 'inquiries' | 'viewings'
}

export interface NavSection {
  label: string
  items: NavItem[]
}

export const NAVIGATION: NavSection[] = [
  {
    label: 'Pilotage',
    items: [{ to: '/', label: 'Tableau de bord', icon: LayoutDashboard, anyOf: ['stats.read_own', 'stats.read_all'], end: true }],
  },
  {
    label: 'Catalogue',
    items: [{ to: '/biens', label: 'Biens immobiliers', icon: Building2, anyOf: ['properties.read_all', 'properties.create'] }],
  },
  {
    label: 'Commercial',
    items: [
      { to: '/demandes', label: 'Demandes', icon: Inbox, anyOf: ['leads.access_assigned', 'leads.read_all'], counter: 'inquiries' },
      { to: '/visites', label: 'Visites', icon: CalendarCheck, anyOf: ['leads.access_assigned', 'leads.read_all'], counter: 'viewings' },
      { to: '/prospects', label: 'Prospects', icon: Users, anyOf: ['leads.access_assigned', 'leads.read_all'] },
      { to: '/agents', label: 'Agents', icon: IdCard, anyOf: [] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/utilisateurs', label: 'Utilisateurs', icon: UserCog, anyOf: ['users.read'] },
      { to: '/parametres', label: "Paramètres de l'agence", icon: Settings, anyOf: ['settings.manage'] },
      { to: '/journal', label: "Journal d'audit", icon: History, anyOf: ['audit.read'] },
    ],
  },
]
