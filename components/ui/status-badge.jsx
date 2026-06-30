'use client'

const STATUS_MAP = {
  active:   'status-active',
  pending:  'status-pending',
  confirmed:'status-active',
  cancelled:'status-inactive',
  inactive: 'status-inactive',
  success:  'status-success',
  warning:  'status-warning',
  danger:   'status-danger',
  info:     'status-info',
  default:  'status-default',
  draft:    'status-draft',
}

const STATUS_LABEL = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  cancelled: 'Đã hủy',
}

export function StatusBadge({ status = 'default', label }) {
  const cls = STATUS_MAP[status] || STATUS_MAP.default
  const text = label || STATUS_LABEL[status] || status
  return (
    <span className={`status-badge ${cls}`}>
      <span className="dot" />
      {text}
    </span>
  )
}
