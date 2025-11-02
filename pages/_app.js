import "../app/globals.css";
import Navbar from "@/components/navbar";
import Head from "next/head";
import { AuthProvider } from "@/components/auth-context";
import ErrorBoundary from "@/components/error-boundary";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>StoreVis - Quản lý cửa hàng</title>
        <meta name="description" content="Ứng dụng quản lý và theo dõi cửa hàng cho đội ngũ sales" />
      </Head>
      <ErrorBoundary>
        <AuthProvider>
          <Navbar />
          <Component {...pageProps} />
        </AuthProvider>
      </ErrorBoundary>
    </>
  );
}
