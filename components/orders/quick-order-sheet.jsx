import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getOrRefreshStores } from '@/lib/storeCache'
import removeVietnameseTones from '@/helper/removeVietnameseTones'

function matchStore(store, q) {
  if (!q) return true
  const norm = removeVietnameseTones(String(q || '')).toLowerCase()
  const hay = [store.name, store.phone, store.phone_secondary, store.address].filter(Boolean).join(' ')
  return removeVietnameseTones(hay).toLowerCase().includes(norm)
}

export default function QuickOrderSheet({ initialStoreId = '', onStart }) {
  const router = useRouter()
  const [stores, setStores] = useState([])
  const [query, setQuery] = useState('')
  const [selectedStoreId, setSelectedStoreId] = useState(initialStoreId)
  const [sku, setSku] = useState('')
  const [qty, setQty] = useState(1)

  useEffect(() => {
    let active = true
    getOrRefreshStores().then((rows) => {
      if (!active) return
      setStores(rows || [])
    }).catch(() => {})
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => stores.filter((s) => matchStore(s, query)).slice(0, 12), [stores, query])

  const handleStart = () => {
    const params = new URLSearchParams()
    if (selectedStoreId) params.set('storeId', String(selectedStoreId))
    if (sku) params.set('prefillSku', String(sku))
    if (qty) params.set('prefillQty', String(qty))
    const url = `/orders/new?${params.toString()}`
    if (typeof onStart === 'function') onStart({ storeId: selectedStoreId, sku, qty })
    router.push(url)
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium text-gray-300">Khách hàng</label>
        <Input placeholder="Tìm tên hoặc SĐT" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="max-h-44 overflow-auto mt-2 space-y-1">
          {filtered.map((s) => (
            <button key={s.id} type="button" onClick={() => setSelectedStoreId(s.id)} className={`w-full text-left rounded-md px-3 py-2 ${String(selectedStoreId) === String(s.id) ? 'bg-primary/10 border border-primary text-primary' : 'bg-gray-900 hover:bg-gray-800'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-sm text-gray-400">{s.phone || s.phone_secondary || ''}</div>
                </div>
                <div className="text-sm text-gray-400">{s.address || ''}</div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-sm text-gray-500">Không tìm thấy khách hàng.</div>
          )}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-300">Mã sản phẩm (SKU)</label>
        <Input placeholder="VD: HC-TST-001" value={sku} onChange={(e) => setSku(e.target.value)} />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-300">Số lượng</label>
        <Input type="number" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))} />
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.push('/orders')}>Hủy</Button>
        <Button variant="primary" onClick={handleStart} disabled={!selectedStoreId && !sku}>Bắt đầu</Button>
      </div>
    </div>
  )
}
