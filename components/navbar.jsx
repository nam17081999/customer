import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-context";
import { LogOut } from "lucide-react";

export default function Navbar() {
    const { user, signOut, loading } = useAuth();

    return (
        <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-gray-800 dark:bg-black/60">
            <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
                {/* Left brand: hidden on small screens */}
                <Link href="/" className="hidden text-sm font-semibold text-gray-900 sm:inline dark:text-gray-100">
                    Cửa hàng
                </Link>
                {/* Placeholder to balance layout on small screens */}
                <span className="text-sm font-semibold opacity-0 sm:hidden">Cửa hàng</span>

                <div className="ml-auto flex items-center gap-2">
                    <Button asChild variant="ghost" size="sm">
                        <Link href="/store/arrange">Xếp đơn</Link>
                    </Button>
                    {user && (
                        <Button asChild size="sm">
                            <Link href="/store/create">Thêm CH</Link>
                        </Button>
                    )}
                    {!loading && user ? (
                        <>
                            <span className="hidden text-xs text-gray-600 dark:text-gray-400 sm:inline">{user.email}</span>
                            <Button size="icon" variant="outline" onClick={signOut} aria-label="Đăng xuất">
                                <LogOut className="h-4 w-4" />
                            </Button>
                        </>
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

