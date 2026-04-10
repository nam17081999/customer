import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function StoreExportLegacyPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/admin/export')
  }, [router])

  return null
}
