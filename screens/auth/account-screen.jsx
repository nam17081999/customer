import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FullPageLoading } from '@/components/ui/full-page-loading'

function MenuSection({ title, children }) {
  return (
    <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-950 p-3">
      <h2 className="text-base font-semibold text-neutral-100">{title}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {children}
      </div>
    </div>
  )
}

export default function AccountScreen() {
  const { replace } = useRouter()
  const { user, role, isAdmin, isTelesale, isAuthenticated, loading: authLoading, signOut } = useAuth() || {}
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      replace('/login?from=/account')
    }
  }, [authLoading, isAuthenticated, replace])

  const handleSignOut = async () => {
    if (!signOut || signingOut) return
    setSigningOut(true)
    const { error } = await signOut()
    setSigningOut(false)

    if (error) {
      console.error('Sign out returned error:', error)
    }

    replace('/login')
  }

  if (authLoading || !isAuthenticated) {
    return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />
  }

  return (
    <>
      <Head>
        <title>Tài khoản - NPP Hà Công</title>
      </Head>

      <div className="min-h-screen bg-neutral-950">
        <div className="mx-auto max-w-screen-md px-3 py-4 sm:px-4 sm:py-6">
          <Card className="rounded-2xl border border-neutral-800">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 border-b border-neutral-800 pb-3">
                <div className="min-w-0">
                  <p className="text-sm text-neutral-400">Tài khoản đăng nhập</p>
                  <p className="truncate text-base font-semibold text-neutral-200">{user?.email}</p>
                  <p className="text-sm text-neutral-400">
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
                <h1 className="text-xl font-semibold text-neutral-100 sm:text-2xl">Menu nhanh</h1>
              </div>

              {(isAdmin || isTelesale) && (
                <div className="space-y-3">
                  <MenuSection title="Bán hàng">
                    {isAdmin && (
                      <>
                        <Button asChild>
                          <Link href="/orders/new">Lên đơn hàng</Link>
                        </Button>
                        <Button asChild variant="outline">
                          <Link href="/orders">Danh sách đơn</Link>
                        </Button>
                        <Button asChild variant="outline">
                          <Link href="/inventory/products">Hàng hóa & tồn kho</Link>
                        </Button>
                        <Button asChild variant="outline">
                          <Link href="/inventory/purchases/new">Nhập hàng</Link>
                        </Button>
                        <Button asChild variant="outline">
                          <Link href="/inventory/purchases">Phiếu nhập</Link>
                        </Button>
                        <Button asChild variant="outline">
                          <Link href="/inventory/stock">Báo cáo tồn kho</Link>
                        </Button>
                      </>
                    )}
                    {isTelesale && !isAdmin && (
                      <Button asChild>
                        <Link href="/telesale/overview">Màn telesale</Link>
                      </Button>
                    )}
                  </MenuSection>

                  {isAdmin && (
                    <>
                      <MenuSection title="Cửa hàng">
                        <Button asChild variant="outline">
                          <Link href="/overview">Màn tổng quan</Link>
                        </Button>
                        <Button asChild variant="outline">
                          <Link href="/store/import">Nhập dữ liệu cửa hàng</Link>
                        </Button>
                        <Button asChild variant="outline">
                          <Link href="/store/export">Xuất dữ liệu cửa hàng</Link>
                        </Button>
                        <Button asChild variant="outline">
                          <Link href="/store/deduplicate">Gộp cửa hàng trùng lặp</Link>
                        </Button>
                      </MenuSection>

                      <MenuSection title="Quản trị">
                        <Button asChild variant="outline">
                          <Link href="/store/verify">Duyệt cửa hàng</Link>
                        </Button>
                        <Button asChild variant="outline">
                          <Link href="/store/reports">Duyệt báo cáo</Link>
                        </Button>
                        <Button asChild variant="outline">
                          <Link href="/admin/users">Quản lý tài khoản</Link>
                        </Button>
                      </MenuSection>
                    </>
                  )}
                </div>
              )}

              {isTelesale && !isAdmin && (
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-3 text-sm text-neutral-300">
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
