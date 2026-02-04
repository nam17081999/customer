import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-context";
import { LogOut, Plus } from "lucide-react";
import { useRouter } from 'next/router'

export default function Navbar() {
    const { user, signOut, loading } = useAuth();
    const router = useRouter()
    const isSearchPage = router.pathname === '/'
    const isAddStorePage = router.pathname === '/store/create'

    return (
        <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/70 backdrop-blur-md dark:border-gray-800 dark:bg-black/60 supports-[backdrop-filter]:bg-white/50">
            <div className="mx-auto flex h-14 w-full max-w-screen-md items-center px-3 sm:px-4 gap-2 sm:gap-3">
                {/* Brand / Logo */}
                <Link href="/" className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">
                    <span className="text-primary">StoreVis</span>
                    <span className="hidden sm:inline text-[10px] font-normal text-gray-500 dark:text-gray-400">Beta</span>
                </Link>
                {/* Right aligned actions */}
                <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
                    {/* Search */}
                    <Button 
                        asChild
                        size="sm" 
                        variant={isSearchPage ? 'default' : 'ghost'}
                        className="flex items-center gap-1.5 px-2.5 sm:px-3 border border-gray-300 dark:border-gray-700 text-xs sm:text-sm"
                        aria-current={isSearchPage ? 'page' : undefined}
                    >
                        <Link href="/" aria-label="Trang tìm kiếm">
                            <div className="flex items-center gap-1.5">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <span className="inline text-xs sm:text-sm">Tìm kiếm</span>
                            </div>
                        </Link>
                    </Button>
                    {/* Add Store */}
                    {user && (
                        <Button
                            asChild
                            size="sm"
                            variant={isAddStorePage ? 'default' : 'ghost'}
                            className="flex items-center gap-1.5 px-2.5 sm:px-3 border border-gray-300 dark:border-gray-700 text-xs sm:text-sm"
                            aria-current={isAddStorePage ? 'page' : undefined}
                        >
                            <Link href="/store/create" aria-label="Thêm cửa hàng">
                                <Plus className="h-4 w-4" />
                                <span className="inline text-xs sm:text-sm">Thêm</span>
                            </Link>
                        </Button>
                    )}
                    {/* Auth */}
                    {!loading && user ? (
                        <Button size="icon" variant="outline" onClick={signOut} aria-label="Đăng xuất" className="h-8 w-8">
                            <LogOut className="h-4 w-4" />
                        </Button>
                    ) : (
                        <Button asChild size="sm" variant="default" className="text-xs sm:text-sm px-2.5 sm:px-3">
                            <Link href="/login">Đăng nhập</Link>
                        </Button>
                    )}
                </div>
            </div>
        </nav>
    );
}
