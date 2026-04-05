/**
 * Validation utilities for the application
 */

/**
 * Validate phone number (Vietnamese format)
 */
export function isValidPhone(phone) {
  return validateVietnamPhone(phone).isValid
}

export function expandScientificNumber(rawValue) {
  const normalized = String(rawValue || '').trim()
  if (!/^\d+(\.\d+)?e[+-]?\d+$/i.test(normalized)) return normalized

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return normalized
  return parsed.toFixed(0)
}

export function getVietnamPhoneInfo(rawValue, options = {}) {
  const { autoRestoreLeadingZero = false } = options
  const trimmed = String(rawValue || '').trim()
  if (!trimmed) {
    return {
      input: '',
      compact: '',
      comparable: '',
      originalCompact: '',
      autoAddedLeadingZero: false,
    }
  }

  let normalized = trimmed.replace(/^'/, '')
  normalized = expandScientificNumber(normalized)
  normalized = normalized.replace(/\.0+$/, '')
  normalized = normalized.replace(/[\s().-]+/g, '')

  const originalCompact = normalized.startsWith('+')
    ? `+${normalized.slice(1).replace(/\D+/g, '')}`
    : normalized.replace(/\D+/g, '')

  const shouldRestoreLeadingZero = autoRestoreLeadingZero
    && /^\d+$/.test(originalCompact)
    && !originalCompact.startsWith('0')
    && !originalCompact.startsWith('84')

  const compact = shouldRestoreLeadingZero ? `0${originalCompact}` : originalCompact
  const comparable = compact.startsWith('+84')
    ? `0${compact.slice(3)}`
    : compact.startsWith('84')
      ? `0${compact.slice(2)}`
      : compact

  return {
    input: trimmed,
    compact,
    comparable,
    originalCompact,
    autoAddedLeadingZero: shouldRestoreLeadingZero,
  }
}

export function normalizeVietnamPhoneForComparison(rawValue, options = {}) {
  return getVietnamPhoneInfo(rawValue, options).comparable
}

export function validateVietnamPhone(rawValue, options = {}) {
  const { required = false, autoRestoreLeadingZero = false } = options
  const info = getVietnamPhoneInfo(rawValue, { autoRestoreLeadingZero })
  const normalized = info.comparable
  const autoFixText = info.autoAddedLeadingZero
    ? `Đã tự thêm số 0 đầu thành ${normalized}. `
    : ''

  if (!normalized) {
    return {
      isValid: !required,
      normalized: '',
      message: required ? 'Vui lòng nhập số điện thoại' : '',
      autoAddedLeadingZero: info.autoAddedLeadingZero,
    }
  }

  if (!/^0\d+$/.test(normalized)) {
    return {
      isValid: false,
      normalized,
      message: `${autoFixText}Số điện thoại chỉ được chứa chữ số và phải bắt đầu bằng 0, 84 hoặc +84.`,
      autoAddedLeadingZero: info.autoAddedLeadingZero,
    }
  }

  if (normalized.startsWith('02')) {
    if (normalized.length < 10 || normalized.length > 11) {
      return {
        isValid: false,
        normalized,
        message: `${autoFixText}Số máy bàn phải bắt đầu bằng 02 và có 10 hoặc 11 số.`,
        autoAddedLeadingZero: info.autoAddedLeadingZero,
      }
    }
    return {
      isValid: true,
      normalized,
      message: '',
      autoAddedLeadingZero: info.autoAddedLeadingZero,
    }
  }

  if (!/^0[35789]/.test(normalized)) {
    return {
      isValid: false,
      normalized,
      message: `Đầu số ${normalized.slice(0, 2)} không phải số di động hoặc máy bàn Việt Nam hợp lệ.`,
      autoAddedLeadingZero: info.autoAddedLeadingZero,
    }
  }

  if (normalized.length !== 10) {
    return {
      isValid: false,
      normalized,
      message: `${autoFixText}Số di động Việt Nam phải có đúng 10 số.`,
      autoAddedLeadingZero: info.autoAddedLeadingZero,
    }
  }

  return {
    isValid: true,
    normalized,
    message: '',
    autoAddedLeadingZero: info.autoAddedLeadingZero,
  }
}

export function findDuplicatePhoneStores(stores, rawPhone, options = {}) {
  const { excludeStoreId = null, autoRestoreLeadingZero = false } = options
  const normalizedPhone = normalizeVietnamPhoneForComparison(rawPhone, { autoRestoreLeadingZero })
  if (!normalizedPhone) return []

  return (stores || []).filter((store) => {
    if (excludeStoreId != null && String(store?.id) === String(excludeStoreId)) return false
    const phoneCandidates = [store?.phone, store?.phone_secondary]
      .map((value) => normalizeVietnamPhoneForComparison(value || ''))
      .filter(Boolean)
    return phoneCandidates.includes(normalizedPhone)
  })
}

export function getStorePhoneNumbers(store) {
  return [store?.phone, store?.phone_secondary]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index)
}

/**
 * Validate coordinates
 */
export function isValidCoordinates(lat, lng) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}

/**
 * Validate URL
 */
export function isValidUrl(url) {
  if (!url) return false
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Validate image file
 */
export function isValidImageFile(file) {
  if (!file) return false

  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  const maxSize = 10 * 1024 * 1024 // 10MB

  return validTypes.includes(file.type) && file.size <= maxSize
}

/**
 * Format phone number for display
 */
export function formatPhone(phone) {
  if (!phone) return ''
  const cleaned = phone.replace(/\s+/g, '')

  // Format: 0901 234 567
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`
  }

  return phone
}

/**
 * Format distance for display
 */
export function formatDistance(km) {
  if (km == null || typeof km !== 'number') return 'N/A'

  if (km < 1) {
    return `${Math.round(km * 1000)}m`
  }

  if (km < 10) {
    return `${km.toFixed(1)}km`
  }

  return `${Math.round(km)}km`
}

/**
 * Format date/time for display
 */
export function formatDate(date) {
  if (!date) return ''

  const d = new Date(date)
  if (isNaN(d.getTime())) return ''

  const now = new Date()
  const diffMs = now - d
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Vừa xong'
  if (diffMins < 60) return `${diffMins} phút trước`
  if (diffHours < 24) return `${diffHours} giờ trước`
  if (diffDays < 7) return `${diffDays} ngày trước`

  // Format: dd/mm/yyyy
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()

  return `${day}/${month}/${year}`
}

/**
 * Format date/time as full locale string (dd/mm/yyyy hh:mm)
 * Dùng cho admin pages cần hiển thị đầy đủ ngày giờ
 */
export function formatDateTime(value) {
  if (!value) return 'Không rõ thời gian'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Không rõ thời gian'
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Sanitize input to prevent XSS
 */
export function sanitizeInput(input) {
  if (!input) return ''

  return String(input)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text, maxLength = 50) {
  if (!text || text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

/**
 * Check if running on mobile device
 */
export function isMobile() {
  if (typeof window === 'undefined') return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text) {
  if (!navigator.clipboard) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      document.body.removeChild(textArea)
      return true
    } catch (err) {
      document.body.removeChild(textArea)
      return false
    }
  }

  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    console.error('Failed to copy:', err)
    return false
  }
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * Throttle function
 */
export function throttle(func, limit) {
  let inThrottle
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * Generate unique ID
 */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Sleep/delay function
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry async function
 */
export async function retry(fn, options = {}) {
  const { retries = 3, delay = 1000, onRetry } = options

  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i === retries - 1) throw err

      if (onRetry) onRetry(i + 1, err)

      await sleep(delay * (i + 1)) // Exponential backoff
    }
  }
}

/**
 * Check if object is empty
 */
export function isEmpty(obj) {
  if (obj == null) return true
  if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0
  if (typeof obj === 'object') return Object.keys(obj).length === 0
  return false
}

/**
 * Deep clone object
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Get error message from error object
 */
export function getErrorMessage(error) {
  if (typeof error === 'string') return error
  if (error?.message) return error.message
  if (error?.error?.message) return error.error.message
  return 'Đã xảy ra lỗi không xác định'
}

