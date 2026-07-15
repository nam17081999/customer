import { db } from '@/api/db/client'

const VEHICLE_SELECT = 'id,name,plate,note,active,created_at'

export async function fetchActiveVehicles() {
  const { data, error } = await db
    .from('vehicles')
    .select(VEHICLE_SELECT)
    .eq('active', true)
    .order('name')
  return { data: data || [], error }
}

export async function createFuelLog({ vehicle_id, fuel_amount, fuel_cost, note }) {
  const { data, error } = await db
    .from('vehicle_fuel_logs')
    .insert([{ vehicle_id, fuel_amount, fuel_cost, note }])
    .select('id, vehicle_id, fuel_amount, fuel_cost, note, recorded_at')
  return { data: data?.[0] || null, error }
}
