'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getLowStockItems } from '@/api/inventory/inventory-client'
import { getPendingReportItems } from '@/api/reports/report-stats-client'
import { loadFeed, getCachedFeed, appendToFeed, loadPreferences, refreshUnreadCount } from '@/lib/notification-store'

function feedId(prefix, uid) {
  return `${prefix}-${uid}`
}

async function newEntries(feed, stock, reports) {
  const existingIds = new Set(feed.map(e => e.id))
  const entries = []

  for (const item of stock) {
    const id = feedId('ls', item.productId)
    if (existingIds.has(id)) continue
    existingIds.add(id)
    entries.push({
      id, type: 'low-stock',
      title: '⚠️ Hàng sắp hết',
      detail: `${item.productName} chỉ còn ${item.onHandQty}/${item.minStockQty} ${item.baseUnitName}`,
      data: { productName: item.productName, onHandQty: item.onHandQty, minStockQty: item.minStockQty, baseUnitName: item.baseUnitName, productId: item.productId },
    })
  }

  for (const report of reports) {
    const id = feedId('rp', report.id)
    if (existingIds.has(id)) continue
    existingIds.add(id)
    entries.push({
      id, type: 'report',
      title: '🔔 Báo cáo chờ duyệt',
      detail: `${report.storeName || '—'} - ${report.title || 'Báo cáo'}`,
      data: { reportTitle: report.title || 'Báo cáo', reportId: report.id, storeName: report.storeName || '' },
    })
  }

  return entries
}

async function insertBatch(entries) {
  if (entries.length === 0) return
  const { insertIntoFeed } = await import('@/api/notifications/notification-api-client')
  // Insert all concurrently
  await Promise.allSettled(entries.map(e => insertIntoFeed(e)))
  // Append to local cache (ko gọi API load lại)
  for (const entry of entries) {
    appendToFeed(entry)
  }
  refreshUnreadCount(true)
}

export function useNotifications(isAdmin) {
  useEffect(() => {
    if (!isAdmin) return
    loadFeed()
    loadPreferences()
    refreshUnreadCount()
  }, [isAdmin])

  // Seed 1 lần
  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false

    async function seed() {
      const [stock, reports] = await Promise.all([
        getLowStockItems().catch(() => []),
        getPendingReportItems().catch(() => []),
      ])
      if (cancelled) return

      const feed = getCachedFeed().length > 0 ? getCachedFeed() : await loadFeed(50, 0)
      if (cancelled) return

      const entries = await newEntries(feed, stock, reports)
      await insertBatch(entries)
    }

    seed()
    return () => { cancelled = true }
  }, [isAdmin])

  // Realtime
  useEffect(() => {
    if (!isAdmin) return

    const channel = supabase
      .channel('notifications-realtime-v3')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'product_stock' },
        async () => {
          try {
            const feed = getCachedFeed()
            const stock = await getLowStockItems().catch(() => [])
            const entries = await newEntries(feed, stock, [])
            if (entries.length > 0) await insertBatch(entries)
          } catch (e) {
            console.warn('[notifications] realtime stock handler failed:', e)
          }
        },
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'store_reports' },
        async (payload) => {
          try {
            const feed = getCachedFeed()
            const existingIds = new Set(feed.map(e => e.id))
            const id = feedId('rp', payload.new.id)
            if (!existingIds.has(id)) {
              await insertBatch([{
                id, type: 'report',
                title: '🔔 Báo cáo chờ duyệt',
                detail: `${payload.new.storeName || '—'} - ${payload.new.title || 'Báo cáo'}`,
                data: { reportTitle: payload.new.title || 'Báo cáo', reportId: payload.new.id, storeName: payload.new.storeName || '' },
              }])
            }
          } catch (e) {
            console.warn('[notifications] realtime report handler failed:', e)
          }
        },
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stores' },
        async (payload) => {
          try {
            const storeName = payload.new?.name || 'Cửa hàng mới'
            const id = feedId('sv', payload.new.id)
            await insertBatch([{
              id, type: 'store-verify',
              title: '🏪 Cửa hàng mới',
              detail: `Cửa hàng ${storeName} cần được duyệt`,
              data: { storeName, storeId: payload.new.id },
            }])
          } catch (e) {
            console.warn('[notifications] realtime store handler failed:', e)
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [isAdmin])
}
