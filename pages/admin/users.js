import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { USER_ROLES } from '@/lib/authz'
import { formatDateTime } from '@/helper/validation'

export default function AdminUsersPage() {
  const router = useRouter()
  const { isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {}
  const [pageReady, setPageReady] = useState(false)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [actionLoading, setActionLoading] = useState({})

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      setPageReady(false)
      void router.replace('/login?from=/admin/users').catch((err) => {
        if (!err?.cancelled) console.error('Redirect to login failed:', err)
      })
      return
    }
    if (!isAdmin) {
      setPageReady(false)
      void router.replace('/account').catch((err) => {
        if (!err?.cancelled) console.error('Redirect to account failed:', err)
      })
      return
    }
    setPageReady(true)
  }, [authLoading, isAuthenticated, isAdmin, router])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) throw new Error('Không lấy được token xác thực.')

      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Server error')
      }

      setUsers(data.users || [])
    } catch (err) {
      console.error(err)
      setUsers([])
      setError(err.message || 'Không tải được danh sách người dùng.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!pageReady) return
    loadUsers()
  }, [pageReady, loadUsers])

  const handleRoleChange = async (userId, newRole) => {
    setActionLoading((prev) => ({ ...prev, [userId]: true }))
    setError('')
    setMessage('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) throw new Error('Không lấy được token xác thực.')

      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Server error')
      }

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: data.role } : u))
      setMessage('Cập nhật quyền thành công!')
    } catch (err) {
      console.error(err)
      setError(err.message || 'Thay đổi quyền thất bại.')
    } finally {
      setActionLoading((prev) => ({ ...prev, [userId]: false }))
    }
  }

  const roleLabelMap = {
    [USER_ROLES.ADMIN]: 'Admin',
    [USER_ROLES.TELESALE]: 'Telesale',
    [USER_ROLES.GUEST]: 'Khách (Guest)',
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black">
        <div className="max-w-screen-md mx-auto px-3 sm:px-4 py-6">
          <p className="text-sm text-gray-400">Đang kiểm tra đăng nhập...</p>
        </div>
      </div>
    )
  }

  if (!pageReady) return null

  return (
    <>
      <Head>
        <title>Quản lý tài khoản - NPP Hà Công</title>
      </Head>

      <div className="min-h-screen bg-black">
        <div className="max-w-screen-md mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
          <Card className="rounded-2xl border border-gray-800">
            <CardContent className="p-4 sm:p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-gray-100">Quản lý Tài Khoản</h1>
                  <p className="text-sm text-gray-400">Kiểm soát thẻ quyền của nhân sự</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={loadUsers} disabled={loading}>
                  {loading ? 'Đang tải...' : 'Làm mới'}
                </Button>
              </div>

              {error && (
                <div className="rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-sm text-red-300">
                  {error}
                </div>
              )}
              {message && (
                <div className="rounded-lg border border-green-900 bg-green-950/30 px-3 py-2 text-sm text-green-300">
                  {message}
                </div>
              )}
            </CardContent>
          </Card>

          {!loading && users.length === 0 && (
             <div className="rounded-xl border border-gray-800 bg-gray-950 p-4 text-sm text-gray-400">
                Không có dữ liệu người dùng.
             </div>
          )}

          <div className="space-y-3">
            {users.map((user) => {
              const uId = user.id
              const isProcessing = Boolean(actionLoading[uId])

              return (
                <Card key={uId} className="rounded-2xl border border-gray-800">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-col gap-1">
                      <h2 className="text-base font-semibold text-gray-100 break-words">
                        {user.email || 'Email không rõ'}
                      </h2>
                      <p className="text-sm text-gray-400">
                        Tham gia: {formatDateTime(user.created_at)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Lần cuối trực tuyến: {user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : 'Chưa đăng nhập'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 pt-2 w-full">
                      <select 
                        className="flex h-10 w-full items-center justify-between rounded-md border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                        value={user.role || USER_ROLES.GUEST}
                        disabled={isProcessing}
                        onChange={(e) => handleRoleChange(uId, e.target.value)}
                      >
                        {Object.values(USER_ROLES).map(roleVal => (
                          <option key={roleVal} value={roleVal}>
                            {roleLabelMap[roleVal] || roleVal}
                          </option>
                        ))}
                      </select>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
