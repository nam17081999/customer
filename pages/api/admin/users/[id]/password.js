import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminApiUser } from '@/lib/admin-api-auth'
import { validateResetAdminUserPasswordInput } from '@/helper/adminUserManagement'

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const adminCheck = await requireAdminApiUser(req)
    if (adminCheck.error) {
      return res.status(adminCheck.status).json({ error: adminCheck.error })
    }

    const validation = validateResetAdminUserPasswordInput({
      userId: req.query.id,
      password: req.body?.password,
    })

    if (validation.error) {
      return res.status(400).json({ error: validation.error })
    }

    const adminSupabase = getSupabaseAdmin()
    const { values } = validation
    const { data, error } = await adminSupabase.auth.admin.updateUserById(values.userId, {
      password: values.password,
    })

    if (error) throw error

    return res.status(200).json({ id: data.user.id, message: 'Đặt lại mật khẩu thành công.' })
  } catch (error) {
    console.error('Reset user password failed:', error)
    if (error.message && error.message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return res.status(500).json({ error: 'Hệ thống thiếu biến môi trường SUPABASE_SERVICE_ROLE_KEY. Vui lòng bổ sung vào .env.' })
    }
    return res.status(500).json({ error: 'Có lỗi xảy ra khi đặt lại mật khẩu.' })
  }
}
