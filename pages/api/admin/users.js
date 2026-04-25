import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminApiUser } from '@/lib/admin-api-auth'
import {
  mapSupabaseAdminUser,
  validateCreateAdminUserInput,
} from '@/helper/adminUserManagement'

async function listUsers(adminSupabase) {
  const users = []
  const perPage = 100
  let page = 1
  const maxPages = 200

  while (page <= maxPages) {
    const { data, error } = await adminSupabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const pageUsers = data?.users ?? []
    users.push(...pageUsers)

    if (pageUsers.length < perPage) break
    page += 1
  }

  return users.map(mapSupabaseAdminUser)
}

async function createUser(req, res, adminSupabase) {
  const validation = validateCreateAdminUserInput(req.body)
  if (validation.error) {
    return res.status(400).json({ error: validation.error })
  }

  const { email, password, role } = validation.values
  const { data, error } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
  })

  if (error) throw error

  return res.status(201).json({ user: mapSupabaseAdminUser(data.user) })
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const adminCheck = await requireAdminApiUser(req)
    if (adminCheck.error) {
      return res.status(adminCheck.status).json({ error: adminCheck.error })
    }

    const adminSupabase = getSupabaseAdmin()

    if (req.method === 'POST') {
      return createUser(req, res, adminSupabase)
    }

    const users = await listUsers(adminSupabase)
    return res.status(200).json({ users })
  } catch (error) {
    console.error('Admin users API failed:', error)
    if (error.message && error.message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return res.status(500).json({ error: 'Hệ thống thiếu biến môi trường SUPABASE_SERVICE_ROLE_KEY. Vui lòng bổ sung vào .env.' })
    }
    if (error.message && error.message.includes('already registered')) {
      return res.status(409).json({ error: 'Email này đã có tài khoản.' })
    }
    return res.status(500).json({ error: 'Có lỗi xảy ra khi xử lý tài khoản.' })
  }
}
