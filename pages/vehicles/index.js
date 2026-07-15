import { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAccessToken } from "@/api/auth/auth-client";
import { useRouter } from "next/router";
import { FullPageLoading } from "@/components/ui/full-page-loading";
import { Msg } from "@/components/ui/msg";
import { Pencil, X, Plus, Check } from "lucide-react";

function VehicleForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [plate, setPlate] = useState(initial?.plate || "");
  const [note, setNote] = useState(initial?.note || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !plate.trim()) return
    setSaving(true)
    await onSave({ name: name.trim(), plate: plate.trim(), note: note.trim() })
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label className="mb-1.5 block">Tên xe</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Xe tải 1" />
        </div>
        <div>
          <Label className="mb-1.5 block">Biển số</Label>
          <Input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="VD: 29H-12345" />
        </div>
        <div>
          <Label className="mb-1.5 block">Ghi chú</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="(không bắt buộc)" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={saving || !name.trim() || !plate.trim()}>
          {saving ? "Đang lưu..." : initial ? "Cập nhật" : "Thêm xe"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Hủy
          </Button>
        )}
      </div>
    </form>
  )
}

export default function VehiclesPage() {
  const { isAdmin, isAuthenticated, loading: authLoading } = useAuth()
  const { replace } = useRouter()
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [msg, setMsg] = useState({ type: "", text: "", show: false })

  const showMsg = useCallback((type, text) => {
    setMsg({ type, text, show: true })
  }, [])

  const fetchVehicles = useCallback(async () => {
    try {
      const token = await getAccessToken()
      const res = await fetch("/api/admin/vehicles", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setVehicles(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      showMsg("error", "Không thể tải danh sách xe.")
    } finally {
      setLoading(false)
    }
  }, [showMsg])

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) { replace("/login?from=/vehicles"); return }
    if (!isAdmin) { replace("/account"); return }
    fetchVehicles()
  }, [authLoading, isAuthenticated, isAdmin, replace, fetchVehicles])

  const handleCreate = async ({ name, plate, note }) => {
    try {
      const token = await getAccessToken()
      const res = await fetch("/api/admin/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, plate, note }),
      })
      if (!res.ok) throw new Error("Create failed")
      await fetchVehicles()
      showMsg("success", "Đã thêm xe mới.")
    } catch (err) {
      console.error(err)
      showMsg("error", "Không thể thêm xe.")
    }
  }

  const handleUpdate = async (id, { name, plate, note }) => {
    try {
      const token = await getAccessToken()
      const res = await fetch(`/api/admin/vehicles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, plate, note }),
      })
      if (!res.ok) throw new Error("Update failed")
      setEditingId(null)
      await fetchVehicles()
      showMsg("success", "Đã cập nhật xe.")
    } catch (err) {
      console.error(err)
      showMsg("error", "Không thể cập nhật xe.")
    }
  }

  const handleToggleActive = async (vehicle) => {
    try {
      const token = await getAccessToken()
      const res = await fetch(`/api/admin/vehicles/${vehicle.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active: !vehicle.active }),
      })
      if (!res.ok) throw new Error("Toggle failed")
      await fetchVehicles()
    } catch (err) {
      console.error(err)
      showMsg("error", "Không thể thay đổi trạng thái xe.")
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return "—"
    try {
      return new Date(dateStr).toLocaleDateString("vi-VN", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    } catch { return "—" }
  }

  if (authLoading || !isAuthenticated) {
    return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />
  }

  return (
    <>
      <Head>
        <title>Quản lý xe - NPP Hà Công</title>
      </Head>

      <div className="min-h-full">
        <div className="max-w-screen-lg mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
          <Msg type={msg.type} show={msg.show} onClose={() => setMsg((m) => ({ ...m, show: false }))}>
            {msg.text}
          </Msg>

          <Card className="rounded-2xl border border-gray-800">
            <CardContent className="p-4 sm:p-5">
              <h2 className="mb-4 text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Plus className="size-4" />
                Thêm xe mới
              </h2>
              <VehicleForm onSave={handleCreate} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-800">
            <CardContent className="p-4 sm:p-5">
              <h2 className="mb-4 text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Danh sách xe
              </h2>

              {loading ? (
                <p className="text-sm text-gray-500">Đang tải...</p>
              ) : vehicles.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <p className="text-base font-semibold text-gray-100">Chưa có xe nào</p>
                  <p className="text-sm text-gray-500">Thêm xe đầu tiên bằng form phía trên.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs uppercase tracking-wider text-gray-500 border-b border-gray-800">
                        <th className="pb-3 pr-4 font-semibold">Tên xe</th>
                        <th className="pb-3 pr-4 font-semibold">Biển số</th>
                        <th className="pb-3 pr-4 font-semibold hidden sm:table-cell">Ghi chú</th>
                        <th className="pb-3 pr-4 font-semibold">Trạng thái</th>
                        <th className="pb-3 font-semibold text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehicles.map((v) => (
                        <tr key={v.id} className="border-b border-gray-800/50 last:border-b-0">
                          {editingId === v.id ? (
                            <td colSpan={5} className="py-3">
                              <VehicleForm
                                initial={v}
                                onSave={(data) => handleUpdate(v.id, data)}
                                onCancel={() => setEditingId(null)}
                              />
                            </td>
                          ) : (
                            <>
                              <td className="py-3 pr-4">
                                <p className="text-sm font-medium text-gray-100">{v.name}</p>
                              </td>
                              <td className="py-3 pr-4">
                                <span className="text-sm text-gray-300">{v.plate}</span>
                              </td>
                              <td className="py-3 pr-4 hidden sm:table-cell">
                                <span className="text-sm text-gray-500">{v.note || "—"}</span>
                              </td>
                              <td className="py-3 pr-4">
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  v.active
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : "bg-gray-800 text-gray-500"
                                }`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${v.active ? "bg-emerald-400" : "bg-gray-500"}`} />
                                  {v.active ? "Hoạt động" : "Tạm ngưng"}
                                </span>
                              </td>
                              <td className="py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => setEditingId(v.id)}
                                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
                                  >
                                    <Pencil className="size-3.5" />
                                    <span className="hidden sm:inline">Sửa</span>
                                  </button>
                                  <button
                                    onClick={() => handleToggleActive(v)}
                                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors cursor-pointer ${
                                      v.active
                                        ? "text-amber-400 hover:bg-amber-500/10"
                                        : "text-emerald-400 hover:bg-emerald-500/10"
                                    }`}
                                  >
                                    {v.active ? "Vô hiệu" : "Kích hoạt"}
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
