export function buildReportStatusChangedDetail({ reportId, status } = {}) {
  return {
    type: 'report-status-changed',
    reportId: reportId ?? null,
    status: status || null,
  }
}

export function dispatchReportsChanged(detail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('storevis:reports-changed', {
      detail,
    })
  )
}
