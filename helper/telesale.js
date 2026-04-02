import { formatDate } from '@/helper/validation'

export const TELESALE_CALL_RESULT_OPTIONS = [
  { value: 'khong_nghe', label: 'Không nghe' },
  { value: 'goi_lai_sau', label: 'Gọi lại sau' },
  { value: 'con_hang', label: 'Còn hàng' },
  { value: 'da_len_don', label: 'Đã lên đơn' },
]

export function getTelesaleResultLabel(value) {
  const legacyLabelMap = {
    khong_nghe_may: 'Không nghe',
    quan_tam: 'Còn hàng',
    khong_quan_tam: 'Chưa cập nhật',
    da_bao_don: 'Đã lên đơn',
  }
  return TELESALE_CALL_RESULT_OPTIONS.find((option) => option.value === value)?.label || legacyLabelMap[value] || 'Chưa cập nhật'
}

export function formatLastCalledText(value) {
  if (!value) return 'Chưa gọi'
  return formatDate(value)
}

export function hasReportedOrder(store) {
  return Boolean(store?.last_order_reported_at)
}
