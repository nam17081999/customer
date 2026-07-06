export const RESEND_COOLDOWN_SECONDS = 60

export function formatCountdown(seconds) {
  if (typeof seconds !== 'number' || seconds <= 0) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`
  return `${s}s`
}
