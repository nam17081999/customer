'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { Bell, Package } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { getCachedFeed, loadFeed, markFeedRead, markAllFeedRead, refreshUnreadCount } from '@/lib/notification-store'

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

export default function NotificationsPage() {
  const router = useRouter()
  const { isAdmin } = useAuth() || {}
  const [feed, setFeed] = useState(() => getCachedFeed())
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(true)
  const itemRefs = useRef({})
  const observerRef = useRef(null)

  // Redirect non-admin users
  useEffect(() => {
    if (isAdmin === false) {
      router.replace('/')
    }
  }, [isAdmin, router])

  // Load feed from API if cache is empty
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

  // IntersectionObserver: mark unread items as read when scrolled into view
  useEffect(() => {
    if (feed.length === 0) return

    const unread = feed.filter(e => !e.is_read)
    if (unread.length === 0) return

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

  const stockItems = feed.filter(e => e.type === 'low-stock').slice(0, 50)
  const reportItems = feed.filter(e => e.type !== 'low-stock').slice(0, 50)
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
        className={`relative group flex items-start gap-2.5 px-4 py-3 transition-colors border-l-2 ${colorBorder} ${
          isUnread ? '' : 'opacity-50'
        } hover:bg-white/[0.04]`}
      >
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-snug ${isUnread ? 'text-white' : 'text-gray-500'}`}>
            {entry.title}
          </p>
          <p className={`text-xs leading-snug mt-0.5 ${isUnread ? 'text-gray-500' : 'text-gray-600'}`}>
            {entry.detail}
          </p>
          <p className="text-[11px] text-gray-600/60 mt-0.5">
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

  // Don't render while checking auth
  if (!isAdmin) return null

  return (
    <div className="mx-auto max-w-2xl px-0 sm:px-4 py-0 sm:py-6">
      <div className="min-h-screen sm:min-h-0 sm:rounded-xl border-0 sm:border border-gray-800 bg-black sm:bg-gray-950/98">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-black/95 sm:bg-transparent backdrop-blur-md border-b border-white/5 px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="size-4 sm:size-5 text-gray-400" />
              <h1 className="text-sm sm:text-base font-semibold text-white">Thông báo</h1>
            </div>
            {(anyInventory || anyReports) && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs sm:text-sm text-[color:var(--primary)] hover:opacity-80 transition-opacity cursor-pointer"
              >
                Đã đọc tất cả
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="pb-20 sm:pb-4">
          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-gray-500">
              <svg className="mx-auto mb-2 size-5 animate-spin text-gray-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Đang tải…
            </div>
          ) : !anyInventory && !anyReports ? (
            <div className="px-4 py-12 text-center text-sm text-gray-500">
              <Bell className="mx-auto mb-1.5 size-5 sm:size-6 text-gray-600" />
              Không có thông báo
            </div>
          ) : (
            <>
              {anyInventory && (
                <div className="mb-1">
                  <div className="flex items-center gap-1.5 px-4 pl-[14px] py-2">
                    <Package className="size-3.5 sm:size-4 text-amber-400" />
                    <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-amber-400/80">
                      Hàng tồn ({stockItems.length})
                    </span>
                  </div>
                  {stockItems.map(renderEntry)}
                </div>
              )}

              {anyReports && (
                <div>
                  <div className="flex items-center gap-1.5 px-4 pl-[14px] py-2 border-t border-white/5">
                    <svg className="size-3.5 sm:size-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 01-3.46 0" />
                    </svg>
                    <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-red-400/80">
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
    </div>
  )
}
