import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { supabase } from '@/lib/supabaseClient'
import { appendStoresToCache, getOrRefreshStores, updateStoresInCache } from '@/lib/storeCache'
import { DEFAULT_STORE_TYPE, STORE_TYPE_OPTIONS } from '@/lib/constants'
import { formatAddressParts } from '@/lib/utils'
import { formatDistance } from '@/helper/validation'
import {
  buildImportPreviewRowsFromCsv,
  buildResolutionPatch,
  buildRowAddress,
  buildTemplateCsv,
  canResolveSystemDuplicate,
  chunkArray,
  finalizePreviewRow,
  getRowContainerVariant,
  getRowStatusLabel,
  getRowStatusVariant,
  prepareExistingStores,
} from '@/helper/storeImportFlow'

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
      const { previewRows: nextPreviewRows, error } = buildImportPreviewRowsFromCsv({
        csvText,
        existingStores,
      })

      setPreviewRows(nextPreviewRows)
      setParseError(error)
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
        <div className="mx-auto max-w-screen-md space-y-4 px-3 py-4 sm:px-4 sm:py-6">
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
                              <h3 className="mt-2 break-words text-base font-semibold text-gray-100">
                                {row.name || 'Chưa có tên cửa hàng'}
                              </h3>
                              <p className="mt-1 break-words text-sm text-gray-400">
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
                                          <div className="break-words text-sm font-medium text-gray-100">
                                            {match.name || 'Cửa hàng'}
                                          </div>
                                          <div className="mt-1 break-words text-sm text-gray-400">
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
