"use client";

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { getOrRefreshStores } from '@/lib/storeCache'

const SearchIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
)

const DashboardIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
  </svg>
)

const VerifyIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5 2A9 9 0 1112 3a9 9 0 019 9z" />
  </svg>
)

const MapIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>
)

const PlusIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
)

const AccountIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A9 9 0 1118.88 17.8M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const ReportIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 4h10a2 2 0 012 2v12l-3-2-3 2-3-2-3 2V6a2 2 0 012-2z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h8M7 12h5" />
  </svg>
)

export default function Navbar() {
  const pathname = usePathname()
  const { isAdmin, isTelesale } = useAuth() || {}
  const [pendingStores, setPendingStores] = useState(0)
  const [pendingReports, setPendingReports] = useState(0)
  const currentPath = pathname || ''
  const accountLabel = isAdmin ? 'Admin' : isTelesale ? 'Telesale' : '\u004e\u0067\u01b0\u1eddi \u0064\u00f9\u006e\u0067'
  const accountMobileLabel = isAdmin ? 'Admin' : isTelesale ? 'Tele' : 'ND'

  const guestLinks = [
    { href: '/', active: currentPath === '/', label: 'Tìm kiếm', mobileLabel: 'Tìm', Icon: SearchIcon },
    { href: '/map', active: currentPath === '/map', label: 'Bản đồ', mobileLabel: 'Bản đồ', Icon: MapIcon },
    { href: '/store/create', active: currentPath === '/store/create', label: 'Thêm', mobileLabel: 'Thêm', Icon: PlusIcon },
    { href: '/account', active: currentPath === '/account', label: accountLabel, mobileLabel: accountMobileLabel, Icon: AccountIcon },
  ]

  const telesaleLinks = [
    { href: '/', active: currentPath === '/', label: 'Tìm kiếm', mobileLabel: 'Tìm', Icon: SearchIcon },
    { href: '/telesale/overview', active: currentPath === '/telesale/overview', label: 'Telesale', mobileLabel: 'TS', Icon: DashboardIcon },
    { href: '/map', active: currentPath === '/map', label: 'Bản đồ', mobileLabel: 'Bản đồ', Icon: MapIcon },
    { href: '/store/create', active: currentPath === '/store/create', label: 'Thêm', mobileLabel: 'Thêm', Icon: PlusIcon },
    { href: '/account', active: currentPath === '/account', label: accountLabel, mobileLabel: accountMobileLabel, Icon: AccountIcon },
  ]

  const adminLinks = [
    { href: '/', active: currentPath === '/', label: 'Tìm kiếm', mobileLabel: 'Tìm', Icon: SearchIcon },
    { href: '/store/verify', active: currentPath === '/store/verify', label: 'Xác thực', mobileLabel: 'Duyệt', Icon: VerifyIcon, badge: pendingStores },
    { href: '/store/reports', active: currentPath === '/store/reports', label: 'Báo cáo', mobileLabel: 'BC', Icon: ReportIcon, badge: pendingReports },
    { href: '/map', active: currentPath === '/map', label: 'Bản đồ', mobileLabel: 'Bản đồ', Icon: MapIcon },
    { href: '/store/create', active: currentPath === '/store/create', label: 'Thêm', mobileLabel: 'Thêm', Icon: PlusIcon },
    { href: '/account', active: currentPath === '/account', label: accountLabel, mobileLabel: accountMobileLabel, Icon: AccountIcon },
  ]

  const navLinks = isAdmin ? adminLinks : isTelesale ? telesaleLinks : guestLinks

  useEffect(() => {
    let alive = true

    async function loadCounts() {
      if (!isAdmin) {
        setPendingStores(0)
        setPendingReports(0)
        return
      }
      try {
        const [stores, reportCountRes] = await Promise.all([
          getOrRefreshStores(),
          supabase
            .from('store_reports')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
        ])
        if (!alive) return
        const pendingStoreCount = (stores || []).filter((store) => store.active !== true).length
        setPendingStores(pendingStoreCount)
        setPendingReports(typeof reportCountRes.count === 'number' ? reportCountRes.count : 0)
      } catch {
        if (!alive) return
        setPendingStores(0)
        setPendingReports(0)
      }
    }

    loadCounts()
    return () => {
      alive = false
    }
  }, [isAdmin])

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
      <nav className="sticky top-0 z-50 hidden border-b border-white/10 bg-slate-950/82 backdrop-blur-xl sm:block">
        <div className="mx-auto flex h-12 w-full max-w-screen-md items-center gap-1.5 px-3 sm:px-4">
          <Link href="/" className="flex shrink-0 items-center text-sm font-semibold uppercase tracking-[0.1em] text-slate-100">
            <span>StoreVis</span>
          </Link>

          <div className="ml-auto hidden items-center gap-1 sm:flex">
            {navLinks.map(({ href, active, label, Icon, badge }) => (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${active ? 'text-white' : 'text-slate-300 hover:text-white'}`}
              >
                <Icon className={`h-3.5 w-3.5 ${active ? 'text-white' : 'text-slate-400'}`} />
                <span className="whitespace-nowrap">{label}</span>
                {active && <span className="absolute inset-x-2.5 -bottom-0.5 h-0.5 rounded-full bg-sky-300" />}
                {renderBadge(badge)}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <div className="safe-area-bottom fixed inset-x-0 bottom-0 z-[60] border-t border-gray-800 bg-gray-950/95 backdrop-blur-md sm:hidden">
        <div className="mx-auto flex h-14 w-full max-w-screen-md">
          {navLinks.map(({ href, active, label, mobileLabel, Icon, badge }) => (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 transition-colors ${active ? 'text-blue-400' : 'text-gray-500 active:text-gray-200'}`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className={`w-full truncate text-center text-[9px] font-medium leading-none whitespace-nowrap ${active ? 'text-blue-400' : 'text-gray-500'}`}>
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
