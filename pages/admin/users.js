import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { USER_ROLES } from '@/lib/authz'
import { formatDateTime } from '@/helper/validation'

const roleLabelMap = {
  [USER_ROLES.ADMIN]: 'Admin',
  [USER_ROLES.TELESALE]: 'Telesale',
  [USER_ROLES.GUEST]: 'Khách (Guest)',
}

const initialCreateForm = {
  email: '',
  password: '',
  role: USER_ROLES.TELESALE,
}

export default function AdminUsersPage() {
  const router = useRouter()
  const { isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {}
  const [pageReady, setPageReady] = useState(false)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [actionLoading, setActionLoading] = useState({})
  const [createForm, setCreateForm] = useState(initialCreateForm)
  const [createLoading, setCreateLoading] = useState(false)
  const [resetPasswords, setResetPasswords] = useState({})

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

  const getAccessToken = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    if (!token) throw new Error('Không lấy được token xác thực.')
    return token
  }, [])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const token = await getAccessToken()
      const response = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
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
  }, [getAccessToken])

  useEffect(() => {
    if (!pageReady) return
    loadUsers()
  }, [pageReady, loadUsers])

  const withRowLoading = async (userId, runner) => {
    setActionLoading((prev) => ({ ...prev, [userId]: true }))
    setError('')
    setMessage('')
    try {
      await runner()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Thao tác thất bại.')
    } finally {
      setActionLoading((prev) => ({ ...prev, [userId]: false }))
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    await withRowLoading(userId, async () => {
      const token = await getAccessToken()
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Server error')
      }

      setUsers((prev) => prev.map((user) => (
        user.id === userId ? { ...user, role: data.role } : user
      )))
      setMessage('Cập nhật quyền thành công!')
    })
  }

  const handleCreateUser = async (event) => {
    event.preventDefault()
    if (createLoading) return

    setCreateLoading(true)
    setError('')
    setMessage('')
    try {
      const token = await getAccessToken()
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(createForm),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Server error')
      }

      setUsers((prev) => [data.user, ...prev])
      setCreateForm(initialCreateForm)
      setMessage(`Đã tạo tài khoản ${data.user.email}.`)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Không tạo được tài khoản.')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleResetPassword = async (userId) => {
    const nextPassword = String(resetPasswords[userId] || '')
    await withRowLoading(userId, async () => {
      const token = await getAccessToken()
      const response = await fetch(`/api/admin/users/${userId}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: nextPassword }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Server error')
      }

      setResetPasswords((prev) => ({ ...prev, [userId]: '' }))
      setMessage('Đặt lại mật khẩu thành công!')
    })
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black">
        <div className="mx-auto max-w-screen-md px-3 py-6 sm:px-4">
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
        <div className="mx-auto max-w-screen-md space-y-4 px-3 py-4 sm:px-4 sm:py-6">
          <Card className="rounded-2xl border border-gray-800">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-lg font-bold text-gray-100 sm:text-xl">Quản lý tài khoản</h1>
                  <p className="text-sm text-gray-400">Tạo tài khoản, đổi quyền và đặt lại mật khẩu cho nhân sự.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={loadUsers} disabled={loading}>
                  {loading ? 'Đang tải...' : 'Làm mới'}
                </Button>
              </div>

              {error ? (
                <div className="rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-sm text-red-300">
                  {error}
                </div>
              ) : null}
              {message ? (
                <div className="rounded-lg border border-green-900 bg-green-950/30 px-3 py-2 text-sm text-green-300">
                  {message}
                </div>
              ) : null}

              <form className="grid gap-3 rounded-xl border border-gray-800 bg-gray-950/70 p-4" onSubmit={handleCreateUser}>
                <div>
                  <h2 className="text-base font-semibold text-gray-100">Tạo tài khoản mới</h2>
                  <p className="text-sm text-gray-400">Admin tạo trực tiếp email, mật khẩu ban đầu và quyền truy cập.</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="create-user-email" className="text-sm text-gray-300">Email</Label>
                    <Input
                      id="create-user-email"
                      type="email"
                      value={createForm.email}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
                      placeholder="nhanvien@example.com"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="create-user-password" className="text-sm text-gray-300">Mật khẩu ban đầu</Label>
                    <Input
                      id="create-user-password"
                      type="password"
                      value={createForm.password}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
                      placeholder="Ít nhất 6 ký tự"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="create-user-role" className="text-sm text-gray-300">Quyền</Label>
                    <select
                      id="create-user-role"
                      className="flex h-10 w-full items-center rounded-md border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-gray-200 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      value={createForm.role}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, role: event.target.value }))}
                    >
                      {Object.values(USER_ROLES).map((role) => (
                        <option key={role} value={role}>{roleLabelMap[role] || role}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <Button type="submit" className="w-full sm:w-auto" disabled={createLoading}>
                  {createLoading ? 'Đang tạo...' : 'Tạo tài khoản'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {!loading && users.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-950 p-4 text-sm text-gray-400">
              Không có dữ liệu người dùng.
            </div>
          ) : null}

          <div className="space-y-3">
            {users.map((user) => {
              const userId = user.id
              const isProcessing = Boolean(actionLoading[userId])
              return (
                <Card key={userId} className="rounded-2xl border border-gray-800">
                  <CardContent className="space-y-4 p-4">
                    <div className="flex flex-col gap-1">
                      <h2 className="break-words text-base font-semibold text-gray-100">
                        {user.email || 'Email không rõ'}
                      </h2>
                      <p className="text-sm text-gray-400">Tham gia: {formatDateTime(user.created_at)}</p>
                      <p className="text-sm text-gray-500">
                        Lần cuối trực tuyến: {user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : 'Chưa đăng nhập'}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                      <div className="space-y-1.5">
                        <Label htmlFor={`role-${userId}`} className="text-sm text-gray-300">Quyền tài khoản</Label>
                        <select
                          id={`role-${userId}`}
                          className="flex h-10 w-full items-center rounded-md border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-gray-200 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                          value={user.role || USER_ROLES.GUEST}
                          disabled={isProcessing}
                          onChange={(event) => handleRoleChange(userId, event.target.value)}
                        >
                          {Object.values(USER_ROLES).map((role) => (
                            <option key={role} value={role}>{roleLabelMap[role] || role}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`password-${userId}`} className="text-sm text-gray-300">Mật khẩu mới</Label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            id={`password-${userId}`}
                            type="password"
                            value={resetPasswords[userId] || ''}
                            onChange={(event) => setResetPasswords((prev) => ({ ...prev, [userId]: event.target.value }))}
                            placeholder="Nhập mật khẩu mới"
                            className="min-w-0"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full sm:w-auto"
                            disabled={isProcessing}
                            onClick={() => handleResetPassword(userId)}
                          >
                            {isProcessing ? 'Đang xử lý...' : 'Reset mật khẩu'}
                          </Button>
                        </div>
                      </div>
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
