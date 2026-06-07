'use client'

/**
 * Test script: thực hiện create store thật + kiểm tra notification delivery.
 * Chạy trong browser console hoặc qua bookmarklet.
 *
 * Usage: copy-paste vào DevTools console.
 */

;(async function testNotification() {
  const supabase = window.__NEXT_DATA__?.props?.pageProps?.supabase
    || (await import('@supabase/supabase-js')).createClient(
      'https://qvzdwqbxkkxidshntacz.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2emR3cWJ4a2t4aWRzaG50YWN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyNTEyMDMsImV4cCI6MjA2MTgyNzIwM30._bX6VWPHj5XpHPB8ZAFiBzwJ4I7c_x-jR5LZFkMhrR0'
    )

  const { createClient } = await import('@supabase/supabase-js')

  if (typeof window === 'undefined') {
    console.error('Chạy script này trong browser console')
    return
  }

  console.log('🧪 === TEST NOTIFICATION SYSTEM ===')

  // 1. Check localStorage log
  const log = JSON.parse(localStorage.getItem('storev…-log') || '[]')
  console.log(`📋 Notification log hiện tại: ${log.length} entries`)
  log.forEach((e, i) => console.log(`  ${i+1}. [${e.read?'✅':'⬜'}] ${e.title}: ${e.detail}`))

  // 2. Check Realtime subscriptions
  console.log('🔌 Đang kiểm tra Realtime connection...')

  const channel = supabase
    .channel('test-channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stores' }, (payload) => {
      console.log('📡 REALTIME RECEIVED:', payload.new)
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'store_reports' }, (payload) => {
      console.log('📡 REALTIME RECEIVED store_reports:', payload.new)
    })
    .subscribe((status) => {
      console.log('📡 Realtime channel status:', status)
    })

  // Wait 2s for subscription to establish
  await new Promise(r => setTimeout(r, 2000))

  // 3. Create a test store
  const testStore = {
    name: `Test Store ${Date.now()}`,
    store_type: 'temporary',
    address_detail: 'Test address',
    ward: null,
    district: null,
    active: true,
    is_potential: false,
    note: 'Notification test - sẽ xoá sau',
    phone: null,
    latitude: 21.0,
    longitude: 105.8,
  }

  console.log('🏪 Đang tạo cửa hàng test...')
  const { data: store, error: createError } = await supabase
    .from('stores')
    .insert([testStore])
    .select()

  if (createError) {
    console.error('❌ Lỗi tạo cửa hàng:', createError)
    channel.unsubscribe()
    return
  }

  const storeId = store[0].id
  console.log(`✅ Đã tạo store ${storeId}: "${store[0].name}"`)

  // 4. Wait for Realtime + polling (wait 5s)
  console.log('⏳ Đợi 5s cho Realtime delivery...')
  await new Promise(r => setTimeout(r, 5000))

  // 5. Check if notification was logged
  const logAfter = JSON.parse(localStorage.getItem('storev…-log') || '[]')
  console.log(`\n📋 Log sau tạo: ${logAfter.length} entries`)
  logAfter.forEach((e, i) => console.log(`  ${i+1}. [${e.read?'✅':'⬜'}] ${e.title}: ${e.detail}`))

  const found = logAfter.find(e => e.id && e.id.startsWith('sv-') && e.detail.includes(store[0].name))
  if (found) {
    console.log(`\n✅ THÀNH CÔNG! Notification log có entry store-verify:`)
    console.log(`  ID: ${found.id}`)
    console.log(`  Title: ${found.title}`)
    console.log(`  Detail: ${found.detail}`)
    console.log(`  Timestamp: ${new Date(found.timestamp).toLocaleString('vi-VN')}`)
  } else {
    console.log(`\n❌ THẤT BẠI! Không tìm thấy notification cho store "${store[0].name}"`)
    console.log('Kiểm tra Realtime có được enable trên stores table trong Supabase dashboard không.')
    console.log('Hoặc polling 30s chưa kịp chạy.')
  }

  // 6. Clean up test store
  console.log('🧹 Đang xoá store test...')
  const { error: delError } = await supabase
    .from('stores')
    .delete()
    .eq('id', storeId)

  if (delError) {
    console.error('⚠️ Lỗi xoá store:', delError)
  } else {
    console.log(`✅ Đã xoá store ${storeId}`)
  }

  channel.unsubscribe()
  console.log('🏁 === TEST COMPLETE ===')
})()
