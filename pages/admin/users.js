import { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { USER_ROLES } from "@/lib/authz";
import { formatDateTime } from "@/helper/validation";
import { Pencil, Check, X } from "lucide-react";
import { getAccessToken } from "@/api/auth/auth-client";

const roleLabelMap = {
  [USER_ROLES.ADMIN]: "Admin",
  [USER_ROLES.TELESALE]: "Telesale",
  [USER_ROLES.GUEST]: "Khách (Guest)",
};

const initialCreateForm = {
  email: "",
  password: "",
  role: USER_ROLES.TELESALE,
  name: "",
  phone: "",
};

function ProfileForm({ user, onSave }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(user.id, { name: name.trim(), phone: phone.trim() });
      setEditing(false);
    } catch {}
    setSaving(false);
  };

  const handleCancel = () => {
    setName(user.name || "");
    setPhone(user.phone || "");
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-2">
        <div>
          <Label className="text-xs text-gray-400">Tên</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Chưa có tên"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-400">SĐT</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Chưa có SĐT"
            className="h-8 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "..." : <Check className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancel}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      <div className="flex-1 text-sm text-gray-300">
        {user.name ? (
          <>
            <span className="font-medium text-gray-100">{user.name}</span>
            {user.phone && (
              <span className="ml-2 text-gray-400">· {user.phone}</span>
            )}
          </>
        ) : (
          <span className="text-gray-500 italic">Chưa có thông tin</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-gray-200"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {};
  const [pageReady, setPageReady] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [actionLoading, setActionLoading] = useState({});
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [createLoading, setCreateLoading] = useState(false);
  const [resetPasswords, setResetPasswords] = useState({});

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setPageReady(false);
      void router.replace("/login?from=/admin/users").catch((err) => {
        if (!err?.cancelled) console.error("Redirect to login failed:", err);
      });
      return;
    }
    if (!isAdmin) {
      setPageReady(false);
      void router.replace("/account").catch((err) => {
        if (!err?.cancelled) console.error("Redirect to account failed:", err);
      });
      return;
    }
    setPageReady(true);
  }, [authLoading, isAuthenticated, isAdmin, router]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Server error");
      setUsers(data.users || []);
    } catch (err) {
      console.error(err);
      setUsers([]);
      setError(err.message || "Không tải được danh sách người dùng.");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!pageReady) return;
    loadUsers();
  }, [pageReady, loadUsers]);

  const handleProfileSave = async (userId, { name, phone }) => {
    const token = await getAccessToken();
    const response = await fetch(`/api/admin/users/${userId}/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, phone }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Server error");
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, name: data.name, phone: data.phone } : u,
      ),
    );
    setMessage("Cập nhật thông tin thành công!");
  };

  const withRowLoading = async (userId, runner) => {
    setActionLoading((prev) => ({ ...prev, [userId]: true }));
    setError("");
    setMessage("");
    try {
      await runner();
    } catch (err) {
      console.error(err);
      setError(err.message || "Thao tác thất bại.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    await withRowLoading(userId, async () => {
      const token = await getAccessToken();
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Server error");
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, role: data.role } : user,
        ),
      );
      setMessage("Cập nhật quyền thành công!");
    });
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    if (createLoading) return;
    setCreateLoading(true);
    setError("");
    setMessage("");
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(createForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Server error");
      setUsers((prev) => [data.user, ...prev]);
      setCreateForm(initialCreateForm);
      setMessage(`Đã tạo tài khoản ${data.user.email}.`);
    } catch (err) {
      console.error(err);
      setError(err.message || "Không tạo được tài khoản.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleResetPassword = async (userId) => {
    const nextPassword = String(resetPasswords[userId] || "");
    await withRowLoading(userId, async () => {
      const token = await getAccessToken();
      const response = await fetch(`/api/admin/users/${userId}/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: nextPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Server error");
      setResetPasswords((prev) => ({ ...prev, [userId]: "" }));
      setMessage("Đặt lại mật khẩu thành công!");
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-full">
        <div className="mx-auto max-w-screen-lg px-3 py-6 sm:px-4">
          <p className="text-sm text-gray-400">Đang kiểm tra đăng nhập...</p>
        </div>
      </div>
    );
  }

  if (!pageReady) return null;

  return (
    <>
      <Head>
        <title>Quản lý tài khoản - NPP Hà Công</title>
      </Head>

      <div
        className="flex min-h-0 flex-1 flex-col gap-2 p-2 sm:gap-3 sm:p-3 lg:max-h-[calc(100vh-3rem)] lg:overflow-hidden lg:p-4 lg:mx-auto lg:w-full"
        style={{ maxWidth: "1900px" }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-100 sm:text-xl">
              Quản lý tài khoản
            </h1>
            <p className="text-sm text-gray-400">
              Tạo, cập nhật thông tin, đổi quyền và đặt lại mật khẩu.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadUsers}
            disabled={loading}
            className="shrink-0"
          >
            {loading ? "Đang tải..." : "Làm mới"}
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-lg border border-green-900 bg-green-950/30 px-3 py-2 text-sm text-green-300">
            {message}
          </div>
        )}

        <form
          className="rounded-xl border border-gray-800 bg-gray-950/70 p-4 space-y-4"
          onSubmit={handleCreateUser}
        >
          <div>
            <h2 className="text-base font-semibold text-gray-100">
              Tạo tài khoản mới
            </h2>
            <p className="text-sm text-gray-400">
              Admin tạo trực tiếp email, mật khẩu ban đầu và quyền truy cập.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <Label className="text-sm text-gray-300">Email</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, email: e.target.value }))
                }
                placeholder="nhanvien@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-gray-300">Tên</Label>
              <Input
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Nguyễn Văn A"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-gray-300">SĐT</Label>
              <Input
                value={createForm.phone}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, phone: e.target.value }))
                }
                placeholder="0912345678"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-gray-300">Mật khẩu</Label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, password: e.target.value }))
                }
                placeholder="Ít nhất 6 ký tự"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-gray-300">Quyền</Label>
              <select
                className="flex h-10 w-full items-center rounded-md border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-gray-200 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                value={createForm.role}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, role: e.target.value }))
                }
              >
                {Object.values(USER_ROLES).map((r) => (
                  <option key={r} value={r}>
                    {roleLabelMap[r] || r}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full" disabled={createLoading}>
                {createLoading ? "Đang tạo..." : "Tạo tài khoản"}
              </Button>
            </div>
          </div>
        </form>

        {/* Danh sách */}
        {!loading && users.length === 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-4 text-sm text-gray-400">
            Không có dữ liệu người dùng.
          </div>
        )}

        <div className="space-y-2 overflow-hidden lg:flex-1 lg:overflow-y-auto lg:space-y-2.5">
          {users.map((user) => {
            const userId = user.id;
            const isProcessing = Boolean(actionLoading[userId]);
            return (
              <Card
                key={userId}
                className="rounded-2xl border border-gray-800 overflow-hidden"
              >
                <CardContent className="p-4 sm:p-5 space-y-4">
                  {/* Email + thời gian */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <h2 className="text-base font-semibold text-gray-100 break-all">
                      {user.email || "Email không rõ"}
                    </h2>
                    <span className="text-xs text-gray-500 shrink-0">
                      {formatDateTime(user.created_at)}
                    </span>
                  </div>

                  {/* Tên + SĐT (inline edit) */}
                  <ProfileForm user={user} onSave={handleProfileSave} />

                  {/* active info */}
                  <p className="text-xs text-gray-600">
                    Lần cuối:{" "}
                    {user.last_sign_in_at
                      ? formatDateTime(user.last_sign_in_at)
                      : "Chưa đăng nhập"}
                  </p>

                  {/* Quyền + reset mật khẩu */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">Quyền</Label>
                      <select
                        className="flex h-10 w-full items-center rounded-md border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-gray-200 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-50"
                        value={user.role || USER_ROLES.GUEST}
                        disabled={isProcessing}
                        onChange={(e) =>
                          handleRoleChange(userId, e.target.value)
                        }
                      >
                        {Object.values(USER_ROLES).map((r) => (
                          <option key={r} value={r}>
                            {roleLabelMap[r] || r}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">
                        Mật khẩu mới
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          value={resetPasswords[userId] || ""}
                          onChange={(e) =>
                            setResetPasswords((p) => ({
                              ...p,
                              [userId]: e.target.value,
                            }))
                          }
                          placeholder="Nhập mật khẩu mới"
                          className="min-w-0"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0"
                          disabled={isProcessing}
                          onClick={() => handleResetPassword(userId)}
                        >
                          {isProcessing ? "..." : "Reset"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
