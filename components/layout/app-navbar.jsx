'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'
import { useTheme } from '@/lib/ThemeContext'
import { Sun, Moon } from 'lucide-react'
import { buildCommandSearchResults, getOperatorShortcutHref, OPERATOR_QUICK_ACTIONS } from '@/helper/operatorWorkflow'
import {
  AccountIcon,
  DashboardIcon,
  MapIcon,
  OrderIcon,
  PlusIcon,
  SearchIcon,
} from '@/components/icons/navigation-icons'

function NavBadge({ count, mobile = false }) {
  if (!count || count <= 0) return null
  const text = count > 99 ? '99+' : String(count)
  return (
    <span className={`absolute rounded-full bg-red-500 text-white leading-none flex items-center justify-center shadow ${mobile ? 'top-1.5 right-1.5 min-w-3.5 h-3.5 px-0.5 text-[9px]' : '-top-1 -right-1 min-w-4 h-4 px-1 text-[10px]'}`}>
      {text}
    </span>
  )
}

export default function AppNavbar() {
  const pathname = usePathname()
  const { isAdmin, isTelesale } = useAuth() || {}
  const { theme, setTheme } = useTheme() || {}
  const [searchHref, setSearchHref] = useState('/')
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickQuery, setQuickQuery] = useState('')
  const [commandData, setCommandData] = useState({ products: [], customers: [], orders: [], loaded: false })
  const [serverCommandResults, setServerCommandResults] = useState([])
  const currentPath = pathname || ''
  const accountLabel = isAdmin ? 'Admin' : isTelesale ? 'Telesale' : 'Người dùng'
  const accountMobileLabel = isAdmin ? 'Admin' : isTelesale ? 'Tele' : 'ND'
  const roleLabel = isAdmin ? 'Admin' : isTelesale ? 'Telesale' : 'Khách'

  const guestLinks = [
    { href: searchHref, active: currentPath === '/', label: 'Tìm kiếm', mobileLabel: 'Tìm', Icon: SearchIcon },
    { href: '/map', active: currentPath === '/map', label: 'Bản đồ', mobileLabel: 'Bản đồ', Icon: MapIcon },
    { href: '/store/create', active: currentPath === '/store/create', label: 'Thêm', mobileLabel: 'Thêm', Icon: PlusIcon },
    { href: '/account', active: currentPath === '/account', label: accountLabel, mobileLabel: accountMobileLabel, Icon: AccountIcon },
  ]

  const telesaleLinks = [
    { href: searchHref, active: currentPath === '/', label: 'Tìm kiếm', mobileLabel: 'Tìm', Icon: SearchIcon },
    { href: '/today', active: currentPath === '/today', label: 'Công việc', mobileLabel: 'Việc', Icon: DashboardIcon },
    { href: '/telesale/overview', active: currentPath === '/telesale/overview', label: 'Telesale', mobileLabel: 'TS', Icon: DashboardIcon },
    { href: '/map', active: currentPath === '/map', label: 'Bản đồ', mobileLabel: 'Bản đồ', Icon: MapIcon },
    { href: '/store/create', active: currentPath === '/store/create', label: 'Thêm', mobileLabel: 'Thêm', Icon: PlusIcon },
    { href: '/account', active: currentPath === '/account', label: accountLabel, mobileLabel: accountMobileLabel, Icon: AccountIcon },
  ]

  const adminLinks = [
    { href: searchHref, active: currentPath === '/', label: 'Tìm kiếm', mobileLabel: 'Tìm', Icon: SearchIcon },
    { href: '/today', active: currentPath === '/today', label: 'Công việc', mobileLabel: 'Việc', Icon: DashboardIcon },
    { href: '/orders/new', active: currentPath === '/orders/new', label: 'Lên đơn', mobileLabel: 'Đơn', Icon: OrderIcon },
    { href: '/map', active: currentPath === '/map', label: 'Bản đồ', mobileLabel: 'Bản đồ', Icon: MapIcon },
    { href: '/store/create', active: currentPath === '/store/create', label: 'Thêm', mobileLabel: 'Thêm', Icon: PlusIcon },
    { href: '/account', active: currentPath === '/account', label: accountLabel, mobileLabel: accountMobileLabel, Icon: AccountIcon },
  ]

  const navLinks = isAdmin ? adminLinks : isTelesale ? telesaleLinks : guestLinks
  const fallbackCommandResults = buildCommandSearchResults({
    query: quickQuery,
    actions: OPERATOR_QUICK_ACTIONS,
    products: commandData.products,
    customers: commandData.customers,
    orders: commandData.orders,
  })
  const commandResults = quickQuery.trim() && serverCommandResults.length > 0 ? serverCommandResults : fallbackCommandResults

  useEffect(() => {
    if (!quickOpen || !isAdmin || commandData.loaded) return
    let cancelled = false
    Promise.all([import('@/api/inventory/inventory-client'), import('@/lib/storeCache')]).then(async ([inventoryClient, storeCache]) => {
      const [products, customers, orders] = await Promise.all([
        inventoryClient.listProductsWithStock().catch(() => []),
        storeCache.getOrRefreshStores().catch(() => []),
        inventoryClient.listSalesOrders(30).catch(() => []),
      ])
      if (cancelled) return
      setCommandData({
        products: (products || []).slice(0, 200),
        customers: customers || [],
        orders: orders || [],
        loaded: true,
      })
    })
    return () => { cancelled = true }
  }, [commandData.loaded, isAdmin, quickOpen])

  useEffect(() => {
    if (!quickOpen || !isAdmin || !quickQuery.trim()) {
      setServerCommandResults([])
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      import('@/api/inventory/inventory-client')
        .then((inventoryClient) => inventoryClient.globalOperatorSearch(quickQuery, 12))
        .then((rows) => {
          if (cancelled) return
          setServerCommandResults((rows || []).map((row) => ({
            type: row.entity_type,
            id: row.entity_id,
            label: row.title,
            subtitle: row.subtitle,
            href: row.href,
          })))
        })
        .catch(() => { if (!cancelled) setServerCommandResults([]) })
    }, 180)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [isAdmin, quickOpen, quickQuery])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncSearchHref = (nextHref) => {
      if (typeof nextHref === 'string' && nextHref.startsWith('/')) {
        setSearchHref(nextHref)
      }
    }

    const handleSearchRouteChanged = (event) => {
      syncSearchHref(event?.detail?.href)
    }

    const handlePageShow = () => {
      syncSearchHref(window.sessionStorage.getItem('storevis:last-search-route') || '/')
    }

    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && String(event.key || '').toLowerCase() === 'k') {
        event.preventDefault()
        setQuickOpen((prev) => !prev)
        return
      }
      const href = getOperatorShortcutHref(event)
      if (href) {
        event.preventDefault()
        window.location.assign(href)
      }
    }

    handlePageShow()
    window.addEventListener('storevis:search-route-changed', handleSearchRouteChanged)
    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('storevis:search-route-changed', handleSearchRouteChanged)
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <>
      {/* Desktop Navigation Header */}
      <nav className="sticky top-0 z-50 hidden border-b border-slate-800/80 bg-[color:var(--surface)]/92 backdrop-blur-xl transition-all duration-300 ease-in-out sm:block shadow-[0_10px_40px_rgba(2,6,23,0.16)]">
        <div className="mx-auto flex h-14 w-full max-w-[1900px] items-center gap-3 px-3 sm:px-4 2xl:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-slate-700/60 bg-slate-900/40 px-3 py-2 transition hover:border-sky-500/40 hover:bg-slate-800/60">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 text-sm font-black text-white shadow-lg shadow-sky-950/30">NH</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold tracking-[0.14em] text-slate-100 uppercase">NPP Hà Công</span>
              <span className="block text-[11px] font-medium text-slate-400">Workbench cho bán hàng, kho và cửa hàng</span>
            </span>
          </Link>

          <div className="hidden items-center gap-2 xl:flex">
            <span className="rounded-full border border-slate-700/70 bg-slate-900/50 px-3 py-1 text-xs font-semibold text-slate-300">{roleLabel}</span>
            {isAdmin && (
              <button
                type="button"
                className="rounded-full border border-slate-700 bg-slate-900/50 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-slate-500 hover:bg-slate-800 hover:text-white transition-all cursor-pointer shadow-inner"
                onClick={() => setQuickOpen((prev) => !prev)}
                aria-expanded={quickOpen}
              >
                Ctrl K
              </button>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {navLinks.map(({ href, active, label, Icon, badge }) => (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
                  active
                    ? 'border-sky-500/35 bg-sky-500/10 text-sky-300'
                    : 'border-transparent bg-transparent text-slate-300 hover:border-slate-700/70 hover:bg-slate-900/60 hover:text-slate-50'
                }`}
              >
                <Icon className={`size-4 ${active ? 'text-sky-300' : 'text-slate-400'}`} />
                <span className="whitespace-nowrap">{label}</span>
                <NavBadge count={badge} />
              </Link>
            ))}

            {theme && (
              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="ml-1 flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-slate-900/50 text-slate-200 hover:border-sky-500/40 hover:bg-slate-800 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
                aria-label="Thay đổi giao diện"
              >
                {theme === 'dark' ? (
                  <Sun className="size-4 text-amber-300" />
                ) : (
                  <Moon className="size-4 text-indigo-500" />
                )}
              </button>
            )}
          </div>
        </div>
        
        {isAdmin && quickOpen && (
          <div className="absolute right-4 top-13 z-[1100] w-85 rounded-2xl border border-slate-800/90 bg-slate-950 p-2 shadow-2xl shadow-black/80 animate-in fade-in slide-in-from-top-2 duration-150">
            <input
              className="mb-2 h-10 w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 text-sm text-slate-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={quickQuery}
              onChange={(event) => setQuickQuery(event.target.value)}
              placeholder="Tìm lệnh, màn hình..."
              autoFocus
            />
            <div className="max-h-80 overflow-y-auto space-y-0.5">
              {commandResults.map((result) => (
                <Link key={`${result.type}-${result.id}`} href={result.href} className="flex items-center justify-between rounded-xl px-3.5 py-2 text-sm text-slate-200 hover:bg-slate-900 transition-colors" onClick={() => { setQuickOpen(false); setQuickQuery('') }}>
                  <span className="font-medium text-slate-100">{result.label}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-800">{result.subtitle}</span>
                </Link>
              ))}
              {commandResults.length === 0 && <p className="px-3.5 py-4 text-sm text-slate-500 text-center">Không tìm thấy kết quả.</p>}
            </div>
          </div>
        )}
      </nav>

      {/* Mobile Top Navigation Header */}
      <header className="sticky top-0 z-50 flex h-14 w-full items-center justify-between border-b border-slate-800/80 bg-[color:var(--surface)]/94 px-4 backdrop-blur-xl transition-all duration-300 sm:hidden shadow-[0_10px_30px_rgba(2,6,23,0.14)]">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 text-xs font-black text-white shadow-lg shadow-sky-950/30">NH</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-extrabold tracking-[0.12em] text-slate-100 uppercase">NPP Hà Công</span>
            <span className="block text-[11px] font-medium text-slate-400">{roleLabel}</span>
          </span>
        </Link>
        {theme && (
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-slate-900/60 text-slate-200 active:scale-95 transition-all cursor-pointer"
            aria-label="Thay đổi giao diện"
          >
            {theme === 'dark' ? (
              <Sun className="size-4 text-amber-300" />
            ) : (
              <Moon className="size-4 text-indigo-500" />
            )}
          </button>
        )}
      </header>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <div className="safe-area-bottom fixed inset-x-0 bottom-0 z-[1000] border-t border-slate-800 bg-[color:var(--surface)]/96 backdrop-blur-xl sm:hidden shadow-[0_-10px_30px_rgba(2,6,23,0.18)]">
        <div className="mx-auto flex h-16 w-full max-w-screen-md px-1.5">
          {navLinks.map(({ href, active, label, mobileLabel, Icon, badge }) => (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 transition-all duration-200 ${active ? 'bg-sky-500/10 text-sky-300' : 'text-slate-500 active:text-slate-200'}`}
            >
              <Icon className="size-5 shrink-0" />
              <span className={`w-full truncate text-center text-[10px] font-semibold leading-none whitespace-nowrap ${active ? 'text-sky-300' : 'text-slate-500'}`}>
                {mobileLabel || label}
              </span>
              <NavBadge count={badge} mobile />
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
