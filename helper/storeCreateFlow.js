import { DEFAULT_STORE_TYPE } from '@/lib/constants'
import { toTitleCaseVI } from '@/lib/utils'
import { haversineKm } from '@/helper/distance'
import { parseCoordinate } from '@/helper/coordinate'
import { findDuplicatePhoneStores, validateVietnamPhone } from '@/helper/validation'
import {
  buildDuplicatePhoneMessage,
  extractCoordsFromMapsUrl,
  getStoreFormFinalCoordinates,
  resolveMapsLinkCoordinates,
} from '@/helper/storeFormShared'

export { extractCoordsFromMapsUrl, resolveMapsLinkCoordinates }

export function findNearestDistrictWard(stores, originLat, originLng) {
  if (originLat == null || originLng == null) return null

  const nearestStore = (Array.isArray(stores) ? stores : []).reduce((nearest, store) => {
    const storeLat = parseCoordinate(store?.latitude)
    const storeLng = parseCoordinate(store?.longitude)
    const storeDistrict = String(store?.district || '').trim()
    const storeWard = String(store?.ward || '').trim()

    if (!Number.isFinite(storeLat) || !Number.isFinite(storeLng) || !storeDistrict || !storeWard) {
      return nearest
    }

    const distance = haversineKm(originLat, originLng, storeLat, storeLng)
    if (!nearest || distance < nearest.distance) {
      return {
        distance,
        district: toTitleCaseVI(storeDistrict),
        ward: toTitleCaseVI(storeWard),
      }
    }

    return nearest
  }, null)

  if (!nearestStore) return null

  return {
    district: nearestStore.district,
    ward: nearestStore.ward,
  }
}

export function buildCreateDuplicatePhoneMessage(matches, label = 'Số điện thoại') {
  return buildDuplicatePhoneMessage(matches, label)
}

export function validateStoreCreateStep2({
  district,
  ward,
  phone,
  phoneSecondary,
  stores,
  requirePhone = false,
}) {
  const fieldErrors = {}
  const rawDistrict = String(district || '').trim()
  const rawWard = String(ward || '').trim()
  const rawPhone = String(phone || '').trim()
  const rawPhoneSecondary = String(phoneSecondary || '').trim()

  if (!rawDistrict) fieldErrors.district = 'Vui lòng nhập quận/huyện'
  if (!rawWard) fieldErrors.ward = 'Vui lòng nhập xã/phường'
  if (requirePhone && !rawPhone) {
    fieldErrors.phone = 'Vui lòng nhập số điện thoại để lưu luôn'
  }
  if (!rawPhone && rawPhoneSecondary) {
    fieldErrors.phone = 'Vui lòng nhập số điện thoại 1 trước'
  }

  let normalizedPhone = ''
  let normalizedPhoneSecondary = ''

  if (!fieldErrors.phone && rawPhone) {
    const validation = validateVietnamPhone(rawPhone)
    if (!validation.isValid) {
      fieldErrors.phone = validation.message
    } else {
      normalizedPhone = validation.normalized
    }
  }

  if (!fieldErrors.phone && !fieldErrors.phone_secondary && rawPhoneSecondary) {
    const validation = validateVietnamPhone(rawPhoneSecondary)
    if (!validation.isValid) {
      fieldErrors.phone_secondary = validation.message
    } else {
      normalizedPhoneSecondary = validation.normalized
    }
  }

  if (!fieldErrors.phone && !fieldErrors.phone_secondary && normalizedPhone && normalizedPhoneSecondary && normalizedPhone === normalizedPhoneSecondary) {
    fieldErrors.phone_secondary = 'Số điện thoại 2 không được trùng số điện thoại 1'
  }

  const safeStores = Array.isArray(stores) ? stores : []
  if (!fieldErrors.phone && !fieldErrors.phone_secondary && (normalizedPhone || normalizedPhoneSecondary)) {
    if (normalizedPhone) {
      const duplicatePhoneStores = findDuplicatePhoneStores(safeStores, normalizedPhone)
      if (duplicatePhoneStores.length > 0) {
        fieldErrors.phone = buildCreateDuplicatePhoneMessage(duplicatePhoneStores, 'Số điện thoại 1')
      }
    }

    if (!fieldErrors.phone_secondary && normalizedPhoneSecondary) {
      const duplicatePhoneStores = findDuplicatePhoneStores(safeStores, normalizedPhoneSecondary)
      if (duplicatePhoneStores.length > 0) {
        fieldErrors.phone_secondary = buildCreateDuplicatePhoneMessage(duplicatePhoneStores, 'Số điện thoại 2')
      }
    }
  }

  return {
    fieldErrors,
    normalizedPhone,
    normalizedPhoneSecondary,
  }
}

export function getCreateFinalCoordinates({
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

export function buildCreateInsertPayload({
  values,
  validatedPhone,
  validatedPhoneSecondary,
  latitude,
  longitude,
  isAdmin,
  isTelesale,
}) {
  return {
    name: toTitleCaseVI(String(values?.name || '').trim()),
    store_type: values?.storeType || DEFAULT_STORE_TYPE,
    address_detail: toTitleCaseVI(String(values?.addressDetail || '').trim()) || null,
    ward: toTitleCaseVI(String(values?.ward || '').trim()) || null,
    district: toTitleCaseVI(String(values?.district || '').trim()) || null,
    active: Boolean(isAdmin),
    is_potential: Boolean(isTelesale),
    note: String(values?.note || '').trim() || null,
    phone: validatedPhone || null,
    phone_secondary: validatedPhoneSecondary || null,
    latitude,
    longitude,
  }
}

export function buildCreateSteps(telesaleNoStep3) {
  if (telesaleNoStep3) {
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

export function shouldShowCreateMobileActionBar({
  currentStep,
  allowDuplicate,
  duplicateCandidates,
}) {
  return (
    (currentStep === 1 && (allowDuplicate || (duplicateCandidates || []).length === 0))
    || currentStep === 2
    || currentStep === 3
  )
}
