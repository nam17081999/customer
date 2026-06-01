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
import {
  CalendarCheck,
  ShoppingCart,
  List,
  Package,
  Truck,
  ClipboardList,
  BarChart3,
  LayoutDashboard,
  Upload,
  Download,
  GitMerge,
  ShieldCheck,
  FileBarChart,
  Users,
  LogOut,
  Sun,
  Moon,
  User,
} from 'lucide-react'

const MENU_SECTIONS = {
  sales: {
    label: 'Bán hàng',
    items: [
      { href: '/today', label: 'Công việc hôm nay', icon: CalendarCheck, accent: true },
      { href: '/orders/new', label: 'Lên đơn hàng', icon: ShoppingCart, accent: true },
      { href: '/orders', label: 'Danh sách đơn', icon: List },
      { href: '/inventory/products', label: 'Hàng hóa & tồn kho', icon: Package },
      { href: '/inventory/purchases/new', label: 'Nhập hàng', icon: Truck },
      { href: '/inventory/purchases', label: 'Phiếu nhập', icon: ClipboardList },
      { href: '/inventory/stock', label: 'Báo cáo tồn kho', icon: BarChart3 },
    ],
  },
  stores: {
    label: 'Cửa hàng',
    items: [
      { href: '/overview', label: 'Tổng quan', icon: LayoutDashboard },
      { href: '/store/import', label: 'Nhập dữ liệu', icon: Upload },
      { href: '/store/export', label: 'Xuất dữ liệu', icon: Download },
      { href: '/store/deduplicate', label: 'Gộp trùng lặp', icon: GitMerge },
    ],
  },
  admin: {
    label: 'Quản trị',
    items: [
      { href: '/store/verify', label: 'Duyệt cửa hàng', icon: ShieldCheck },
      { href: '/store/reports', label: 'Duyệt báo cáo', icon: FileBarChart },
      { href: '/admin/users', label: 'Quản lý tài khoản', icon: Users },
    ],
  },
  telesale: {
    label: 'Bán hàng',
    items: [
      { href: '/today', label: 'Công việc hôm nay', icon: CalendarCheck, accent: true },
      { href: '/telesale/overview', label: 'Màn telesale', icon: LayoutDashboard },
    ],
  },
}

function SidebarCard({ user, role, isAdmin, theme, setTheme, signingOut, onSignOut }) {
  const roleLabel = isAdmin ? 'Admin' : role === 'telesale' ? 'Telesale' : 'Khách'

  return (
    <Card style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'var(--surface)', boxShadow: 'var(--card-shadow)' }} className="rounded-xl">
      <CardContent className="p-5 space-y-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.02), transparent)' }}>
            <User className="h-7 w-7" style={{ color: 'var(--muted)' }} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{user?.email}</p>
            <span className="mt-1 inline-block rounded-full border px-2.5 py-0.5 text-sm font-medium" style={{ borderColor: 'rgba(255,255,255,0.06)', color: 'var(--muted)' }}>
              {roleLabel}
            </span>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }} />

        <div>
          <h3 className="mb-2 text-sm font-medium" style={{ color: 'var(--muted)' }}>Giao diện</h3>
          <div className="grid grid-cols-2 gap-2">
            {THEME_OPTIONS.map((option) => {
              const meta = getThemeMeta(option)
              const active = theme === option
              const Icon = option === 'dark' ? Moon : Sun
              return (
                <button
                  key={option}
                  type="button"
                  className="flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition"
                  onClick={() => setTheme(option)}
                  aria-pressed={active}
                  style={active ? { background: 'var(--primary)', color: 'var(--foreground)', borderColor: 'transparent' } : { background: 'transparent', borderColor: 'rgba(255,255,255,0.04)', color: 'var(--foreground)' }}
                >
                  <Icon className="h-4 w-4" />
                  {meta.label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }} />

        <Button
          type="button"
          variant="outline"
          className="w-full justify-center gap-2"
          onClick={onSignOut}
          disabled={signingOut}
          style={{ borderColor: 'rgba(255,0,0,0.12)', color: 'rgba(255,120,120,0.95)' }}
        >
          <LogOut className="h-4 w-4" />
          {signingOut ? 'Đang xuất...' : 'Đăng xuất'}
        </Button>
      </CardContent>
    </Card>
  )
}

function MenuCard({ section, filterFn }) {
  const items = filterFn ? section.items.filter(filterFn) : section.items
  if (items.length === 0) return null

  return (
    <Card className="rounded-xl w-full" style={{ border: '1px solid rgba(255,255,255,0.04)', background: 'transparent' }}>
      <CardContent className="p-5">
        <h2 className="mb-3 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{section.label}</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl border px-4 py-3 text-base font-medium transition`}
                style={item.accent ? { borderColor: 'transparent', background: 'linear-gradient(180deg,var(--primary-600), var(--primary) )', color: 'white' } : { borderColor: 'rgba(255,255,255,0.04)', background: 'transparent', color: 'var(--foreground)' }}
              >
                <Icon className="h-5 w-5 shrink-0" style={{ color: item.accent ? 'white' : 'var(--muted)' }} />
                {item.label}
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
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

      <div style={{ minHeight: '100svh', background: 'var(--background)', color: 'var(--foreground)' }} className="safe-container">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
          <h1 className="mb-4 text-xl font-bold sm:hidden" style={{ color: 'var(--foreground)' }}>Tài khoản</h1>

          <div className="grid gap-4 sm:grid-cols-[320px_1fr] sm:items-start sm:h-[calc(100vh-3.5rem)]">
            <div className="sm:sticky sm:top-6">
              <SidebarCard
              user={user}
              role={role}
              isAdmin={isAdmin}
              theme={theme}
              setTheme={setTheme}
              signingOut={signingOut}
              onSignOut={handleSignOut}
              />
            </div>

            <div className="space-y-4">
              {(isAdmin || isTelesale) && (
                <>
                  {isAdmin && (
                    <>
                      <MenuCard section={MENU_SECTIONS.sales} />
                      <MenuCard section={MENU_SECTIONS.stores} />
                      <MenuCard section={MENU_SECTIONS.admin} />
                    </>
                  )}
                  {isTelesale && !isAdmin && (
                    <MenuCard section={MENU_SECTIONS.telesale} />
                  )}
                </>
              )}

              {isTelesale && !isAdmin && (
                <Card className="rounded-xl w-full" style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'var(--surface)' }}>
                  <CardContent className="p-4">
                    <p className="text-base" style={{ color: 'var(--muted)' }}>
                      Telesale chỉ thấy các màn phục vụ gọi điện và theo dõi trạng thái gọi.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
