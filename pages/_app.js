import "../app/globals.css";
import Navbar from "@/components/navbar";
import Head from "next/head";
import ErrorBoundary from "@/components/error-boundary";
import OfflineBanner from "@/components/offline-banner";
import OfflineSync from "@/components/offline-sync";
import { useOnlineStatus } from "@/helper/useOnlineStatus";
import { useRouter } from "next/router";
import { useEffect } from "react";

/**
 * Placeholder shown on non-search pages when user is offline.
 */
function OfflinePlaceholder() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-20 text-center text-gray-500 dark:text-gray-400">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 11-12.728 0M12 9v4m0 4h.01" />
      </svg>
      <p className="text-sm">Trang này cần kết nối mạng</p>
      <button
        onClick={() => router.push('/')}
        className="mt-1 rounded-md bg-gray-900 px-4 py-2 text-xs font-medium text-white dark:bg-gray-100 dark:text-gray-900"
      >
        Về trang tìm kiếm
      </button>
    </div>
  );
}

export default function App({ Component, pageProps }) {
  const { isOnline } = useOnlineStatus();
  const router = useRouter();

  // Register Service Worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[SW] Registered:", reg.scope);
        })
        .catch((err) => {
          console.warn("[SW] Registration failed:", err);
        });
    }
  }, []);

  // When offline and not on search page, redirect to search
  useEffect(() => {
    if (!isOnline && router.pathname !== '/') {
      router.replace('/');
    }
  }, [isOnline, router]);

  // Determine if current page is allowed offline (only search '/')
  const isSearchPage = router.pathname === '/';
  const showPage = isOnline || isSearchPage;

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <title>StoreVis - Quản lý cửa hàng</title>
        <meta name="description" content="Ứng dụng quản lý và theo dõi cửa hàng cho đội ngũ sales" />
        <meta name="theme-color" content="#000000" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Head>
      <ErrorBoundary>
        <div className="sticky top-0 z-50">
          <OfflineBanner />
          <Navbar />
        </div>
        <OfflineSync />
        {showPage ? <Component {...pageProps} /> : <OfflinePlaceholder />}
      </ErrorBoundary>
    </>
  );
}
