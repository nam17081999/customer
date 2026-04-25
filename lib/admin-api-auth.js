import { createClient } from '@supabase/supabase-js'
import { isAdminRole, resolveUserRole } from '@/lib/authz'

export async function requireAdminApiUser(req) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing authorization header', status: 401 }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: 'Server configuration error', status: 500 }
  }

  const token = authHeader.split(' ')[1]
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return { error: 'Invalid token', status: 401 }
  }

  const role = resolveUserRole(user)
  if (!isAdminRole(role)) {
    return { error: 'Forbidden: Admin access required', status: 403 }
  }

  return { user, role, error: '', status: 200 }
}
