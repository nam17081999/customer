import { supabase } from '@/lib/supabaseClient'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined } })
    setLoading(false)
    if (error) console.error(error)
    else alert('Kiểm tra email để đăng nhập!')
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-black">
      <div className="mx-auto max-w-md">
        <Card>
          <CardContent className="space-y-4 p-6">
            <h1 className="text-lg font-semibold">Đăng nhập</h1>
            <Input type="email" placeholder="Nhập email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button onClick={handleLogin} disabled={!email || loading}>{loading ? 'Đang gửi...' : 'Gửi link đăng nhập'}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
