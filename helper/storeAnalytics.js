import { hasValidCoordinates as hasValidCoords } from '@/helper/coordinate'

export function formatDateTime(value) {
  if (!value) return 'Chưa có dữ liệu'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu'
  return date.toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit',
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function isToday(value) {
  if (!value) return false
  const d = new Date(value)
  const n = new Date()
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
}

function isYesterday(value) {
  if (!value) return false
  const d = new Date(value)
  const y = new Date()
  y.setDate(y.getDate() - 1)
  return d.getDate() === y.getDate() && d.getMonth() === y.getMonth() && d.getFullYear() === y.getFullYear()
}

export function formatOrderTime(value) {
  if (!value) return ''
  if (isToday(value)) return formatTime(value)
  if (isYesterday(value)) return 'Hôm qua'
  return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

export function hasValidCoordinates(store) {
  const lat = store?.latitude
  const lng = store?.longitude
  if (lat == null || lng == null) return false
  return hasValidCoords(Number(lat), Number(lng))
}
