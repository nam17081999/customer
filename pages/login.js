import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { isAuthenticatedRole, resolveUserRole } from '@/lib/authz'
import { normalizeInternalPath } from '@/features/auth/utils/redirect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/v2'

export default function LoginPage() {
  const router = useRouter()
  const { signIn, signOut, isAuthenticated, isSignedIn, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const redirectPath = useMemo(() => {
    if (!router.isReady) return '/account'
    const rawFrom = Array.isArray(router.query.from) ? router.query.from[0] : router.query.from
    return normalizeInternalPath(rawFrom, '/account')
  }, [router.isReady, router.query.from])

  useEffect(() => {
    if (authLoading || !router.isReady || !isAuthenticated) return
    router.replace(redirectPath)
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

    setError('')
    setLoading(true)

    const { data, error: signInError } = await signIn(email.trim(), password)
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

    router.replace(redirectPath)
    setLoading(false)
  }

  return (
    <div className="min-h-[calc(100svh-3.5rem)] px-3 py-4 sm:px-4 sm:py-6">
      <div className="mx-auto grid min-h-[calc(100svh-6.5rem)] max-w-6xl items-stretch gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-5 shadow-2xl shadow-black/15 backdrop-blur-sm sm:p-8 lg:p-10">
          <PageHeader
            title="Đăng nhập"
            subtitle="Dành cho telesale và admin để vào công cụ vận hành, lên đơn và quản lý dữ liệu."
          />

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ['Tìm nhanh', 'Tra cứu cửa hàng, khách hàng, đơn hàng.'],
              ['Lên đơn', 'Tạo đơn, xem tồn và in nhanh.'],
              ['Quản trị', 'Duyệt, sửa, báo cáo và đối soát.'],
            ].map(([title, description]) => (
              <div key={title} className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4">
                <p className="text-base font-semibold text-gray-100">{title}</p>
                <p className="mt-1 text-sm text-gray-400">{description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center">
          <div className="w-full rounded-3xl border border-slate-800/80 bg-slate-950/85 p-5 shadow-2xl shadow-black/20 backdrop-blur-sm sm:p-6">
            <div className="mb-6 space-y-1.5">
              <h2 className="text-2xl font-bold text-gray-100">Vào hệ thống</h2>
              <p className="text-base text-gray-400">Nhập tài khoản Supabase đã được cấp quyền.</p>
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
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={loading || authLoading}
                />
              </div>

              {error && (
                <p className="rounded-2xl border border-red-900/60 bg-red-950/25 px-4 py-3 text-base text-red-200">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading || authLoading}>
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
