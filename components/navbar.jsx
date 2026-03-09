"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

/* SVG icon helpers - ICON LON HON cho nguoi kem mat */
const SearchIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
)
const VerifyIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5 2A9 9 0 1112 3a9 9 0 019 9z" />
    </svg>
)
const MapIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
)
const PlusIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
)
const AccountIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A9 9 0 1118.88 17.8M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
)

export default function Navbar() {
    const pathname = usePathname()
    const { user } = useAuth() || {}
    const currentPath = pathname || ''
    
    // Navigation don gian voi TEN RO RANG cho nguoi it biet cong nghe
    const navLinks = user
        ? [
            { href: '/', active: currentPath === '/', label: 'Tim kiem', mobileLabel: 'Tim', Icon: SearchIcon },
            { href: '/store/verify', active: currentPath === '/store/verify', label: 'Duyet', mobileLabel: 'Duyet', Icon: VerifyIcon },
            { href: '/map', active: currentPath === '/map', label: 'Ban do', mobileLabel: 'Ban do', Icon: MapIcon },
            { href: '/store/create', active: currentPath === '/store/create', label: 'Them moi', mobileLabel: 'Them', Icon: PlusIcon },
            { href: '/account', active: currentPath === '/account', label: 'Tai khoan', mobileLabel: 'Ca nhan', Icon: AccountIcon },
        ]
        : [
            { href: '/', active: currentPath === '/', label: 'Tim kiem', mobileLabel: 'Tim', Icon: SearchIcon },
            { href: '/map', active: currentPath === '/map', label: 'Ban do', mobileLabel: 'Ban do', Icon: MapIcon },
            { href: '/store/create', active: currentPath === '/store/create', label: 'Them moi', mobileLabel: 'Them', Icon: PlusIcon },
            { href: '/account', active: currentPath === '/account', label: 'Tai khoan', mobileLabel: 'Ca nhan', Icon: AccountIcon },
        ]

    const brandHref = '/'

    return (
        <>
            {/* ── Top bar - NEN XANH DUONG NOI BAT ── */}
            <nav className="hidden sm:block sticky top-0 z-50 bg-blue-700 shadow-lg">
                <div className="mx-auto flex h-16 w-full max-w-screen-md items-center px-4 gap-3">
                    {/* Brand - Font lon hon */}
                    <Link href={brandHref} className="flex items-center font-bold text-white text-2xl shrink-0">
                        <span className="text-yellow-300">StoreVis</span>
                    </Link>

                    {/* Desktop nav links - NUT LON, MAU NOI BAT */}
                    <div className="ml-auto hidden sm:flex items-center gap-2">
                        {navLinks.map(({ href, active, label, Icon }) => (
                            <Link
                                key={href}
                                href={href}
                                aria-current={active ? 'page' : undefined}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-base font-bold transition-all ${active
                                        ? 'bg-yellow-400 text-blue-900 shadow-lg'
                                        : 'text-white hover:bg-blue-600'
                                    }`}
                            >
                                <Icon className="w-5 h-5" />
                                <span>{label}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            </nav>

            {/* ── Bottom tab bar - MAU SAC NOI BAT ── */}
            <div className="sm:hidden fixed bottom-0 inset-x-0 z-[60] bg-blue-800 border-t-4 border-yellow-400 safe-area-bottom">
                <div className="flex h-20 max-w-screen-md mx-auto w-full">
                    {navLinks.map(({ href, active, label, mobileLabel, Icon }) => (
                        <Link
                            key={href}
                            href={href}
                            aria-current={active ? 'page' : undefined}
                            className={`flex flex-1 min-w-0 flex-col items-center justify-center gap-1 px-1 transition-all ${active
                                    ? 'bg-yellow-400 text-blue-900'
                                    : 'text-white active:bg-blue-700'
                                }`}
                        >
                            {/* Icon lon hon - 28px */}
                            <Icon className={`w-7 h-7 shrink-0 ${active ? 'text-blue-900' : 'text-white'}`} />
                            {/* Text lon hon, de doc hon */}
                            <span className={`w-full truncate text-center whitespace-nowrap text-sm font-bold leading-tight ${active ? 'text-blue-900' : 'text-white'}`}>
                                {mobileLabel || label}
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
        </>
    )
}
