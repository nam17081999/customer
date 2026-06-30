import { verifyUserToken } from '@/api/auth/auth-client'
import { isAdminRole, resolveUserRole } from '@/lib/authz'

export async function requireAdminApiUser(req) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing authorization header', status: 401 }
  }

  const token = authHeader.split(' ')[1]
  const { user, error: authError } = await verifyUserToken(token)

  if (authError || !user) {
    return { error: 'Invalid token', status: 401 }
  }

  const role = resolveUserRole(user)
  if (!isAdminRole(role)) {
    return { error: 'Forbidden: Admin access required', status: 403 }
  }

  return { user, role, error: '', status: 200 }
}
