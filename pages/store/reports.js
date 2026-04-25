import Head from 'next/head'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { REPORT_REASON_OPTIONS } from '@/lib/constants'
import { summarizeStoreReport } from '@/helper/storeReportFlow'
import { formatDateTime } from '@/helper/validation'
import { useStoreReportsController } from '@/helper/useStoreReportsController'

const reasonLabelMap = REPORT_REASON_OPTIONS.reduce((acc, item) => {
  acc[item.code] = item.label
  return acc
}, {})

export default function StoreReportsPage() {
  const {
    authLoading,
    pageReady,
    reports,
    loading,
    error,
    message,
    loadReports,
  } = useStoreReportsController()

  const pendingCount = reports.length

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black">
        <div className="mx-auto max-w-screen-md px-3 py-6 sm:px-4">
          <p className="text-sm text-gray-400">Đang kiểm tra đăng nhập...</p>
        </div>
      </div>
    )
  }

  if (!pageReady) return null

  return (
    <>
      <Head>
        <title>Báo cáo cửa hàng - NPP Hà Công</title>
      </Head>

      <div className="min-h-screen bg-black">
        <div className="mx-auto max-w-screen-md space-y-4 px-3 py-4 sm:px-4 sm:py-6">
          <Card className="rounded-2xl border border-gray-800">
            <CardContent className="space-y-3 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-lg font-bold text-gray-100 sm:text-xl">Báo cáo cửa hàng</h1>
                  <p className="text-sm text-gray-400">Danh sách báo cáo chờ xử lý. Bấm vào từng mục để xem màn chi tiết riêng.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={loadReports} disabled={loading}>
                  {loading ? 'Đang tải...' : 'Làm mới'}
                </Button>
              </div>

              <div className="rounded-xl border border-blue-900 bg-blue-950/30 p-3">
                <p className="text-sm text-blue-200">Báo cáo chờ xử lý</p>
                <p className="text-2xl font-bold text-blue-100">{pendingCount}</p>
              </div>

              {error ? (
                <div className="rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-sm text-red-300">
                  {error}
                </div>
              ) : null}
              {message ? (
                <div className="rounded-lg border border-green-900 bg-green-950/30 px-3 py-2 text-sm text-green-300">
                  {message}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {!loading && reports.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-950 p-4 text-sm text-gray-400">
              Hiện chưa có báo cáo cần xử lý.
            </div>
          ) : null}

          <div className="space-y-3">
            {reports.map((report) => {
              const isEdit = report.report_type === 'edit'
              const summary = summarizeStoreReport(report)
              const reasonLabels = (report.reason_codes || []).map((code) => reasonLabelMap[code] || code)

              return (
                <Card key={report.id} className="rounded-2xl border border-gray-800">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                            isEdit
                              ? 'border-blue-900 bg-blue-950/60 text-blue-200'
                              : 'border-amber-900 bg-amber-950/60 text-amber-200'
                          }`}>
                            {isEdit ? 'Sửa thông tin' : 'Báo cáo vấn đề'}
                          </span>
                          <span className="text-xs text-gray-500">{formatDateTime(report.created_at)}</span>
                        </div>

                        <h2 className="break-words text-base font-semibold text-gray-100">
                          {report.store?.name || 'Cửa hàng không rõ'}
                        </h2>

                        <p className="text-sm text-gray-400">
                          {isEdit
                            ? `Có ${summary.fieldCount} mục thay đổi được đề xuất.`
                            : (reasonLabels.length > 0 ? reasonLabels.join(', ') : 'Không có lý do')}
                        </p>
                      </div>

                      <Button asChild className="w-full sm:w-auto">
                        <Link href={`/store/reports/${report.id}`}>Xem chi tiết</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
