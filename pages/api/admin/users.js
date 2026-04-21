import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { resolveUserRole, isAdminRole } from '@/lib/authz'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' })
    }
    const token = authHeader.split(' ')[1]

    // Verify user role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: 'Server configuration error' })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const role = resolveUserRole(user)
    if (!isAdminRole(role)) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' })
    }

    // Initialize Admin Supabase
    const adminSupabase = getSupabaseAdmin()

    // Get users (paginate to retrieve all)
    const users = []
    const perPage = 100
    let page = 1
    const maxPages = 200 // safety cap: 20,000 users

    while (page <= maxPages) {
      const { data, error: usersError } = await adminSupabase.auth.admin.listUsers({ page, perPage })

      if (usersError) {
        throw usersError
      }

      const pageUsers = data?.users ?? []
      users.push(...pageUsers)

      if (pageUsers.length < perPage) {
        break
      }

      page += 1
    }

    const mappedUsers = users.map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      role: resolveUserRole(u)
    }))

    return res.status(200).json({ users: mappedUsers })
  } catch (error) {
    console.error('List users failed:', error)
    if (error.message && error.message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return res.status(500).json({ error: 'Hệ thống thiếu biến môi trường SUPABASE_SERVICE_ROLE_KEY. Vui lòng bổ sung vào .env.' })
    }
    return res.status(500).json({ error: 'Có lỗi xảy ra khi lấy danh sách người dùng.' })
  }
}
