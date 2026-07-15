import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminApiUser } from '@/lib/admin-api-auth'

export default async function handler(req, res) {
  if (!['GET', 'PUT', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, PUT, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const adminCheck = await requireAdminApiUser(req)
    if (adminCheck.error) {
      return res.status(adminCheck.status).json({ error: adminCheck.error })
    }

    const { id } = req.query
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid vehicle ID' })
    }

    const adminSupabase = getSupabaseAdmin()

    if (req.method === 'GET') {
      const { data, error } = await adminSupabase
        .from('vehicles')
        .select('id,name,plate,note,active,created_at,updated_at')
        .eq('id', id)
        .single()

      if (error) return res.status(404).json({ error: 'Không tìm thấy xe.' })
      return res.status(200).json(data)
    }

    if (req.method === 'PUT') {
      const { name, plate, note, active } = req.body
      const updates = {}
      if (name !== undefined) updates.name = name.trim()
      if (plate !== undefined) updates.plate = plate.trim()
      if (note !== undefined) updates.note = note.trim() || null
      if (active !== undefined) updates.active = active
      updates.updated_at = new Date().toISOString()

      const { data, error } = await adminSupabase
        .from('vehicles')
        .update(updates)
        .eq('id', id)
        .select('id,name,plate,note,active,created_at,updated_at')
        .single()

      if (error) throw error
      return res.status(200).json(data)
    }

    if (req.method === 'DELETE') {
      const { error } = await adminSupabase
        .from('vehicles')
        .delete()
        .eq('id', id)

      if (error) throw error
      return res.status(200).json({ success: true })
    }
  } catch (error) {
    console.error('Admin vehicle API failed:', error)
    return res.status(500).json({ error: 'Có lỗi xảy ra.' })
  }
}
