import { useEffect, useState, useCallback } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { LogOut } from 'lucide-react'
import { loadPreferences, subscribePreferences, setPreference } from '@/lib/notification-store'

function getInitials(email) {
  if (!email) return '?'
  const local = email.split('@')[0] || ''
  const parts = local.split(/[._-]/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return local.slice(0, 2).toUpperCase()
}

const NOTIF_TOGGLES = [
  { key: 'notif_new_order', label: 'Thông báo đơn hàng mới' },
  { key: 'notif_low_stock', label: 'Thông báo tồn kho thấp' },
  { key: 'notif_debt', label: 'Thông báo công nợ' },
  { key: 'notif_daily_report', label: 'Email báo cáo hàng ngày' },
  { key: 'notif_weekly_report', label: 'Email báo cáo hàng tuần' },
]

export default function AccountPage() {
  const router = useRouter()
  const { user, role, isAdmin, isAuthenticated, loading: authLoading, signOut } = useAuth() || {}
  const [signingOut, setSigningOut] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toasts, setToasts] = useState([])
  const [confirm, setConfirm] = useState(null)

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) router.replace('/login?from=/account')
  }, [authLoading, isAuthenticated, router])

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  const handleSignOut = async () => {
    if (!signOut || signingOut) return
    setConfirm(null)
    setSigningOut(true)
    const { error } = await signOut()
    setSigningOut(false)
    if (error) console.error('Sign out error:', error)
    router.replace('/login')
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setConfirm(null)
    await new Promise(r => setTimeout(r, 500))
    showToast('Liên hệ admin để xoá tài khoản', 'error')
    setDeleting(false)
  }

  const openConfirm = (title, message, onOk) => setConfirm({ title, message, onOk })
  const closeConfirm = () => setConfirm(null)

  if (authLoading || !isAuthenticated) {
    return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />
  }

  const roleLabel = isAdmin ? 'Quản trị viên' : role === 'telesale' ? 'Telesale' : 'Khách'

  return (
    <>
      <Head>
        <title>Tài khoản - NPP Hà Công</title>
      </Head>

      <div className="page-title">
        <h1>Tài khoản</h1>
        <p>Quản lý thông tin cá nhân và cài đặt hệ thống</p>
      </div>

      {/* Toast container */}
      <div className="toast-container" id="toastContainer">
        {toasts.map(t => (
          <div key={t.id} className={`toast show ${t.type}`}>{t.message}</div>
        ))}
      </div>

      {/* ═══════ 1. THÔNG TIN CÁ NHÂN ═══════ */}
      <div className="settings-card" id="personalCard">
        <div className="card-title">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          Thông tin cá nhân
        </div>

        <ProfileSection user={user} roleLabel={roleLabel} />
        <ProfileForm user={user} roleLabel={roleLabel} showToast={showToast} />
      </div>

      {/* ═══════ 2. ĐỔI MẬT KHẨU ═══════ */}
      <div className="settings-card">
        <div className="card-title">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Đổi mật khẩu
        </div>
        <PasswordChangeForm showToast={showToast} />
      </div>

      {/* ═══════ 3. CÀI ĐẶT THÔNG BÁO ═══════ */}
      <div className="settings-card">
        <div className="card-title">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          Cài đặt thông báo
        </div>
        <NotificationToggles showToast={showToast} />
      </div>

      {/* ═══════ 4. THÔNG TIN ỨNG DỤNG ═══════ */}
      <div className="settings-card muted">
        <div className="card-title" style={{ color: 'var(--muted)' }}>
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Thông tin ứng dụng
        </div>

        <div className="info-line">
          <span className="il-label">Phiên bản</span>
          <span className="il-value">2.1.0</span>
        </div>
        <div className="info-line">
          <span className="il-label">Cơ sở dữ liệu</span>
          <span className="il-value">Supabase</span>
        </div>
        <div className="info-line">
          <span className="il-label">Lần đồng bộ cuối</span>
          <span className="il-value">15/06/2026 14:30</span>
        </div>

        <div className="btn-center">
          <button className="btn btn-red" style={{ width: 200 }} onClick={() => openConfirm('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất?', handleSignOut)} disabled={signingOut}>
            <LogOut className="h-4 w-4" />
            {signingOut ? 'Đang xuất...' : 'Đăng xuất'}
          </button>
        </div>
        <div className="btn-center">
          <button className="btn btn-red-outline" style={{ width: 200 }} onClick={() => openConfirm('Xoá tài khoản', 'Bạn có chắc chắn muốn xoá tài khoản? Hành động này không thể hoàn tác.', handleDeleteAccount)} disabled={deleting}>
            {deleting ? 'Đang xoá...' : 'Xoá tài khoản'}
          </button>
        </div>
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <div className="confirm-overlay open" onClick={(e) => { if (e.target === e.currentTarget) closeConfirm() }}>
          <div className="confirm-box">
            <h3>{confirm.title}</h3>
            <p>{confirm.message}</p>
            <div className="confirm-actions">
              <button className="btn btn-outline" onClick={closeConfirm}>Huỷ</button>
              <button className="btn btn-primary" onClick={confirm.onOk}>Xác nhận</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ProfileSection({ user, roleLabel }) {
  return (
    <div className="profile-head">
      <div className="profile-avatar">{getInitials(user?.email)}</div>
      <div className="profile-head-info">
        <h2>{user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Người dùng'}</h2>
        <p>{roleLabel}</p>
      </div>
    </div>
  )
}

function ProfileForm({ user, roleLabel, showToast }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user?.user_metadata?.full_name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [origName, setOrigName] = useState(name)
  const [origEmail, setOrigEmail] = useState(email)
  const [origPhone, setOrigPhone] = useState(phone)

  function startEdit() {
    setOrigName(name); setOrigEmail(email); setOrigPhone(phone)
    setEditing(true)
  }

  function cancelEdit() {
    setName(origName); setEmail(origEmail); setPhone(origPhone)
    setEditing(false)
  }

  function saveEdit() {
    if (!name.trim() || !email.trim() || !phone.trim()) {
      showToast('Vui lòng điền đầy đủ thông tin', 'error')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Email không hợp lệ', 'error')
      return
    }
    showToast('Cập nhật thông tin thành công', 'success')
    setEditing(false)
  }

  return (
    <>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Họ tên</label>
          <input className={'form-input' + (editing ? ' editable' : '')} type="text" value={name} disabled={!editing}
            onChange={e => setName(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className={'form-input' + (editing ? ' editable' : '')} type="email" value={email} disabled={!editing}
            onChange={e => setEmail(e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">SĐT</label>
          <input className={'form-input' + (editing ? ' editable' : '')} type="tel" value={phone} disabled={!editing}
            onChange={e => setPhone(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Vai trò</label>
          <input className="form-input" type="text" value={roleLabel} disabled />
        </div>
      </div>
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        {editing ? (
          <>
            <button className="btn btn-outline" onClick={cancelEdit}>Huỷ</button>
            <button className="btn btn-primary" onClick={saveEdit}>Lưu</button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={startEdit}>Chỉnh sửa</button>
        )}
      </div>
    </>
  )
}

function PasswordChangeForm({ showToast }) {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')

  function handleChange() {
    if (!currentPw) { showToast('Vui lòng nhập mật khẩu hiện tại', 'error'); return }
    if (!newPw) { showToast('Vui lòng nhập mật khẩu mới', 'error'); return }
    if (newPw.length < 6) { showToast('Mật khẩu mới phải có ít nhất 6 ký tự', 'error'); return }
    if (newPw !== confirmPw) { showToast('Xác nhận mật khẩu không khớp', 'error'); return }
    showToast('Đổi mật khẩu thành công', 'success')
    setCurrentPw(''); setNewPw(''); setConfirmPw('')
  }

  return (
    <>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Mật khẩu hiện tại</label>
          <input className="form-input" type="password" placeholder="••••••••"
            value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Mật khẩu mới</label>
          <input className="form-input" type="password" placeholder="Tối thiểu 6 ký tự"
            value={newPw} onChange={e => setNewPw(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Xác nhận mật khẩu mới</label>
          <input className="form-input" type="password" placeholder="Nhập lại mật khẩu mới"
            value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
        </div>
      </div>
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-primary" onClick={handleChange}>Lưu mật khẩu</button>
      </div>
    </>
  )
}

function NotificationToggles({ showToast }) {
  const [prefs, setPrefs] = useState({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    loadPreferences().then(p => { setPrefs(p); setLoaded(true) })
  }, [])

  useEffect(() => {
    const unsub = subscribePreferences(p => setPrefs({ ...p }))
    return unsub
  }, [])

  const toggle = useCallback(async (key) => {
    const current = prefs[key]
    const newVal = current === undefined ? false : !current
    setPrefs(prev => ({ ...prev, [key]: newVal }))
    await setPreference(key, newVal)
    showToast('Đã cập nhật cài đặt thông báo', 'success')
  }, [prefs, showToast])

  return (
    <div id="toggleList">
      {NOTIF_TOGGLES.map(({ key, label }) => {
        const enabled = prefs[key] !== false
        return (
          <div key={key} className="toggle-row">
            <span className="toggle-label">{label}</span>
            <label className="toggle-switch">
              <input type="checkbox" checked={enabled} disabled={!loaded}
                onChange={() => toggle(key)} />
              <span className="toggle-slider"></span>
            </label>
          </div>
        )
      })}
    </div>
  )
}
