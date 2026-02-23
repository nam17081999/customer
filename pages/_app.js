import "../app/globals.css";
import Navbar from "@/components/navbar";
import Head from "next/head";
import ErrorBoundary from "@/components/error-boundary";

export default function App({ Component, pageProps }) {
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
        <Navbar />
        <Component {...pageProps} />
      </ErrorBoundary>
    </>
  );
}
