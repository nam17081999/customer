import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignup = async () => {
    if (!email || !username || !password) return
    setLoading(true)
    try {
      // create auth user
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        console.error(error)
        alert('Đăng ký thất bại')
        return
      }

      const user = data.user
      if (!user) {
        alert('Vui lòng xác minh email để hoàn tất đăng ký')
        setLoading(false)
        return
      }

      // save profile (username + email)
      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert({ id: user.id, username, email })
      if (profileErr) {
        console.error(profileErr)
        alert('Lưu hồ sơ thất bại')
        return
      }

      alert('Đăng ký thành công!')
      window.location.href = '/login'
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black px-3 sm:px-4 py-8">
      <div className="mx-auto max-w-sm w-full">
        <Card>
          <CardContent className="space-y-4 p-6">
            <h1 className="text-base sm:text-lg font-semibold">Đăng ký</h1>
            <Input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input type="password" placeholder="Mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button onClick={handleSignup} disabled={!email || !username || !password || loading} className="text-sm sm:text-base">
              {loading ? 'Đang đăng ký...' : 'Đăng ký'}
            </Button>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              Đã có tài khoản? <Link className="text-blue-600 underline" href="/login">Đăng nhập</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
