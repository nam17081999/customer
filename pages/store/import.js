import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { supabase } from '@/lib/supabaseClient'
import { getOrRefreshStores, invalidateStoreCache } from '@/lib/storeCache'
import {
  DEFAULT_STORE_SIZE,
  DEFAULT_STORE_TYPE,
  STORE_SIZE_OPTIONS,
  STORE_TYPE_OPTIONS,
} from '@/lib/constants'
import { formatAddressParts, toTitleCaseVI } from '@/lib/utils'
import { haversineKm } from '@/helper/distance'
import {
  containsAllInputWords,
  extractWords,
  isSimilarNameByWords,
  mergeDuplicateCandidates,
  normalizeNameForMatch,
} from '@/helper/duplicateCheck'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { formatDistance, isValidPhone } from '@/helper/validation'

const TEMPLATE_HEADERS = [
  'Tên cửa hàng',
  'Loại cửa hàng',
  'Độ lớn cửa hàng',
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
  store_size: ['do lon cua hang', 'độ lớn cửa hàng', 'do lon', 'store size', 'store_size'],
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
const STORE_SIZE_LOOKUP = buildOptionLookup(STORE_SIZE_OPTIONS)

function parseCoordinate(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  if (typeof value !== 'string') return NaN
  const trimmed = value.trim()
  if (!trimmed) return NaN
  const parsed = Number.parseFloat(trimmed.replace(/,/g, '.'))
  return Number.isFinite(parsed) ? parsed : NaN
}

function hasValidCoordinates(lat, lng) {
  return (
    Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= -90
    && lat <= 90
    && lng >= -180
    && lng <= 180
  )
}

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
    const fallback = STORE_TYPE_OPTIONS.find((option) => option.value === DEFAULT_STORE_TYPE) || STORE_TYPE_OPTIONS[0]
    return { option: fallback, error: '' }
  }
  const matched = STORE_TYPE_LOOKUP.get(normalizeToken(rawValue))
  if (!matched) {
    return { option: null, error: 'Loại cửa hàng không hợp lệ' }
  }
  return { option: matched, error: '' }
}

function resolveStoreSize(rawValue) {
  if (!String(rawValue || '').trim()) {
    return { option: null, error: '' }
  }
  const normalized = normalizeToken(rawValue)
  if (normalized === normalizeToken('Chưa rõ')) {
    return { option: null, error: '' }
  }
  const matched = STORE_SIZE_LOOKUP.get(normalized)
  if (!matched) {
    return { option: null, error: 'Độ lớn cửa hàng không hợp lệ' }
  }
  return { option: matched, error: '' }
}

function prepareExistingStores(stores) {
  return (stores || []).map((store) => {
    const lat = parseCoordinate(store.latitude)
    const lng = parseCoordinate(store.longitude)
    return {
      ...store,
      latitude: Number.isFinite(lat) ? lat : store.latitude,
      longitude: Number.isFinite(lng) ? lng : store.longitude,
      hasCoordinates: hasValidCoordinates(lat, lng),
    }
  })
}

function findDuplicateMatches(rowDraft, existingStores) {
  if (!rowDraft.name || rowDraft.inputWords.length === 0) return []

  const nearMatches = rowDraft.hasCoordinates
    ? existingStores
      .filter((store) => store.hasCoordinates)
      .map((store) => ({
        ...store,
        distance: haversineKm(rowDraft.latitude, rowDraft.longitude, store.latitude, store.longitude),
      }))
      .filter((store) => store.distance <= 0.1 && isSimilarNameByWords(rowDraft.inputWords, store.name))
    : []

  const globalMatches = existingStores.filter((store) => containsAllInputWords(rowDraft.inputWords, store.name))

  return mergeDuplicateCandidates(
    nearMatches,
    globalMatches,
    rowDraft.hasCoordinates ? rowDraft.latitude : null,
    rowDraft.hasCoordinates ? rowDraft.longitude : null
  )
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

function buildDuplicateSummary(matches) {
  return matches.slice(0, 3).map((match) => {
    const distanceText = typeof match.distance === 'number' ? ` • ${formatDistance(match.distance)}` : ''
    return `${match.name || 'Cửa hàng'}${distanceText}`
  }).join('; ')
}

function getRowStatusVariant(status) {
  if (status === 'ready') return 'border-green-900/70 bg-green-950/20 text-green-200'
  if (status === 'duplicate') return 'border-amber-900/70 bg-amber-950/20 text-amber-200'
  return 'border-red-900/70 bg-red-950/20 text-red-200'
}

export default function StoreImportPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth() || {}
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

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setPageReady(false)
      void router.replace('/login?from=/store/import').catch((err) => {
        if (!err?.cancelled) console.error('Redirect to login failed:', err)
      })
      return
    }
    setPageReady(true)
  }, [authLoading, user, router])

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
        const normalizedPhone = rawPhone.trim()
        const normalizedNote = rawNote.trim()

        const { option: resolvedStoreType, error: storeTypeError } = resolveStoreType(getCsvCell(row, headerMap, 'store_type'))
        const { option: resolvedStoreSize, error: storeSizeError } = resolveStoreSize(getCsvCell(row, headerMap, 'store_size'))

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
        if (storeSizeError) errors.push(storeSizeError)
        if (normalizedPhone && !isValidPhone(normalizedPhone)) errors.push('Số điện thoại không hợp lệ')
        if (hasLatCell !== hasLngCell) errors.push('Phải nhập đủ cả vĩ độ và kinh độ')
        if ((hasLatCell || hasLngCell) && !hasCoordinates) errors.push('Tọa độ không hợp lệ')

        const inputWords = extractWords(normalizeNameForMatch(normalizedName))
        const duplicateBaseKey = inputWords.join(' ') || normalizeToken(normalizedName)
        const duplicateKey = normalizedName && normalizedDistrict && normalizedWard
          ? `${duplicateBaseKey}|${normalizeToken(normalizedDistrict)}|${normalizeToken(normalizedWard)}`
          : ''

        const draft = {
          rowNumber,
          name: normalizedName,
          storeTypeValue: resolvedStoreType?.value || DEFAULT_STORE_TYPE,
          storeTypeLabel: resolvedStoreType?.label || '',
          storeSizeValue: resolvedStoreSize?.value || DEFAULT_STORE_SIZE,
          storeSizeLabel: resolvedStoreSize?.label || '',
          addressDetail: normalizedAddressDetail,
          ward: normalizedWard,
          district: normalizedDistrict,
          phone: normalizedPhone,
          note: normalizedNote,
          latitude: hasCoordinates ? latitude : null,
          longitude: hasCoordinates ? longitude : null,
          hasCoordinates,
          inputWords,
          duplicateKey,
          errors,
        }

        return {
          ...draft,
          duplicateMatches: findDuplicateMatches(draft, existingStores),
        }
      })

      const duplicateRowMap = new Map()
      drafts.forEach((draft) => {
        if (!draft.duplicateKey) return
        const rowsForKey = duplicateRowMap.get(draft.duplicateKey) || []
        rowsForKey.push(draft.rowNumber)
        duplicateRowMap.set(draft.duplicateKey, rowsForKey)
      })

      const nextPreviewRows = drafts.map((draft) => {
        const duplicateInFileRows = (duplicateRowMap.get(draft.duplicateKey) || []).filter((rowNumber) => rowNumber !== draft.rowNumber)
        const issues = [...draft.errors]

        if (duplicateInFileRows.length > 0) {
          issues.push(`Trùng với dòng ${duplicateInFileRows.join(', ')} trong file`)
        }
        if (draft.duplicateMatches.length > 0) {
          issues.push(`Nghi trùng hệ thống: ${buildDuplicateSummary(draft.duplicateMatches)}`)
        }

        const status = draft.errors.length > 0
          ? 'error'
          : (duplicateInFileRows.length > 0 || draft.duplicateMatches.length > 0 ? 'duplicate' : 'ready')

        return {
          ...draft,
          duplicateInFileRows,
          issues,
          status,
        }
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

  const handleImport = useCallback(async () => {
    const readyRows = previewRows.filter((row) => row.status === 'ready')
    if (readyRows.length === 0 || importing) return

    const skippedRows = previewRows.length - readyRows.length
    const confirmed = window.confirm(
      `Sẽ nhập ${readyRows.length} dòng hợp lệ và bỏ qua ${skippedRows} dòng lỗi/trùng. Bạn có muốn tiếp tục không?`
    )
    if (!confirmed) return

    setImporting(true)
    setParseError('')
    setImportResult('')

    try {
      const payloads = readyRows.map((row) => ({
        name: row.name,
        store_type: row.storeTypeValue || DEFAULT_STORE_TYPE,
        store_size: row.storeSizeValue || null,
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

      for (const chunk of chunkArray(payloads, 100)) {
        const { error } = await supabase.from('stores').insert(chunk)
        if (error) throw error
      }

      await invalidateStoreCache()
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('storevis:stores-changed', {
            detail: { type: 'bulk-import', shouldRefetchAll: true },
          })
        )
      }

      setImportResult(`Đã nhập thành công ${readyRows.length} dòng. Bỏ qua ${skippedRows} dòng lỗi hoặc nghi trùng.`)
      setPreviewRows([])
      setSelectedFileName('')
      await loadExistingStores()
    } catch (error) {
      console.error(error)
      setImportResult('')
      setParseError(error?.message || 'Nhập dữ liệu thất bại. Vui lòng thử lại.')
    } finally {
      setImporting(false)
    }
  }, [importing, loadExistingStores, previewRows])

  if (authLoading || !pageReady) {
    return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />
  }

  if (loadingStores) {
    return <FullPageLoading visible message="Đang tải dữ liệu để kiểm tra trùng..." />
  }

  return (
    <>
      <Head>
        <title>Nhập dữ liệu - StoreVis</title>
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
                  <p className="mt-1 text-sm text-gray-400">
                    Độ lớn: Chưa rõ, {STORE_SIZE_OPTIONS.map((option) => option.label).join(', ')}
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
                        Mỗi dòng được kiểm tra lỗi dữ liệu, nghi trùng trong file và nghi trùng với hệ thống hiện có.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleImport}
                      disabled={importing || summary.ready === 0}
                    >
                      {importing ? 'Đang nhập dữ liệu...' : `Nhập ${summary.ready} dòng hợp lệ`}
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {previewRows.map((row) => (
                      <div key={`preview-row-${row.rowNumber}`} className="rounded-xl border border-gray-800 bg-black/40 p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-sm text-gray-400">Dòng {row.rowNumber}</p>
                            <h3 className="text-base font-semibold text-gray-100 break-words">
                              {row.name || 'Chưa có tên cửa hàng'}
                            </h3>
                            <p className="mt-1 text-sm text-gray-400 break-words">
                              {buildRowAddress(row) || 'Chưa có địa chỉ'}
                            </p>
                          </div>
                          <span className={`inline-flex self-start rounded-full px-2.5 py-1 text-xs font-medium ${getRowStatusVariant(row.status)}`}>
                            {row.status === 'ready' ? 'Sẵn sàng nhập' : row.status === 'duplicate' ? 'Nghi trùng' : 'Lỗi dữ liệu'}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-2 text-sm text-gray-300 sm:grid-cols-2">
                          <div>
                            <span className="text-gray-500">Loại:</span> {row.storeTypeLabel || 'Không rõ'}
                          </div>
                          <div>
                            <span className="text-gray-500">Độ lớn:</span> {row.storeSizeLabel || 'Chưa rõ'}
                          </div>
                          <div>
                            <span className="text-gray-500">Số điện thoại:</span> {row.phone || 'Không có'}
                          </div>
                          <div>
                            <span className="text-gray-500">Vị trí:</span> {row.hasCoordinates ? `${row.latitude.toFixed(6)}, ${row.longitude.toFixed(6)}` : 'Không có vị trí'}
                          </div>
                          {row.note && (
                            <div className="sm:col-span-2">
                              <span className="text-gray-500">Ghi chú:</span> {row.note}
                            </div>
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
                            <p className="text-sm font-medium text-gray-200">Các cửa hàng nghi trùng trong hệ thống</p>
                            <div className="mt-2 space-y-2">
                              {row.duplicateMatches.slice(0, 3).map((match) => (
                                <div key={`${row.rowNumber}-match-${match.id}`} className="rounded-lg border border-gray-800 bg-black/40 px-3 py-2 text-sm text-gray-300">
                                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                    <span className="font-medium text-gray-100">{match.name || 'Cửa hàng'}</span>
                                    <span className="text-xs text-gray-400">
                                      {typeof match.distance === 'number' ? formatDistance(match.distance) : 'Không có vị trí'}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-xs text-gray-400">
                                    {formatAddressParts(match) || 'Chưa có địa chỉ'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
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
