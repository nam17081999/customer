export const USER_ROLES = {
  GUEST: 'guest',
  TELESALE: 'telesale',
  ADMIN: 'admin',
}

const ROLE_ALIASES = {
  [USER_ROLES.ADMIN]: new Set([
    'admin',
    'administrator',
    'super_admin',
    'superadmin',
  ]),
  [USER_ROLES.TELESALE]: new Set([
    'telesale',
    'tele_sale',
    'tele-sale',
    'sales',
    'sale',
  ]),
}

function normalizeRoleValue(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return ''
  if (ROLE_ALIASES[USER_ROLES.ADMIN].has(normalized)) return USER_ROLES.ADMIN
  if (ROLE_ALIASES[USER_ROLES.TELESALE].has(normalized)) return USER_ROLES.TELESALE
  return ''
}

function parseBooleanFlag(value) {
  if (value === true || value === false) return value
  if (typeof value === 'number') return value === 1
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}

export function resolveUserRole(user) {
  if (!user) return USER_ROLES.GUEST

  // Security rule:
  // Only trust app_metadata because user_metadata can be edited by the user.
  const directCandidates = [
    user?.app_metadata?.role,
    user?.app_metadata?.user_role,
  ]

  for (const candidate of directCandidates) {
    const normalized = normalizeRoleValue(candidate)
    if (normalized) return normalized
  }

  const roleLists = [
    user?.app_metadata?.roles,
  ]

  for (const list of roleLists) {
    if (!Array.isArray(list)) continue
    if (list.some((item) => normalizeRoleValue(item) === USER_ROLES.ADMIN)) return USER_ROLES.ADMIN
    if (list.some((item) => normalizeRoleValue(item) === USER_ROLES.TELESALE)) return USER_ROLES.TELESALE
  }

  const adminFlags = [
    user?.app_metadata?.is_admin,
    user?.app_metadata?.admin,
  ]

  if (adminFlags.some((flag) => parseBooleanFlag(flag))) {
    return USER_ROLES.ADMIN
  }

  return USER_ROLES.GUEST
}

export function isAdminRole(role) {
  return role === USER_ROLES.ADMIN
}

export function isTelesaleRole(role) {
  return role === USER_ROLES.TELESALE
}

export function isAuthenticatedRole(role) {
  return role === USER_ROLES.ADMIN || role === USER_ROLES.TELESALE
}
