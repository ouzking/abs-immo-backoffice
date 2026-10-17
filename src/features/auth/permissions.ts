import type { MyAccess, PermissionCode, RoleCode } from '@/types'

/**
 * Aides d'affichage uniquement : la sécurité réelle est appliquée par
 * PostgreSQL (RLS, droits par colonne, garde-fous). Masquer un bouton ne
 * protège rien ; cela évite seulement de proposer une action vouée à l'échec.
 */
export function hasPermission(access: MyAccess | null | undefined, permission: PermissionCode): boolean {
  return !!access?.is_active && access.permissions.includes(permission)
}

export function hasAnyPermission(access: MyAccess | null | undefined, permissions: readonly PermissionCode[]): boolean {
  return permissions.length === 0 || permissions.some((p) => hasPermission(access, p))
}

export const ROLE_RANKS: Record<RoleCode, number> = { super_admin: 100, admin: 80, sales_manager: 60, agent: 40 }

/** Rôles que l'utilisateur peut attribuer (rang strictement inférieur, sauf super_admin). */
export function assignableRoles(access: MyAccess | null | undefined): RoleCode[] {
  if (!access || !hasPermission(access, 'roles.assign')) return []
  const isSuper = access.roles.includes('super_admin')
  return (Object.keys(ROLE_RANKS) as RoleCode[]).filter((r) => isSuper || ROLE_RANKS[r] < access.rank)
}

/** Libellé du rôle principal (le plus élevé). */
export function primaryRole(access: MyAccess | null | undefined): RoleCode | null {
  return access?.roles[0] ?? null
}
