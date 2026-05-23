import "../app/globals.css";
import { useRouter } from "next/router";
import Navbar from "@/components/navbar";
import Head from "next/head";
import ErrorBoundary from "@/components/error-boundary";
import { AuthProvider } from "@/lib/AuthContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import { getThemeInitScript } from "@/helper/theme";

export default function App({ Component, pageProps }) {
  const { pathname } = useRouter()
  const needsBottomPadding = pathname !== '/map' && pathname !== '/'
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>NPP Hà Công - Quản lý cửa hàng</title>
        <meta name="description" content="Ứng dụng quản lý và theo dõi cửa hàng cho đội ngũ sales" />
        <meta name="theme-color" content="#000000" />
        <link rel="manifest" href="/manifest.json" />
        <script dangerouslySetInnerHTML={{ __html: getThemeInitScript() }} />
      </Head>
      <ThemeProvider>
        <AuthProvider>
          <ErrorBoundary>
            <Navbar />
            {/* pb-16 = space for fixed bottom tab bar on mobile */}
            <div className={needsBottomPadding ? 'pb-16 sm:pb-0' : ''}>
              <Component {...pageProps} />
            </div>
          </ErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </>
  );
}
