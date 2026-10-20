import { UserRole } from '@prisma/client';

/**
 * Fine-grained admin permissions. RBAC is enforced on the API (guards), not
 * merely hidden in the UI. Roles provide a default permission set; explicit
 * AdminPermissionGrant rows can extend a specific admin's set.
 */
export const ALL_PERMISSIONS = [
  'overview.read',
  'users.read',
  'users.freeze',
  'users.credit',
  'users.manage',
  'wallets.read',
  'wallets.adjust',
  'ledger.reverse',
  'orders.read',
  'orders.settle',
  'disputes.read',
  'disputes.manage',
  'disputes.refund',
  'audit.read',
  'settings.read',
  'settings.write',
  'providers.switch_live',
  'reports.read',
  'risk.read',
  'risk.manage',
  'admins.manage',
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

const READ_ONLY: Permission[] = ALL_PERMISSIONS.filter((p) => p.endsWith('.read'));

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  ADMIN: [...ALL_PERMISSIONS],
  FINANCE: [
    'overview.read',
    'users.read',
    'wallets.read',
    'wallets.adjust',
    'ledger.reverse',
    'orders.read',
    'disputes.read',
    'disputes.manage',
    'disputes.refund',
    'audit.read',
    'settings.read',
    'reports.read',
    'risk.read',
  ],
  SUPPORT: [
    'overview.read',
    'users.read',
    'users.freeze',
    'wallets.read',
    'orders.read',
    'orders.settle',
    'disputes.read',
    'disputes.manage',
    'disputes.refund',
    'audit.read',
    'reports.read',
    'risk.read',
  ],
  VIEWER: [...READ_ONLY],
};

/** Roles allowed to sign in to the admin console at all. */
export const ADMIN_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.FINANCE,
  UserRole.SUPPORT,
  UserRole.VIEWER,
];

export function permissionsForRole(role: string | null | undefined): Permission[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role] ?? [];
}

export function isPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as readonly string[]).includes(value);
}
