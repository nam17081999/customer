export const ACTION_LABELS = {
  edit: 'Chỉnh sửa',
  supplement: 'Bổ sung',
  verify: 'Xác thực',
  report_apply: 'Duyệt báo cáo',
  delete_soft: 'Xóa mềm',
  telesale_potential_toggle: 'Đổi trạng thái tiềm năng',
}

export const FIELD_LABELS = {
  name: 'Tên',
  store_type: 'Loại cửa hàng',
  address_detail: 'Địa chỉ chi tiết',
  ward: 'Xã/Phường',
  district: 'Quận/Huyện',
  phone: 'Số điện thoại',
  phone_secondary: 'Số điện thoại 2',
  note: 'Ghi chú',
  latitude: 'Vĩ độ',
  longitude: 'Kinh độ',
  active: 'Xác thực',
  deleted_at: 'Xóa mềm',
  is_potential: 'Tiềm năng',
  last_call_result: 'Kết quả gọi',
  sales_note: 'Ghi chú telesale',
}

export function formatFieldValue(key, value) {
  if (value === null || value === undefined || value === '') return '\u2014'
  if (key === 'latitude' || key === 'longitude') {
    const num = Number(value)
    if (!Number.isFinite(num)) return '\u2014'
    return num.toFixed(6)
  }
  if (key === 'active') return value ? 'Có' : 'Không'
  if (key === 'deleted_at') return value ? 'Có' : 'Không'
  return String(value)
}

export function getAvailableActionTypes(items) {
  return Array.from(
    new Set(items.map((row) => String(row?.action_type || '')).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, 'vi'))
}

export function getAvailableFields(items) {
  const keys = new Set()
  for (const row of items) {
    const changes = row?.changes && typeof row.changes === 'object' ? row.changes : {}
    Object.keys(changes).forEach((key) => keys.add(key))
  }
  return Array.from(keys).sort((a, b) => a.localeCompare(b, 'vi'))
}

export function filterEditHistoryItems({
  items = [],
  actionFilter = 'all',
  fieldFilter = 'all',
  searchTerm = '',
  actionLabels = ACTION_LABELS,
} = {}) {
  const q = String(searchTerm || '').trim().toLowerCase()
  return items.filter((row) => {
    if (actionFilter !== 'all' && String(row?.action_type || '') !== actionFilter) return false

    const changes = row?.changes && typeof row.changes === 'object' ? row.changes : {}
    const keys = Object.keys(changes)
    if (fieldFilter !== 'all' && !keys.includes(fieldFilter)) return false

    if (!q) return true
    const actionLabel = actionLabels[row.action_type] || String(row.action_type || '')
    const actorRole = String(row.actor_role || '')
    const joinedKeys = keys.join(' ')
    return (
      actionLabel.toLowerCase().includes(q) ||
      String(row.action_type || '').toLowerCase().includes(q) ||
      actorRole.toLowerCase().includes(q) ||
      joinedKeys.toLowerCase().includes(q)
    )
  })
}
