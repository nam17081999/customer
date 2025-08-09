import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-gray-800 dark:bg-black/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Customer
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Danh sách</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/store/create">Thêm cửa hàng</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}
