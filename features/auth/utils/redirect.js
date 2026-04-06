export function normalizeInternalPath(path, fallback = '/account') {
  const rawPath = Array.isArray(path) ? path[0] : path
  if (typeof rawPath !== 'string') return fallback

  const trimmed = rawPath.trim()
  if (!trimmed) return fallback
  if (!trimmed.startsWith('/')) return fallback
  if (trimmed.startsWith('//')) return fallback

  return trimmed
}
