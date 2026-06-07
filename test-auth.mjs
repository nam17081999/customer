import { connect } from '/Users/nam/Desktop/customer/node_modules/.pnpm/puppeteer-core@25.1.0/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'

async function wait(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  const browser = await connect({ browserURL: 'http://127.0.0.1:9222' })
  const pages = await browser.pages()
  const page = pages[0] || await browser.newPage()
  
  if (!pages.length) {
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 20000 })
  }
  await wait(3000)

  // Check auth
  const status = await page.evaluate(() => {
    const bell = !!document.querySelector('[title="Thông báo"]')
    return { path: window.location.pathname, hasBell: bell }
  })
  
  if (!status.hasBell) {
    console.log('🔐 Not logged in. Navigating to /login...')
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0', timeout: 15000 })
    await wait(2000)
    
    // Stop here — user needs to login manually
    console.log('⚠️ Cannot auto-login (no password).')
    console.log('   Please LOGIN manually in the browser tab, then press Enter.')
    await new Promise(r => process.stdin.once('data', r))
    
    await wait(2000)
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 15000 })
    await wait(3000)
  }
  
  // Now logged in
  const auth = await page.evaluate(() => {
    const bell = !!document.querySelector('[title="Thông báo"]')
    const log = (() => { try { return JSON.parse(localStorage.getItem('storev…-log') || '[]') } catch { return [] } })()
    return { path: window.location.pathname, hasBell: bell, logCount: log.length, log: log.slice(-5) }
  })
  
  console.log('📋 Auth state:', JSON.stringify(auth, null, 2))
  
  if (!auth.hasBell) {
    console.log('❌ Still no bell. Something wrong.')
    await browser.close()
    return
  }
  
  console.log('\n✅ Bell visible — user is admin!')
  
  // Test store-created event
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('storevis:store-created', {
      detail: { storeId: 'test-admin-1', storeName: 'Admin Test Store' }
    }))
  })
  await wait(2000)
  
  const after = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('storev…-log') || '[]') } catch { return [] }
  })
  console.log(`\n📋 Logs after event (${after.length} total):`)
  after.forEach(e => console.log(`  [${e.read?'✅':'⬜'}] ${e.id} ${e.title}: ${e.detail}`))

  const sv = after.find(e => e.type === 'store-verify')
  if (sv) {
    console.log('\n✅ store-created event WORKS!')
  } else {
    console.log('\n❌ Still not working. Event handler not registered.')
    
    // Check console errors
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
    await page.reload({ waitUntil: 'networkidle0', timeout: 15000 })
    await wait(5000)
    
    // Trigger again
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('storevis:store-created', {
        detail: { storeId: 'test-2', storeName: 'Store After Reload' }
      }))
    })
    await wait(3000)
    
    const final = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('storev…-log') || '[]') } catch { return [] }
    })
    console.log(`After reload + event: ${final.length} entries`)
    final.slice(-5).forEach(e => console.log(`  ${e.type}: ${e.detail}`))
    console.log('Console errors:', errors.slice(0, 5))
  }
  
  await browser.close()
}

main().catch(console.error)
