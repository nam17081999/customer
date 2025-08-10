import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/components/auth-context'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog'
import Image from 'next/image'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import imageCompression from 'browser-image-compression'

export default function StoreDetail() {
  const router = useRouter()
  const { id } = router.query
  const { user, loading } = useAuth()

  const [store, setStore] = useState(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    supabase
      .from('stores')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        setStore(data)
        if (data) {
          setName(data.name || '')
          setAddress(data.address || '')
          setPhone(data.phone || '')
          setNote(data.note || '')
        }
      })
  }, [id])

  function getOldFileNameFromUrl(url) {
    // Try to parse after '/object/public/stores/'
    try {
      const marker = '/object/public/stores/'
      const idx = url.indexOf(marker)
      if (idx !== -1) return url.substring(idx + marker.length)
      // fallback: last segment
      const u = new URL(url)
      const parts = u.pathname.split('/')
      return parts[parts.length - 1]
    } catch {
      return null
    }
  }

  async function onSave(e) {
    e.preventDefault()
    if (!user) {
      alert('Vui lòng đăng nhập để sửa cửa hàng')
      return
    }

    setSaving(true)

    // Get current location at submit time (fallback to old values if denied)
    let latitude = store?.latitude ?? null
    let longitude = store?.longitude ?? null
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject)
      )
      latitude = pos.coords.latitude
      longitude = pos.coords.longitude
    } catch (geoErr) {
      console.error('Không lấy được tọa độ khi cập nhật:', geoErr)
      alert('Ứng dụng cần quyền truy cập vị trí để lưu thay đổi. Vui lòng cấp quyền định vị cho trang này trong trình duyệt, rồi thử lại.')
      setSaving(false)
      return
    }

    let image_url = store?.image_url || null
    let newUploadedFile = null

    try {
      if (imageFile) {
        // compress before upload
        const options = {
          maxSizeMB: 0.35,
          maxWidthOrHeight: 1024,
          useWebWorker: true,
          initialQuality: 0.65,
          fileType: 'image/jpeg',
        }
        let fileToUpload = imageFile
        try {
          const compressed = await imageCompression(imageFile, options)
          fileToUpload = compressed
        } catch (cmpErr) {
          console.warn('Nén ảnh thất bại, dùng ảnh gốc:', cmpErr)
        }

        const ext = fileToUpload.type.includes('jpeg') ? 'jpg' : (imageFile.name.split('.').pop() || 'jpg')
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`
        const { error: upErr } = await supabase.storage.from('stores').upload(fileName, fileToUpload, { contentType: fileToUpload.type })
        if (upErr) throw upErr
        const { data } = supabase.storage.from('stores').getPublicUrl(fileName)
        image_url = data.publicUrl
        newUploadedFile = fileName
      }

      // compute normalized search name when updating
      const name_search = removeVietnameseTones(name)

      const { error: updateErr } = await supabase
        .from('stores')
        .update({ name, name_search, address, phone, note, image_url, latitude, longitude })
        .eq('id', id)
      if (updateErr) throw updateErr

      // Optional cleanup: delete old image if replaced
      if (imageFile && store?.image_url) {
        const oldFileName = getOldFileNameFromUrl(store.image_url)
        if (oldFileName) {
          await supabase.storage.from('stores').remove([oldFileName])
        }
      }

      alert('Đã lưu')
      router.push('/')
    } catch (err) {
      console.error(err)
      // Rollback new upload if DB update failed
      if (imageFile && newUploadedFile) {
        await supabase.storage.from('stores').remove([newUploadedFile])
      }
      alert('Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  if (!store) {
    return (
      <div className="mx-auto max-w-2xl p-6">Đang tải...</div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Chi tiết cửa hàng</h1>
        <Button variant="ghost" size="sm" onClick={() => router.push('/')}>Quay lại</Button>
      </div>
      <Card className="mt-4">
        <CardContent className="space-y-4 p-6">
          {store?.image_url && (
            <Dialog>
              <DialogTrigger asChild>
                <Image src={store.image_url} alt={store.name} width={96} height={96} className="h-24 w-24 cursor-zoom-in rounded object-cover ring-1 ring-gray-200 dark:ring-gray-800" />
              </DialogTrigger>
              <DialogContent className="overflow-hidden p-0">
                <Image src={store.image_url} alt={store.name} width={800} height={800} className="max-h-[80vh] w-auto object-contain" />
              </DialogContent>
            </Dialog>
          )}
          <form onSubmit={onSave} className="space-y-4">
            <div className="grid gap-1.5">
              <Label>Tên</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!user} />
            </div>
            <div className="grid gap-1.5">
              <Label>Địa chỉ</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} disabled={!user} />
            </div>
            <div className="grid gap-1.5">
              <Label>Số điện thoại</Label>
              <Input
                type="tel"
                inputMode="numeric"
                pattern="[0-9+ ]*"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={!user}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Ghi chú</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} disabled={!user} />
            </div>
            {user && (
              <div className="grid gap-1.5">
                <Label>Đổi ảnh (tùy chọn)</Label>
                <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              </div>
            )}
            <div className="pt-2">
              <Button type="submit" disabled={!user || saving} className="w-full">
                {!user ? 'Vui lòng đăng nhập' : saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
