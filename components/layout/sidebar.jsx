'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  LayoutDashboard, Store, PlusCircle,
  ClipboardList, FileText,
  Package, ClipboardPlus, BarChart3,
  MapIcon, User,
  CheckCircle, Users, Settings, Shield, Bell,
  Download, Upload, GitMerge,
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
      { href: '/store/import',   label: 'Nhập dữ liệu',       Icon: Download },
      { href: '/store/export',   label: 'Xuất dữ liệu',       Icon: Upload },
      { href: '/store/deduplicate', label: 'Gộp trùng lặp',   Icon: GitMerge },
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
      { href: '/inventory/stock',         label: 'Tồn kho',      Icon: BarChart3 },
      { href: '/inventory/purchases',     label: 'Phiếu nhập',   Icon: FileText },
      { href: '/inventory/reports',       label: 'Thống kê kho', Icon: BarChart3 },
    ],
  },
  {
    key: 'map',
    label: 'Bản đồ',
    items: [
      { href: '/map', label: 'Bản đồ', Icon: MapIcon },
    ],
  },
  {
    key: 'system',
    label: 'Hệ thống',
    items: [
      { href: '/account',          label: 'Tài khoản',         Icon: User },
      { href: '/notifications',    label: 'Thông báo',         Icon: Bell },
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
  const userName = user?.email?.split('@')[0] || 'Khách'
  const userRole = !user ? '' : user.role === 'admin' ? 'Quản lý' : 'Telesale'

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
