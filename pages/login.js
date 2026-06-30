import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { isAuthenticatedRole, resolveUserRole } from '@/lib/authz'
import { normalizeInternalPath } from '@/features/auth/utils/redirect'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const { signIn, signOut, isAuthenticated, isSignedIn, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const redirectPath = useMemo(() => {
    if (!router.isReady) return '/account'
    const rawFrom = Array.isArray(router.query.from) ? router.query.from[0] : router.query.from
    return normalizeInternalPath(rawFrom, '/account')
  }, [router.isReady, router.query.from])

  useEffect(() => {
    if (authLoading || !router.isReady || !isAuthenticated) return
    router.replace(redirectPath).catch(() => {})
  }, [authLoading, isAuthenticated, redirectPath, router, router.isReady])

  useEffect(() => {
    if (authLoading || isAuthenticated || !isSignedIn) return

    let cancelled = false

    async function clearUnauthorizedSession() {
      await signOut()
      if (!cancelled) {
        setError('Tài khoản chưa được cấp quyền truy cập. Vui lòng liên hệ quản trị viên.')
      }
    }

    clearUnauthorizedSession()

    return () => {
      cancelled = true
    }
  }, [authLoading, isAuthenticated, isSignedIn, signOut])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (loading) return

    // Client-side validation
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError('Vui lòng nhập email')
      return
    }
    if (!password) {
      setError('Vui lòng nhập mật khẩu')
      return
    }

    setError('')
    setLoading(true)

    const { data, error: signInError } = await signIn(trimmedEmail, password)
    if (signInError) {
      setError('Email hoặc mật khẩu không đúng')
      setLoading(false)
      return
    }

    const nextRole = resolveUserRole(data?.user)
    if (!isAuthenticatedRole(nextRole)) {
      await signOut()
      setError('Tài khoản chưa được cấp quyền truy cập. Vui lòng liên hệ quản trị viên.')
      setLoading(false)
      return
    }

    router.replace(redirectPath).catch(() => {})
    setLoading(false)
  }

  return (
    <div className="flex items-start justify-center h-full pt-[12vh]">
      <div className="w-full max-w-sm mx-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-100 mb-1">Đăng nhập</h1>
          <p className="text-sm text-gray-400">Dành cho tài khoản telesale hoặc admin</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={loading || authLoading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="login-password">Mật khẩu</Label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={loading || authLoading}
                className="flex h-11 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 pr-10 text-base text-gray-100 placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 cursor-pointer"
                tabIndex={-1}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-200">{error}</div>
          )}

          <Button type="submit" className="w-full" disabled={loading || authLoading}>
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>
        </form>
      </div>
    </div>
  )
}