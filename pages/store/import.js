import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { supabase } from '@/lib/supabaseClient'
import { appendStoresToCache, getOrRefreshStores, updateStoresInCache } from '@/lib/storeCache'
import {
  DEFAULT_STORE_TYPE,
  STORE_TYPE_OPTION_BY_VALUE,
  STORE_TYPE_OPTIONS,
} from '@/lib/constants'
import { formatAddressParts, toTitleCaseVI } from '@/lib/utils'
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
  formatDistance,
  normalizeVietnamPhoneForComparison,
  validateVietnamPhone,
} from '@/helper/validation'

const TEMPLATE_HEADERS = [
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

const REQUIRED_FIELDS = ['name', 'ward', 'district']
const FIELD_ALIASES = {
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

function normalizeToken(value) {
  return removeVietnameseTones(String(value || ''))
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildOptionLookup(options) {
  const lookup = new Map()
  options.forEach((option) => {
    lookup.set(normalizeToken(option.value), option)
    lookup.set(normalizeToken(option.label), option)
  })
  return lookup
}

const STORE_TYPE_LOOKUP = buildOptionLookup(STORE_TYPE_OPTIONS)

function sanitizeCsvValue(value) {
  const normalized = value == null ? '' : String(value)
  if (/[",\r\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`
  }
  return normalized
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function buildTemplateCsv() {
  return `\uFEFF${TEMPLATE_HEADERS.map(sanitizeCsvValue).join(',')}\r\n`
}

function parseCsv(text) {
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

function buildHeaderMap(headerRow) {
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

function getCsvCell(row, headerMap, field) {
  const index = headerMap[field]
  if (index == null) return ''
  return String(row[index] || '').trim()
}

function resolveStoreType(rawValue) {
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

function prepareExistingStores(stores) {
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

function findDuplicateMatches(rowDraft, existingStores) {
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

function buildExactRowDuplicateKey(draft) {
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

function buildPhoneDuplicateSummary(matches) {
  return matches.slice(0, 3).map((match) => match.name || 'Cửa hàng').join('; ')
}

function buildRowAddress(values) {
  return [values.addressDetail, values.ward, values.district].filter(Boolean).join(', ')
}

function chunkArray(items, size) {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function getRowStatusVariant(status) {
  if (status === 'ready') return 'border-green-900/70 bg-green-950/20 text-green-200'
  if (status === 'duplicate') return 'border-amber-900/70 bg-amber-950/20 text-amber-200'
  return 'border-red-900/70 bg-red-950/20 text-red-200'
}

function getRowStatusLabel(status) {
  if (status === 'ready') return 'Sẵn sàng nhập'
  if (status === 'duplicate') return 'Cần xử lý'
  return 'Lỗi dữ liệu'
}

function getRowContainerVariant(status) {
  if (status === 'ready') return 'border-green-900/40 bg-green-950/10'
  if (status === 'duplicate') return 'border-amber-900/40 bg-amber-950/10'
  return 'border-red-900/40 bg-red-950/10'
}

function canResolveSystemDuplicate(row) {
  return (
    row.errors.length === 0
    && row.duplicateInFileRows.length === 0
    && (row.phoneDuplicateInFileRows || []).length === 0
  )
}

function finalizePreviewRow(
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

function isMissingValue(value) {
  return value == null || String(value).trim() === ''
}

function pickResolvedValue(existingValue, incomingValue, preferImport) {
  const existingMissing = isMissingValue(existingValue)
  const incomingMissing = isMissingValue(incomingValue)

  if (existingMissing && incomingMissing) return null
  if (existingMissing) return incomingValue
  if (incomingMissing) return existingValue
  return preferImport ? incomingValue : existingValue
}

function buildResolutionPatch(existingStore, row, resolutionMode) {
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

export default function StoreImportPage() {
  const router = useRouter()
  const { isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {}
  const fileInputRef = useRef(null)

  const [pageReady, setPageReady] = useState(false)
  const [loadingStores, setLoadingStores] = useState(true)
  const [existingStores, setExistingStores] = useState([])
  const [selectedFileName, setSelectedFileName] = useState('')
  const [previewRows, setPreviewRows] = useState([])
  const [parseError, setParseError] = useState('')
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState('')
  const [hideReadyRows, setHideReadyRows] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      setPageReady(false)
      void router.replace('/login?from=/store/import').catch((err) => {
        if (!err?.cancelled) console.error('Redirect to login failed:', err)
      })
      return
    }
    if (!isAdmin) {
      setPageReady(false)
      void router.replace('/account').catch((err) => {
        if (!err?.cancelled) console.error('Redirect to account failed:', err)
      })
      return
    }
    setPageReady(true)
  }, [authLoading, isAuthenticated, isAdmin, router])

  const loadExistingStores = useCallback(async () => {
    setLoadingStores(true)
    try {
      const stores = await getOrRefreshStores()
      setExistingStores(prepareExistingStores(stores))
    } catch (error) {
      console.error(error)
      setExistingStores([])
      setParseError('Không tải được dữ liệu cửa hàng hiện có để kiểm tra trùng.')
    } finally {
      setLoadingStores(false)
    }
  }, [])

  useEffect(() => {
    if (!pageReady) return
    loadExistingStores()
  }, [pageReady, loadExistingStores])

  const summary = useMemo(() => {
    const total = previewRows.length
    const ready = previewRows.filter((row) => row.status === 'ready').length
    const duplicate = previewRows.filter((row) => row.status === 'duplicate').length
    const error = previewRows.filter((row) => row.status === 'error').length
    return { total, ready, duplicate, error }
  }, [previewRows])

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push('/account')
  }, [router])

  const handleDownloadTemplate = useCallback(() => {
    downloadTextFile(
      'store-import-template.csv',
      buildTemplateCsv(),
      'text/csv;charset=utf-8'
    )
  }, [])

  const parseFileToPreview = useCallback(async (file) => {
    setParsing(true)
    setParseError('')
    setImportResult('')

    try {
      const csvText = await file.text()
      const rows = parseCsv(csvText)

      if (rows.length <= 1) {
        setPreviewRows([])
        setParseError('File không có dữ liệu để nhập.')
        return
      }

      const { headerMap, missingFields } = buildHeaderMap(rows[0])
      if (missingFields.length > 0) {
        const missingLabels = missingFields.map((field) => {
          const labelMap = {
            name: 'Tên cửa hàng',
            ward: 'Xã / Phường',
            district: 'Quận / Huyện',
          }
          return labelMap[field] || field
        })
        setPreviewRows([])
        setParseError(`Thiếu cột bắt buộc trong file mẫu: ${missingLabels.join(', ')}`)
        return
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

      const nextPreviewRows = drafts.map((draft) => {
        const duplicateInFileRows = (duplicateRowMap.get(draft.exactDuplicateKey) || []).filter((rowNumber) => rowNumber !== draft.rowNumber)
        const phoneDuplicateInFileRows = (duplicatePhoneRowMap.get(draft.phone) || []).filter((rowNumber) => rowNumber !== draft.rowNumber)
        return finalizePreviewRow(draft, duplicateInFileRows, phoneDuplicateInFileRows)
      })

      setPreviewRows(nextPreviewRows)
    } catch (error) {
      console.error(error)
      setPreviewRows([])
      setParseError('Không đọc được file CSV. Vui lòng kiểm tra lại file mẫu.')
    } finally {
      setParsing(false)
    }
  }, [existingStores])

  const handleChooseFile = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setSelectedFileName(file.name)
    await parseFileToPreview(file)
    event.target.value = ''
  }, [parseFileToPreview])

  const handleToggleDuplicateList = useCallback((rowNumber) => {
    setPreviewRows((prev) => prev.map((row) => (
      row.rowNumber === rowNumber
        ? { ...row, duplicateListExpanded: !row.duplicateListExpanded }
        : row
    )))
  }, [])

  const handleChooseDuplicateTarget = useCallback((rowNumber, selectedDuplicateId) => {
    setPreviewRows((prev) => prev.map((row) => {
      if (row.rowNumber !== rowNumber) return row
      const nextSelectedDuplicateId = row.selectedDuplicateId === selectedDuplicateId ? null : selectedDuplicateId
      const nextResolutionMode = nextSelectedDuplicateId == null ? '' : row.resolutionMode
      return finalizePreviewRow(
        row,
        row.duplicateInFileRows,
        row.phoneDuplicateInFileRows || [],
        nextResolutionMode,
        nextSelectedDuplicateId,
        row.duplicateListExpanded
      )
    }))
  }, [])

  const handleSetDuplicateResolution = useCallback((rowNumber, resolutionMode) => {
    setPreviewRows((prev) => prev.map((row) => {
      if (row.rowNumber !== rowNumber) return row
      const nextResolutionMode = row.resolutionMode === resolutionMode ? '' : resolutionMode
      return finalizePreviewRow(
        row,
        row.duplicateInFileRows,
        row.phoneDuplicateInFileRows || [],
        nextResolutionMode,
        nextResolutionMode === 'create' ? null : row.selectedDuplicateId,
        row.duplicateListExpanded
      )
    }))
  }, [])

  const handleImport = useCallback(async () => {
    const readyRows = previewRows.filter((row) => row.status === 'ready')
    if (readyRows.length === 0 || importing) return

    const skippedRows = previewRows.length - readyRows.length
    const createRows = readyRows.filter((row) => row.resolutionMode === 'create' || row.duplicateMatches.length === 0)
    const resolvedDuplicateRows = readyRows.filter((row) => (
      (row.resolutionMode === 'keep-existing' || row.resolutionMode === 'prefer-import')
      && row.selectedDuplicateId != null
    ))
    const importConfirmed = window.confirm(
      `Sẽ xử lý ${readyRows.length} dòng hợp lệ, gồm ${createRows.length} dòng tạo mới và ${resolvedDuplicateRows.length} dòng cập nhật từ cửa hàng nghi trùng. Bỏ qua ${skippedRows} dòng lỗi hoặc chưa chọn hướng xử lý. Bạn có muốn tiếp tục không?`
    )
    if (!importConfirmed) return

    setImporting(true)
    setParseError('')
    setImportResult('')

    try {
      const createPayloads = createRows.map((row) => ({
        name: row.name,
        store_type: row.storeTypeValue || DEFAULT_STORE_TYPE,
        address_detail: row.addressDetail || null,
        ward: row.ward || null,
        district: row.district || null,
        phone: row.phone || null,
        note: row.note || null,
        latitude: row.latitude,
        longitude: row.longitude,
        image_url: null,
        active: true,
      }))

      const nextInsertedStores = []
      if (createPayloads.length > 0) {
        for (const chunk of chunkArray(createPayloads, 100)) {
          const { data, error } = await supabase.from('stores').insert(chunk).select()
          if (error) throw error
          if (Array.isArray(data)) nextInsertedStores.push(...data)
        }
      }

      const nextResolvedStores = []
      for (const row of resolvedDuplicateRows) {
        const existingStore = existingStores.find((store) => store.id === row.selectedDuplicateId)
        if (!existingStore) continue
        const patch = buildResolutionPatch(existingStore, row, row.resolutionMode)
        if (!patch) {
          nextResolvedStores.push(existingStore)
          continue
        }
        const { data, error } = await supabase
          .from('stores')
          .update({
            ...patch,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.selectedDuplicateId)
          .select()
          .single()
        if (error) throw error
        if (data) nextResolvedStores.push(data)
      }

      await appendStoresToCache(nextInsertedStores)
      await updateStoresInCache(nextResolvedStores)

      if (typeof window !== 'undefined') {
        if (nextInsertedStores.length > 0) {
          window.dispatchEvent(
            new CustomEvent('storevis:stores-changed', {
              detail: { type: 'append-many', stores: nextInsertedStores },
            })
          )
        }
        nextResolvedStores.forEach((store) => {
          if (!store?.id) return
          window.dispatchEvent(
            new CustomEvent('storevis:stores-changed', {
              detail: { type: 'update', store },
            })
          )
        })
      }

      setImportResult(`Đã xử lý thành công ${readyRows.length} dòng: ${nextInsertedStores.length} dòng tạo mới, ${resolvedDuplicateRows.length} dòng cập nhật từ cửa hàng nghi trùng. Bỏ qua ${skippedRows} dòng lỗi hoặc chưa chọn hướng xử lý.`)
      setPreviewRows([])
      setSelectedFileName('')
      setExistingStores((prev) => {
        const nextById = new Map(prev.map((store) => [store.id, store]))
        prepareExistingStores(nextResolvedStores).forEach((store) => {
          if (store?.id != null) nextById.set(store.id, store)
        })
        prepareExistingStores(nextInsertedStores).forEach((store) => {
          if (store?.id != null) nextById.set(store.id, store)
        })
        return Array.from(nextById.values())
      })
    } catch (error) {
      console.error(error)
      setImportResult('')
      setParseError(error?.message || 'Nhập dữ liệu thất bại. Vui lòng thử lại.')
    } finally {
      setImporting(false)
    }
  }, [existingStores, importing, previewRows])

  const visiblePreviewRows = useMemo(() => (
    hideReadyRows
      ? previewRows.filter((row) => row.status !== 'ready')
      : previewRows
  ), [hideReadyRows, previewRows])

  if (authLoading || !pageReady) {
    return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />
  }

  if (loadingStores) {
    return <FullPageLoading visible message="Đang tải dữ liệu để kiểm tra trùng..." />
  }

  return (
    <>
      <Head>
        <title>Nhập dữ liệu - NPP Hà Công</title>
      </Head>

      <div className="min-h-screen bg-black">
        <div className="mx-auto max-w-screen-md px-3 py-4 sm:px-4 sm:py-6 space-y-4">
          <Card className="rounded-2xl border border-gray-800 bg-gray-950">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-400">Màn nhập dữ liệu</p>
                  <h1 className="text-xl font-bold text-gray-100">Nhập nhiều cửa hàng từ file CSV</h1>
                  <p className="mt-1 text-sm text-gray-400">
                    Tải file mẫu, điền dữ liệu theo đúng cột rồi tải lên để kiểm tra lỗi và nghi trùng trước khi nhập.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={handleBack}>
                  Quay lại
                </Button>
              </div>

              <div className="rounded-xl border border-gray-800 bg-black/40 p-3">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="button" onClick={handleDownloadTemplate}>
                    Tải file mẫu
                  </Button>
                  <Button type="button" variant="outline" onClick={handleChooseFile} disabled={parsing || importing}>
                    {parsing ? 'Đang đọc file...' : 'Chọn file CSV'}
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {selectedFileName && (
                  <p className="mt-2 text-sm text-gray-300">
                    File đã chọn: <span className="font-medium text-gray-100">{selectedFileName}</span>
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-800 bg-black/40 p-3">
                  <h2 className="text-base font-semibold text-gray-100">Cột bắt buộc</h2>
                  <p className="mt-1 text-sm text-gray-400">`Tên cửa hàng`, `Xã / Phường`, `Quận / Huyện`</p>
                </div>
                <div className="rounded-xl border border-gray-800 bg-black/40 p-3">
                  <h2 className="text-base font-semibold text-gray-100">Giá trị gợi ý</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    Loại: {STORE_TYPE_OPTIONS.map((option) => option.label).join(', ')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {parseError && (
            <div className="rounded-xl border border-red-900/70 bg-red-950/20 px-4 py-3 text-sm text-red-200">
              {parseError}
            </div>
          )}

          {importResult && (
            <div className="rounded-xl border border-green-900/70 bg-green-950/20 px-4 py-3 text-sm text-green-200">
              {importResult}
            </div>
          )}

          {previewRows.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Tổng dòng', value: summary.total, tone: 'text-gray-100' },
                  { label: 'Sẵn sàng nhập', value: summary.ready, tone: 'text-green-300' },
                  { label: 'Nghi trùng', value: summary.duplicate, tone: 'text-amber-300' },
                  { label: 'Lỗi dữ liệu', value: summary.error, tone: 'text-red-300' },
                ].map((item) => (
                  <Card key={item.label} className="rounded-2xl border border-gray-800 bg-gray-950">
                    <CardContent className="p-3">
                      <p className="text-sm text-gray-400">{item.label}</p>
                      <p className={`mt-1 text-2xl font-bold ${item.tone}`}>{item.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="rounded-2xl border border-gray-800 bg-gray-950">
                <CardContent className="space-y-4 p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-100">Xem trước dữ liệu nhập</h2>
                      <p className="text-sm text-gray-400">
                        Mỗi dòng được kiểm tra lỗi dữ liệu, trùng y hệt trong file và cửa hàng có thể trùng trong hệ thống cùng quận / huyện.
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        Đang hiển thị {visiblePreviewRows.length} / {previewRows.length} dòng
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setHideReadyRows((prev) => !prev)}
                        disabled={previewRows.length === 0}
                      >
                        {hideReadyRows ? 'Hiện tất cả dòng' : 'Chỉ xem cần xử lý'}
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        onClick={handleImport}
                        disabled={importing || summary.ready === 0}
                      >
                        {importing ? 'Đang nhập dữ liệu...' : `Nhập ${summary.ready} dòng hợp lệ`}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {visiblePreviewRows.map((row) => {
                      const selectedDuplicate = row.duplicateMatches.find((match) => match.id === row.selectedDuplicateId)

                      return (
                        <div
                          key={`preview-row-${row.rowNumber}`}
                          className={`rounded-xl border p-3 ${getRowContainerVariant(row.status)}`}
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex rounded-full border border-gray-800 bg-black/40 px-2 py-0.5 text-sm font-medium text-gray-300">
                                  Dòng {row.rowNumber}
                                </span>
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-sm font-medium ${getRowStatusVariant(row.status)}`}>
                                  {getRowStatusLabel(row.status)}
                                </span>
                              </div>
                              <h3 className="mt-2 text-base font-semibold text-gray-100 break-words">
                                {row.name || 'Chưa có tên cửa hàng'}
                              </h3>
                              <p className="mt-1 text-sm text-gray-400 break-words">
                                {buildRowAddress(row) || 'Chưa có địa chỉ'}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2 text-sm">
                            <span className="inline-flex items-center rounded-full border border-gray-800 bg-black/40 px-2.5 py-1 text-gray-300">
                              Loại: {row.storeTypeLabel || 'Không rõ'}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-gray-800 bg-black/40 px-2.5 py-1 text-gray-300">
                              {row.phone ? `SĐT: ${row.phone}` : 'Không có số điện thoại'}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-gray-800 bg-black/40 px-2.5 py-1 text-gray-300">
                              {row.hasCoordinates ? 'Đã có vị trí' : 'Không có vị trí'}
                            </span>
                            {row.note && (
                              <span className="inline-flex items-center rounded-full border border-gray-800 bg-black/40 px-2.5 py-1 text-gray-300">
                                Có ghi chú
                              </span>
                            )}
                          </div>

                          {row.issues.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {row.issues.map((issue) => (
                                <div
                                  key={`${row.rowNumber}-${issue}`}
                                  className={`rounded-lg border px-3 py-2 text-sm ${row.status === 'error' ? 'border-red-900/70 bg-red-950/20 text-red-200' : 'border-amber-900/70 bg-amber-950/20 text-amber-200'}`}
                                >
                                  {issue}
                                </div>
                              ))}
                            </div>
                          )}

                          {row.duplicateMatches.length > 0 && (
                            <div className="mt-3 rounded-lg border border-gray-800 bg-gray-950/70 p-3">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-100">Xử lý cửa hàng nghi trùng</p>
                                  <p className="mt-1 text-sm text-gray-400">
                                    Bước 1: chọn đúng cửa hàng trong hệ thống. Bước 2: chọn ưu tiên dữ liệu cũ hay dữ liệu mới.
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-9 px-3 text-sm"
                                    onClick={() => handleToggleDuplicateList(row.rowNumber)}
                                  >
                                    {row.duplicateListExpanded ? 'Ẩn danh sách trùng' : `Chọn trong ${row.duplicateMatches.length} cửa hàng`}
                                  </Button>
                                  {canResolveSystemDuplicate(row) && (
                                    <Button
                                      type="button"
                                      variant={row.resolutionMode === 'create' ? 'primary' : 'outline'}
                                      className="h-9 px-3 text-sm"
                                      onClick={() => handleSetDuplicateResolution(row.rowNumber, 'create')}
                                    >
                                      {row.resolutionMode === 'create' ? 'Đang chọn tạo mới' : 'Tạo mới'}
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {row.resolutionMode === 'create' && canResolveSystemDuplicate(row) && (
                                <div className="mt-3 rounded-lg border border-green-900/70 bg-green-950/20 px-3 py-2 text-sm text-green-200">
                                  Dòng này sẽ được tạo mới dù đang có cửa hàng nghi trùng trong hệ thống.
                                </div>
                              )}

                              {row.duplicateListExpanded && (
                                <div className="mt-3 space-y-2">
                                  {row.duplicateMatches.map((match) => (
                                    <div key={`${row.rowNumber}-match-${match.id}`} className="rounded-lg border border-gray-800 bg-black/40 px-3 py-2">
                                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                          <div className="text-sm font-medium text-gray-100 break-words">
                                            {match.name || 'Cửa hàng'}
                                          </div>
                                          <div className="mt-1 text-sm text-gray-400 break-words">
                                            {formatAddressParts(match) || 'Chưa có địa chỉ'}
                                          </div>
                                          <div className="mt-1 text-sm text-gray-500">
                                            {typeof match.distance === 'number'
                                              ? formatDistance(match.distance)
                                              : (match.hasCoordinates ? 'Đã có vị trí' : 'Không có vị trí')}
                                          </div>
                                        </div>
                                        {canResolveSystemDuplicate(row) && (
                                          <Button
                                            type="button"
                                            variant={row.selectedDuplicateId === match.id ? 'primary' : 'outline'}
                                            className="h-8 px-3 text-sm"
                                            onClick={() => handleChooseDuplicateTarget(row.rowNumber, match.id)}
                                          >
                                            {row.selectedDuplicateId === match.id ? 'Đã chọn' : 'Chọn cửa hàng này'}
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {selectedDuplicate && row.resolutionMode !== 'create' && (
                                <div className="mt-3 rounded-lg border border-sky-900/70 bg-sky-950/20 px-3 py-2">
                                  <p className="text-sm font-medium text-sky-100">Đã chọn đối chiếu với: {selectedDuplicate.name}</p>
                                  <p className="mt-1 text-sm text-sky-200/90">
                                    Field chỉ có ở một bên sẽ luôn được giữ lại. Với field có ở cả hai bên, chọn cách ưu tiên bên dưới.
                                  </p>
                                </div>
                              )}

                              {row.selectedDuplicateId != null && canResolveSystemDuplicate(row) && row.resolutionMode !== 'create' && (
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSetDuplicateResolution(row.rowNumber, 'keep-existing')}
                                    className={`rounded-lg border px-3 py-3 text-left transition ${
                                      row.resolutionMode === 'keep-existing'
                                        ? 'border-blue-500 bg-blue-500/15 text-blue-100'
                                        : 'border-gray-700 bg-black/40 text-gray-300 hover:bg-gray-900'
                                    }`}
                                  >
                                    <div className="text-sm font-semibold">Giữ dữ liệu cũ</div>
                                    <div className="mt-1 text-sm text-gray-400">
                                      Chỉ lấy thêm các field đang thiếu trong hệ thống.
                                    </div>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSetDuplicateResolution(row.rowNumber, 'prefer-import')}
                                    className={`rounded-lg border px-3 py-3 text-left transition ${
                                      row.resolutionMode === 'prefer-import'
                                        ? 'border-blue-500 bg-blue-500/15 text-blue-100'
                                        : 'border-gray-700 bg-black/40 text-gray-300 hover:bg-gray-900'
                                    }`}
                                  >
                                    <div className="text-sm font-semibold">Lấy dữ liệu mới</div>
                                    <div className="mt-1 text-sm text-gray-400">
                                      Giữ lại field thiếu và ưu tiên dữ liệu từ file khi có xung đột.
                                    </div>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  )
}
