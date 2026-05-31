import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { useTheme } from '@/lib/ThemeContext'
import { THEME_OPTIONS, getThemeMeta } from '@/helper/theme'
import { PageHeader } from '@/components/ui/v2'

function MenuSection({ title, children }) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4">
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
  const { theme, setTheme } = useTheme()
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

      <div className="min-h-screen px-3 py-4 sm:px-4 sm:py-6">
        <div className="mx-auto max-w-6xl space-y-4">
          <PageHeader
            title="Tài khoản"
            subtitle="Tổng hợp nhanh quyền, giao diện và các lối tắt vận hành thường dùng."
            actions={(
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
            )}
          />

          <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <Card className="rounded-3xl border border-slate-800/80 bg-slate-950/70">
              <CardContent className="space-y-4 p-4 sm:p-5">
                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4">
                  <p className="text-sm text-neutral-400">Tài khoản đăng nhập</p>
                  <p className="mt-1 truncate text-base font-semibold text-neutral-100">{user?.email}</p>
                  <p className="text-sm text-neutral-400">
                    Quyền: {isAdmin ? 'Admin' : role === 'telesale' ? 'Telesale' : 'Khách'}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4">
                  <h2 className="text-base font-semibold text-neutral-100">Giao diện</h2>
                  <p className="mt-1 text-sm text-neutral-400">Chọn màu sáng hoặc tối cho toàn bộ app.</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {THEME_OPTIONS.map((option) => {
                      const meta = getThemeMeta(option)
                      const active = theme === option
                      return (
                        <button
                          key={option}
                          type="button"
                          className={`h-11 rounded-xl border px-3 text-base font-semibold transition ${active ? 'border-sky-400 bg-sky-500/15 text-sky-100' : 'border-slate-700 bg-slate-900 text-neutral-200 hover:bg-slate-800'}`}
                          onClick={() => setTheme(option)}
                          aria-pressed={active}
                        >
                          {meta.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {(isAdmin || isTelesale) && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <MenuSection title="Bán hàng">
                    <Button asChild><Link href="/today">Công việc hôm nay</Link></Button>
                    {isAdmin && <Button asChild><Link href="/orders/new">Lên đơn hàng</Link></Button>}
                    <Button asChild variant="outline"><Link href="/orders">Danh sách đơn</Link></Button>
                    {isAdmin && <Button asChild variant="outline"><Link href="/inventory/products">Hàng hóa & tồn kho</Link></Button>}
                    {isAdmin && <Button asChild variant="outline"><Link href="/inventory/purchases/new">Nhập hàng</Link></Button>}
                    {isAdmin && <Button asChild variant="outline"><Link href="/inventory/purchases">Phiếu nhập</Link></Button>}
                    {isAdmin && <Button asChild variant="outline"><Link href="/inventory/stock">Báo cáo tồn kho</Link></Button>}
                    {isTelesale && !isAdmin && <Button asChild variant="outline"><Link href="/telesale/overview">Màn telesale</Link></Button>}
                  </MenuSection>

                  {isAdmin && (
                    <MenuSection title="Cửa hàng và quản trị">
                      <Button asChild variant="outline"><Link href="/overview">Màn tổng quan</Link></Button>
                      <Button asChild variant="outline"><Link href="/store/import">Nhập dữ liệu cửa hàng</Link></Button>
                      <Button asChild variant="outline"><Link href="/store/export">Xuất dữ liệu cửa hàng</Link></Button>
                      <Button asChild variant="outline"><Link href="/store/deduplicate">Gộp cửa hàng trùng lặp</Link></Button>
                      <Button asChild variant="outline"><Link href="/store/verify">Duyệt cửa hàng</Link></Button>
                      <Button asChild variant="outline"><Link href="/store/reports">Duyệt báo cáo</Link></Button>
                      <Button asChild variant="outline"><Link href="/admin/users">Quản lý tài khoản</Link></Button>
                    </MenuSection>
                  )}
                </div>
              )}

              {isTelesale && !isAdmin && (
                <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 text-base text-neutral-300">
                  Telesale chỉ thấy các màn phục vụ gọi điện và theo dõi trạng thái gọi.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
