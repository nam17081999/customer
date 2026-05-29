import "../app/globals.css";
import { useRouter } from "next/router";
import Navbar from "@/components/navbar";
import Head from "next/head";
import ErrorBoundary from "@/components/error-boundary";
import { AuthProvider } from "@/lib/AuthContext";
import { ThemeProvider } from "@/lib/ThemeContext";

export default function App({ Component, pageProps }) {
  const { pathname } = useRouter()
  const hideChrome = pathname === '/login'
  const needsBottomPadding = !hideChrome && pathname !== '/map' && pathname !== '/'
  return (
    <div className="flex min-h-screen flex-col overflow-hidden">
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
            {!hideChrome && <Navbar />}
            {/* pb-16 = space for fixed bottom tab bar on mobile */}
            <div className={`${needsBottomPadding ? 'pb-16 sm:pb-0' : ''} min-h-0 flex-1 overflow-hidden`}>
              <Component {...pageProps} />
            </div>
          </ErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </div>
  );
}
