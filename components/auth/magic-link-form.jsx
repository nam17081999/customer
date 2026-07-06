import { useCallback, useEffect, useRef, useState } from 'react'
import { signInWithOtp } from '@/api/auth/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RESEND_COOLDOWN_SECONDS, formatCountdown } from '@/helper/magicLinkResend'

export default function MagicLinkForm({ onSuccess }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef(null)

  const canResend = countdown === 0

  useEffect(() => {
    if (countdown <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          timerRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [countdown])

  const send = useCallback(async (emailAddress) => {
    const trimmedEmail = String(emailAddress || '').trim()
    if (!trimmedEmail) {
      setError('Vui lòng nhập email')
      return
    }
    setLoading(true)
    setError('')
    const { error: err } = await signInWithOtp(trimmedEmail)
    if (err) {
      setError(err.message === 'Signup not allowed' ? 'Email không tồn tại trong hệ thống' : err.message)
      setLoading(false)
      return
    }
    setEmailSent(true)
    setCountdown(RESEND_COOLDOWN_SECONDS)
    setLoading(false)
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (loading) return
    send(email)
  }

  if (emailSent) {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-full bg-blue-500/10 w-12 h-12 mx-auto flex items-center justify-center">
          <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-gray-100 font-medium">Đã gửi email</p>
        <p className="text-sm text-gray-400">
          Vui lòng kiểm tra hộp thư <span className="text-gray-200 font-medium">{email}</span> và làm theo hướng dẫn.
        </p>
        <div className="text-sm text-gray-500">
          {canResend ? (
            <button
              type="button"
              onClick={() => send(email)}
              disabled={loading}
              className="text-blue-400 hover:text-blue-300 underline cursor-pointer disabled:opacity-50"
            >
              Gửi lại email
            </button>
          ) : (
            <span>Gửi lại sau {formatCountdown(countdown)}</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="magic-link-email">Email</Label>
        <Input
          id="magic-link-email"
          type="email"
          autoComplete="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-200">{error}</div>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Đang gửi...' : 'Gửi link đăng nhập'}
      </Button>

      <p className="text-xs text-gray-500 text-center">
        Kiểm tra email bao gồm cả thư mục Spam
      </p>
    </form>
  )
}
