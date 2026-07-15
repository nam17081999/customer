import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminApiUser } from '@/lib/admin-api-auth'

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
      const { name, plate, note } = req.body
      if (!name || !plate) {
        return res.status(400).json({ error: 'Vui lòng nhập tên xe và biển số.' })
      }

      const { data, error } = await adminSupabase
        .from('vehicles')
        .insert([{ name: name.trim(), plate: plate.trim(), note: note?.trim() || null }])
        .select('id,name,plate,note,active,created_at')
        .single()

      if (error) throw error
      return res.status(201).json(data)
    }

    const { data, error } = await adminSupabase
      .from('vehicles')
      .select('id,name,plate,note,active,created_at,updated_at')
      .order('created_at', { ascending: false })

    if (error) throw error
    return res.status(200).json(data || [])
  } catch (error) {
    console.error('Admin vehicles API failed:', error)
    return res.status(500).json({ error: 'Có lỗi xảy ra khi xử lý xe.' })
  }
}
