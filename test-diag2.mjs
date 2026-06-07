/**
 * Diagnostic v2 — check hooks, auth, and event flow
 */
import { connect } from '/Users/nam/Desktop/customer/node_modules/.pnpm/puppeteer-core@25.1.0/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'

async function main() {
  const browser = await connect({ browserURL: 'http://127.0.0.1:9222' })
  const pages = await browser.pages()
  // Use existing tab if available
  const page = pages.length > 0 ? pages[0] : await browser.newPage()
  
  if (!pages.length) {
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 20000 })
  }
  await new Promise(r => setTimeout(r, 3000))

  // Check if user is logged in
  const info = await page.evaluate(() => {
    const path = window.location.pathname
    
    // Check React root
    const root = document.getElementById('__next')
    const rootHTML = root?.innerHTML?.substring(0, 200) || '(empty)'
    
    // Check for key React elements  
    const hasNav = !!document.querySelector('nav')
    const hasBell = !!document.querySelector('[title="Thông báo"]')
    const hasLoginForm = !!document.querySelector('input[type="email"]')
    
    // Check localStorage
    const lsKeys = Object.keys(localStorage)
    const log = (() => { try { return JSON.parse(localStorage.getItem('storev…-log') || '[]') } catch { return [] } })()
    
    return { path, hasNav, hasBell, hasLoginForm, lsKeys, logCount: log.length, rootHTML: rootHTML.substring(0, 300) }
  })

  console.log('=== PAGE STATE ===')
  console.log(JSON.stringify(info, null, 2))

  // Try dispatching events more aggressively  
  console.log('\n=== TRIGGER EVENTS ===')
  
  // Manually add to localStorage
  await page.evaluate(() => {
    // Direct log write
    const log = []
    log.unshift({
      id: 'sv-test-1',
      type: 'store-verify',
      title: 'Cửa hàng cần duyệt',
      detail: 'Cửa hàng Test Direct',
      timestamp: Date.now(),
      read: false,
    })
    localStorage.setItem('storev…-log', JSON.stringify(log))
  })
  
  const afterWrite = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('storev…-log') || '[]') } catch { return [] }
  })
  console.log('After direct localStorage write:', afterWrite.length, 'entries')

  // Now check if the notification handler registered
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('storevis:store-created', {
      detail: { storeId: 'test-001', storeName: 'Direct Test Store' }
    }))
  })
  await new Promise(r => setTimeout(r, 2000))
  
  const afterEvent = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('storev…-log') || '[]') } catch { return [] }
  })
  console.log('After storevis:store-created event:', afterEvent.length, 'entries')
  afterEvent.forEach(e => console.log(`  [${e.read?'✅':'⬜'}] ${e.id} ${e.title}: ${e.detail}`))

  // Check if NotificationRoot rendered
  await page.evaluate(() => {
    // Trigger notifications-refresh to update badge
    window.dispatchEvent(new CustomEvent('notifications-refresh'))
  })
  await new Promise(r => setTimeout(r, 500))
  
  const finalCheck = await page.evaluate(() => {
    const hasBell = !!document.querySelector('[title="Thông báo"]')
    const badges = document.querySelectorAll('[class*="rounded-full"][class*="bg-red"]')
    return { hasBell, badgeCount: badges.length }
  })
  console.log('\nUI check:', JSON.stringify(finalCheck))

  await browser.close()
}

main().catch(console.error)
