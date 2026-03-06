import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function AccountPage() {
  const router = useRouter()
  const { user, loading, signOut } = useAuth() || {}
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    if (!signOut || signingOut) return
    setSigningOut(true)
    await signOut()
    setSigningOut(false)
    router.replace('/login')
  }

  return (
    <>
      <Head>
        <title>Tài khoản - StoreVis</title>
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-black">
        <div className="max-w-screen-md mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <Card className="rounded-2xl border border-gray-200 dark:border-gray-800">
            <CardContent className="p-5 space-y-4">
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Tài khoản</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Quản lý trạng thái đăng nhập quản trị viên
                </p>
              </div>

              {loading ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Đang kiểm tra phiên đăng nhập...</p>
              ) : user ? (
                <>
                  <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Đăng nhập với</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 break-all">
                      {user.email || 'Tài khoản quản trị'}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className="h-10"
                    >
                      {signingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
                    </Button>
                    <Button asChild type="button" variant="outline" className="h-10">
                      <Link href="/dashboard">Về tổng quan</Link>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Bạn chưa đăng nhập quản trị viên.
                    </p>
                  </div>

                  <Button asChild type="button" className="h-10">
                    <Link href="/login?from=/account">Đăng nhập</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
