import { supabase } from '@/lib/supabaseClient'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function Login() {
  const [loading, setLoading] = useState(false)

  const handleGoogleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    })
    if (error) {
      console.error(error)
      alert('Đăng nhập Google thất bại')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black px-3 sm:px-4 py-8">
      <div className="mx-auto max-w-sm w-full">
        <Card>
          <CardContent className="space-y-4 p-6">
            <h1 className="text-base sm:text-lg font-semibold">Đăng nhập</h1>
            <Button onClick={handleGoogleLogin} disabled={loading} className="w-full text-sm sm:text-base">
              {loading ? 'Đang chuyển tới Google…' : 'Đăng nhập với Google'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
