import "../app/globals.css";
import { useRouter } from "next/router";
import { useEffect, useMemo } from "react";
import AppLayout from "@/components/layout/app-layout";
import { NotificationToaster } from "@/components/layout/notification-toaster";
import { useNotifications } from "@/hooks/useNotifications";

import { useAuth } from '@/lib/AuthContext'

// ── Route → Page title mapping ──
const PAGE_TITLES = {
  '/overview': { title: 'Bảng điều khiển', subtitle: 'Tổng quan hoạt động' },
  '/': { title: 'Cửa hàng', subtitle: 'Danh sách cửa hàng kinh doanh' },
  '/map': null, // fullscreen
  '/login': null, // no chrome
  '/inventory/products': { title: 'Hàng hóa' },
  '/inventory/purchases/new': { title: 'Nhập hàng', subtitle: 'Tạo phiếu nhập kho' },
  '/inventory/purchases': { title: 'Phiếu nhập', subtitle: 'Danh sách phiếu nhập kho' },
  '/inventory/stock': { title: 'Báo cáo tồn kho', subtitle: 'Thống kê tồn kho' },
  '/inventory/reports': { title: 'Báo cáo', subtitle: 'Thống kê kinh doanh' },
  '/orders/new': { title: 'Lên đơn hàng', subtitle: 'Tạo đơn hàng mới' },
  '/orders': { title: 'Đơn hàng', subtitle: 'Danh sách đơn hàng' },
  '/telesale/overview': { title: 'Telesale', subtitle: 'Danh sách gọi' },
  '/store/create': { title: 'Thêm cửa hàng', subtitle: 'Nhập thông tin cửa hàng mới' },
  '/store/import': { title: 'Nhập dữ liệu', subtitle: 'Import cửa hàng từ CSV' },
  '/store/export': { title: 'Xuất dữ liệu', subtitle: 'Export danh sách cửa hàng' },
  '/store/verify': { title: 'Duyệt cửa hàng', subtitle: 'Xác nhận cửa hàng mới' },
  '/store/reports': { title: 'Duyệt báo cáo', subtitle: 'Báo cáo từ người dùng' },
  '/store/deduplicate': { title: 'Gộp trùng lặp', subtitle: 'Xử lý cửa hàng trùng' },
  '/admin/users': { title: 'Quản lý tài khoản', subtitle: 'Người dùng hệ thống' },
  '/admin/operations': { title: 'Thao tác', subtitle: 'Quản trị hệ thống' },
  '/notifications': { title: 'Thông báo', subtitle: 'Thông báo hệ thống' },
  '/account': { title: 'Tài khoản', subtitle: 'Thông tin cá nhân' },
  '/login': { title: 'Đăng nhập' },
}

const NO_CHROME = []

// ── Activates notification subscriptions globally ──
function NotificationRoot() {
  const { isAdmin } = useAuth() || {}
  useNotifications(isAdmin)
  return isAdmin ? <NotificationToaster /> : null
}
import Head from "next/head";
import ErrorBoundary from "@/components/error-boundary";
import { AuthProvider } from "@/lib/AuthContext";
import { ThemeProvider } from "@/lib/ThemeContext";

export default function App({ Component, pageProps }) {
  const { pathname } = useRouter()
  const hideChrome = NO_CHROME.includes(pathname)
  const pageMeta = PAGE_TITLES[pathname] || null

  // Content wrapper
  const content = (
    <>
      <NotificationRoot />
      <Component {...pageProps} />
    </>
  )

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>NPP Hà Công - Quản lý cửa hàng</title>
        <meta name="description" content="Ứng dụng quản lý và theo dõi cửa hàng cho đội ngũ sales" />
        <meta name="theme-color" content="#000000" />
        <link rel="manifest" href="/manifest.json" />
      </Head>
      <ThemeProvider>
        <AuthProvider>
          <ErrorBoundary>
            {hideChrome ? (
              content
            ) : (
              <AppLayout title={pageMeta?.title} subtitle={pageMeta?.subtitle}>
                {content}
              </AppLayout>
            )}
          </ErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </>
  );
}
