import Head from 'next/head'
import Link from 'next/link'
import { PrimaryButton, FAB, DataTable, Skeleton, BottomNav } from '@/components/ui/v2'
import { Plus } from 'lucide-react'

export default function UiKitPage() {
  const navItems = [
    { href: '/', label: 'Tìm', mobileLabel: 'Tìm', Icon: () => <svg className="w-5 h-5" /> , active: true },
    { href: '/orders/new', label: 'Đơn', mobileLabel: 'Đơn', Icon: () => <svg className="w-5 h-5" /> },
  ]

  return (
    <>
      <Head>
        <title>UI Kit - NPP Hà Công</title>
      </Head>
      <main className="min-h-screen bg-black/40 text-slate-100 p-6">
        <h1 className="text-2xl font-bold mb-4">UI Kit (preview)</h1>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Buttons</h2>
          <div className="flex gap-3 items-center">
            <PrimaryButton onClick={() => {}}>
              <Plus className="h-4 w-4" /> Thêm
            </PrimaryButton>
            <button className="rounded-xl border px-3 py-2">Outline</button>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Data Table</h2>
          <DataTable header={<div className="text-sm font-bold">Các cột</div>}>
            <div className="space-y-2">
              <div className="p-2 rounded bg-slate-900/30">Row 1</div>
              <div className="p-2 rounded bg-slate-900/20">Row 2</div>
            </div>
          </DataTable>
        </section>

        <section className="mt-6 space-y-3">
          <h2 className="text-lg font-semibold">Skeleton</h2>
          <Skeleton className="h-8 w-64 rounded" />
        </section>

        <FAB onClick={() => alert('FAB')}>
          <Plus className="h-6 w-6" />
        </FAB>

        <BottomNav items={navItems} />
      </main>
    </>
  )
}
