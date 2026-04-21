import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { resolveUserRole, isAdminRole, USER_ROLES } from '@/lib/authz'

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query
  const { role: newRole } = req.body

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid user ID' })
  }

  // Allow only valid roles
  const validRoles = Object.values(USER_ROLES)
  if (!validRoles.includes(newRole)) {
    return res.status(400).json({ error: 'Invalid role value' })
  }

  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' })
    }
    const token = authHeader.split(' ')[1]

    // Verify the caller's role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl) {
      return res.status(500).json({ error: 'Hệ thống thiếu biến môi trường NEXT_PUBLIC_SUPABASE_URL. Vui lòng bổ sung vào .env.' })
    }

    if (!supabaseAnonKey) {
      return res.status(500).json({ error: 'Hệ thống thiếu biến môi trường NEXT_PUBLIC_SUPABASE_ANON_KEY. Vui lòng bổ sung vào .env.' })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !currentUser) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const currentRoleString = resolveUserRole(currentUser)
    if (!isAdminRole(currentRoleString)) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' })
    }

    // Initialize Admin Supabase
    const adminSupabase = getSupabaseAdmin()

    // Retrieve user current app_metadata
    const { data: { user: targetUser }, error: getUserError } = await adminSupabase.auth.admin.getUserById(id)

    if (getUserError || !targetUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    // We only update the role in app_metadata
    const app_metadata = targetUser.app_metadata || {}
    const new_app_metadata = { ...app_metadata, role: newRole }

    // Update the user
    const { data: { user: updatedUser }, error: updateUserError } = await adminSupabase.auth.admin.updateUserById(
      id,
      { app_metadata: new_app_metadata }
    )

    if (updateUserError) {
      throw updateUserError
    }

    return res.status(200).json({ 
      id: updatedUser.id, 
      role: resolveUserRole(updatedUser) 
    })
  } catch (error) {
    console.error('Update user role failed:', error)
    if (error.message && error.message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return res.status(500).json({ error: 'Hệ thống thiếu biến môi trường SUPABASE_SERVICE_ROLE_KEY. Vui lòng bổ sung vào .env.' })
    }
    return res.status(500).json({ error: 'Có lỗi xảy ra khi cập nhật quyền người dùng.' })
  }
}
