import { resolveUserRole, USER_ROLES } from '@/lib/authz'

const MIN_PASSWORD_LENGTH = 6

export function normalizeAdminUserEmail(email) {
  return String(email || '').trim().toLowerCase()
}

export function isValidAdminUserRole(role) {
  return Object.values(USER_ROLES).includes(role)
}

function validatePassword(password) {
  const rawPassword = String(password || '')
  if (!rawPassword) {
    return 'Vui lòng nhập mật khẩu.'
  }
  if (rawPassword.length < MIN_PASSWORD_LENGTH) {
    return `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`
  }
  return ''
}

export function validateCreateAdminUserInput({ email, password, role } = {}) {
  const normalizedEmail = normalizeAdminUserEmail(email)
  if (!normalizedEmail) {
    return { error: 'Vui lòng nhập email.' }
  }
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    return { error: 'Email chưa hợp lệ.' }
  }

  const passwordError = validatePassword(password)
  if (passwordError) return { error: passwordError }

  const normalizedRole = role || USER_ROLES.TELESALE
  if (!isValidAdminUserRole(normalizedRole)) {
    return { error: 'Quyền tài khoản chưa hợp lệ.' }
  }

  return {
    error: '',
    values: {
      email: normalizedEmail,
      password: String(password),
      role: normalizedRole,
    },
  }
}

export function validateResetAdminUserPasswordInput({ userId, password } = {}) {
  const normalizedUserId = String(userId || '').trim()
  if (!normalizedUserId) {
    return { error: 'Thiếu ID người dùng.' }
  }

  const passwordError = validatePassword(password)
  if (passwordError) return { error: passwordError }

  return {
    error: '',
    values: {
      userId: normalizedUserId,
      password: String(password),
    },
  }
}

export function mapSupabaseAdminUser(user) {
  return {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at,
    role: resolveUserRole(user),
  }
}
