import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminApiUser } from '@/lib/admin-api-auth'

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query
  const { name, phone } = req.body

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid user ID' })
  }

  try {
    const adminCheck = await requireAdminApiUser(req)
    if (adminCheck.error) {
      return res.status(adminCheck.status).json({ error: adminCheck.error })
    }

    const adminSupabase = getSupabaseAdmin()

    const { data: { user: targetUser }, error: getUserError } = await adminSupabase.auth.admin.getUserById(id)
    if (getUserError || !targetUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    const meta = targetUser.user_metadata || {}
    const newMeta = { ...meta }
    if (name !== undefined) newMeta.name = String(name).trim()
    if (phone !== undefined) newMeta.phone = String(phone).trim()

    const { data: { user: updatedUser }, error: updateError } = await adminSupabase.auth.admin.updateUserById(
      id,
      { user_metadata: newMeta }
    )

    if (updateError) throw updateError

    return res.status(200).json({
      id: updatedUser.id,
      name: updatedUser.user_metadata?.name || '',
      phone: updatedUser.user_metadata?.phone || '',
    })
  } catch (error) {
    console.error('Update user metadata failed:', error)
    return res.status(500).json({ error: 'Có lỗi xảy ra khi cập nhật thông tin người dùng.' })
  }
}
