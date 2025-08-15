import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-context";
import { LogOut, Plus } from "lucide-react";
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'

const STORAGE_KEY = 'selectedStores'

export default function Navbar() {
    const { user, signOut, loading } = useAuth();
    const router = useRouter()
    const [visitListCount, setVisitListCount] = useState(0)
    const isSearchPage = router.pathname === '/'
    const isVisitListPage = router.pathname === '/visit-list'
    const isAddStorePage = router.pathname === '/store/create'

    // Load visit list count from localStorage
    useEffect(() => {
        const updateCount = () => {
            const saved = localStorage.getItem(STORAGE_KEY)
            if (saved) {
                try {
                    const stores = JSON.parse(saved)
                    setVisitListCount(stores.length)
                } catch (e) {
                    console.error('Failed to load selected stores:', e)
                    setVisitListCount(0)
                }
            } else {
                setVisitListCount(0)
            }
        }
        updateCount()
        window.addEventListener('storage', updateCount)
        window.addEventListener('selectedStoresUpdated', updateCount)
        return () => {
            window.removeEventListener('storage', updateCount)
            window.removeEventListener('selectedStoresUpdated', updateCount)
        }
    }, [])

    const badgeValue = visitListCount > 9 ? '9+' : visitListCount

    return (
        <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/70 backdrop-blur-md dark:border-gray-800 dark:bg-black/60 supports-[backdrop-filter]:bg-white/50">
            <div className="mx-auto flex h-14 max-w-6xl items-center px-4 gap-4">
                {/* Brand / Logo */}
                <Link href="/" className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
                    <span className="text-primary">StoreVis</span>
                    <span className="hidden sm:inline text-xs font-normal text-gray-500 dark:text-gray-400">Beta</span>
                </Link>

                {/* Right aligned actions */}
                <div className="ml-auto flex items-center gap-2">
                    {/* Search */}
                    <Button 
                        asChild
                        size="sm" 
                        variant={isSearchPage ? 'default' : 'ghost'}
                        className="flex items-center gap-2 px-3 border border-gray-300 dark:border-gray-700"
                        aria-current={isSearchPage ? 'page' : undefined}
                    >
                        <Link href="/" aria-label="Trang tìm kiếm">
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <span className="hidden sm:inline">Tìm kiếm</span>
                            </div>
                        </Link>
                    </Button>

                    {/* Add Store */}
                    {user && (
                        <Button
                            asChild
                            size="sm"
                            variant={isAddStorePage ? 'default' : 'ghost'}
                            className="flex items-center gap-2 px-3 border border-gray-300 dark:border-gray-700"
                            aria-current={isAddStorePage ? 'page' : undefined}
                        >
                            <Link href="/store/create" aria-label="Thêm cửa hàng">
                                <Plus className="h-4 w-4" />
                                <span className="hidden sm:inline">Thêm cửa hàng</span>
                            </Link>
                        </Button>
                    )}

                    {/* Visit List */}
                    <Button
                        asChild
                        size="sm"
                        variant={isVisitListPage ? 'default' : 'ghost'}
                        className="relative flex items-center gap-2 px-3 border border-gray-300 dark:border-gray-700"
                        aria-current={isVisitListPage ? 'page' : undefined}
                    >
                        <Link href="/visit-list" aria-label="Danh sách ghé thăm">
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                <span className="hidden sm:inline">Danh sách</span>
                                {visitListCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full h-4 min-w-[1rem] px-1 flex items-center justify-center text-[10px] leading-none font-medium">
                                        {badgeValue}
                                    </span>
                                )}
                            </div>
                        </Link>
                    </Button>

                    {/* Auth */}
                    {!loading && user ? (
                        <Button size="icon" variant="outline" onClick={signOut} aria-label="Đăng xuất">
                            <LogOut className="h-4 w-4" />
                        </Button>
                    ) : (
                        <Button asChild size="sm" variant="default">
                            <Link href="/login">Đăng nhập</Link>
                        </Button>
                    )}
                </div>
            </div>
        </nav>
    );
}

