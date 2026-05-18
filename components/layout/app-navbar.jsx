'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'
import {
  AccountIcon,
  DashboardIcon,
  MapIcon,
  OrderIcon,
  PlusIcon,
  SearchIcon,
} from '@/components/icons/navigation-icons'

export default function AppNavbar() {
  const pathname = usePathname()
  const { isAdmin, isTelesale } = useAuth() || {}
  const [searchHref, setSearchHref] = useState('/')
  const currentPath = pathname || ''
  const accountLabel = isAdmin ? 'Admin' : isTelesale ? 'Telesale' : 'Người dùng'
  const accountMobileLabel = isAdmin ? 'Admin' : isTelesale ? 'Tele' : 'ND'

  const guestLinks = [
    { href: searchHref, active: currentPath === '/', label: 'Tìm kiếm', mobileLabel: 'Tìm', Icon: SearchIcon },
    { href: '/map', active: currentPath === '/map', label: 'Bản đồ', mobileLabel: 'Bản đồ', Icon: MapIcon },
    { href: '/store/create', active: currentPath === '/store/create', label: 'Thêm', mobileLabel: 'Thêm', Icon: PlusIcon },
    { href: '/account', active: currentPath === '/account', label: accountLabel, mobileLabel: accountMobileLabel, Icon: AccountIcon },
  ]

  const telesaleLinks = [
    { href: searchHref, active: currentPath === '/', label: 'Tìm kiếm', mobileLabel: 'Tìm', Icon: SearchIcon },
    { href: '/telesale/overview', active: currentPath === '/telesale/overview', label: 'Telesale', mobileLabel: 'TS', Icon: DashboardIcon },
    { href: '/map', active: currentPath === '/map', label: 'Bản đồ', mobileLabel: 'Bản đồ', Icon: MapIcon },
    { href: '/store/create', active: currentPath === '/store/create', label: 'Thêm', mobileLabel: 'Thêm', Icon: PlusIcon },
    { href: '/account', active: currentPath === '/account', label: accountLabel, mobileLabel: accountMobileLabel, Icon: AccountIcon },
  ]

  const adminLinks = [
    { href: searchHref, active: currentPath === '/', label: 'Tìm kiếm', mobileLabel: 'Tìm', Icon: SearchIcon },
    { href: '/orders/new', active: currentPath === '/orders/new', label: 'Lên đơn', mobileLabel: 'Đơn', Icon: OrderIcon },
    { href: '/map', active: currentPath === '/map', label: 'Bản đồ', mobileLabel: 'Bản đồ', Icon: MapIcon },
    { href: '/store/create', active: currentPath === '/store/create', label: 'Thêm', mobileLabel: 'Thêm', Icon: PlusIcon },
    { href: '/account', active: currentPath === '/account', label: accountLabel, mobileLabel: accountMobileLabel, Icon: AccountIcon },
  ]

  const navLinks = isAdmin ? adminLinks : isTelesale ? telesaleLinks : guestLinks

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

    handlePageShow()
    window.addEventListener('storevis:search-route-changed', handleSearchRouteChanged)
    window.addEventListener('pageshow', handlePageShow)

    return () => {
      window.removeEventListener('storevis:search-route-changed', handleSearchRouteChanged)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [])

  const renderBadge = (count, opts = {}) => {
    if (!count || count <= 0) return null
    const text = count > 99 ? '99+' : String(count)
    const isMobile = Boolean(opts.mobile)
    return (
      <span className={`absolute rounded-full bg-red-500 text-white leading-none flex items-center justify-center shadow ${isMobile ? 'top-1.5 right-1.5 min-w-3.5 h-3.5 px-0.5 text-[9px]' : '-top-1 -right-1 min-w-4 h-4 px-1 text-[10px]'}`}>
        {text}
      </span>
    )
  }

  return (
    <>
      <nav className="sticky top-0 z-50 hidden border-b border-white/10 bg-neutral-950/82 backdrop-blur-xl sm:block">
        <div className="mx-auto flex h-12 w-full max-w-[1900px] items-center gap-1.5 px-3 sm:px-4 2xl:px-6">
          <Link href="/" className="flex shrink-0 items-center text-sm font-semibold uppercase tracking-[0.1em] text-neutral-100">
            <span>NPP Hà Công</span>
          </Link>

          <div className="ml-auto hidden items-center gap-1 sm:flex">
            {navLinks.map(({ href, active, label, Icon, badge }) => (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${active ? 'text-white' : 'text-neutral-300 hover:text-white'}`}
              >
                <Icon className={`size-3.5 ${active ? 'text-white' : 'text-neutral-400'}`} />
                <span className="whitespace-nowrap">{label}</span>
                {active && <span className="absolute inset-x-2.5 -bottom-0.5 h-0.5 rounded-full bg-sky-300" />}
                {renderBadge(badge)}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <div className="safe-area-bottom fixed inset-x-0 bottom-0 z-[1000] border-t border-neutral-800 bg-neutral-950/95 backdrop-blur-md sm:hidden">
        <div className="mx-auto flex h-14 w-full max-w-screen-md">
          {navLinks.map(({ href, active, label, mobileLabel, Icon, badge }) => (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 transition-colors ${active ? 'text-blue-400' : 'text-neutral-500 active:text-neutral-200'}`}
            >
              <Icon className="size-5 shrink-0" />
              <span className={`w-full truncate text-center text-[9px] font-medium leading-none whitespace-nowrap ${active ? 'text-blue-400' : 'text-neutral-500'}`}>
                {mobileLabel || label}
              </span>
              {renderBadge(badge, { mobile: true })}
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
