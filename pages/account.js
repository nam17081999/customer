import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FullPageLoading } from '@/components/ui/full-page-loading'

export default function AccountPage() {
  const router = useRouter()
  const { user, role, isAdmin, isTelesale, isAuthenticated, loading: authLoading, signOut } = useAuth() || {}
  const [pageReady, setPageReady] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      setPageReady(false)
      router.replace('/login?from=/account')
      return
    }
    setPageReady(true)
  }, [authLoading, isAuthenticated, router])

  const handleSignOut = async () => {
    if (!signOut || signingOut) return
    setSigningOut(true)
    await signOut()
    setSigningOut(false)
    router.replace('/login')
  }

  if (authLoading || !pageReady) {
    return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />
  }

  return (
    <>
      <Head>
        <title>Tài khoản - NPP Hà Công</title>
      </Head>

      <div className="min-h-screen bg-black">
        <div className="mx-auto max-w-screen-md px-3 py-4 sm:px-4 sm:py-6">
          <Card className="rounded-2xl border border-gray-800">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 border-b border-gray-800 pb-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-400">Tài khoản đăng nhập</p>
                  <p className="truncate text-base font-semibold text-gray-200">{user?.email}</p>
                  <p className="text-sm text-gray-400">
                    Quyền: {isAdmin ? 'Admin' : role === 'telesale' ? 'Telesale' : 'Khách'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="shrink-0"
                >
                  {signingOut ? 'Đang xuất...' : 'Đăng xuất'}
                </Button>
              </div>

              <div>
                <h1 className="text-xl font-bold text-gray-100 sm:text-2xl">Menu nhanh</h1>
              </div>

              {(isAdmin || isTelesale) && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Button asChild>
                    <Link href="/telesale/overview">Màn telesale</Link>
                  </Button>
                  {isAdmin && (
                    <>
                      <Button asChild variant="outline">
                        <Link href="/overview">Màn tổng quan</Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link href="/store/import">Màn nhập dữ liệu</Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link href="/store/export">Màn xuất dữ liệu</Link>
                      </Button>
                    </>
                  )}
                </div>
              )}

              {isTelesale && !isAdmin && (
                <div className="rounded-xl border border-gray-800 bg-gray-900/70 px-3 py-3 text-sm text-gray-300">
                  Telesale chỉ thấy các màn phục vụ gọi điện và theo dõi trạng thái gọi.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
