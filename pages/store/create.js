import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-context'
import Link from 'next/link'
import imageCompression from 'browser-image-compression'
import { toTitleCaseVI } from '@/lib/utils'

export default function AddStore() {
  const { user } = useAuth()
  const router = useRouter()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [resolvingAddr, setResolvingAddr] = useState(false)

  useEffect(() => {
    if (!user) return
    const qName = typeof router.query.name === 'string' ? router.query.name.trim() : ''
    if (qName) setName(toTitleCaseVI(qName))
  }, [user, router.query.name])

  // Auto-fill address on mount (no manual typing needed)
  useEffect(() => {
    if (!user) return
    if (!address && !resolvingAddr) {
      handleFillAddress()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  function cleanNominatimDisplayName(name) {
    if (!name) return ''
    const parts = name.split(',').map((p) => p.trim())
    while (parts.length > 0) {
      const last = parts[parts.length - 1]
      if (last.toLowerCase() === 'việt nam' || /^[0-9]{4,6}$/.test(last)) {
        parts.pop()
        continue
      }
      break
    }
    return parts.join(', ')
  }

  async function handleFillAddress() {
    try {
      setResolvingAddr(true)
      const coords = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos.coords),
          (err) => reject(err)
        )
      })
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&zoom=18&addressdetails=1&accept-language=vi`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Reverse geocoding failed')
      const data = await res.json()
      const text = data?.display_name || ''
      const cleaned = cleanNominatimDisplayName(text)
      if (cleaned) setAddress(cleaned)
      else alert('Không lấy được địa chỉ từ Nominatim')
    } catch (err) {
      console.error('Auto fill address error:', err)
      alert('Không lấy được địa chỉ. Vui lòng cấp quyền định vị cho trang này và thử lại.')
    } finally {
      setResolvingAddr(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!user) {
      alert('Vui lòng đăng nhập để tạo cửa hàng')
      return
    }

    if (!name || !address || !imageFile) {
      alert('Tên, địa chỉ và ảnh là bắt buộc')
      return
    }

    // Normalize name to Title Case before saving
    const normalizedName = toTitleCaseVI(name.trim())

    let latitude = null
    let longitude = null
    try {
      const coords = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos.coords),
          (err) => reject(err)
        )
      })
      latitude = coords.latitude
      longitude = coords.longitude
    } catch (geoErr) {
      console.error('Không lấy được tọa độ:', geoErr)
      alert('Ứng dụng cần quyền truy cập vị trí để tiếp tục. Vui lòng cấp quyền định vị cho trang này trong trình duyệt (bấm vào biểu tượng ổ khóa cạnh thanh địa chỉ → cho phép Vị trí), sau đó thử lại.')
      return
    }

    try {
      setLoading(true)

      // Aggressive client-side compression
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
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('stores')
        .upload(fileName, fileToUpload, { contentType: fileToUpload.type })
      if (uploadError) {
        console.error(uploadError)
        alert('Lỗi khi upload ảnh')
        setLoading(false)
        return
      }

      const { data: publicUrlData } = supabase.storage.from('stores').getPublicUrl(fileName)
      const imageUrl = publicUrlData.publicUrl

      const nameSearch = removeVietnameseTones(normalizedName)

      const { error: insertError } = await supabase.from('stores').insert([
        {
          name: normalizedName,
          name_search: nameSearch,
          address,
          note,
          phone,
          image_url: imageUrl,
          latitude,
          longitude,
        },
      ])

      if (insertError) {
        console.error(insertError)
        await supabase.storage.from('stores').remove([fileName])
        alert('Lỗi khi lưu dữ liệu')
        setLoading(false)
        return
      }

      alert('Tạo cửa hàng thành công!')
      e.target.reset()
      setName('')
      setAddress('')
      setPhone('')
      setNote('')
      setImageFile(null)
    } catch (err) {
      console.error(err)
      alert('Đã xảy ra lỗi')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-black">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardContent className="p-6 text-center text-sm text-gray-600 dark:text-gray-400">
              Vui lòng <Link href="/login" className="text-blue-600 underline">đăng nhập</Link> để tạo cửa hàng.
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-black">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Thêm cửa hàng</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Nhập thông tin cửa hàng và tải ảnh đại diện.</p>

        <Card className="mt-6">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-1.5">
                <Label htmlFor="name">Tên cửa hàng</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Cửa hàng ABC" />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="address">Địa chỉ</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="address"
                    value={address}
                    readOnly
                    placeholder={resolvingAddr ? 'Đang tự động lấy địa chỉ…' : 'Địa chỉ sẽ được tự động điền'}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={handleFillAddress} disabled={resolvingAddr}>
                    {resolvingAddr ? 'Đang lấy…' : 'Lấy lại'}
                  </Button>
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="phone">Số điện thoại</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9+ ]*"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="VD: 0901234567"
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="note">Ghi chú</Label>
                <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú thêm (không bắt buộc)" />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="image">Ảnh đại diện</Label>
                <Input id="image" type="file" accept="image/*;capture=camera" capture="environment" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Đang thêm…' : 'Thêm cửa hàng'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
