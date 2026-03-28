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
  const { user, loading: authLoading, signOut } = useAuth() || {}
  const [pageReady, setPageReady] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setPageReady(false)
      router.replace('/login?from=/account')
      return
    }
    setPageReady(true)
  }, [authLoading, user, router])

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
        <title>Tài khoản - StoreVis</title>
      </Head>

      <div className="min-h-screen bg-black">
        <div className="max-w-screen-md mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <Card className="rounded-2xl border border-gray-800">
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-800">
                <div className="min-w-0">
                  <p className="text-sm text-gray-400">Tài khoản đăng nhập</p>
                  <p className="text-base font-semibold text-gray-200 truncate">{user?.email}</p>
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
                <h1 className="text-xl sm:text-2xl font-bold text-gray-100">Menu nhanh</h1>
                <p className="text-base text-gray-400">
                  Tạm thời chỉ hiển thị 3 màn hình: Tổng quan, Xuất dữ liệu, Xuất danh bạ.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button asChild>
                  <Link href="/overview">Màn tổng quan</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/store/export-data">Màn xuất dữ liệu</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/store/export-contacts">Màn xuất danh bạ</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
