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
  const roleColor = isAdmin ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' : role === 'telesale' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-gray-500/15 text-gray-300 border-gray-500/30'

  return (
    <Card className="rounded-2xl border border-gray-800">
      <CardContent className="p-5 space-y-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gray-800">
            <User className="h-7 w-7 text-gray-400" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-gray-100">{user?.email}</p>
            <span className={`mt-1 inline-block rounded-full border px-2.5 py-0.5 text-sm font-medium ${roleColor}`}>
              {roleLabel}
            </span>
          </div>
        </div>

        <div className="border-t border-gray-800" />

        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-400">Giao diện</h3>
          <div className="grid grid-cols-2 gap-2">
            {THEME_OPTIONS.map((option) => {
              const meta = getThemeMeta(option)
              const active = theme === option
              const Icon = option === 'dark' ? Moon : Sun
              return (
                <button
                  key={option}
                  type="button"
                  className={`flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition ${
                    active
                      ? 'border-gray-100 bg-gray-100 text-gray-950'
                      : 'border-gray-700 bg-gray-900 text-gray-200 hover:border-gray-600 hover:bg-gray-800'
                  }`}
                  onClick={() => setTheme(option)}
                  aria-pressed={active}
                >
                  <Icon className="h-4 w-4" />
                  {meta.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="border-t border-gray-800" />

        <Button
          type="button"
          variant="outline"
          className="w-full justify-center gap-2 border-red-900/50 text-red-400 hover:bg-red-950/30 hover:text-red-300"
          onClick={onSignOut}
          disabled={signingOut}
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
    <Card className="rounded-2xl border border-gray-800">
      <CardContent className="p-5">
        <h2 className="mb-3 text-lg font-semibold text-gray-100">{section.label}</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl border px-4 py-3 text-base font-medium transition ${
                  item.accent
                    ? 'border-blue-500/30 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20'
                    : 'border-gray-800 bg-gray-900/50 text-gray-200 hover:border-gray-700 hover:bg-gray-800'
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${item.accent ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300'}`} />
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

      <div className="min-h-screen bg-black">
        <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
          <h1 className="mb-4 text-xl font-bold text-gray-100 sm:hidden">Tài khoản</h1>

          <div className="grid gap-4 sm:grid-cols-[280px_1fr] sm:items-start">
            <SidebarCard
              user={user}
              role={role}
              isAdmin={isAdmin}
              theme={theme}
              setTheme={setTheme}
              signingOut={signingOut}
              onSignOut={handleSignOut}
            />

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
                <Card className="rounded-2xl border border-gray-800">
                  <CardContent className="p-4">
                    <p className="text-base text-gray-400">
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
