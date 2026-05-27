import { toInventoryNumber } from '@/helper/orderInventoryFlow'

export function formatMoney(value) {
  const number = Number(value || 0)
  return number.toLocaleString('vi-VN')
}

export function toNumber(value, fallback = 0) {
  return toInventoryNumber(value, fallback)
}

export function buildDocumentCode(prefix) {
  const date = new Date()
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join('')
  return `${prefix}${stamp}`
}
