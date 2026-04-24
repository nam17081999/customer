import { DEFAULT_STORE_TYPE } from '@/lib/constants'
import { hasValidCoordinates, parseCoordinate } from '@/helper/coordinate'
import { validateVietnamPhone } from '@/helper/validation'
import { toTitleCaseVI } from '@/lib/utils'

export const STORE_REPORT_EDIT_FIELDS = [
  { key: 'name', label: 'Tên' },
  { key: 'store_type', label: 'Loại cửa hàng' },
  { key: 'address_detail', label: 'Địa chỉ chi tiết' },
  { key: 'ward', label: 'Xã/Phường' },
  { key: 'district', label: 'Quận/Huyện' },
  { key: 'phone', label: 'Số điện thoại' },
  { key: 'note', label: 'Ghi chú' },
  { key: 'latitude', label: 'Vĩ độ' },
  { key: 'longitude', label: 'Kinh độ' },
]

export function normalizeStoreReportCoordinate(value) {
  const parsed = parseCoordinate(value)
  if (!Number.isFinite(parsed)) return null
  return Number(parsed.toFixed(7))
}

export function buildStoreReportProposedChanges({ store, values, normalizedPhoneOverride } = {}) {
  const sourceStore = store || {}
  const nextValues = values || {}
  const proposed = {}
  const rawName = String(nextValues.name || '').trim()
  const currentName = String(sourceStore.name || '').trim()
  const normalizedName = toTitleCaseVI(rawName)
  const normalizedStoreType = nextValues.storeType || DEFAULT_STORE_TYPE
  const rawAddressDetail = String(nextValues.addressDetail || '').trim()
  const currentAddressDetail = String(sourceStore.address_detail || '').trim()
  const normalizedAddressDetail = rawAddressDetail
    ? toTitleCaseVI(rawAddressDetail)
    : null
  const rawWard = String(nextValues.ward || '').trim()
  const currentWard = String(sourceStore.ward || '').trim()
  const normalizedWard = rawWard
    ? toTitleCaseVI(rawWard)
    : null
  const rawDistrict = String(nextValues.district || '').trim()
  const currentDistrict = String(sourceStore.district || '').trim()
  const normalizedDistrict = rawDistrict
    ? toTitleCaseVI(rawDistrict)
    : null
  const normalizedPhone = normalizedPhoneOverride !== undefined
    ? normalizedPhoneOverride
    : (String(nextValues.phone || '').trim() || null)
  const currentPhoneValidation = validateVietnamPhone(String(sourceStore.phone || '').trim())
  const currentPhone = currentPhoneValidation.isValid
    ? currentPhoneValidation.normalized
    : (String(sourceStore.phone || '').trim() || null)
  const rawNote = String(nextValues.note || '').trim()
  const currentNote = String(sourceStore.note || '').trim()
  const normalizedNote = rawNote || null

  if (normalizedName && rawName !== currentName) proposed.name = normalizedName
  if ((sourceStore.store_type || DEFAULT_STORE_TYPE) !== normalizedStoreType) proposed.store_type = normalizedStoreType
  if ((currentAddressDetail || null) !== normalizedAddressDetail && rawAddressDetail !== currentAddressDetail) proposed.address_detail = normalizedAddressDetail
  if ((currentWard || null) !== normalizedWard && rawWard !== currentWard) proposed.ward = normalizedWard
  if ((currentDistrict || null) !== normalizedDistrict && rawDistrict !== currentDistrict) proposed.district = normalizedDistrict
  if ((currentPhone || null) !== normalizedPhone) proposed.phone = normalizedPhone
  if ((currentNote || null) !== normalizedNote) proposed.note = normalizedNote

  const currentLat = normalizeStoreReportCoordinate(sourceStore.latitude)
  const currentLng = normalizeStoreReportCoordinate(sourceStore.longitude)
  const nextLat = normalizeStoreReportCoordinate(nextValues.latitude)
  const nextLng = normalizeStoreReportCoordinate(nextValues.longitude)

  if (currentLat !== nextLat) proposed.latitude = nextLat
  if (currentLng !== nextLng) proposed.longitude = nextLng

  return proposed
}

export function validateStoreReportSubmission({ mode, reasons, store, values } = {}) {
  if (!mode) {
    return { error: 'Vui lòng chọn loại báo cáo.' }
  }

  if (mode === 'reason') {
    if (!Array.isArray(reasons) || reasons.length === 0) {
      return { error: 'Vui lòng chọn ít nhất một lý do.' }
    }
    return { error: '', proposedChanges: null }
  }

  const nextValues = values || {}
  if (!String(nextValues.name || '').trim()) {
    return { error: 'Tên cửa hàng không được để trống.' }
  }

  if (!String(nextValues.district || '').trim() || !String(nextValues.ward || '').trim()) {
    return { error: 'Vui lòng nhập đủ quận/huyện và xã/phường.' }
  }

  const rawPhone = String(nextValues.phone || '').trim()
  let normalizedPhoneOverride = undefined
  if (rawPhone) {
    const validation = validateVietnamPhone(rawPhone)
    if (!validation.isValid) {
      return { error: validation.message }
    }
    normalizedPhoneOverride = validation.normalized
  }

  const nextLat = normalizeStoreReportCoordinate(nextValues.latitude)
  const nextLng = normalizeStoreReportCoordinate(nextValues.longitude)
  const hasOneCoordinate = nextLat != null || nextLng != null
  if (hasOneCoordinate && !hasValidCoordinates(nextLat, nextLng)) {
    return { error: 'Vị trí chưa hợp lệ. Vui lòng chọn lại trên bản đồ.' }
  }

  const proposedChanges = buildStoreReportProposedChanges({
    store,
    values: {
      ...nextValues,
      latitude: nextLat,
      longitude: nextLng,
    },
    normalizedPhoneOverride,
  })

  if (Object.keys(proposedChanges).length === 0) {
    return { error: 'Bạn chưa thay đổi thông tin nào.' }
  }

  return {
    error: '',
    proposedChanges,
  }
}

export function buildStoreReportPayload({ storeId, mode, reasons, proposedChanges, reporterId } = {}) {
  return {
    store_id: storeId,
    report_type: mode === 'edit' ? 'edit' : 'reason_only',
    reason_codes: mode === 'reason' ? reasons : null,
    proposed_changes: mode === 'edit' ? proposedChanges : null,
    reporter_id: reporterId || null,
  }
}

export function summarizeStoreReport(report) {
  const proposed = report?.proposed_changes || {}
  const keys = Object.keys(proposed)
  const hasLocation = keys.includes('latitude') || keys.includes('longitude')
  const fieldCount = keys.filter((key) => !['latitude', 'longitude'].includes(key)).length + (hasLocation ? 1 : 0)
  return { proposed, hasLocation, fieldCount }
}

export function getStoreReportSuccessMessage() {
  return 'Đã gửi báo cáo. Admin sẽ xem xét và cập nhật.'
}
