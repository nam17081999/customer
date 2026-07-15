import { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/router";
import { FullPageLoading } from "@/components/ui/full-page-loading";
import { Msg } from "@/components/ui/msg";
import { fetchActiveVehicles, createFuelLog } from "@/api/vehicles/client";
import { Fuel } from "lucide-react";

export default function RecordFuelPage() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { replace } = useRouter()
  const [vehicles, setVehicles] = useState([])
  const [vehicleId, setVehicleId] = useState("")
  const [fuelAmount, setFuelAmount] = useState("")
  const [fuelCost, setFuelCost] = useState("")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState({ type: "", text: "", show: false })

  const showMsg = useCallback((type, text) => {
    setMsg({ type, text, show: true })
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) { replace("/login?from=/vehicles/record-fuel"); return }

    fetchActiveVehicles().then(({ data, error }) => {
      if (error) {
        showMsg("error", "Không thể tải danh sách xe.")
      } else {
        setVehicles(data)
        if (data.length > 0) setVehicleId(data[0].id)
      }
    }).finally(() => setLoading(false))
  }, [authLoading, isAuthenticated, replace, showMsg])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!vehicleId || !fuelAmount || parseFloat(fuelAmount) <= 0) return
    setSaving(true)
    const { error } = await createFuelLog({
      vehicle_id: vehicleId,
      fuel_amount: parseFloat(fuelAmount),
      fuel_cost: fuelCost ? parseInt(fuelCost, 10) : null,
      note: note.trim() || null,
    })
    setSaving(false)

    if (error) {
      showMsg("error", "Không thể ghi nhận xăng. Vui lòng thử lại.")
      return
    }

    showMsg("success", "Đã ghi nhận xăng thành công!")
    setFuelAmount("")
    setFuelCost("")
    setNote("")
  }

  const formatCurrency = (val) => {
    if (!val) return ""
    return Number(val).toLocaleString("vi-VN")
  }

  if (authLoading || !isAuthenticated) {
    return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />
  }

  return (
    <>
      <Head>
        <title>Ghi nhận xăng - NPP Hà Công</title>
      </Head>

      <div className="min-h-full">
        <div className="max-w-screen-sm mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
          <Msg type={msg.type} show={msg.show} onClose={() => setMsg((m) => ({ ...m, show: false }))}>
            {msg.text}
          </Msg>

          <Card className="rounded-2xl border border-gray-800">
            <CardContent className="p-4 sm:p-5">
              {loading ? (
                <p className="text-sm text-gray-500">Đang tải danh sách xe...</p>
              ) : vehicles.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <Fuel className="mx-auto size-8 text-gray-600" />
                  <p className="text-base font-semibold text-gray-100">Chưa có xe nào</p>
                  <p className="text-sm text-gray-500">Vui lòng liên hệ admin để thêm xe trước.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label className="mb-1.5 block">Chọn xe</Label>
                    <select
                      value={vehicleId}
                      onChange={(e) => setVehicleId(e.target.value)}
                      className="flex h-11 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-base text-gray-100 focus:outline-none focus-visible:ring-white"
                      required
                    >
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} — {v.plate}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="mb-1.5 block">Số lít xăng</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={fuelAmount}
                        onChange={(e) => setFuelAmount(e.target.value)}
                        placeholder="VD: 10.5"
                        required
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5 block">Thành tiền (VNĐ)</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={fuelCost ? formatCurrency(fuelCost) : fuelCost}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, "")
                          setFuelCost(raw)
                        }}
                        placeholder="VD: 200,000"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="mb-1.5 block">Ghi chú (không bắt buộc)</Label>
                    <Input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="VD: Đổ tại cây xăng ABC"
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full"
                    size="lg"
                    disabled={saving || !vehicleId || !fuelAmount || parseFloat(fuelAmount) <= 0}
                  >
                    {saving ? "Đang lưu..." : "Ghi nhận"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
