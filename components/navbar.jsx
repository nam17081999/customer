"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

/* SVG icon helpers ─ rendered at configurable size */
const SearchIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
)
const DashboardIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
    </svg>
)
const VerifyIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5 2A9 9 0 1112 3a9 9 0 019 9z" />
    </svg>
)
const MapIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
)
const PlusIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
)
const AccountIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A9 9 0 1118.88 17.8M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
)

export default function Navbar() {
    const pathname = usePathname()
    const { user } = useAuth() || {}
    const currentPath = pathname || ''
    const navLinks = user
        ? [
            { href: '/', active: currentPath === '/', label: 'Tìm kiếm', mobileLabel: 'Tìm', Icon: SearchIcon },
            { href: '/store/verify', active: currentPath === '/store/verify', label: 'Xác thực', mobileLabel: 'Duyệt', Icon: VerifyIcon },
            { href: '/map', active: currentPath === '/map', label: 'Bản đồ', mobileLabel: 'Bản đồ', Icon: MapIcon },
            { href: '/store/create', active: currentPath === '/store/create', label: 'Thêm', mobileLabel: 'Thêm', Icon: PlusIcon },
            { href: '/account', active: currentPath === '/account', label: 'Tài khoản', mobileLabel: 'TK', Icon: AccountIcon },
        ]
        : [
            { href: '/', active: currentPath === '/', label: 'Tìm kiếm', mobileLabel: 'Tìm', Icon: SearchIcon },
            { href: '/map', active: currentPath === '/map', label: 'Bản đồ', mobileLabel: 'Bản đồ', Icon: MapIcon },
            { href: '/store/create', active: currentPath === '/store/create', label: 'Thêm', mobileLabel: 'Thêm', Icon: PlusIcon },
            { href: '/account', active: currentPath === '/account', label: 'Tài khoản', mobileLabel: 'TK', Icon: AccountIcon },
        ]

    const brandHref = '/'

    return (
        <>
            {/* ── Top bar ── */}
            <nav className="hidden sm:block sticky top-0 z-50 border-b border-gray-200 bg-white/70 backdrop-blur-md dark:border-gray-800 dark:bg-black/60 supports-[backdrop-filter]:bg-white/50">
                <div className="mx-auto flex h-14 w-full max-w-screen-md items-center px-3 sm:px-4 gap-2">
                    {/* Brand */}
                    <Link href={brandHref} className="flex items-center font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base shrink-0">
                        <span className="text-primary">StoreVis</span>
                    </Link>

                    {/* Desktop nav links (hidden on mobile) */}
                    <div className="ml-auto hidden sm:flex items-center gap-1.5">
                        {navLinks.map(({ href, active, label, Icon }) => (
                            <Link
                                key={href}
                                href={href}
                                aria-current={active ? 'page' : undefined}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${active
                                        ? 'bg-gray-900 text-white border-transparent dark:bg-gray-100 dark:text-gray-900'
                                        : 'text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                <span>{label}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            </nav>

            {/* ── Bottom tab bar (mobile only) ── */}
            <div className="sm:hidden fixed bottom-0 inset-x-0 z-[60] bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 safe-area-bottom">
                <div className="flex h-14 max-w-screen-md mx-auto w-full">
                    {navLinks.map(({ href, active, label, mobileLabel, Icon }) => (
                        <Link
                            key={href}
                            href={href}
                            aria-current={active ? 'page' : undefined}
                            className={`flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 transition-colors ${active
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-gray-400 dark:text-gray-500 active:text-gray-600 dark:active:text-gray-300'
                                }`}
                        >
                            <Icon className="w-5 h-5 shrink-0" />
                            <span className={`w-full truncate text-center whitespace-nowrap text-[9px] font-medium leading-none ${active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                {mobileLabel || label}
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
        </>
    )
}
