import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { getCachedStores, getOrRefreshStores } from '@/lib/storeCache'
import { formatDateTime } from '@/helper/validation'

const PAGE_SIZE = 50

const ACTION_LABELS = {
  edit: 'Chỉnh sửa',
  supplement: 'Bổ sung',
  verify: 'Xác thực',
  report_apply: 'Duyệt báo cáo',
  delete_soft: 'Xóa mềm',
  telesale_potential_toggle: 'Đổi trạng thái tiềm năng',
}

const FIELD_LABELS = {
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

function formatFieldValue(key, value) {
  if (value === null || value === undefined || value === '') return '—'
  if (key === 'latitude' || key === 'longitude') {
    const num = Number(value)
    if (!Number.isFinite(num)) return '—'
    return num.toFixed(6)
  }
  if (key === 'active') return value ? 'Có' : 'Không'
  if (key === 'deleted_at') return value ? 'Có' : 'Không'
  return String(value)
}

export default function StoreEditHistoryPage() {
  const router = useRouter()
  const { id } = router.query
  const from = Array.isArray(router.query.from) ? router.query.from[0] : router.query.from
  const { user, isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {}

  const [pageReady, setPageReady] = useState(false)
  const [storeName, setStoreName] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [fieldFilter, setFieldFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const storeId = useMemo(() => {
    const raw = Array.isArray(id) ? id[0] : id
    return raw ? String(raw) : ''
  }, [id])

  // Auth guard
  useEffect(() => {
    if (!router.isReady || authLoading) return
    if (!isAuthenticated) {
      setPageReady(false)
      void router.replace(`/login?from=${encodeURIComponent(router.asPath || `/store/history/${storeId}`)}`)
      return
    }
    if (!isAdmin) {
      setPageReady(false)
      void router.replace('/account')
      return
    }
    setPageReady(true)
  }, [router, authLoading, isAuthenticated, isAdmin, storeId])

  const resolveStoreName = useCallback(async () => {
    if (!storeId) return
    try {
      const cached = await getCachedStores()
      const cachedStores = Array.isArray(cached?.data) ? cached.data : []
      const cachedMatch = cachedStores.find((entry) => String(entry?.id) === String(storeId))
      if (cachedMatch?.name) {
        setStoreName(cachedMatch.name)
        return
      }

      const all = await getOrRefreshStores()
      const match = (all || []).find((entry) => String(entry?.id) === String(storeId))
      if (match?.name) setStoreName(match.name)
    } catch {
      // ignore
    }
  }, [storeId])

  const loadPage = useCallback(async (offset, { append = false } = {}) => {
    if (!storeId) return
    const nextOffset = Math.max(0, Number(offset) || 0)
    setError('')
    try {
      const { data, error: fetchError } = await supabase
        .from('store_edit_history')
        .select('id, store_id, action_type, actor_user_id, actor_role, changes, created_at')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .range(nextOffset, nextOffset + PAGE_SIZE - 1)

      if (fetchError) throw fetchError
      const pageData = Array.isArray(data) ? data : []
      setHasMore(pageData.length === PAGE_SIZE)
      setItems((prev) => (append ? [...prev, ...pageData] : pageData))
    } catch (err) {
      console.error(err)
      setError('Không tải được lịch sử chỉnh sửa. Vui lòng thử lại.')
      if (!append) setItems([])
      setHasMore(false)
    }
  }, [storeId])

  useEffect(() => {
    if (!pageReady || !storeId) return
    setLoading(true)
    void resolveStoreName()
    void loadPage(0, { append: false }).finally(() => setLoading(false))
  }, [pageReady, storeId, resolveStoreName, loadPage])

  const availableActionTypes = useMemo(() => {
    return Array.from(new Set(items.map((row) => String(row?.action_type || '')).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'vi'))
  }, [items])

  const availableFields = useMemo(() => {
    const keys = new Set()
    for (const row of items) {
      const changes = row?.changes && typeof row.changes === 'object' ? row.changes : {}
      Object.keys(changes).forEach((key) => keys.add(key))
    }
    return Array.from(keys).sort((a, b) => a.localeCompare(b, 'vi'))
  }, [items])

  const filteredItems = useMemo(() => {
    const q = String(searchTerm || '').trim().toLowerCase()
    return items.filter((row) => {
      if (actionFilter !== 'all' && String(row?.action_type || '') !== actionFilter) return false

      const changes = row?.changes && typeof row.changes === 'object' ? row.changes : {}
      const keys = Object.keys(changes)
      if (fieldFilter !== 'all' && !keys.includes(fieldFilter)) return false

      if (!q) return true
      const actionLabel = ACTION_LABELS[row.action_type] || String(row.action_type || '')
      const actorRole = String(row.actor_role || '')
      const joinedKeys = keys.join(' ')
      return (
        actionLabel.toLowerCase().includes(q) ||
        String(row.action_type || '').toLowerCase().includes(q) ||
        actorRole.toLowerCase().includes(q) ||
        joinedKeys.toLowerCase().includes(q)
      )
    })
  }, [items, actionFilter, fieldFilter, searchTerm])

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    await loadPage(items.length, { append: true })
    setLoadingMore(false)
  }

  if (authLoading || !router.isReady) return <FullPageLoading />
  if (!pageReady) return null

  return (
    <>
      <Head>
        <title>Lịch sử chỉnh sửa - NPP Hà Công</title>
      </Head>

      <div className="min-h-screen bg-black">
        <div className="max-w-screen-md mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-gray-100">Lịch sử chỉnh sửa</h1>
              <p className="text-sm text-gray-400 break-words">
                {storeName ? storeName : `Cửa hàng: ${storeId}`}
              </p>
              <p className="text-xs text-gray-500">
                Admin: {user?.email || '—'}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (from) router.push(String(from))
                else router.back()
              }}
            >
              Quay lại
            </Button>
          </div>

          <Card className="rounded-2xl border border-gray-800">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm theo hành động/field/role..."
                  className="h-11 rounded-xl border border-gray-700 bg-gray-900 px-3 text-base text-gray-100"
                  aria-label="Tìm trong lịch sử"
                />
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="h-11 rounded-xl border border-gray-700 bg-gray-900 px-3 text-base text-gray-100"
                  aria-label="Lọc theo hành động"
                >
                  <option value="all">Tất cả hành động</option>
                  {availableActionTypes.map((type) => (
                    <option key={type} value={type}>{ACTION_LABELS[type] || type}</option>
                  ))}
                </select>
                <select
                  value={fieldFilter}
                  onChange={(e) => setFieldFilter(e.target.value)}
                  className="h-11 rounded-xl border border-gray-700 bg-gray-900 px-3 text-base text-gray-100"
                  aria-label="Lọc theo trường"
                >
                  <option value="all">Tất cả trường</option>
                  {availableFields.map((key) => (
                    <option key={key} value={key}>{FIELD_LABELS[key] || key}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between gap-3 text-sm text-gray-400">
                <span>Đang hiển thị: {filteredItems.length} / {items.length}</span>
                {(actionFilter !== 'all' || fieldFilter !== 'all' || String(searchTerm || '').trim()) ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setActionFilter('all')
                      setFieldFilter('all')
                      setSearchTerm('')
                    }}
                  >
                    Xóa lọc
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <Card className="rounded-2xl border border-gray-800">
              <CardContent className="p-4">
                <p className="text-sm text-gray-400">Đang tải lịch sử...</p>
              </CardContent>
            </Card>
          ) : filteredItems.length === 0 ? (
            <Card className="rounded-2xl border border-gray-800">
              <CardContent className="p-5 text-center space-y-2">
                <p className="text-base font-semibold text-gray-100">
                  {items.length === 0 ? 'Chưa có lịch sử chỉnh sửa' : 'Không có kết quả phù hợp bộ lọc'}
                </p>
                <p className="text-sm text-gray-400">
                  {items.length === 0
                    ? 'Khi admin chỉnh sửa/xác thực/duyệt báo cáo, lịch sử sẽ xuất hiện ở đây.'
                    : 'Hãy thử đổi bộ lọc hoặc từ khóa.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((row) => {
                const actionLabel = ACTION_LABELS[row.action_type] || row.action_type
                const changes = row.changes && typeof row.changes === 'object' ? row.changes : {}
                const keys = Object.keys(changes).sort((a, b) => a.localeCompare(b, 'vi'))
                const actorRoleText = String(row.actor_role || '').trim()
                return (
                  <Card key={row.id} className="rounded-2xl border border-gray-800">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-gray-100">{actionLabel}</p>
                          <p className="text-sm text-gray-400">{formatDateTime(row.created_at)}</p>
                          {actorRoleText ? (
                            <p className="text-xs text-gray-500">Role: {actorRoleText}</p>
                          ) : null}
                        </div>
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium bg-gray-800 text-gray-200 border border-gray-700">
                          {keys.length} thay đổi
                        </span>
                      </div>

                      <div className="space-y-2">
                        {keys.map((key) => {
                          const entry = changes[key] || {}
                          const label = FIELD_LABELS[key] || key
                          const fromValue = formatFieldValue(key, entry.from)
                          const toValue = formatFieldValue(key, entry.to)
                          return (
                            <div key={`${row.id}-${key}`} className="rounded-xl border border-gray-800 bg-gray-950 p-3">
                              <p className="text-sm font-medium text-gray-200">{label}</p>
                              <p className="text-sm text-gray-500 line-through break-words [overflow-wrap:anywhere]">{fromValue}</p>
                              <p className="text-sm text-green-300 break-words [overflow-wrap:anywhere]">{toValue}</p>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}

              {hasMore && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loadingMore}
                  onClick={handleLoadMore}
                >
                  {loadingMore ? 'Đang tải...' : 'Tải thêm'}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

