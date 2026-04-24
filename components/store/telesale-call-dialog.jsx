import { cloneElement, isValidElement, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getStorePhoneNumbers } from '@/helper/validation'

function buildTelHref(phone) {
  return `tel:${String(phone || '').replace(/[^0-9+]/g, '')}`
}

export default function TelesaleCallDialog({ store, trigger }) {
  const phoneNumbers = getStorePhoneNumbers(store)
  const [open, setOpen] = useState(false)

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen)
  }

  const startPhoneCall = (phone) => {
    if (!phone) return
    const href = buildTelHref(phone)
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  const handleTriggerClick = (event) => {
    event.preventDefault()
    event.stopPropagation()
    event.nativeEvent?.stopImmediatePropagation?.()

    if (phoneNumbers.length === 0) return
    if (phoneNumbers.length === 1) {
      startPhoneCall(phoneNumbers[0])
      return
    }

    setOpen(true)
  }

  const handleSelectPhone = (phone) => {
    setOpen(false)
    startPhoneCall(phone)
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
    <DialogContent className="max-w-md w-[calc(100%-2rem)] max-h-[90vh] overflow-hidden rounded-xl p-0 z-[310]">
          <div className="border-b border-gray-800 px-4 py-3">
            <DialogTitle className="text-base font-semibold text-gray-100">Chọn số để gọi</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-gray-400">
              {store?.name}
            </DialogDescription>
          </div>

          <div className="space-y-3 px-4 py-4">
            {phoneNumbers.map((phone, index) => (
              <Button
                key={`call-phone-${phone}-${index}`}
                type="button"
                className="w-full"
                onClick={() => handleSelectPhone(phone)}
              >
                {phoneNumbers.length > 1 ? `Số ${index + 1}: ` : ''}{phone}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
