'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'
import { isAuthenticatedRole, resolveUserRole } from '@/lib/authz'
import { normalizeInternalPath } from '@/features/auth/utils/redirect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signIn, signOut, isAuthenticated, isSignedIn, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const redirectPath = useMemo(
    () => normalizeInternalPath(searchParams.get('from'), '/account'),
    [searchParams],
  )

  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    router.replace(redirectPath)
  }, [authLoading, isAuthenticated, redirectPath, router])

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
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
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
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading || authLoading}>
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>
        </form>
      </div>
    </div>
  )
}
