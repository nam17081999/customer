import { Suspense } from 'react'
import AppNavbar from '@/components/layout/app-navbar'

export const metadata = {
  title: 'Đăng nhập - NPP Hà Công',
}

/**
 * Layout cho /login - thêm Navbar vì trang này dùng App Router,
 * không qua pages/_app.js
 */
export default function LoginLayout({ children }) {
  return (
    <>
      <AppNavbar />
      <div className="pb-16 sm:pb-0">
        <Suspense>
          {children}
        </Suspense>
      </div>
    </>
  )
}
