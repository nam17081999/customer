import { cloneElement, isValidElement, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { updateStoreInCache } from '@/lib/storeCache'

function buildTelHref(phone) {
  return `tel:${String(phone || '').replace(/[^0-9+]/g, '')}`
}

export default function TelesaleCallDialog({ store, trigger, onSaved }) {
  const router = useRouter()
  const { isAdmin, isTelesale } = useAuth() || {}
  const canTrackTelesale = isAdmin || isTelesale
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen)
    if (!nextOpen) setError('')
  }

  const startPhoneCall = () => {
    if (!store?.phone) return
    const href = buildTelHref(store.phone)
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  const markCallStarted = async () => {
    if (!canTrackTelesale || !store?.id) return true
    const nowIso = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('stores')
      .update({ last_called_at: nowIso, is_potential: true })
      .eq('id', store.id)

    if (updateError) {
      console.error(updateError)
      setError('Không lưu được thời gian gọi. Vui lòng thử lại.')
      return false
    }

    const nextStore = { ...store, last_called_at: nowIso, is_potential: true }
    await updateStoreInCache(store.id, { last_called_at: nowIso, is_potential: true })
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('storevis:stores-changed', {
          detail: { type: 'update', id: store.id, store: nextStore },
        }),
      )
    }

    onSaved?.(nextStore)
    return true
  }

  const handleTriggerClick = (event) => {
    event.preventDefault()
    event.stopPropagation()
    event.nativeEvent?.stopImmediatePropagation?.()

    if (!store?.phone) return
    if (!canTrackTelesale) {
      startPhoneCall()
      return
    }

    setError('')
    setOpen(true)
  }

  const handleCallOnly = () => {
    setOpen(false)
    startPhoneCall()
  }

  const handleCallToOrder = () => {
    if (!canTrackTelesale) {
      setOpen(false)
      startPhoneCall()
      return
    }

    const from = router.asPath || '/'
    setError('')
    setOpen(false)
    startPhoneCall()
    void markCallStarted()
    router.push(`/telesale/call/${store.id}?from=${encodeURIComponent(from)}`)
  }

  const triggerNode = isValidElement(trigger)
    ? cloneElement(trigger, {
        onClick: handleTriggerClick,
        onPointerDown: (event) => {
          event.stopPropagation()
        },
      })
    : null

  return (
    <>
      {triggerNode}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)] max-h-[90vh] overflow-hidden rounded-xl p-0">
          <div className="border-b border-gray-800 px-4 py-3">
            <DialogTitle className="text-base font-semibold text-gray-100">Chọn cách gọi</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-gray-400">
              {store?.name}
            </DialogDescription>
          </div>

          <div className="space-y-3 px-4 py-4">
            <Button type="button" className="w-full" onClick={handleCallOnly}>
              Chỉ gọi
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={handleCallToOrder}>
              Gọi lên đơn
            </Button>
            {error && (
              <div className="rounded-xl border border-red-900/70 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
