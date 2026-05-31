import React from 'react'
import Link from 'next/link'

export default function BottomNav({ items = [] }) {
  return (
    <div className="safe-area-bottom fixed inset-x-0 bottom-0 z-[1000] border-t border-slate-800 bg-[color:var(--surface)]/96 backdrop-blur-xl sm:hidden shadow-[0_-10px_30px_rgba(2,6,23,0.18)]">
      <div className="mx-auto flex h-16 w-full max-w-screen-md px-1.5">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 ${it.active ? 'bg-sky-500/10 text-sky-300' : 'text-slate-500'}`}>
            <it.Icon className="size-5 shrink-0" />
            <span className="w-full truncate text-center text-[10px] font-semibold leading-none whitespace-nowrap">{it.mobileLabel || it.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
