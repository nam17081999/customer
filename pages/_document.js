import { Html, Head, Main, NextScript } from 'next/document'
import Script from 'next/script'
import { getThemeInitScript } from '@/helper/theme'

export default function Document() {
  return (
    <Html lang="vi">
      <Head />
      <body>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: getThemeInitScript() }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
