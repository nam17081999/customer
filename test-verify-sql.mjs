import { connect } from '/Users/nam/Desktop/customer/node_modules/.pnpm/puppeteer-core@25.1.0/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'

async function main() {
  const browser = await connect({ browserURL: 'http://127.0.0.1:9222' })
  const [page] = await browser.pages()

  // Check if table exists via REST
  const result = await page.evaluate(() => {
    return fetch(
      'https://qvzdwqbxkkxidshntacz.supabase.co/rest/v1/notification_log?limit=1',
      {
        headers: {
          'apikey': 'eyJhbG…hrR0',
          'Authorization': 'Bearer eyJhbG…hrR0',
        },
      },
    ).then(async r => {
      const text = await r.text()
      return { status: r.status, body: text.substring(0, 200) }
    }).catch(e => ({ error: e.message }))
  })

  console.log('Check notification_log table:', JSON.stringify(result, null, 2))

  if (result.status === 200) {
    console.log('\n✅ Bảng notification_log tồn tại!')
  } else if (result.status === 404) {
    console.log('\n❌ Bảng notification_log CHƯA tồn tại. Cần apply SQL.')
    console.log('Khởi động Docker rồi chạy: cd ~/Desktop/customer && supabase db push')
  } else {
    console.log(`\n⚠️ Status ${result.status} — cần kiểm tra thêm`)
  }

  await browser.close()
}

main().catch(console.error)
