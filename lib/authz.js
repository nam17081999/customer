export const USER_ROLES = {
  GUEST: 'guest',
  TELESALE: 'telesale',
  ADMIN: 'admin',
}

function normalizeRoleValue(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === USER_ROLES.ADMIN) return USER_ROLES.ADMIN
  if (normalized === USER_ROLES.TELESALE) return USER_ROLES.TELESALE
  return ''
}

export function resolveUserRole(user) {
  if (!user) return USER_ROLES.GUEST

  const directCandidates = [
    user?.app_metadata?.role,
    user?.user_metadata?.role,
  ]

  for (const candidate of directCandidates) {
    const normalized = normalizeRoleValue(candidate)
    if (normalized) return normalized
  }

  const roleLists = [
    user?.app_metadata?.roles,
    user?.user_metadata?.roles,
  ]

  for (const list of roleLists) {
    if (!Array.isArray(list)) continue
    if (list.some((item) => normalizeRoleValue(item) === USER_ROLES.ADMIN)) return USER_ROLES.ADMIN
    if (list.some((item) => normalizeRoleValue(item) === USER_ROLES.TELESALE)) return USER_ROLES.TELESALE
  }

  if (user?.app_metadata?.is_admin === true || user?.user_metadata?.is_admin === true) {
    return USER_ROLES.ADMIN
  }

  // Backward-compatible fallback: old authenticated accounts keep admin access
  // until their metadata is assigned explicitly.
  return USER_ROLES.ADMIN
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

