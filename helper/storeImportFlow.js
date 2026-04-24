import {
  DEFAULT_STORE_TYPE,
  STORE_TYPE_OPTION_BY_VALUE,
  STORE_TYPE_OPTIONS,
} from '@/lib/constants'
import { toTitleCaseVI } from '@/lib/utils'
import { haversineKm } from '@/helper/distance'
import { hasValidCoordinates, parseCoordinate } from '@/helper/coordinate'
import {
  containsAllInputWords,
  extractWords,
  isSimilarNameByWords,
  mergeDuplicateCandidates,
  normalizeNameForMatch,
} from '@/helper/duplicateCheck'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import {
  findDuplicatePhoneStores,
  normalizeVietnamPhoneForComparison,
  validateVietnamPhone,
} from '@/helper/validation'

export const TEMPLATE_HEADERS = [
  'Tên cửa hàng',
  'Loại cửa hàng',
  'Địa chỉ chi tiết',
  'Xã / Phường',
  'Quận / Huyện',
  'Số điện thoại',
  'Ghi chú',
  'Vĩ độ',
  'Kinh độ',
]

export const REQUIRED_FIELDS = ['name', 'ward', 'district']

export const FIELD_ALIASES = {
  name: ['ten cua hang', 'tên cửa hàng', 'ten', 'name'],
  store_type: ['loai cua hang', 'loại cửa hàng', 'loai', 'store type', 'store_type'],
  address_detail: ['dia chi chi tiet', 'địa chỉ chi tiết', 'dia chi', 'address detail', 'address_detail'],
  ward: ['xa phuong', 'xã phường', 'xa / phuong', 'xã / phường', 'phuong xa', 'ward'],
  district: ['quan huyen', 'quận huyện', 'quan / huyen', 'quận / huyện', 'huyen quan', 'district'],
  phone: ['so dien thoai', 'số điện thoại', 'sdt', 'phone'],
  note: ['ghi chu', 'ghi chú', 'note'],
  latitude: ['vi do', 'vĩ độ', 'latitude', 'lat'],
  longitude: ['kinh do', 'kinh độ', 'longitude', 'lng', 'lon'],
}

const MISSING_FIELD_LABELS = {
  name: 'Tên cửa hàng',
  ward: 'Xã / Phường',
  district: 'Quận / Huyện',
}

export function normalizeToken(value) {
  return removeVietnameseTones(String(value || ''))
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildOptionLookup(options) {
  const lookup = new Map()
  options.forEach((option) => {
    lookup.set(normalizeToken(option.value), option)
    lookup.set(normalizeToken(option.label), option)
  })
  return lookup
}

const STORE_TYPE_LOOKUP = buildOptionLookup(STORE_TYPE_OPTIONS)

export function sanitizeCsvValue(value) {
  const normalized = value == null ? '' : String(value)
  if (/[",\r\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`
  }
  return normalized
}

export function buildTemplateCsv() {
  return `\uFEFF${TEMPLATE_HEADERS.map(sanitizeCsvValue).join(',')}\r\n`
}

export function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const nextChar = text[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && char === ',') {
      row.push(cell)
      cell = ''
      continue
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && nextChar === '\n') {
        index += 1
      }
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows
    .map((csvRow) => csvRow.map((value) => String(value || '').trim()))
    .filter((csvRow) => csvRow.some((value) => value !== ''))
}

export function buildHeaderMap(headerRow) {
  const normalizedHeaders = headerRow.map((value) => normalizeToken(value))
  const headerMap = {}

  Object.entries(FIELD_ALIASES).forEach(([field, aliases]) => {
    const normalizedAliases = aliases.map((alias) => normalizeToken(alias))
    const matchIndex = normalizedHeaders.findIndex((header) => normalizedAliases.includes(header))
    if (matchIndex >= 0) headerMap[field] = matchIndex
  })

  const missingFields = REQUIRED_FIELDS.filter((field) => headerMap[field] == null)
  return { headerMap, missingFields }
}

export function getMissingFieldLabels(missingFields) {
  return missingFields.map((field) => MISSING_FIELD_LABELS[field] || field)
}

export function getCsvCell(row, headerMap, field) {
  const index = headerMap[field]
  if (index == null) return ''
  return String(row[index] || '').trim()
}

export function resolveStoreType(rawValue) {
  if (!String(rawValue || '').trim()) {
    const fallback = STORE_TYPE_OPTION_BY_VALUE[DEFAULT_STORE_TYPE] || STORE_TYPE_OPTIONS[0]
    return { option: fallback, error: '' }
  }
  const matched = STORE_TYPE_LOOKUP.get(normalizeToken(rawValue))
  if (!matched) {
    return { option: null, error: 'Loại cửa hàng không hợp lệ' }
  }
  return { option: matched, error: '' }
}

export function prepareExistingStores(stores) {
  return (stores || []).map((store) => {
    const lat = parseCoordinate(store.latitude)
    const lng = parseCoordinate(store.longitude)
    const normalizedPhone = normalizeVietnamPhoneForComparison(store.phone)
    return {
      ...store,
      latitude: Number.isFinite(lat) ? lat : store.latitude,
      longitude: Number.isFinite(lng) ? lng : store.longitude,
      normalizedPhone,
      hasCoordinates: hasValidCoordinates(lat, lng),
    }
  })
}

export function findDuplicateMatches(rowDraft, existingStores) {
  if (!rowDraft.name || rowDraft.inputWords.length === 0) return []

  const normalizedDistrict = normalizeToken(rowDraft.district)
  const candidateStores = normalizedDistrict
    ? existingStores.filter((store) => normalizeToken(store.district) === normalizedDistrict)
    : existingStores

  const nearMatches = rowDraft.hasCoordinates
    ? candidateStores
      .filter((store) => store.hasCoordinates)
      .map((store) => ({
        ...store,
        distance: haversineKm(rowDraft.latitude, rowDraft.longitude, store.latitude, store.longitude),
      }))
      .filter((store) => store.distance <= 0.1 && isSimilarNameByWords(rowDraft.inputWords, store.name))
    : []

  const globalMatches = candidateStores.filter((store) => containsAllInputWords(rowDraft.inputWords, store.name))

  return mergeDuplicateCandidates(
    nearMatches,
    globalMatches,
    rowDraft.hasCoordinates ? rowDraft.latitude : null,
    rowDraft.hasCoordinates ? rowDraft.longitude : null
  )
}

export function buildExactRowDuplicateKey(draft) {
  return [
    normalizeToken(draft.name),
    normalizeToken(draft.storeTypeValue),
    normalizeToken(draft.addressDetail),
    normalizeToken(draft.ward),
    normalizeToken(draft.district),
    normalizeVietnamPhoneForComparison(draft.phone),
    normalizeToken(draft.note),
    draft.latitude == null ? '' : String(draft.latitude),
    draft.longitude == null ? '' : String(draft.longitude),
  ].join('|')
}

export function buildPhoneDuplicateSummary(matches) {
  return matches.slice(0, 3).map((match) => match.name || 'Cửa hàng').join('; ')
}

export function buildRowAddress(values) {
  return [values.addressDetail, values.ward, values.district].filter(Boolean).join(', ')
}

export function chunkArray(items, size) {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

export function getRowStatusVariant(status) {
  if (status === 'ready') return 'border-green-900/70 bg-green-950/20 text-green-200'
  if (status === 'duplicate') return 'border-amber-900/70 bg-amber-950/20 text-amber-200'
  return 'border-red-900/70 bg-red-950/20 text-red-200'
}

export function getRowStatusLabel(status) {
  if (status === 'ready') return 'Sẵn sàng nhập'
  if (status === 'duplicate') return 'Cần xử lý'
  return 'Lỗi dữ liệu'
}

export function getRowContainerVariant(status) {
  if (status === 'ready') return 'border-green-900/40 bg-green-950/10'
  if (status === 'duplicate') return 'border-amber-900/40 bg-amber-950/10'
  return 'border-red-900/40 bg-red-950/10'
}

export function canResolveSystemDuplicate(row) {
  return (
    row.errors.length === 0
    && row.duplicateInFileRows.length === 0
    && (row.phoneDuplicateInFileRows || []).length === 0
  )
}

export function finalizePreviewRow(
  draft,
  duplicateInFileRows,
  phoneDuplicateInFileRows,
  resolutionMode = '',
  selectedDuplicateId = null,
  duplicateListExpanded = false
) {
  const issues = [...draft.errors]
  const blockingIssues = []
  const hasResolvedSystemDuplicate = resolutionMode === 'create'
    || ((resolutionMode === 'keep-existing' || resolutionMode === 'prefer-import') && selectedDuplicateId != null)

  if (phoneDuplicateInFileRows.length > 0) {
    blockingIssues.push(`Trùng số điện thoại với dòng ${phoneDuplicateInFileRows.join(', ')} trong file`)
  }
  if (draft.phoneDuplicateMatches.length > 0 && draft.duplicateMatches.length === 0) {
    blockingIssues.push(`Số điện thoại đã tồn tại trong dữ liệu: ${buildPhoneDuplicateSummary(draft.phoneDuplicateMatches)}`)
  }

  issues.push(...blockingIssues)
  if (draft.phoneDuplicateMatches.length > 0 && draft.duplicateMatches.length > 0) {
    issues.push(`Số điện thoại đang trùng với dữ liệu hiện có: ${buildPhoneDuplicateSummary(draft.phoneDuplicateMatches)}`)
  }
  if (duplicateInFileRows.length > 0) {
    issues.push(`Trùng y hệt với dòng ${duplicateInFileRows.join(', ')} trong file`)
  }
  if (draft.duplicateMatches.length > 0 && !hasResolvedSystemDuplicate) {
    issues.push(`Có ${draft.duplicateMatches.length} cửa hàng có thể trùng trong hệ thống`)
  }

  const status = draft.errors.length > 0 || blockingIssues.length > 0
    ? 'error'
    : (duplicateInFileRows.length > 0 || (draft.duplicateMatches.length > 0 && !hasResolvedSystemDuplicate) ? 'duplicate' : 'ready')

  return {
    ...draft,
    duplicateInFileRows,
    phoneDuplicateInFileRows,
    resolutionMode,
    selectedDuplicateId,
    duplicateListExpanded,
    issues,
    status,
  }
}

export function isMissingValue(value) {
  return value == null || String(value).trim() === ''
}

export function pickResolvedValue(existingValue, incomingValue, preferImport) {
  const existingMissing = isMissingValue(existingValue)
  const incomingMissing = isMissingValue(incomingValue)

  if (existingMissing && incomingMissing) return null
  if (existingMissing) return incomingValue
  if (incomingMissing) return existingValue
  return preferImport ? incomingValue : existingValue
}

export function buildResolutionPatch(existingStore, row, resolutionMode) {
  if (!existingStore || !row) return null
  const preferImport = resolutionMode === 'prefer-import'

  const patch = {}
  const nextStoreType = pickResolvedValue(existingStore.store_type, row.storeTypeValue, preferImport)
  const nextAddressDetail = pickResolvedValue(existingStore.address_detail, row.addressDetail, preferImport)
  const nextWard = pickResolvedValue(existingStore.ward, row.ward, preferImport)
  const nextDistrict = pickResolvedValue(existingStore.district, row.district, preferImport)
  const nextPhone = pickResolvedValue(existingStore.phone, row.phone, preferImport)
  const nextNote = pickResolvedValue(existingStore.note, row.note, preferImport)

  if (nextStoreType !== existingStore.store_type) patch.store_type = nextStoreType
  if (nextAddressDetail !== existingStore.address_detail) patch.address_detail = nextAddressDetail
  if (nextWard !== existingStore.ward) patch.ward = nextWard
  if (nextDistrict !== existingStore.district) patch.district = nextDistrict
  if (nextPhone !== existingStore.phone) patch.phone = nextPhone
  if (nextNote !== existingStore.note) patch.note = nextNote

  const existingLat = parseCoordinate(existingStore.latitude)
  const existingLng = parseCoordinate(existingStore.longitude)
  const existingHasCoordinates = hasValidCoordinates(existingLat, existingLng)
  if ((!existingHasCoordinates && row.hasCoordinates) || (preferImport && row.hasCoordinates)) {
    patch.latitude = row.latitude
    patch.longitude = row.longitude
  }

  return Object.keys(patch).length > 0 ? patch : null
}

export function buildImportPreviewRowsFromCsv({ csvText, existingStores }) {
  const rows = parseCsv(csvText)

  if (rows.length <= 1) {
    return {
      previewRows: [],
      error: 'File không có dữ liệu để nhập.',
    }
  }

  const { headerMap, missingFields } = buildHeaderMap(rows[0])
  if (missingFields.length > 0) {
    return {
      previewRows: [],
      error: `Thiếu cột bắt buộc trong file mẫu: ${getMissingFieldLabels(missingFields).join(', ')}`,
    }
  }

  const drafts = rows.slice(1).map((row, index) => {
    const rowNumber = index + 2
    const rawName = getCsvCell(row, headerMap, 'name')
    const rawAddressDetail = getCsvCell(row, headerMap, 'address_detail')
    const rawWard = getCsvCell(row, headerMap, 'ward')
    const rawDistrict = getCsvCell(row, headerMap, 'district')
    const rawPhone = getCsvCell(row, headerMap, 'phone')
    const rawNote = getCsvCell(row, headerMap, 'note')
    const rawLat = getCsvCell(row, headerMap, 'latitude')
    const rawLng = getCsvCell(row, headerMap, 'longitude')

    const normalizedName = rawName ? toTitleCaseVI(rawName) : ''
    const normalizedAddressDetail = rawAddressDetail ? toTitleCaseVI(rawAddressDetail) : ''
    const normalizedWard = rawWard ? toTitleCaseVI(rawWard) : ''
    const normalizedDistrict = rawDistrict ? toTitleCaseVI(rawDistrict) : ''
    const phoneValidation = validateVietnamPhone(rawPhone, { autoRestoreLeadingZero: true })
    const normalizedPhone = phoneValidation.normalized
    const hasValidPhone = normalizedPhone && phoneValidation.isValid
    const normalizedNote = rawNote.trim()

    const { option: resolvedStoreType, error: storeTypeError } = resolveStoreType(getCsvCell(row, headerMap, 'store_type'))

    const latitude = parseCoordinate(rawLat)
    const longitude = parseCoordinate(rawLng)
    const hasLatCell = rawLat !== ''
    const hasLngCell = rawLng !== ''
    const hasCoordinates = hasValidCoordinates(latitude, longitude)

    const errors = []
    if (!normalizedName) errors.push('Thiếu tên cửa hàng')
    if (!normalizedDistrict) errors.push('Thiếu quận / huyện')
    if (!normalizedWard) errors.push('Thiếu xã / phường')
    if (storeTypeError) errors.push(storeTypeError)
    if (normalizedPhone && !hasValidPhone) errors.push(phoneValidation.message)
    if (hasLatCell !== hasLngCell) errors.push('Phải nhập đủ cả vĩ độ và kinh độ')
    if ((hasLatCell || hasLngCell) && !hasCoordinates) errors.push('Tọa độ không hợp lệ')

    const inputWords = extractWords(normalizeNameForMatch(normalizedName))
    const draft = {
      rowNumber,
      name: normalizedName,
      storeTypeValue: resolvedStoreType?.value || DEFAULT_STORE_TYPE,
      storeTypeLabel: resolvedStoreType?.label || '',
      addressDetail: normalizedAddressDetail,
      ward: normalizedWard,
      district: normalizedDistrict,
      phone: normalizedPhone,
      note: normalizedNote,
      latitude: hasCoordinates ? latitude : null,
      longitude: hasCoordinates ? longitude : null,
      hasCoordinates,
      inputWords,
      errors,
    }

    return {
      ...draft,
      exactDuplicateKey: buildExactRowDuplicateKey(draft),
      duplicateMatches: findDuplicateMatches(draft, existingStores),
      phoneDuplicateMatches: hasValidPhone
        ? findDuplicatePhoneStores(existingStores, normalizedPhone)
        : [],
    }
  })

  const duplicateRowMap = new Map()
  const duplicatePhoneRowMap = new Map()

  drafts.forEach((draft) => {
    if (!draft.exactDuplicateKey) return
    const rowsForKey = duplicateRowMap.get(draft.exactDuplicateKey) || []
    rowsForKey.push(draft.rowNumber)
    duplicateRowMap.set(draft.exactDuplicateKey, rowsForKey)
  })

  drafts.forEach((draft) => {
    if (!draft.phone || !validateVietnamPhone(draft.phone).isValid) return
    const rowsForPhone = duplicatePhoneRowMap.get(draft.phone) || []
    rowsForPhone.push(draft.rowNumber)
    duplicatePhoneRowMap.set(draft.phone, rowsForPhone)
  })

  return {
    error: '',
    previewRows: drafts.map((draft) => {
      const duplicateInFileRows = (duplicateRowMap.get(draft.exactDuplicateKey) || []).filter((rowNumber) => rowNumber !== draft.rowNumber)
      const phoneDuplicateInFileRows = (duplicatePhoneRowMap.get(draft.phone) || []).filter((rowNumber) => rowNumber !== draft.rowNumber)
      return finalizePreviewRow(draft, duplicateInFileRows, phoneDuplicateInFileRows)
    }),
  }
}
