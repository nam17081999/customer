import { supabase } from '../lib/supabaseClient'
import { useState } from 'react'

export default function Login() {
  const [email, setEmail] = useState('')

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) console.error(error)
    else alert('Check email để đăng nhập!')
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Đăng nhập</h1>
      <input
        type="email"
        placeholder="Nhập email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button onClick={handleLogin}>Gửi link đăng nhập</button>
    </div>
  )
}
