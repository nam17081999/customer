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
const LogoutIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
)
const LoginIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
    </svg>
)

export default function Navbar() {
    const pathname = usePathname()
    const { user, signOut } = useAuth() || {}
    const isSearchPage = pathname === '/'
    const isMapPage = pathname === '/map'
    const isAddStorePage = pathname === '/store/create'

    const navLinks = [
        { href: '/', active: isSearchPage, label: 'Tìm kiếm', Icon: SearchIcon },
        { href: '/map', active: isMapPage, label: 'Bản đồ', Icon: MapIcon },
        { href: '/store/create', active: isAddStorePage, label: 'Thêm', Icon: PlusIcon },
    ]

    return (
        <>
            {/* ── Top bar ── */}
            <nav className="border-b border-gray-200 bg-white/70 backdrop-blur-md dark:border-gray-800 dark:bg-black/60 supports-[backdrop-filter]:bg-white/50">
                <div className="mx-auto flex h-14 w-full max-w-screen-md items-center px-3 sm:px-4 gap-2">
                    {/* Brand */}
                    <Link href="/" className="flex items-center font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base shrink-0">
                        <span className="text-primary">StoreVis</span>
                    </Link>

                    {/* Desktop nav links (hidden on mobile) */}
                    <div className="ml-auto hidden sm:flex items-center gap-1.5">
                        {navLinks.map(({ href, active, label, Icon }) => (
                            <Link
                                key={href}
                                href={href}
                                aria-current={active ? 'page' : undefined}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                                    active
                                        ? 'bg-gray-900 text-white border-transparent dark:bg-gray-100 dark:text-gray-900'
                                        : 'text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                <span>{label}</span>
                            </Link>
                        ))}
                    </div>

                    {/* Auth button — shown on both mobile and desktop */}
                    <div className="ml-auto sm:ml-1.5 shrink-0">
                        {user ? (
                            <button
                                onClick={() => signOut()}
                                aria-label="Đăng xuất"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition"
                            >
                                <LogoutIcon className="w-4 h-4 shrink-0" />
                                <span className="hidden sm:inline">Đăng xuất</span>
                            </button>
                        ) : (
                            <Link
                                href="/login"
                                aria-label="Đăng nhập"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 transition"
                            >
                                <LoginIcon className="w-4 h-4 shrink-0" />
                                <span className="hidden sm:inline">Đăng nhập</span>
                            </Link>
                        )}
                    </div>
                </div>
            </nav>

            {/* ── Bottom tab bar (mobile only) ── */}
            <div className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800">
                <div className="flex h-14 max-w-screen-md mx-auto">
                    {navLinks.map(({ href, active, label, Icon }) => (
                        <Link
                            key={href}
                            href={href}
                            aria-current={active ? 'page' : undefined}
                            className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
                                active
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-gray-500 dark:text-gray-400 active:text-gray-700 dark:active:text-gray-200'
                            }`}
                        >
                            <Icon className="w-5 h-5" />
                            <span className="text-[10px] font-medium leading-none">{label}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </>
    )
}
