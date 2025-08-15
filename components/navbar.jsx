import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-context";
import { LogOut } from "lucide-react";
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'

const STORAGE_KEY = 'selectedStores'

export default function Navbar() {
    const { user, signOut, loading } = useAuth();
    const router = useRouter()
    const [visitListCount, setVisitListCount] = useState(0)
    const isSearchPage = router.pathname === '/'
    const isVisitListPage = router.pathname === '/visit-list'

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

        // Initial load
        updateCount()

        // Listen for storage changes
        window.addEventListener('storage', updateCount)
        
        // Custom event for same-tab updates
        window.addEventListener('selectedStoresUpdated', updateCount)

        return () => {
            window.removeEventListener('storage', updateCount)
            window.removeEventListener('selectedStoresUpdated', updateCount)
        }
    }, [])

    return (
        <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-gray-800 dark:bg-black/60">
            <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
                {/* Left: Navigation Buttons */}
                <div className="flex items-center gap-2">
                    <Link href="/" className="hidden text-sm font-semibold text-gray-900 sm:inline dark:text-gray-100">
                        Cửa hàng
                    </Link>
                    <div className="flex gap-1 ml-2">
                        <Link href="/">
                            <Button 
                                size="sm" 
                                variant={isSearchPage ? 'default' : 'outline'}
                                className="flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <span className="hidden sm:inline">Tìm kiếm</span>
                            </Button>
                        </Link>
                        <Link href="/visit-list">
                            <Button 
                                size="sm" 
                                variant={isVisitListPage ? 'default' : 'outline'}
                                className="relative flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                <span className="hidden sm:inline">Danh sách</span>
                                {visitListCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center text-[10px]">
                                        {visitListCount}
                                    </span>
                                )}
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="ml-auto flex items-center gap-2">
                    {user && (
                        <Button asChild size="sm">
                            <Link href="/store/create">Thêm CH</Link>
                        </Button>
                    )}
                    {!loading && user ? (
                            <Button size="icon" variant="outline" onClick={signOut} aria-label="Đăng xuất">
                                <LogOut className="h-4 w-4" />
                            </Button>
                    ) : (
                        <Button asChild size="sm" variant="secondary">
                            <Link href="/login">Đăng nhập</Link>
                        </Button>
                    )}
                </div>
            </div>
        </nav>
    );
}

