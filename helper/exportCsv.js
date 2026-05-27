function escapeCsvValue(value) {
  if (value == null) return ''
  const text = String(value)
  if (!/[",\n\r]/.test(text)) return text
  return `"${text.replaceAll('"', '""')}"`
}

export function buildCsvContent({ columns = [], rows = [] } = {}) {
  const safeColumns = (Array.isArray(columns) ? columns : [])
    .map((column) => ({ key: String(column.key || '').trim(), label: String(column.label || column.key || '').trim() }))
    .filter((column) => column.key)
  if (safeColumns.length === 0) throw new Error('CSV cần ít nhất một cột.')

  const header = safeColumns.map((column) => escapeCsvValue(column.label)).join(',')
  const body = (Array.isArray(rows) ? rows : []).map((row) => (
    safeColumns.map((column) => escapeCsvValue(row?.[column.key])).join(',')
  ))
  return [header, ...body].join('\n')
}

export function buildReportExportRows(rows = [], mapper = (row) => row) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => ({
    stt: index + 1,
    ...mapper(row, index),
  }))
}

export function downloadCsvFile({ filename = 'export.csv', content }) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
  return true
}
