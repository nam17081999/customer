import { useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { parseCsvContent, validateProductImportRows } from '@/helper/importCsv'
import { formatMoney } from '@/helper/inventoryFormat'
import { useAuth } from '@/lib/AuthContext'
import { getOperatorErrorMessage } from '@/helper/operatorErrors'
import { submitProductImportFromPreview } from '@/services/inventory/inventory-page-service'

const SAMPLE = 'name,sku,base_unit_name,default_sale_price,retail_price,wholesale_price\nNước suối 500ml,NUOC-500,chai,5000,6000,5500'

export default function ProductImportPage() {
  const { user, isAdmin } = useAuth() || {}
  const [fileName, setFileName] = useState('')
  const [rawCsv, setRawCsv] = useState('')
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)

  const parsed = useMemo(() => parseCsvContent(rawCsv), [rawCsv])
  const validatedRows = useMemo(() => validateProductImportRows(parsed.rows), [parsed.rows])
  const validRows = useMemo(() => validatedRows.filter((row) => row.errors.length === 0), [validatedRows])
  const invalidRows = useMemo(() => validatedRows.filter((row) => row.errors.length > 0), [validatedRows])
  const duplicateCount = useMemo(() => validatedRows.filter((row) => row.errors.includes('Trùng SKU trong file')).length, [validatedRows])
  const totalValue = useMemo(() => validRows.reduce((sum, row) => sum + Number(row.data.defaultSalePrice || 0), 0), [validRows])
  const canImport = isAdmin && validRows.length > 0 && invalidRows.length === 0 && !importing

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    setError('')
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Chỉ hỗ trợ file CSV.')
      return
    }
    setFileName(file.name)
    setRawCsv(await file.text())
    setImportResult(null)
  }

  const handleConfirmImport = async () => {
    if (!canImport) return
    const confirmed = window.confirm(`Import ${validRows.length} sản phẩm hợp lệ? Thao tác này ghi dữ liệu thật và được audit.`)
    if (!confirmed) return
    setImporting(true)
    setError('')
    setImportResult(null)
    try {
      const requestId = `product-import-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      const result = await submitProductImportFromPreview(validRows, { requestId, actorId: user?.id || null })
      setImportResult(result)
    } catch (err) {
      setError(getOperatorErrorMessage(err, 'Import thất bại. Chưa xác nhận được trạng thái ghi dữ liệu.'))
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <Head><title>Preview import sản phẩm - NPP Hà Công</title></Head>
      <main className="min-h-full bg-black text-gray-100">
        <div className="mx-auto max-w-[1600px] space-y-4 px-3 py-4 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold"><FileSpreadsheet className="h-6 w-6" /> Preview import sản phẩm</h1>
              <p className="text-base text-gray-400">Kiểm tra CSV, trùng SKU, dữ liệu lỗi trước khi import thật. Màn này chưa ghi DB.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handleConfirmImport} disabled={!canImport}>{importing ? 'Đang import...' : 'Xác nhận import'}</Button>
              <Button asChild variant="outline"><Link href="/admin/operations">Trung tâm vận hành</Link></Button>
            </div>
          </div>

          {error && <div className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-red-200">{error}</div>}

          <Card><CardContent className="space-y-3 p-4">
            <label className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-700 bg-gray-950 p-4 text-center hover:border-amber-500">
              <Upload className="h-6 w-6 text-amber-300" />
              <span className="font-semibold">Chọn CSV sản phẩm</span>
              <span className="text-sm text-gray-400">Cột hỗ trợ: name/ten/Tên hàng, sku, base_unit_name/unit/Đơn vị, default_sale_price/sale_price/Giá bán, retail_price/Giá bán lẻ, wholesale_price/Giá bán xỉ</span>
              <input data-testid="product-import-file" type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFile} />
            </label>
            <textarea data-testid="product-import-raw" value={rawCsv} onChange={(event) => { setFileName('Dán thủ công'); setRawCsv(event.target.value); setImportResult(null) }} rows={5} className="w-full rounded-lg border border-gray-700 bg-gray-950 p-3 text-base text-gray-100" placeholder={SAMPLE} />
          </CardContent></Card>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card><CardContent className="p-4"><p className="text-sm text-gray-400">File</p><p className="truncate text-lg font-semibold">{fileName || 'Chưa chọn'}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-gray-400">Dòng hợp lệ</p><p className="text-2xl font-bold text-green-200">{validRows.length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-gray-400">Dòng lỗi</p><p className="text-2xl font-bold text-red-200">{invalidRows.length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-gray-400">Giá bán preview</p><p className="text-2xl font-bold text-sky-200">{formatMoney(totalValue)}</p></CardContent></Card>
          </div>

          {duplicateCount > 0 && <div className="flex items-center gap-2 rounded-lg border border-amber-900 bg-amber-950/30 p-3 text-amber-100"><AlertTriangle className="h-5 w-5" /> Có {duplicateCount} SKU trùng trong file.</div>}
          {rawCsv && invalidRows.length === 0 && <div className="flex items-center gap-2 rounded-lg border border-green-900 bg-green-950/30 p-3 text-green-100"><CheckCircle2 className="h-5 w-5" /> Preview sạch. Có thể chuyển sang bước import có transaction.</div>}
          {!isAdmin && <div className="rounded-lg border border-amber-900 bg-amber-950/30 p-3 text-amber-100">Chỉ admin được xác nhận import thật.</div>}
          {importResult && <div data-testid="product-import-result" className="rounded-lg border border-green-900 bg-green-950/30 p-3 text-green-100">Import xong: thêm {importResult.summary?.insertedCount || 0}, cập nhật {importResult.summary?.updatedCount || 0}, bỏ qua {importResult.summary?.skippedCount || 0}.</div>}

          <Card><CardContent className="p-0">
            <div className="border-b border-gray-800 p-4"><h2 className="text-lg font-semibold">Validation report</h2><p className="text-sm text-gray-400">Partial failure được hiển thị theo từng dòng để sửa file trước khi import.</p></div>
            {validatedRows.length === 0 ? <div className="p-4 text-gray-400">Dán CSV hoặc chọn file để xem preview.</div> : validatedRows.slice(0, 200).map((row) => (
              <div key={row.rowNumber} data-testid="import-preview-row" className="grid gap-2 border-b border-gray-900 px-4 py-3 last:border-b-0 md:grid-cols-[90px_1fr_120px_140px_140px_140px_1.3fr]">
                <span className="text-gray-400">Dòng {row.rowNumber}</span>
                <span className="font-semibold">{row.data.name || '—'}</span>
                <span>{row.data.sku || 'Không SKU'}</span>
                <span>{formatMoney(row.data.defaultSalePrice || 0)}</span>
                <span className="hidden sm:block">{formatMoney(row.data.retailPrice || 0)}</span>
                <span className="hidden sm:block">{formatMoney(row.data.wholesalePrice || 0)}</span>
                <span className={row.errors.length ? 'text-red-200' : 'text-green-200'}>{row.errors.length ? row.errors.join(', ') : 'OK'}</span>
              </div>
            ))}
          </CardContent></Card>
        </div>
      </main>
    </>
  )
}
