'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  LayoutDashboard, Store, PlusCircle,
  ClipboardList, FileText,
  Package, ClipboardPlus, BarChart3,
  MapIcon, User,
  CheckCircle, Users, Settings, Shield,
  Download, Upload, GitMerge, ChevronDown,
} from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'

/* ─── Nav structure — tất cả pages, không role filter ────── */
const ALL_SECTIONS = [
  {
    key: 'overview',
    label: 'Tổng quan',
    items: [
      { href: '/overview', label: 'Tổng quan', Icon: LayoutDashboard },
    ],
  },
  {
    key: 'stores',
    label: 'Cửa hàng',
    items: [
      { href: '/',              label: 'Danh sách cửa hàng', Icon: Store },
      { href: '/store/create',   label: 'Thêm cửa hàng',      Icon: PlusCircle },
      { href: '/store/reports',  label: 'Báo cáo cửa hàng',   Icon: CheckCircle },
      { href: '/store/verify',   label: 'Duyệt cửa hàng',     Icon: Shield },
    ],
    submenu: {
      key: 'data-processing',
      label: 'Xử lý dữ liệu',
      Icon: Download,
      items: [
        { href: '/store/import',   label: 'Nhập dữ liệu',   Icon: Download },
        { href: '/store/export',   label: 'Xuất dữ liệu',   Icon: Upload },
        { href: '/store/deduplicate', label: 'Gộp trùng lặp', Icon: GitMerge },
      ],
    },
  },
  {
    key: 'map',
    label: 'Bản đồ',
    items: [
      { href: '/map', label: 'Bản đồ', Icon: MapIcon },
    ],
  },
  {
    key: 'orders',
    label: 'Đơn hàng',
    items: [
      { href: '/orders',     label: 'Danh sách đơn', Icon: ClipboardList },
      { href: '/orders/new', label: 'Tạo đơn hàng',  Icon: FileText },
    ],
  },
  {
    key: 'inventory',
    label: 'Kho hàng',
    items: [
      { href: '/inventory/products',      label: 'Hàng hóa',     Icon: Package },
      { href: '/inventory/purchases/new', label: 'Nhập kho',     Icon: ClipboardPlus },
      { href: '/inventory/purchases',     label: 'Phiếu nhập',   Icon: FileText },
      { href: '/inventory/reports',       label: 'Thống kê kho', Icon: BarChart3 },
    ],
  },
  {
    key: 'system',
    label: 'Hệ thống',
    items: [
      { href: '/account',          label: 'Tài khoản',         Icon: User },
      { href: '/admin/users',      label: 'Quản lý tài khoản', Icon: Users },
      { href: '/admin/operations', label: 'Thao tác hệ thống', Icon: Settings },
    ],
  },
]

/* ─── Helpers ──────────────────────────────────────────────── */
function isActive(pathname, href) {
  if (href === '/') return pathname === '/'
  return pathname === href
}

/* ─── Component ────────────────────────────────────────────── */
export default function Sidebar({ open, onClose }) {
  const { pathname } = useRouter()
  const { user } = useAuth() || {}
  const [openSubmenus, setOpenSubmenus] = useState({})

  useEffect(() => {
    const sectionsToCheck = user ? ALL_SECTIONS : ALL_SECTIONS.filter((s) => s.key === 'stores')
    setOpenSubmenus((prev) => {
      const next = { ...prev }
      for (const s of sectionsToCheck) {
        if (s.submenu && s.submenu.items.some((i) => isActive(pathname, i.href))) {
          next[s.submenu.key] = true
        }
      }
      return next
    })
  }, [pathname, user])
  const userName = user?.email?.split('@')[0] || 'Khách'
  const userRole = !user ? '' : user.role === 'admin' ? 'Quản lý' : 'Telesale'

  const toggleSubmenu = (key) => setOpenSubmenus((prev) => ({ ...prev, [key]: !prev[key] }))

  const sections = useMemo(() => {
    if (user) return ALL_SECTIONS
    return ALL_SECTIONS
      .filter((s) => s.key === 'stores')
      .map((s) => ({
        ...s,
        items: s.items.filter((i) => i.href === '/' || i.href === '/store/create'),
      }))
  }, [user])

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed lg:sticky top-0 left-0 z-50
          w-[240px] h-screen flex flex-col
          bg-[var(--sidebar)]
          border-r border-[var(--border)]
          transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* ── Brand ── */}
        <div className="sidebar-brand">
          <h1>NPP Hà Công</h1>
          <span>Quản lý phân phối</span>
        </div>

        {/* ── Nav ── */}
        <nav className="sidebar-nav">
          {sections.map((section) => (
            <div key={section.key}>
              <div className="sidebar-section">{section.label}</div>
              {section.items.map((item) => {
                const active = isActive(pathname, item.href)
                const ItemIcon = item.Icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`nav-item ${active ? 'active' : ''}`}
                  >
                    <ItemIcon className="size-[18px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
              {section.submenu && (
                <div>
                  <button
                    onClick={() => toggleSubmenu(section.submenu.key)}
                    className={`nav-item ${openSubmenus[section.submenu.key] ? 'active' : ''}`}
                  >
                    <Download className="size-[18px] shrink-0" strokeWidth={openSubmenus[section.submenu.key] ? 2.2 : 1.8} />
                    <span>{section.submenu.label}</span>
                    <ChevronDown
                      className="shrink-0 transition-transform duration-200"
                      style={{ width: 14, height: 14, transform: openSubmenus[section.submenu.key] ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    />
                  </button>
                  <div
                    className="overflow-hidden transition-all duration-200"
                    style={{
                      maxHeight: openSubmenus[section.submenu.key] ? `${section.submenu.items.length * 44}px` : '0',
                    }}
                  >
                    <div className="nav-submenu-items">
                      {section.submenu.items.map((item) => {
                        const active = isActive(pathname, item.href)
                        const ItemIcon = item.Icon
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={onClose}
                            className={`nav-item ${active ? 'active' : ''}`}
                          >
                            <ItemIcon className="size-[18px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                            <span>{item.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* ── Footer — user card only when logged in ── */}
        {user && (
          <div className="sidebar-footer">
            <div className="user-card">
              <div className="avatar-sm">{userName.charAt(0).toUpperCase()}</div>
              <div className="user-info">
                <div className="name truncate">{userName}</div>
                <div className="role">{userRole}</div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
