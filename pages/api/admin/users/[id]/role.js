import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { USER_ROLES, resolveUserRole } from '@/lib/authz'
import { requireAdminApiUser } from '@/lib/admin-api-auth'

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
    const adminCheck = await requireAdminApiUser(req)
    if (adminCheck.error) {
      return res.status(adminCheck.status).json({ error: adminCheck.error })
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
