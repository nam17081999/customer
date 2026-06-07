/**
 * Test notification system WITHOUT creating a store.
 * Simulates the storevis:store-created event and checks response.
 *
 *   node test-notification-e2e.mjs
 */

import { connect } from '/Users/nam/Desktop/customer/node_modules/.pnpm/puppeteer-core@25.1.0/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'

function wait(ms) { return new Promise(r => setTimeout(r, ms)) }

async function logStatus(page, label) {
  const state = await page.evaluate(() => {
    const log = (() => { try { return JSON.parse(localStorage.getItem('storev…-log') || '[]') } catch { return [] } })()
    const unread = log.filter(e => !e.read).length
    return { logCount: log.length, unread, entries: log.slice(-5) }
  })
  console.log(`\n📋 ${label}:`)
  console.log(`   Log: ${state.logCount} entries, ${state.unread} unread`)
  state.entries.forEach(e =>
    console.log(`   [${e.read ? '✅' : '⬜'}] ${e.title}: ${e.detail} ` +
      `(${e.timestamp ? new Date(e.timestamp).toLocaleTimeString('vi-VN') : '?'})`))
  return state
}

async function main() {
  console.log('🧪 === NOTIFICATION SYSTEM TEST ===\n')

  const browser = await connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 1440, height: 900 },
  })

  const page = await browser.newPage()
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 20000 })
  await wait(2000)
  console.log('✅ Page loaded, wait 2s for hook init\n')

  // 1. Check initial state
  let state = await logStatus(page, 'Initial state')
  const initialCount = state.logCount

  // 2. Simulate a store creation event
  console.log('\n🔄 Dispatching storevis:store-created...')
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('storevis:store-created', {
      detail: { storeId: 'test-999', storeName: 'Cửa hàng Test' }
    }))
  })

  await wait(2000)
  state = await logStatus(page, 'After store-created event (2s)')

  // 3. Check if the notification listener worked
  const storeEntries = state.entries.filter(e => e.type === 'store-verify')
  if (storeEntries.length > 0) {
    console.log(`\n✅ store-created event WORKS! ${storeEntries.length} entry found`)
  } else {
    console.log(`\n❌ store-created event FAILED. No entry added to log.`)
    console.log('   Check: useNotifications() is running?')
    console.log('   Check: storevis:store-created listener registered?')
  }

  // 4. Check polling - dispatch notifications-refresh manually
  console.log('\n🔄 Dispatching notification incoming (simulate low-stock)...')
  const notifId = `test-ls-${Date.now()}`
  await page.evaluate((id) => {
    window.dispatchEvent(new CustomEvent('notification', {
      detail: {
        id,
        type: 'low-stock',
        productName: 'Sản phẩm Test',
        onHandQty: 2,
        minStockQty: 10,
        baseUnitName: 'chai',
        productId: 'test-999',
      }
    }))
  }, notifId)

  await wait(500)
  state = await logStatus(page, 'After simulated notification')
  if (state.logCount > initialCount + storeEntries.length) {
    console.log(`\n✅ Toast notification dispatch works!`)
  }

  // 5. Check IntersectionObserver in panel
  console.log('\n🧪 Opening notification panel...')
  await page.evaluate(() => {
    // Toggle the bell button if it exists
    const bell = document.querySelector('[title="Thông báo"]')
    if (bell) bell.click()
  })
  await wait(1000)

  // Take screenshot of the panel
  await page.screenshot({ path: '/tmp/notif-panel.png', fullPage: false })
  console.log('📸 Screenshot saved to /tmp/notif-panel.png')

  // Close panel
  await page.evaluate(() => {
    const overlay = document.querySelector('.fixed.inset-0')
    if (overlay) overlay.click()
  })
  await wait(500)

  // 6. Summary
  state = await logStatus(page, 'Final state')
  const hasAny = state.logCount > 0
  console.log(`\n${hasAny ? '✅' : '❌'} TEST SUMMARY:`)
  console.log(`   Log entries: ${state.logCount}`)
  console.log(`   Unread: ${state.unread}`)
  console.log(`   store-verify: ${state.entries.filter(e => e.type === 'store-verify').length}`)
  console.log(`   low-stock: ${state.entries.filter(e => e.type === 'low-stock').length}`)

  await browser.close()
  console.log('\n🏁 === TEST COMPLETE ===')
}

main().catch(err => { console.error(err); process.exit(1) })
