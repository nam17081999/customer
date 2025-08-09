import "../app/globals.css";
import Navbar from "@/components/navbar";
import Head from "next/head";
import { AuthProvider } from "@/components/auth-context";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <AuthProvider>
        <Navbar />
        <Component {...pageProps} />
      </AuthProvider>
    </>
  );
}
