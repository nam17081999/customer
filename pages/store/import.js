import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function StoreImportLegacyPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/admin/import')
  }, [router])

  return null
}
