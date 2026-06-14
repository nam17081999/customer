'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { getOperatorShortcutHref } from '@/helper/operatorWorkflow'
import { ChevronDown, Package, Shield } from 'lucide-react'
import {
  AccountIcon,
  MapIcon,
  OrderIcon,
  PlusIcon,
  SearchIcon,
} from '@/components/icons/navigation-icons'
import { initNotificationSound, playNotificationSound } from '@/lib/notification-sound'
import { loadFeed, markFeedRead, markAllFeedRead, getCachedFeed, refreshUnreadCount } from '@/lib/notification-store'

// ─── Menu structure ─────────────────────────────────────────────────

const GROUPS = [
  {
    key: 'sales',
    label: 'Bán hàng',
    Icon: OrderIcon,
    roles: ['admin', 'telesale'],
    items: [
      { href: '/orders/new', label: 'Lên đơn hàng', roles: ['admin'] },
      { href: '/orders', label: 'Danh sách đơn', roles: ['admin'] },
      { href: '/telesale/overview', label: 'Telesale', roles: ['telesale'] },
    ],
  },
  {
    key: 'inventory',
    label: 'Kho hàng',
    Icon: Package,
    roles: ['admin'],
    items: [
      { href: '/inventory/products', label: 'Hàng hóa & tồn kho' },
      { href: '/inventory/purchases/new', label: 'Nhập hàng' },
      { href: '/inventory/purchases', label: 'Phiếu nhập' },
      { href: '/inventory/stock', label: 'Báo cáo tồn kho' },
    ],
  },
  {
    key: 'stores',
    label: 'Cửa hàng',
    Icon: MapIcon,
    roles: ['admin', 'telesale', 'guest'],
    items: [
      { href: '/map', label: 'Bản đồ' },
      { href: '/overview', label: 'Tổng quan', roles: ['admin'] },
      { href: '/store/create', label: 'Thêm cửa hàng' },
      { href: '/store/import', label: 'Nhập dữ liệu', roles: ['admin'] },
      { href: '/store/export', label: 'Xuất dữ liệu', roles: ['admin'] },
      { href: '/store/deduplicate', label: 'Gộp trùng lặp', roles: ['admin'] },
    ],
  },
  {
    key: 'admin',
    label: 'Quản trị',
    Icon: Shield,
    roles: ['admin'],
    items: [
      { href: '/store/verify', label: 'Duyệt cửa hàng' },
      { href: '/store/reports', label: 'Duyệt báo cáo' },
      { href: '/admin/operations', label: 'Thao tác' },
      { href: '/admin/users', label: 'Quản lý tài khoản' },
    ],
  },
]

function resolveRole(isAdmin, isTelesale) {
  if (isAdmin) return 'admin'
  if (isTelesale) return 'telesale'
  return 'guest'
}

function getFilteredGroups(role) {
  return GROUPS
    .filter(g => g.roles.includes(role))
    .map(g => ({
      ...g,
      items: g.items.filter(i => !i.roles || i.roles.includes(role)),
    }))
    .filter(g => g.items.length > 0)
}

// ─── Components ─────────────────────────────────────────────────────

function NavBadge({ count, mobile = false }) {
  if (!count || count <= 0) return null
  const text = count > 99 ? '99+' : String(count)
  return (
    <span className={`absolute rounded-full bg-red-500 text-white leading-none flex items-center justify-center shadow ${
      mobile
        ? 'top-1.5 right-1.5 min-w-3.5 h-3.5 px-0.5 text-[9px]'
        : '-top-1 -right-1 min-w-4 h-4 px-1 text-[10px]'
    }`}>
      {text}
    </span>
  )
}

function activeClass(cond) {
  return cond
    ? 'text-[color:var(--primary)]'
    : 'text-gray-300 hover:text-white'
}

function DropdownGroup({ group, currentPath }) {
  const Icon = group.Icon
  const isActive = group.items.some(i => i.href === currentPath)

  return (
    <div className="relative group">
      <button
        type="button"
        className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors cursor-default select-none ${activeClass(isActive)}`}
      >
        <Icon className={`size-3.5 transition-colors ${isActive ? 'text-[color:var(--primary)]' : 'text-gray-400 group-hover:text-gray-200'}`} />
        <span className="whitespace-nowrap">{group.label}</span>
        <ChevronDown className={`size-3 transition-all duration-200 group-hover:rotate-180 ${isActive ? 'text-[color:var(--primary)]/60' : 'text-gray-500 group-hover:text-gray-300'}`} />
      </button>

      <div className="invisible group-hover:visible absolute top-full left-0 min-w-[200px] pt-4 z-50">
        <div className="rounded-xl border border-gray-800 bg-gray-950/98 backdrop-blur-2xl shadow-2xl shadow-black/50 py-1.5 overflow-hidden">
          {group.items.map((item) => {
            const itemActive = currentPath === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2 text-sm transition-colors ${
                  itemActive
                    ? 'font-semibold text-[color:var(--primary)]'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span className="pl-1">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Notifications panel ────────────────────────────────────────────

function NotificationsPanel({ onClose }) {
  const [feed, setFeed] = useState(() => getCachedFeed())
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(true)
  const itemRefs = useRef({})
  const observerRef = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // Load feed từ API nếu cache rỗng (page vừa reload, chưa kịp fetch)
  useEffect(() => {
    mountedRef.current = true
    const cached = getCachedFeed()
    if (cached.length > 0) {
      setFeed(cached)
      return
    }
    setLoading(true)
    loadFeed(50, 0).then((data) => {
      if (!mountedRef.current) return
      setFeed(data || [])
    }).catch(() => {
      // Keep empty state on error
    }).finally(() => {
      if (mountedRef.current) setLoading(false)
    })
    return () => { mountedRef.current = false }
  }, [])

  // Observer: items chưa đọc trong viewport → đánh dấu đã đọc
  useEffect(() => {
    if (feed.length === 0) return

    const unread = feed.filter(e => !e.is_read)
    if (unread.length === 0) return

    // Disconnect observer cũ nếu có
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(async (entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.dataset.notifId
            if (id) {
              observer.unobserve(entry.target)
              await markFeedRead(id).catch(() => {})
            }
          }
        })
      },
      { rootMargin: '0px 0px -80px 0px' },
    )

    observerRef.current = observer

    // Đợi DOM render xong rồi observe
    const timer = setTimeout(() => {
      for (const item of unread) {
        const el = itemRefs.current[item.id]
        if (el) observer.observe(el)
      }
    }, 100)

    return () => {
      clearTimeout(timer)
      observer.disconnect()
      observerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed])

  const handleMarkRead = async (id) => {
    await markFeedRead(id)
    setFeed(getCachedFeed())
    refreshUnreadCount()
  }

  const handleMarkAllRead = async () => {
    await markAllFeedRead()
    setFeed(getCachedFeed())
    refreshUnreadCount()
  }

  const stockItems = feed.filter(e => e.type === 'low-stock').slice(0, 15)
  const reportItems = feed.filter(e => e.type !== 'low-stock').slice(0, 15)
  const anyInventory = stockItems.length > 0
  const anyReports = reportItems.length > 0

  const renderEntry = (entry) => {
    const isUnread = !entry.is_read
    const colorBorder = entry.type === 'low-stock' ? 'border-l-amber-500/30' :
      entry.type === 'store-verify' ? 'border-l-blue-500/30' :
      'border-l-red-500/30'

    return (
      <div
        key={entry.id}
        ref={(el) => { itemRefs.current[entry.id] = el }}
        data-notif-id={entry.id}
        className={`relative group flex items-start gap-2.5 px-3 py-2 transition-colors border-l-2 ${colorBorder} ${
          isUnread ? '' : 'opacity-50'
        } hover:bg-white/[0.04]`}
      >
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium leading-snug ${isUnread ? 'text-white' : 'text-gray-500'}`}>
            {entry.title}
          </p>
          <p className={`text-[11px] leading-snug mt-0.5 ${isUnread ? 'text-gray-500' : 'text-gray-600'}`}>
            {entry.detail}
          </p>
          <p className="text-[10px] text-gray-600/60 mt-0.5">
            {formatTimestamp(entry.created_at)}
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); handleMarkRead(entry.id) }}
          className="shrink-0 mt-0.5 text-gray-600 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-[60]" onClick={closeRef.current} />
      <div className="absolute top-full right-0 pt-4 z-[61]" onClick={(e) => e.stopPropagation()}>
        <div className="w-80 rounded-xl border border-gray-800 bg-gray-950/98 backdrop-blur-2xl shadow-2xl shadow-black/50 py-2 max-h-[75vh] overflow-y-auto">
          {loading ? (
            <div className="px-3 py-6 text-center text-sm text-gray-500">
              <svg className="mx-auto mb-2 size-5 animate-spin text-gray-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Đang tải…
            </div>
          ) : !anyInventory && !anyReports ? (
            <div className="px-3 py-6 text-center text-sm text-gray-500">
              <Bell className="mx-auto mb-1.5 size-5 text-gray-600" />
              Không có thông báo
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 pb-1.5 border-b border-white/5 mb-1">
                <span className="text-xs text-gray-400">Thông báo</span>
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-[color:var(--primary)] hover:opacity-80 transition-opacity cursor-pointer"
                >
                  Đã đọc tất cả
                </button>
              </div>

              {anyInventory && (
                <div className="mb-1">
                  <div className="flex items-center gap-1.5 px-3 pl-[10px] py-1.5">
                    <Package className="size-3 text-amber-400" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/80">
                      Hàng tồn ({stockItems.length})
                    </span>
                  </div>
                  {stockItems.map(renderEntry)}
                </div>
              )}

              {anyReports && (
                <div>
                  <div className="flex items-center gap-1.5 px-3 pl-[10px] py-1.5 border-t border-white/5">
                    <svg className="size-3 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 01-3.46 0" />
                    </svg>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400/80">
                      Đang chờ duyệt ({reportItems.length})
                    </span>
                  </div>
                  {reportItems.map(renderEntry)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

function formatTimestamp(ts) {
  if (!ts) return ''
  const date = new Date(ts)
  if (isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  if (diff < 60000) return 'Vừa xong'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ─── Main ─────────────────────────────────────────────────────────

export default function AppNavbar() {
  const pathname = usePathname()
  const { isAdmin, isTelesale } = useAuth() || {}
  const [searchHref, setSearchHref] = useState('/')
  const currentPath = pathname || ''

  const role = resolveRole(isAdmin, isTelesale)
  const groups = getFilteredGroups(role)

  const [badgeCount, setBadgeCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)

  // Init audio on first user gesture
  useEffect(() => {
    const handler = () => { initNotificationSound(); document.removeEventListener('click', handler) }
    document.addEventListener('click', handler, { once: true })
    document.addEventListener('keydown', handler, { once: true })
    return () => { document.removeEventListener('click', handler); document.removeEventListener('keydown', handler) }
  }, [])

  // Badge count — khởi tạo từ cache và subscribe (không gọi RPC)
  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    let unsub

    const init = () => {
      const feed = getCachedFeed()
      if (feed.length > 0) {
        const total = feed.filter(e => !e.is_read).length
        setBadgeCount(total)
      }
      // Subscribe để cập nhật khi có thay đổi (markRead, new entry …)
      import('@/lib/notification-store').then(({ subscribeUnreadCount }) => {
        unsub = subscribeUnreadCount((total) => {
          if (!cancelled) setBadgeCount(total)
        })
      })
    }
    init()
    return () => {
      cancelled = true
      if (unsub) unsub()
    }
  }, [isAdmin])

  // Play sound on new notification
  useEffect(() => {
    if (!isAdmin) return
    const handler = (e) => {
      if (e.detail?.type) playNotificationSound(e.detail.type)
    }
    window.addEventListener('notification', handler)
    return () => window.removeEventListener('notification', handler)
  }, [isAdmin])

  // Close panel on escape
  useEffect(() => {
    if (!notifOpen) return
    const handler = (e) => { if (e.key === 'Escape') setNotifOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [notifOpen])

  const accountLabel = isAdmin ? 'Admin' : isTelesale ? 'Telesale' : 'Người dùng'
  const accountMobileLabel = isAdmin ? 'Admin' : isTelesale ? 'Tele' : 'ND'

  // Mobile tab
  const mobileLinks = [
    { href: searchHref, active: currentPath === '/', label: 'Tìm kiếm', mobileLabel: 'Tìm', Icon: SearchIcon },
    { href: '/orders/new', active: currentPath === '/orders/new', label: 'Lên đơn', mobileLabel: 'Đơn', Icon: OrderIcon },
    { href: '/map', active: currentPath === '/map', label: 'Bản đồ', mobileLabel: 'Bản đồ', Icon: MapIcon },
    { href: '/store/create', active: currentPath === '/store/create', label: 'Thêm', mobileLabel: 'Thêm', Icon: PlusIcon },
    ...(isAdmin ? [{ href: '/notifications', active: currentPath === '/notifications', label: 'Thông báo', mobileLabel: 'TB', Icon: Bell, badge: badgeCount }] : []),
    { href: '/account', active: currentPath === '/account', label: accountLabel, mobileLabel: accountMobileLabel, Icon: AccountIcon },
  ]

  // Global events
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
      {/* ───────── DESKTOP ───────── */}
      <nav className="sticky top-0 z-50 hidden border-b border-white/10 bg-gray-950/82 backdrop-blur-xl sm:block">
        <div className="mx-auto flex h-12 w-full max-w-[1900px] items-center px-3 sm:px-4 2xl:px-6">
          <Link
            href="/"
            className="flex shrink-0 items-center text-sm font-semibold uppercase tracking-[0.1em] text-gray-100"
          >
            <span className="hidden lg:inline">NPP Hà Công</span>
            <span className="inline lg:hidden">NPP HC</span>
          </Link>

          <div className="ml-auto flex items-center gap-1">
            {/* Search */}
            <Link
              href={searchHref}
              aria-current={currentPath === '/' ? 'page' : undefined}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${activeClass(currentPath === '/')}`}
            >
              <SearchIcon className={`size-3.5 ${currentPath === '/' ? 'text-[color:var(--primary)]' : 'text-gray-400 group-hover:text-gray-200'}`} />
              <span>Tìm kiếm</span>
            </Link>

            {/* Dropdown groups */}
            {groups.map(group => (
              <DropdownGroup key={group.key} group={group} currentPath={currentPath} />
            ))}

            {/* Notifications bell */}
            {isAdmin && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotifOpen((o) => !o)}
                  className={`relative flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer select-none ${
                    badgeCount > 0
                      ? 'text-amber-400'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  title="Thông báo"
                >
                  <Bell className="size-3.5" />
                  {badgeCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex min-w-[14px] h-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] leading-none text-white shadow">
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <NotificationsPanel onClose={() => setNotifOpen(false)} />
                )}
              </div>
            )}

            {/* Account */}
            <Link
              href="/account"
              aria-current={currentPath === '/account' ? 'page' : undefined}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${activeClass(currentPath === '/account')}`}
            >
              <AccountIcon className={`size-3.5 ${currentPath === '/account' ? 'text-[color:var(--primary)]' : 'text-gray-400 group-hover:text-gray-200'}`} />
              <span className="whitespace-nowrap">{accountLabel}</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* ───────── MOBILE ───────── */}
      <div className="safe-area-bottom fixed inset-x-0 bottom-0 z-[1000] border-t border-gray-800 bg-gray-950/95 backdrop-blur-md sm:hidden">
        <div className="mx-auto flex h-14 w-full max-w-screen-md">
          {mobileLinks.map(({ href, active, label, mobileLabel, Icon, badge }) => (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 transition-colors ${
                active ? 'text-[color:var(--primary)]' : 'text-gray-500 active:text-gray-200'
              }`}
            >
              <Icon className="size-5 shrink-0" />
              <span className={`w-full truncate text-center text-[9px] font-medium leading-none whitespace-nowrap ${
                active ? 'text-[color:var(--primary)]' : 'text-gray-500'
              }`}>
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
