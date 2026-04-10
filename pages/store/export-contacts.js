import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function ExportContactsLegacyPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/admin/export')
  }, [router])

  return null
}
