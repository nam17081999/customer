import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { supabase } from '@/lib/supabaseClient'
import { formatAddressParts } from '@/lib/utils'

const EXPORT_STORE_SELECT_FIELDS = [
  'id',
  'name',
  'store_type',
  'image_url',
  'latitude',
  'longitude',
  'address_detail',
  'ward',
  'district',
  'phone',
  'note',
  'active',
  'created_at',
  'updated_at',
].join(',')
const EXPORT_FETCH_PAGE_SIZE = 1000

function sanitizeCsvValue(value) {
  const normalized = value == null ? '' : String(value)
  if (/[",\r\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`
  }
  return normalized
}

function normalizeSinglePhone(phoneToken) {
  const raw = String(phoneToken || '').trim()
  if (!raw) return ''

  const hasLeadingPlus = raw.startsWith('+')
  const digitsOnly = raw.replace(/[^\d]/g, '')
  if (!digitsOnly) return ''

  const normalized = hasLeadingPlus ? `+${digitsOnly}` : digitsOnly
  const digitCount = digitsOnly.length
  if (digitCount < 6 || digitCount > 15) return ''

  return normalized
}

function extractPhones(phoneRaw) {
  const raw = String(phoneRaw || '').trim()
  if (!raw) return []

  const candidates = raw.match(/\+?\d[\d\s()./-]{6,}\d/g) || []
  const normalizedFromCandidates = candidates
    .map((candidate) => normalizeSinglePhone(candidate))
    .filter(Boolean)

  if (normalizedFromCandidates.length > 0) {
    return [...new Set(normalizedFromCandidates)]
  }

  const fallback = normalizeSinglePhone(raw)
  return fallback ? [fallback] : []
}

function escapeVCardValue(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function encodeQuotedPrintableUtf8(value) {
  const bytes = new TextEncoder().encode(String(value || ''))
  let out = ''
  for (const b of bytes) {
    if ((b >= 33 && b <= 60) || (b >= 62 && b <= 126)) {
      out += String.fromCharCode(b)
    } else if (b === 32) {
      out += ' '
    } else {
      out += `=${b.toString(16).toUpperCase().padStart(2, '0')}`
    }
  }
  return out
}

function buildTextVCardLine(field, value) {
  const text = String(value || '')
  if (!text) return null
  return `${field};CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:${encodeQuotedPrintableUtf8(text)}`
}

function sanitizeAddressPart(value) {
  return String(value || '')
    .replace(/[;\r\n]+/g, ' ')
    .trim()
}

function getValidCoordinates(store) {
  const lat = Number(store?.latitude)
  const lng = Number(store?.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return {
    lat: lat.toFixed(6),
    lng: lng.toFixed(6),
  }
}

async function exportTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType })

  // iOS/Safari often handles file export better via the native share sheet.
  if (typeof navigator !== 'undefined' && typeof File !== 'undefined') {
    try {
      const file = new File([blob], filename, { type: mimeType })
      if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        await navigator.share({
          files: [file],
          title: filename,
        })
        return
      }
    } catch {
      // Fall back to anchor download if share is unavailable or cancelled.
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Delay revoke to avoid Safari cancelling the download.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function buildStoreCsv(stores) {
  const headers = [
    'Ten cua hang',
    'Loai cua hang',
    'Dia chi',
    'So dien thoai',
    'Trang thai',
    'Vi do',
    'Kinh do',
    'Ngay tao',
    'Ngay cap nhat',
  ]

  const rows = stores.map((store) => {
    const status = store.active === true ? 'Da xac thuc' : 'Chua xac thuc'
    return [
      store.name || '',
      store.store_type || '',
      formatAddressParts(store) || '',
      store.phone || '',
      status,
      store.latitude ?? '',
      store.longitude ?? '',
      store.created_at || '',
      store.updated_at || '',
    ].map(sanitizeCsvValue).join(',')
  })

  return `\uFEFF${[headers.join(','), ...rows].join('\r\n')}`
}

function buildContactsVcf(storesWithPhone) {
  const cards = storesWithPhone.flatMap((store) => {
    const phones = extractPhones(store.phone)
    if (phones.length === 0) return []

    const name = (store.name || '').trim() || 'Cua hang'
    const ward = sanitizeAddressPart(store.ward)
    const district = sanitizeAddressPart(store.district)
    const city = 'H\u00E0 N\u1ED9i'
    const country = 'Vi\u1EC7t Nam'
    const street = ward
    const coords = getValidCoordinates(store)
    const mapsUrl = coords
      ? `https://www.google.com/maps?q=${coords.lat},${coords.lng}`
      : ''
    // ADR vCard order: PO Box;Extended;Street;City;State;PostalCode;Country
    const adrValue = `;;${sanitizeAddressPart(street)};${sanitizeAddressPart(city)};${sanitizeAddressPart(district)};;${sanitizeAddressPart(country)}`
    const adrLine = buildTextVCardLine('ADR;HOME', adrValue)

    return phones.map((phone, phoneIndex) => {
      const contactName = phones.length > 1 ? `${name} (${phoneIndex + 1})` : name
      const lines = [
        'BEGIN:VCARD',
        'VERSION:2.1',
        buildTextVCardLine('N', `${contactName};;;;`),
        buildTextVCardLine('FN', contactName),
        `TEL;CELL:${escapeVCardValue(phone)}`,
        adrLine,
        'item1.X-ABADR:vn',
        coords ? `GEO:${coords.lat};${coords.lng}` : null,
        mapsUrl ? `item2.URL:${mapsUrl}` : null,
        mapsUrl ? 'item2.X-ABLabel:Google Maps' : null,
        'END:VCARD',
      ].filter(Boolean)
      return lines.join('\r\n')
    })
  })
  return `${cards.join('\r\n')}\r\n`
}

export function StoreExportScreen({ mode = 'all' }) {
  const router = useRouter()
  const { isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {}

  const [pageReady, setPageReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stores, setStores] = useState([])

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      setPageReady(false)
      void router.replace('/login?from=/store/export').catch((err) => {
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

  const loadStores = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const allStores = []
      let from = 0

      while (true) {
        const to = from + EXPORT_FETCH_PAGE_SIZE - 1
        const { data, error: loadError } = await supabase
          .from('stores')
          .select(EXPORT_STORE_SELECT_FIELDS)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .range(from, to)

        if (loadError) throw loadError

        const pageData = Array.isArray(data) ? data : []
        allStores.push(...pageData)

        if (pageData.length < EXPORT_FETCH_PAGE_SIZE) break
        from += EXPORT_FETCH_PAGE_SIZE
      }

      setStores(allStores)
    } catch {
      setStores([])
      setError('Không tải được dữ liệu cửa hàng. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push('/account')
  }, [router])

  useEffect(() => {
    if (!pageReady) return
    loadStores()
  }, [pageReady, loadStores])

  const storesWithPhone = useMemo(() => {
    return stores.filter((store) => extractPhones(store.phone).length > 0)
  }, [stores])

  const contactsCount = useMemo(() => {
    return storesWithPhone.reduce((sum, store) => sum + extractPhones(store.phone).length, 0)
  }, [storesWithPhone])

  const exportStoresToExcel = async () => {
    const csv = buildStoreCsv(stores)
    const stamp = new Date().toISOString().slice(0, 10)
    await exportTextFile(`storevis-stores-${stamp}.csv`, csv, 'text/csv;charset=utf-8;')
  }

  const exportContacts = async () => {
    const vcf = buildContactsVcf(storesWithPhone)
    const stamp = new Date().toISOString().slice(0, 10)
    await exportTextFile(`storevis-contacts-${stamp}.vcf`, vcf, 'text/vcard;charset=utf-8;')
  }

  const isDataOnly = mode === 'data'
  const isContactsOnly = mode === 'contacts'
  const pageTitle = isDataOnly
    ? 'Xuất dữ liệu - StoreVis'
    : isContactsOnly
      ? 'Xuất danh bạ - StoreVis'
      : 'Xuất dữ liệu - StoreVis'

  if (authLoading || !pageReady) {
    return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />
  }

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
      </Head>

      <div className="min-h-screen bg-black">
        <div className="max-w-screen-md mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
          <div>
            <Button type="button" variant="outline" size="sm" onClick={handleBack}>
              ← Quay lại
            </Button>
          </div>

          <Card className="rounded-2xl border border-gray-800">
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-100">
                    {isDataOnly ? 'Xuất dữ liệu' : isContactsOnly ? 'Xuất danh bạ' : 'Xuất dữ liệu'}
                  </h1>
                  {!isDataOnly && !isContactsOnly && (
                    <p className="text-base text-gray-400">
                      Xuất danh sách cửa hàng ra file Excel và file danh bạ điện thoại.
                    </p>
                  )}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={loadStores} disabled={loading}>
                  {loading ? 'Đang tải...' : 'Làm mới'}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-800 p-3 bg-gray-950">
                  <p className="text-sm text-gray-400">Tổng cửa hàng</p>
                  <p className="text-2xl font-semibold text-gray-100">{stores.length}</p>
                </div>
                <div className="rounded-xl border border-gray-800 p-3 bg-gray-950">
                  <p className="text-sm text-gray-400">Cửa hàng có số điện thoại</p>
                  <p className="text-2xl font-semibold text-gray-100">{storesWithPhone.length}</p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-800 p-3 bg-gray-950">
                <p className="text-sm text-gray-400">Contact sẽ xuất ra VCF</p>
                <p className="text-2xl font-semibold text-gray-100">{contactsCount}</p>
              </div>

              {error && (
                <div className="rounded-lg border border-red-900 bg-red-950/30 p-3">
                  <p className="text-base text-red-300">{error}</p>
                </div>
              )}

              {!isContactsOnly && (
                <div className="rounded-xl border border-gray-800 p-3 bg-gray-950 space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-100">File Excel (CSV)</h2>
                    <p className="text-sm text-gray-400">
                      Bao gồm tất cả cửa hàng: tên, loại, địa chỉ, số điện thoại, trạng thái, tọa độ, ngày tạo và ngày cập nhật.
                    </p>
                  </div>
                  <Button type="button" onClick={exportStoresToExcel} disabled={loading || stores.length === 0}>
                    Xuất file Excel
                  </Button>
                </div>
              )}

              {!isDataOnly && (
                <div className="rounded-xl border border-gray-800 p-3 bg-gray-950 space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-100">File danh bạ (.vcf)</h2>
                    <p className="text-sm text-gray-400">
                      Chỉ xuất cửa hàng có số điện thoại. Để tương thích iPhone, mỗi số điện thoại sẽ được tạo thành 1 contact riêng.
                    </p>
                  </div>
                  <Button type="button" variant="outline" onClick={exportContacts} disabled={loading || contactsCount === 0}>
                    Xuất file danh bạ
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

export default function StoreExportPage() {
  return <StoreExportScreen mode="all" />
}
