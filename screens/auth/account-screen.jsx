import { useEffect, useState, useMemo, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FullPageLoading } from "@/components/ui/full-page-loading";
import { useTheme } from "@/lib/ThemeContext";
import { Bell, BellOff, Package, FileText, Store } from "lucide-react";
import {
  loadPreferences,
  getCachedPreferences,
  subscribePreferences,
  setPreference,
} from "@/lib/notification-store";
import { THEME_OPTIONS, getThemeMeta } from "@/helper/theme";
import {
  ShoppingCart,
  List,
  Package as PkgIcon,
  Truck,
  ClipboardList,
  BarChart3,
  LayoutDashboard,
  Upload,
  Download,
  GitMerge,
  ShieldCheck,
  FileBarChart,
  Users,
  LogOut,
  Sun,
  Moon,
  User,
  ChevronRight,
} from "lucide-react";

// ─── Menu definitions ───────────────────────────────────────────────
const MENU_SECTIONS = {
  sales: {
    label: "Bán hàng",
    items: [
      {
        href: "/orders/new",
        label: "Lên đơn hàng",
        icon: ShoppingCart,
        accent: true,
      },
      { href: "/orders", label: "Danh sách đơn", icon: List },
      {
        href: "/inventory/products",
        label: "Hàng hóa & tồn kho",
        icon: PkgIcon,
      },
      { href: "/inventory/purchases/new", label: "Nhập hàng", icon: Truck },
      {
        href: "/inventory/purchases",
        label: "Phiếu nhập",
        icon: ClipboardList,
      },
      { href: "/inventory/reports", label: "Báo cáo tồn kho", icon: BarChart3 },
    ],
  },
  stores: {
    label: "Cửa hàng",
    items: [
      { href: "/overview", label: "Tổng quan", icon: LayoutDashboard },
      { href: "/store/import", label: "Nhập dữ liệu", icon: Upload },
      { href: "/store/export", label: "Xuất dữ liệu", icon: Download },
      { href: "/store/deduplicate", label: "Gộp trùng lặp", icon: GitMerge },
    ],
  },
  admin: {
    label: "Quản trị",
    items: [
      { href: "/store/verify", label: "Duyệt cửa hàng", icon: ShieldCheck },
      { href: "/store/reports", label: "Duyệt báo cáo", icon: FileBarChart },
      { href: "/admin/users", label: "Quản lý tài khoản", icon: Users },
    ],
  },
  telesale: {
    label: "Bán hàng",
    items: [
      {
        href: "/telesale/overview",
        label: "Màn telesale",
        icon: LayoutDashboard,
      },
    ],
  },
};

// ─── Helpers ────────────────────────────────────────────────────────

/** Extract initials from email (letters before @ and after dots) */
function getInitials(email) {
  if (!email) return "?";
  const local = email.split("@")[0] || "";
  const parts = local.split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

// ─── Notification Preferences ─────────────────────────────────────

const NOTIF_TYPES = [
  {
    key: "low-stock",
    label: "Hàng sắp hết",
    icon: PkgIcon,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
  },
  {
    key: "report",
    label: "Báo cáo chờ duyệt",
    icon: FileText,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
  },
  {
    key: "store-verify",
    label: "Cửa hàng mới",
    icon: Store,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
];

function NotificationPrefsCard({ isAdmin }) {
  const [prefs, setPrefs] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadPreferences().then((p) => {
      setPrefs(p);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    const unsub = subscribePreferences((p) => setPrefs({ ...p }));
    return unsub;
  }, []);

  const toggle = useCallback(
    async (type) => {
      const current = prefs[type];
      // default true nếu chưa có
      const newVal = current === undefined ? false : !current;
      setPrefs((prev) => ({ ...prev, [type]: newVal }));
      await setPreference(type, newVal);
    },
    [prefs],
  );

  if (!isAdmin) return null;

  return (
    <Card className="w-full border-gray-800 bg-gray-950 rounded-2xl overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wider">
          <span className="h-px flex-1 bg-gray-800" />
          <span>Thông báo</span>
          <span className="h-px flex-1 bg-gray-800" />
        </h2>

        <p className="text-xs text-gray-500 mb-4">
          Chọn loại thông báo bạn muốn nhận:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {NOTIF_TYPES.map(({ key, label, icon: Icon, color, bgColor }) => {
            const enabled = prefs[key] !== false; // default true
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggle(key)}
                disabled={!loaded}
                className={`relative flex items-center gap-3 rounded-xl border px-3 py-3 text-sm font-medium transition-all duration-150 ${
                  enabled
                    ? `${bgColor} border-transparent ${color}`
                    : "border-gray-800 bg-gray-900/50 text-gray-500 hover:border-gray-700"
                }`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${enabled ? bgColor : "bg-gray-800"}`}
                >
                  {enabled ? (
                    <Bell className={`h-4 w-4 ${color}`} />
                  ) : (
                    <BellOff className="h-4 w-4 text-gray-600" />
                  )}
                </div>
                <div className="text-left">
                  <p className={enabled ? "text-gray-200" : "text-gray-500"}>
                    {label}
                  </p>
                  <p className="text-[10px] mt-0.5 text-gray-500">
                    {enabled ? "Đang bật" : "Đã tắt"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
        {!loaded && (
          <p className="text-xs text-gray-600 mt-2">Đang tải cài đặt...</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

/**
 * Desktop sidebar — sticky, shows on sm and up.
 */
function DesktopSidebar({
  user,
  role,
  isAdmin,
  theme,
  setTheme,
  signingOut,
  onSignOut,
}) {
  const roleLabel = isAdmin
    ? "Admin"
    : role === "telesale"
      ? "Telesale"
      : "Khách";

  return (
    <aside className="hidden sm:block sm:w-[280px] xl:w-[320px] shrink-0">
      <div className="sm:sticky sm:top-4 space-y-4">
        {/* ── Profile card ── */}
        <Card className="overflow-hidden border-gray-800 bg-gray-950 rounded-2xl">
          <CardContent className="p-0">
            {/* Decorative top bar */}
            <div className="h-2 w-full bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--primary-600)]" />

            <div className="p-5 space-y-5">
              {/* Avatar + info */}
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--primary-600)] text-white text-lg font-bold shadow-lg shadow-primary/20">
                  {getInitials(user?.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-gray-100">
                    {user?.email}
                  </p>
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-gray-700 bg-gray-900 px-2.5 py-0.5 text-xs font-medium text-gray-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {roleLabel}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-800" />

              {/* Theme selector */}
              <div>
                <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Giao diện
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {THEME_OPTIONS.map((option) => {
                    const meta = getThemeMeta(option);
                    const active = theme === option;
                    const Icon = option === "dark" ? Moon : Sun;
                    return (
                      <button
                        key={option}
                        type="button"
                        className={`flex h-10 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-all duration-150 ${
                          active
                            ? "border-[color:var(--primary)]/50 bg-[color:var(--primary)]/10 text-[color:var(--primary)] shadow-sm shadow-primary/5"
                            : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600 hover:text-gray-200"
                        }`}
                        onClick={() => setTheme(option)}
                        aria-pressed={active}
                      >
                        <Icon className="h-4 w-4" />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-800" />

              {/* Logout */}
              <Button
                type="button"
                variant="destructive"
                className="w-full justify-center gap-2"
                onClick={onSignOut}
                disabled={signingOut}
              >
                <LogOut className="h-4 w-4" />
                {signingOut ? "Đang xuất..." : "Đăng xuất"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Quick info ── */}
        <Card className="border-gray-800 bg-gray-950 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500">Phiên bản</p>
            <p className="text-sm font-medium text-gray-300 mt-0.5">v0.1.0</p>
          </CardContent>
        </Card>
      </div>
    </aside>
  );
}

/**
 * Mobile profile header — appears only on mobile.
 */
function MobileProfileHeader({
  user,
  role,
  isAdmin,
  theme,
  setTheme,
  signingOut,
  onSignOut,
}) {
  const roleLabel = isAdmin
    ? "Admin"
    : role === "telesale"
      ? "Telesale"
      : "Khách";

  return (
    <Card className="overflow-hidden border-gray-800 bg-gray-950 rounded-2xl sm:hidden">
      <CardContent className="p-0">
        <div className="h-1.5 w-full bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--primary-600)]" />
        <div className="p-4 space-y-4">
          {/* Avatar + info row */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--primary-600)] text-white text-sm font-bold shadow-lg shadow-primary/20">
              {getInitials(user?.email)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-100">
                {user?.email}
              </p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-gray-700 bg-gray-900 px-2 py-0.5 text-[11px] font-medium text-gray-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {roleLabel}
              </span>
            </div>
          </div>

          {/* Theme + logout row */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-gray-700 bg-gray-900 p-1">
              {THEME_OPTIONS.map((option) => {
                const meta = getThemeMeta(option);
                const active = theme === option;
                const Icon = option === "dark" ? Moon : Sun;
                return (
                  <button
                    key={option}
                    type="button"
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-all ${
                      active
                        ? "bg-[color:var(--primary)]/10 text-[color:var(--primary)]"
                        : "text-gray-500 hover:text-gray-200"
                    }`}
                    onClick={() => setTheme(option)}
                    aria-pressed={active}
                    title={meta.label}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="ml-auto gap-1.5"
              onClick={onSignOut}
              disabled={signingOut}
            >
              <LogOut className="h-3.5 w-3.5" />
              {signingOut ? "..." : "Thoát"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Menu section card — renders a group of links.
 */
function MenuCard({ section, filterFn }) {
  const items = filterFn ? section.items.filter(filterFn) : section.items;
  if (items.length === 0) return null;

  return (
    <Card className="w-full border-gray-800 bg-gray-950 rounded-2xl overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wider">
          <span className="h-px flex-1 bg-gray-800" />
          <span>{section.label}</span>
          <span className="h-px flex-1 bg-gray-800" />
        </h2>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-3 rounded-xl border px-3 sm:px-4 py-3 text-sm font-medium transition-all duration-150 ${
                  item.accent
                    ? "text-white border-transparent"
                    : "border-gray-800 bg-gray-900/50 text-gray-300 hover:border-gray-700 hover:bg-gray-900 hover:text-gray-100"
                }`}
                style={
                  item.accent
                    ? {
                        background:
                          "linear-gradient(135deg, var(--primary), var(--primary-600))",
                        boxShadow: "0 4px 12px rgba(2,132,199,0.25)",
                      }
                    : {}
                }
              >
                <Icon
                  className={`h-5 w-5 shrink-0 transition-transform duration-150 group-hover:scale-110 ${
                    item.accent
                      ? "text-white"
                      : "text-gray-500 group-hover:text-gray-300"
                  }`}
                />
                <span className="min-w-0 flex-1">{item.label}</span>
                <ChevronRight
                  className={`h-4 w-4 shrink-0 transition-all duration-150 ${
                    item.accent
                      ? "text-white/60 group-hover:translate-x-0.5 group-hover:text-white"
                      : "text-transparent group-hover:text-gray-500 group-hover:translate-x-0.5"
                  }`}
                />
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main screen ────────────────────────────────────────────────────

export default function AccountScreen() {
  const { replace } = useRouter();
  const {
    user,
    role,
    isAdmin,
    isTelesale,
    isAuthenticated,
    loading: authLoading,
    signOut,
  } = useAuth() || {};
  const { theme, setTheme } = useTheme();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      replace("/login?from=/account");
    }
  }, [authLoading, isAuthenticated, replace]);

  const handleSignOut = async () => {
    if (!signOut || signingOut) return;
    setSigningOut(true);
    const { error } = await signOut();
    setSigningOut(false);

    if (error) {
      console.error("Sign out error:", error);
    }
    replace("/login");
  };

  if (authLoading || !isAuthenticated) {
    return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />;
  }

  return (
    <>
      <Head>
        <title>Tài khoản - NPP Hà Công</title>
      </Head>

      <div className="min-h-full text-gray-100">
        <div
          className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8"
          style={{ maxWidth: "1900px" }}
        >
          {/* ── Page header ── */}
          <header className="mb-5 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 tracking-tight">
              Tài khoản
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Quản lý thông tin cá nhân và truy cập nhanh các tính năng
            </p>
          </header>

          {/* ── Mobile profile card ── */}
          <MobileProfileHeader
            user={user}
            role={role}
            isAdmin={isAdmin}
            theme={theme}
            setTheme={setTheme}
            signingOut={signingOut}
            onSignOut={handleSignOut}
          />

          {/* ── Layout: sidebar + content ── */}
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 lg:gap-8 mt-4 sm:mt-0">
            {/* Desktop sidebar */}
            <DesktopSidebar
              user={user}
              role={role}
              isAdmin={isAdmin}
              theme={theme}
              setTheme={setTheme}
              signingOut={signingOut}
              onSignOut={handleSignOut}
            />

            {/* ── Main content ── */}
            <main className="flex-1 min-w-0 space-y-4">
              {(isAdmin || isTelesale) && (
                <>
                  {isAdmin && (
                    <>
                      <MenuCard section={MENU_SECTIONS.sales} />
                      <MenuCard section={MENU_SECTIONS.stores} />
                      <MenuCard section={MENU_SECTIONS.admin} />
                    </>
                  )}
                  {isTelesale && !isAdmin && (
                    <MenuCard section={MENU_SECTIONS.telesale} />
                  )}
                </>
              )}

              {/* ─── Notification Preferences ─── */}
              <NotificationPrefsCard isAdmin={isAdmin} />

              {isTelesale && !isAdmin && (
                <Card className="w-full border-gray-800 bg-gray-950 rounded-2xl">
                  <CardContent className="p-4 sm:p-5">
                    <p className="text-base text-gray-400">
                      Telesale chỉ thấy các màn phục vụ gọi điện và theo dõi
                      trạng thái gọi.
                    </p>
                  </CardContent>
                </Card>
              )}

              {!isAdmin && !isTelesale && (
                <Card className="w-full border-gray-800 bg-gray-950 rounded-2xl">
                  <CardContent className="p-5 text-center">
                    <User className="mx-auto h-8 w-8 text-gray-600 mb-2" />
                    <p className="text-gray-400">
                      Bạn đang đăng nhập với quyền khách. Một số tính năng bị
                      giới hạn.
                    </p>
                  </CardContent>
                </Card>
              )}
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
