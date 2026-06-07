/**
 * Diagnostic test - capture console errors + check hooks
 */
import { connect } from '/Users/nam/Desktop/customer/node_modules/.pnpm/puppeteer-core@25.1.0/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'

async function main() {
  const browser = await connect({ browserURL: 'http://127.0.0.1:9222' })
  const page = await browser.newPage()

  // Capture console
  const errors = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('pageerror', err => errors.push(err.message))

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 20000 })
  await new Promise(r => setTimeout(r, 3000))

  console.log('=== CONSOLE ERRORS ===')
  errors.forEach(e => console.log(e))
  if (errors.length === 0) console.log('(none)')

  // Check if _app.js renders NotificationRoot
  const appCheck = await page.evaluate(() => {
    // Check if login page hides notification root
    const path = window.location.pathname
    // Check for notification store
    const log = (() => { try { return JSON.parse(localStorage.getItem('storev…-log') || '[]') } catch { return [] } })()
    // Check if auth is set
    return {
      path,
      logCount: log.length,
      logKeys: log.map(e => e.id),
      hasSupabase: typeof window.supabase !== 'undefined',
      nextData: !!window.__NEXT_DATA__,
      nextDataProp: window.__NEXT_DATA__?.props?.pageProps ? Object.keys(window.__NEXT_DATA__.props.pageProps).slice(0,5) : [],
    }
  })
  console.log('\n=== APP STATE ===')
  console.log(JSON.stringify(appCheck, null, 2))

  // Check localStorage directly
  const ls = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter(k => k.includes('storev') || k.includes('notif'))
    const vals = {}
    keys.forEach(k => { try { vals[k] = JSON.parse(localStorage.getItem(k)) } catch { vals[k] = localStorage.getItem(k) } })
    return { keys, vals, allKeys: Object.keys(localStorage) }
  })
  console.log('\n=== LOCALSTORAGE ===')
  console.log('Matching keys:', ls.keys)
  console.log('Values:', JSON.stringify(ls.vals, null, 2))
  console.log('All keys:', ls.allKeys)

  await browser.close()
}

main().catch(console.error)
