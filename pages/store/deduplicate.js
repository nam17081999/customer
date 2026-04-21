import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getOrRefreshStores, updateStoreInCache, invalidateStoreCache } from '@/lib/storeCache'
import { haversineKm } from '@/helper/distance'
import { extractWords, isSimilarNameByWords, containsAllInputWords } from '@/helper/duplicateCheck'
import { parseCoordinate } from '@/helper/coordinate'
import { formatAddressParts } from '@/lib/utils'

export default function DeduplicatePage() {
  const router = useRouter()
  const { isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {}
  const [pageReady, setPageReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [clusters, setClusters] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [actionLoading, setActionLoading] = useState({})

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      setPageReady(false)
      void router.replace('/login?from=/store/deduplicate').catch(() => {})
      return
    }
    if (!isAdmin) {
      setPageReady(false)
      void router.replace('/account').catch(() => {})
      return
    }
    setPageReady(true)
  }, [authLoading, isAuthenticated, isAdmin, router])

  const handleScan = useCallback(async () => {
    setLoading(true)
    setError('')
    setMessage('')
    setClusters([])

    try {
      // Small timeout to allow UI to render spinner before main thread blocking
      await new Promise(r => setTimeout(r, 50)) 

      const allStores = await getOrRefreshStores()
      const activeStores = allStores.filter(s => !s.deleted_at)

      const foundClusters = []
      const mergedSet = new Set()

      for (let i = 0; i < activeStores.length; i++) {
        if (mergedSet.has(activeStores[i].id)) continue

        const storeA = activeStores[i]
        const latA = parseCoordinate(storeA.latitude)
        const lngA = parseCoordinate(storeA.longitude)
        const nameAWords = extractWords(storeA.name || '')
        
        const currentCluster = [storeA]

        for (let j = i + 1; j < activeStores.length; j++) {
          if (mergedSet.has(activeStores[j].id)) continue
          const storeB = activeStores[j]
          
          let isMatch = false

          // Distance check
          if (Number.isFinite(latA) && Number.isFinite(lngA)) {
            const latB = parseCoordinate(storeB.latitude)
            const lngB = parseCoordinate(storeB.longitude)
            if (Number.isFinite(latB) && Number.isFinite(lngB)) {
              const distance = haversineKm(latA, lngA, latB, lngB)
              if (distance <= 0.1 && isSimilarNameByWords(nameAWords, storeB.name)) {
                isMatch = true
              }
            }
          }

          // Global exact match check
          if (!isMatch) {
            if (containsAllInputWords(nameAWords, storeB.name) && containsAllInputWords(extractWords(storeB.name || ''), storeA.name)) {
              isMatch = true
            }
          }

          // Phone exact match check
          if (!isMatch && storeA.phone && storeB.phone) {
             let pA1 = (storeA.phone || '').trim()
             let pA2 = (storeA.phone_secondary || '').trim()
             let pB1 = (storeB.phone || '').trim()
             let pB2 = (storeB.phone_secondary || '').trim()

             const phonesA = [pA1, pA2].filter(Boolean)
             const phonesB = [pB1, pB2].filter(Boolean)

             if (phonesA.some(pa => phonesB.includes(pa))) {
                isMatch = true
             }
          }

          if (isMatch) {
            currentCluster.push(storeB)
            mergedSet.add(storeB.id)
          }
        }

        if (currentCluster.length > 1) {
          foundClusters.push(currentCluster)
        }
      }

      setClusters(foundClusters)
      if (foundClusters.length === 0) {
        setMessage('Hệ thống đang sạch sẽ, không tìm thấy trùng lặp!')
      }
    } catch (err) {
      console.error(err)
      setError('Quá trình quét thất bại.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleMerge = async (clusterIndex, primaryStoreId) => {
    const cluster = clusters[clusterIndex]
    const primaryStore = cluster.find(s => s.id === primaryStoreId)
    const secondaryStores = cluster.filter(s => s.id !== primaryStoreId)

    if (!primaryStore || secondaryStores.length === 0) return

    setActionLoading(prev => ({ ...prev, [primaryStoreId]: true }))
    setError('')
    setMessage('')

    try {
      // 1. Prepare merged data for primary store
      const updatesTemp = {}
      const fieldsToMerge = ['address_detail', 'ward', 'district', 'note'] // text fields
      
      fieldsToMerge.forEach(field => {
         if (!primaryStore[field]) {
            const secondaryWithVal = secondaryStores.find(s => s[field])
            if (secondaryWithVal) updatesTemp[field] = secondaryWithVal[field]
         }
      })

      // phone merging
      const allPhones = new Set([primaryStore.phone, primaryStore.phone_secondary].filter(Boolean))
      secondaryStores.forEach(s => {
         if (s.phone) allPhones.add(s.phone)
         if (s.phone_secondary) allPhones.add(s.phone_secondary)
      })
      const phonesArr = Array.from(allPhones)
      if (!primaryStore.phone && phonesArr.length > 0) updatesTemp.phone = phonesArr[0]
      if (!primaryStore.phone_secondary && phonesArr.length > 1) {
         if (updatesTemp.phone !== phonesArr[1]) updatesTemp.phone_secondary = phonesArr[1]
      }

      // location merging - treat lat/lng as a pair; validate both before using
      if (!Number.isFinite(parseCoordinate(primaryStore.latitude)) || !Number.isFinite(parseCoordinate(primaryStore.longitude))) {
         const secWithLoc = secondaryStores.find(s =>
           Number.isFinite(parseCoordinate(s.latitude)) && Number.isFinite(parseCoordinate(s.longitude))
         )
         if (secWithLoc) {
            updatesTemp.latitude = secWithLoc.latitude
            updatesTemp.longitude = secWithLoc.longitude
         }
      }

      // image merging
      if (!primaryStore.image_url) {
         const secWithImg = secondaryStores.find(s => s.image_url)
         if (secWithImg) {
            updatesTemp.image_url = secWithImg.image_url
         }
      }

      // 2. Perform DB Updates
      const timestamp = new Date().toISOString()
      
      if (Object.keys(updatesTemp).length > 0) {
         const { error: pErr } = await supabase.from('stores').update({...updatesTemp, updated_at: timestamp}).eq('id', primaryStore.id)
         if (pErr) throw pErr
         await updateStoreInCache(primaryStore.id, updatesTemp)
      }

      const secondaryIds = secondaryStores.map(s => s.id)
      const { error: xErr } = await supabase.from('stores').update({ deleted_at: timestamp, updated_at: timestamp }).in('id', secondaryIds)
      if (xErr) throw xErr

      await invalidateStoreCache()

      // UI Reaction
      setClusters(prev => prev.filter((_, idx) => idx !== clusterIndex))
      setMessage('Hợp nhất thành công và đã xóa các bản nháp phụ.')
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('storevis:stores-changed', {
            detail: { type: 'merge_deduplicate' },
          })
        )
      }

    } catch(err) {
      console.error(err)
      setError('Hợp nhất thất bại, vui lòng kiểm tra kết nối mạng.')
    } finally {
      setActionLoading(prev => ({ ...prev, [primaryStoreId]: false }))
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black">
        <div className="max-w-screen-md mx-auto px-3 sm:px-4 py-6">
          <p className="text-sm text-gray-400">Đang kiểm tra đăng nhập...</p>
        </div>
      </div>
    )
  }

  if (!pageReady) return null

  return (
    <>
      <Head>
        <title>Gộp Cửa Hàng - NPP Hà Công</title>
      </Head>

      <div className="min-h-screen bg-black">
        <div className="max-w-screen-md mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
          <Card className="rounded-2xl border border-gray-800">
            <CardContent className="p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-gray-100">Gộp Dữ Liệu Trùng Lặp</h1>
                  <p className="text-sm text-gray-400">Tìm và hợp nhất các cửa hàng trùng tên/vị trí</p>
                </div>
                <Button 
                   type="button" 
                   size="sm" 
                   className="w-full sm:w-auto"
                   onClick={handleScan} 
                   disabled={loading}
                >
                  {loading ? 'Đang quét...' : 'Quét toàn hệ thống'}
                </Button>
              </div>

              {error && (
                <div className="rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-sm text-red-300">
                  {error}
                </div>
              )}
              {message && (
                <div className="rounded-lg border border-green-900 bg-green-950/30 px-3 py-2 text-sm text-green-300">
                  {message}
                </div>
              )}
            </CardContent>
          </Card>

          {clusters.length > 0 && (
             <div className="rounded-xl bg-amber-950/30 border border-amber-900 p-3 mb-4">
               <p className="text-sm text-amber-200">Phát hiện {clusters.length} nhóm cơ sở nghi trùng nhau.</p>
             </div>
          )}

          <div className="space-y-6">
            {clusters.map((cluster, cIndex) => {
               const isLoading = cluster.some(s => actionLoading[s.id])
               return (
                  <div key={cIndex} className="p-3 bg-gray-900/40 rounded-xl border border-gray-800 space-y-3">
                     <div className="text-sm font-semibold text-gray-300">Nhóm {cIndex + 1}</div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {cluster.map((store) => {
                           return (
                              <Card key={store.id} className="rounded-xl border border-gray-700 bg-black">
                                 <CardContent className="p-3 space-y-2 relative">
                                    <h3 className="font-semibold text-gray-100 text-base break-words pr-20">{store.name}</h3>
                                    <p className="text-xs text-gray-400 truncate">{formatAddressParts(store)}</p>
                                    <p className="text-xs text-gray-400">SĐT: {store.phone || 'Chưa có'}</p>
                                    <p className="text-xs text-gray-400">
                                       Tọa độ: {Number.isFinite(parseCoordinate(store.latitude)) ? 'Có' : 'Bị thiếu'}
                                    </p>
                                    
                                    <Button 
                                       size="sm" 
                                       className="w-full mt-2" 
                                       disabled={isLoading}
                                       onClick={() => handleMerge(cIndex, store.id)}
                                    >
                                       Gộp vào đây
                                    </Button>
                                 </CardContent>
                              </Card>
                           )
                        })}
                     </div>
                  </div>
               )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
