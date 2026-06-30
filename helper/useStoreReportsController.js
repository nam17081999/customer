import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { updateStoreInCache } from '@/lib/storeCache'
import { buildStoreDiff, logStoreEditHistory } from '@/lib/storeEditHistory'
import { buildReportStatusChangedDetail, dispatchReportsChanged } from '@/helper/storeReportEvents'
import { fetchPendingReports, updateReportStatus as updateReportStatusDb, applyReportEdit } from '@/api/reports/report-client'

const STORE_REPORTS_SELECT = 'id, store_id, report_type, reason_codes, reason_note, proposed_changes, status, created_at, store:stores!inner(id, name, store_type, address_detail, ward, district, phone, note, latitude, longitude, active, deleted_at)'

export function useStoreReportsController() {
  const router = useRouter()
  const { user, isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {}
  const [pageReady, setPageReady] = useState(false)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [actionLoading, setActionLoading] = useState({})
  const [confirmAction, setConfirmAction] = useState({ open: false, type: '', report: null })

  useEffect(() => {
    if (authLoading) return

    if (!isAuthenticated) {
      setPageReady(false)
      void router.replace('/login?from=/store/reports').catch((err) => {
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

  const markActionLoading = useCallback((reportId, value) => {
    setActionLoading((prev) => ({ ...prev, [reportId]: value }))
  }, [])

  const removeHandledReport = useCallback((reportId) => {
    setReports((prev) => prev.filter((item) => item.id !== reportId))
  }, [])

  const loadReports = useCallback(async () => {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const { data, error: fetchError } = await fetchPendingReports()

      if (fetchError) throw fetchError
      setReports(data || [])
    } catch (err) {
      console.error(err)
      setReports([])
      setError('Không tải được danh sách báo cáo. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!pageReady) return
    void loadReports()
  }, [pageReady, loadReports])

  const updateReportStatusAction = useCallback(async ({ reportId, status, errorMessage, successMessage }) => {
    markActionLoading(reportId, true)
    const { error: updateError } = await updateReportStatusDb(reportId, status)

    if (updateError) {
      setError(errorMessage)
    } else {
      removeHandledReport(reportId)
      dispatchReportsChanged(buildReportStatusChangedDetail({ reportId, status }))
      setMessage(successMessage)
    }

    markActionLoading(reportId, false)
  }, [markActionLoading, removeHandledReport])

  const handleReject = useCallback(async (reportId) => {
    await updateReportStatusAction({
      reportId,
      status: 'rejected',
      errorMessage: 'Từ chối thất bại. Vui lòng thử lại.',
      successMessage: 'Đã từ chối báo cáo.',
    })
  }, [updateReportStatusAction])

  const handleApproveReason = useCallback(async (reportId) => {
    await updateReportStatusAction({
      reportId,
      status: 'approved',
      errorMessage: 'Cập nhật thất bại. Vui lòng thử lại.',
      successMessage: 'Đã đánh dấu báo cáo.',
    })
  }, [updateReportStatusAction])

  const handleApproveEdit = useCallback(async (report) => {
    const reportId = report?.id
    const storeId = report?.store_id
    const proposed = report?.proposed_changes || {}

    if (!reportId) return

    markActionLoading(reportId, true)
    setError('')

    if (!storeId || Object.keys(proposed).length === 0) {
      setError('Không có thay đổi để cập nhật.')
      markActionLoading(reportId, false)
      return
    }

    const storeUpdates = { ...proposed, updated_at: new Date().toISOString() }

    const { error: updateStoreError } = await applyReportEdit(storeId, storeUpdates, reportId)

    if (updateStoreError) {
      console.error(updateStoreError)
      setError('Không cập nhật được cửa hàng. Vui lòng thử lại.')
      markActionLoading(reportId, false)
      return
    }

    removeHandledReport(reportId)
    dispatchReportsChanged(buildReportStatusChangedDetail({ reportId, status: 'approved' }))
    setMessage('Đã duyệt cập nhật cửa hàng.')
    const nextStore = { ...(report.store || {}), ...storeUpdates }
    await updateStoreInCache(storeId, storeUpdates)
    try {
      const changes = buildStoreDiff(report.store || {}, storeUpdates)
      await logStoreEditHistory({
        storeId,
        actionType: 'report_apply',
        actorUserId: user?.id,
        changes,
      })
    } catch (err) {
      console.error('store_edit_history report_apply failed:', err)
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('storevis:stores-changed', {
          detail: { type: 'update', id: storeId, store: nextStore },
        })
      )
    }

    markActionLoading(reportId, false)
  }, [markActionLoading, removeHandledReport, user?.id])

  const openConfirmAction = useCallback((type, report) => {
    setConfirmAction({ open: true, type, report })
  }, [])

  const closeConfirmAction = useCallback(() => {
    setConfirmAction({ open: false, type: '', report: null })
  }, [])

  const handleConfirmAction = useCallback(async () => {
    const currentAction = confirmAction
    closeConfirmAction()

    if (!currentAction.report) return
    if (currentAction.type === 'edit') {
      await handleApproveEdit(currentAction.report)
      return
    }
    if (currentAction.type === 'reason') {
      await handleApproveReason(currentAction.report.id)
    }
  }, [closeConfirmAction, confirmAction, handleApproveEdit, handleApproveReason])

  return {
    authLoading,
    pageReady,
    reports,
    loading,
    error,
    message,
    actionLoading,
    confirmAction,
    loadReports,
    handleReject,
    openConfirmAction,
    closeConfirmAction,
    handleConfirmAction,
  }
}
