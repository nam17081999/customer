import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminApiUser } from '@/lib/admin-api-auth'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const adminCheck = await requireAdminApiUser(req)
    if (adminCheck.error) {
      return res.status(adminCheck.status).json({ error: adminCheck.error })
    }

    const adminSupabase = getSupabaseAdmin()

    const { data, error } = await adminSupabase
      .from('vehicle_fuel_logs')
      .select('id,vehicle_id,fuel_amount,note,recorded_at,created_by,created_at,vehicles(id,name,plate)')
      .order('recorded_at', { ascending: false })
      .limit(100)

    if (error) throw error
    return res.status(200).json(data || [])
  } catch (error) {
    console.error('Fuel log API failed:', error)
    return res.status(500).json({ error: 'Có lỗi xảy ra khi tải dữ liệu.' })
  }
}
