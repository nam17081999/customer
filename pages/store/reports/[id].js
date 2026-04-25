import { useMemo } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import StoreReportAdminDetail from '@/components/store/store-report-admin-detail'
import { summarizeStoreReport } from '@/helper/storeReportFlow'
import { useStoreReportsController } from '@/helper/useStoreReportsController'

export default function StoreReportDetailPage() {
  const router = useRouter()
  const reportId = useMemo(() => {
    const raw = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id
    return raw ? String(raw) : ''
  }, [router.query.id])

  const {
    authLoading,
    pageReady,
    reports,
    loading,
    error,
    message,
    actionLoading,
    confirmAction,
    closeConfirmAction,
    handleReject,
    openConfirmAction,
    handleConfirmAction,
  } = useStoreReportsController()

  const report = reports.find((item) => item.id === reportId) || null
  const reportHandled = !loading && reportId && reports.length > 0 && !report
  const isLoading = Boolean(actionLoading[reportId])

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
        <title>Chi tiết báo cáo - NPP Hà Công</title>
      </Head>

      <div className="min-h-screen bg-black">
        <div className="mx-auto max-w-screen-md space-y-4 px-3 py-4 sm:px-4 sm:py-6">
          <div className="flex items-center justify-between gap-3">
            <Button asChild variant="outline">
              <Link href="/store/reports">Quay lại danh sách</Link>
            </Button>
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

          {loading ? (
            <div className="rounded-xl border border-gray-800 bg-gray-950 p-4 text-sm text-gray-400">
              Đang tải chi tiết báo cáo...
            </div>
          ) : null}

          {report ? (
            <StoreReportAdminDetail
              report={report}
              isLoading={isLoading}
              onReject={() => handleReject(report.id)}
              onApprove={() => openConfirmAction(report.report_type === 'edit' ? 'edit' : 'reason', report)}
            />
          ) : null}

          {reportHandled ? (
            <div className="rounded-xl border border-gray-800 bg-gray-950 p-4 text-sm text-gray-400">
              Báo cáo này không còn ở trạng thái chờ xử lý hoặc không tồn tại.
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={confirmAction.open} onOpenChange={(open) => { if (!open) closeConfirmAction() }}>
        <DialogContent className="rounded-2xl border border-gray-800 bg-gray-950 text-gray-100 sm:max-w-md">
          <DialogTitle>
            {confirmAction.type === 'edit' ? 'Xác nhận cập nhật cửa hàng' : 'Xác nhận đánh dấu báo cáo'}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-400">
            {confirmAction.type === 'edit'
              ? 'Duyệt và cập nhật cửa hàng theo đề xuất?'
              : 'Đánh dấu báo cáo này là đã xử lý?'}
          </DialogDescription>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeConfirmAction}>Hủy</Button>
            <Button type="button" onClick={handleConfirmAction}>Xác nhận</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
