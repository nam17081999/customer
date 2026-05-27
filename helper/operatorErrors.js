const DEFAULT_OPERATOR_MESSAGE = 'Có lỗi xảy ra. Vui lòng thử lại hoặc báo quản trị viên.'

const ERROR_RULES = [
  { test: /insufficient stock|not enough stock|stock would be negative|negative/i, message: 'Tồn kho không đủ để thực hiện thao tác.' },
  { test: /duplicate key|unique constraint|23505/i, message: 'Dữ liệu đã tồn tại. Vui lòng kiểm tra mã/SKU hoặc thử lại.' },
  { test: /invalid input syntax|invalid uuid|22P02/i, message: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin nhập.' },
  { test: /not authorized|permission denied|admin permission required|42501|rls/i, message: 'Không có quyền thực hiện thao tác này.' },
  { test: /timeout|timed out|network|fetch failed|failed to fetch/i, message: 'Kết nối không ổn định. Vui lòng thử lại.' },
  { test: /requires at least one item|empty.*item/i, message: 'Cần có ít nhất một dòng hàng.' },
  { test: /discount.*exceeds subtotal/i, message: 'Chiết khấu không được lớn hơn tổng tiền hàng.' },
  { test: /quantity|conversion|numeric|invalid money|precision/i, message: 'Số lượng hoặc số tiền không hợp lệ.' },
  { test: /sales order .* not found|purchase order .* not found|not found/i, message: 'Không tìm thấy dữ liệu cần xử lý. Vui lòng làm mới trang.' },
  { test: /cancelled|already cancelled/i, message: 'Chứng từ đã bị hủy trước đó.' },
]

function collectErrorText(error) {
  if (!error) return ''
  if (typeof error === 'string') return error
  const parts = [
    error.operatorMessage,
    error.message,
    error.details,
    error.hint,
    error.code,
    error.error_description,
    error.error?.message,
  ]
  return parts.filter(Boolean).map(String).join(' ')
}

export function getOperatorErrorMessage(error, fallback = DEFAULT_OPERATOR_MESSAGE) {
  if (error?.operatorMessage) return error.operatorMessage
  const text = collectErrorText(error)
  if (!text) return fallback
  const matched = ERROR_RULES.find((rule) => rule.test.test(text))
  if (matched) return matched.message
  const safeText = String(error?.message || '').trim()
  if (safeText && !/[A-Z0-9_]{4,}|constraint|syntax|SQL|Postgres|stack|uuid/i.test(safeText)) return safeText
  return fallback
}

export function normalizeOperatorError(error, fallback = DEFAULT_OPERATOR_MESSAGE) {
  const normalized = new Error(getOperatorErrorMessage(error, fallback))
  normalized.name = 'OperatorSafeError'
  normalized.operatorMessage = normalized.message
  normalized.code = error?.code || null
  normalized.cause = error
  return normalized
}

export function toOperatorErrorPayload(error, fallback = DEFAULT_OPERATOR_MESSAGE) {
  return {
    message: getOperatorErrorMessage(error, fallback),
    code: error?.code || null,
    retryable: /timeout|network|fetch failed|failed to fetch/i.test(collectErrorText(error)),
  }
}
