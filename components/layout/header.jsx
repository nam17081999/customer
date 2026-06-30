'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { Bell, Package } from 'lucide-react'
import { loadFeed, markFeedRead, markAllFeedRead, getCachedFeed, refreshUnreadCount } from '@/lib/notification-store'

function formatTimestamp(ts) {
  if (!ts) return ''
  const date = new Date(ts)
  const now = new Date()
  const diff = now - date
  if (diff < 60000) return 'Vừa xong'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function Header({ title, subtitle, onMenuClick }) {
  const { user, isAdmin } = useAuth() || {}
  const userName = user?.email?.split('@')[0] || 'K'
  const initial = userName.charAt(0).toUpperCase()
  const [notifOpen, setNotifOpen] = useState(false)
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(false)
  const [badgeCount, setBadgeCount] = useState(0)
  const closeRef = useRef(() => setNotifOpen(false))
  const itemRefs = useRef({})

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    let unsub

    const init = () => {
      const cached = getCachedFeed()
      if (cached.length > 0) {
        setFeed(cached)
        setBadgeCount(cached.filter(e => !e.is_read).length)
      }
      import('@/lib/notification-store').then(({ subscribeUnreadCount }) => {
        unsub = subscribeUnreadCount((total) => {
          if (!cancelled) setBadgeCount(total)
        })
      })
    }
    init()
    return () => { cancelled = true; if (unsub) unsub() }
  }, [isAdmin])

  useEffect(() => {
    if (!notifOpen || !isAdmin) return
    let cancelled = false
    setLoading(true)
    loadFeed().then((entries) => {
      if (!cancelled) { setFeed(entries || []); setLoading(false) }
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [notifOpen, isAdmin])

  const handleMarkRead = useCallback(async (id) => {
    await markFeedRead(id)
    setFeed(getCachedFeed())
    refreshUnreadCount()
  }, [])

  const handleMarkAllRead = useCallback(async () => {
    await markAllFeedRead()
    setFeed(getCachedFeed())
    refreshUnreadCount()
  }, [])

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
    <header className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
      <button
        onClick={onMenuClick}
        className="hamburger-header"
        aria-label="Mở menu"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <h2 className="text-xl font-bold text-[var(--fg)] mr-auto" style={{ letterSpacing: '-0.02em' }}>{title || ''}</h2>

      <div className="flex items-center gap-2">
        {/* Notification bell */}
        {isAdmin && (
          <div className="relative">
            <button
              onClick={() => setNotifOpen((o) => !o)}
              className="notif-btn"
              aria-label="Thông báo"
            >
              <Bell className="size-5" />
              {badgeCount > 0 && <span className="notif-dot" />}
            </button>

            {notifOpen && (
              <>
                <div className="fixed inset-0 z-[60]" onClick={() => setNotifOpen(false)} />
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
            )}
          </div>
        )}

        <button
          onClick={() => window.location.href = '/account'}
          className="avatar-sm"
          title={userName}
        >
          {initial}
        </button>
      </div>
    </header>
  )
}
