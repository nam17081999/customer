import { DEFAULT_STORE_TYPE } from '@/lib/constants'
import { toTitleCaseVI } from '@/lib/utils'
import { buildDuplicatePhoneMessage, getStoreFormFinalCoordinates } from '@/helper/storeFormShared'
import { findDuplicatePhoneStores, validateVietnamPhone } from '@/helper/validation'

function hasText(value) {
  return Boolean(String(value ?? '').trim())
}

function hasFiniteCoordinates(coordinates) {
  return Number.isFinite(coordinates?.latitude) && Number.isFinite(coordinates?.longitude)
}

export { buildDuplicatePhoneMessage }

export function buildEditSteps() {
  return [
    { num: 1, label: 'Tên' },
    { num: 2, label: 'Thông tin' },
    { num: 3, label: 'Vị trí' },
  ]
}

export function buildSupplementLocks(store, canSupplementLocation) {
  return {
    name: hasText(store?.name),
    storeType: hasText(store?.store_type),
    addressDetail: hasText(store?.address_detail),
    ward: hasText(store?.ward),
    district: hasText(store?.district),
    phone: hasText(store?.phone),
    phoneSecondary: hasText(store?.phone_secondary),
    note: hasText(store?.note),
    location: !canSupplementLocation,
  }
}

export function buildSupplementSteps(canSupplementLocation) {
  if (!canSupplementLocation) {
    return [
      { num: 1, label: 'Tên' },
      { num: 2, label: 'Thông tin' },
    ]
  }

  return [
    { num: 1, label: 'Tên' },
    { num: 2, label: 'Thông tin' },
    { num: 3, label: 'Vị trí' },
  ]
}

export function hasEditableSupplementFields(supplementLocks) {
  return Object.values(supplementLocks || {}).some((value) => value === false)
}

export function getFinalCoordinates({
  userHasEditedMap,
  pickedLat,
  pickedLng,
  initialGPSLat,
  initialGPSLng,
}) {
  return getStoreFormFinalCoordinates({
    userHasEditedMap,
    pickedLat,
    pickedLng,
    initialGPSLat,
    initialGPSLng,
  })
}

export function buildSupplementUpdates({
  supplementLocks,
  values,
  validatedPhone,
  validatedPhoneSecondary,
  coordinates,
  nowIso,
}) {
  const updates = {}

  if (!supplementLocks?.name) {
    const normalizedName = toTitleCaseVI(String(values?.name || '').trim())
    if (normalizedName) updates.name = normalizedName
  }
  if (!supplementLocks?.storeType) {
    const normalizedStoreType = values?.storeType || DEFAULT_STORE_TYPE
    if (normalizedStoreType) updates.store_type = normalizedStoreType
  }
  if (!supplementLocks?.addressDetail) {
    const normalizedDetail = String(values?.addressDetail || '').trim()
      ? toTitleCaseVI(String(values.addressDetail).trim())
      : ''
    if (normalizedDetail) updates.address_detail = normalizedDetail
  }
  if (!supplementLocks?.district) {
    const normalizedDistrict = String(values?.district || '').trim()
      ? toTitleCaseVI(String(values.district).trim())
      : ''
    if (normalizedDistrict) updates.district = normalizedDistrict
  }
  if (!supplementLocks?.ward) {
    const normalizedWard = String(values?.ward || '').trim()
      ? toTitleCaseVI(String(values.ward).trim())
      : ''
    if (normalizedWard) updates.ward = normalizedWard
  }
  if (!supplementLocks?.phone && validatedPhone) {
    updates.phone = validatedPhone
  }
  if (!supplementLocks?.phoneSecondary && validatedPhoneSecondary) {
    updates.phone_secondary = validatedPhoneSecondary
  }
  if (!supplementLocks?.note) {
    const normalizedNote = String(values?.note || '').trim()
    if (normalizedNote) updates.note = normalizedNote
  }
  if (!supplementLocks?.location && hasFiniteCoordinates(coordinates)) {
    updates.latitude = coordinates.latitude
    updates.longitude = coordinates.longitude
  }

  if (Object.keys(updates).length === 0) return {}
  return {
    ...updates,
    updated_at: nowIso,
  }
}

export function buildEditUpdates({
  values,
  validatedPhone,
  validatedPhoneSecondary,
  active,
  coordinates,
  nowIso,
}) {
  return {
    name: toTitleCaseVI(String(values?.name || '').trim()),
    store_type: values?.storeType || DEFAULT_STORE_TYPE,
    address_detail: String(values?.addressDetail || '').trim()
      ? toTitleCaseVI(String(values.addressDetail).trim())
      : null,
    ward: String(values?.ward || '').trim()
      ? toTitleCaseVI(String(values.ward).trim())
      : null,
    district: String(values?.district || '').trim()
      ? toTitleCaseVI(String(values.district).trim())
      : null,
    phone: validatedPhone || null,
    phone_secondary: validatedPhoneSecondary || null,
    note: String(values?.note || '').trim() || null,
    active: Boolean(active),
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
    updated_at: nowIso,
  }
}

export function validateStoreEditPhones({
  phone,
  phoneSecondary,
  store,
  storeId,
  stores,
  supplementLocks,
  skipWhenLocked = false,
}) {
  const fallbackPrimary = skipWhenLocked && supplementLocks?.phone ? String(store?.phone || '').trim() : ''
  const fallbackSecondary = skipWhenLocked && supplementLocks?.phoneSecondary ? String(store?.phone_secondary || '').trim() : ''

  const rawPrimary = skipWhenLocked && supplementLocks?.phone ? fallbackPrimary : String(phone || '').trim()
  const rawSecondary = skipWhenLocked && supplementLocks?.phoneSecondary ? fallbackSecondary : String(phoneSecondary || '').trim()

  let normalizedPrimary = ''
  let normalizedSecondary = ''

  if (rawPrimary) {
    const validation = validateVietnamPhone(rawPrimary)
    if (!validation.isValid) {
      return { normalizedPhone: '', normalizedPhoneSecondary: '', error: validation.message }
    }
    normalizedPrimary = validation.normalized
  }

  if (!normalizedPrimary && rawSecondary) {
    return { normalizedPhone: '', normalizedPhoneSecondary: '', error: 'Vui lòng nhập số điện thoại 1 trước' }
  }

  if (rawSecondary) {
    const validation = validateVietnamPhone(rawSecondary)
    if (!validation.isValid) {
      return { normalizedPhone: normalizedPrimary, normalizedPhoneSecondary: '', error: validation.message }
    }
    normalizedSecondary = validation.normalized
  }

  if (normalizedPrimary && normalizedSecondary && normalizedPrimary === normalizedSecondary) {
    return {
      normalizedPhone: normalizedPrimary,
      normalizedPhoneSecondary: '',
      error: 'Số điện thoại 2 không được trùng số điện thoại 1',
    }
  }

  if (!normalizedPrimary && !normalizedSecondary) {
    return { normalizedPhone: '', normalizedPhoneSecondary: '', error: '' }
  }

  const safeStores = Array.isArray(stores) ? stores : []

  if (normalizedPrimary) {
    const duplicatePhoneStores = findDuplicatePhoneStores(safeStores, normalizedPrimary, { excludeStoreId: storeId })
    if (duplicatePhoneStores.length > 0) {
      return {
        normalizedPhone: '',
        normalizedPhoneSecondary: normalizedSecondary,
        error: buildDuplicatePhoneMessage(duplicatePhoneStores, 'Số điện thoại 1'),
      }
    }
  }

  if (normalizedSecondary) {
    const duplicatePhoneStores = findDuplicatePhoneStores(safeStores, normalizedSecondary, { excludeStoreId: storeId })
    if (duplicatePhoneStores.length > 0) {
      return {
        normalizedPhone: normalizedPrimary,
        normalizedPhoneSecondary: '',
        error: buildDuplicatePhoneMessage(duplicatePhoneStores, 'Số điện thoại 2'),
      }
    }
  }

  return { normalizedPhone: normalizedPrimary, normalizedPhoneSecondary: normalizedSecondary, error: '' }
}
