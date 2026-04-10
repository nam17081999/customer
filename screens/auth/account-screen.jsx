import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { getOrRefreshStores, updateStoreInCache } from '@/lib/storeCache'
import { DISTRICT_WARD_SUGGESTIONS } from '@/lib/constants'
import { formatAddressParts } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

const ADMIN_TABS = [
  { id: 'overview', label: 'Tổng quan', hint: 'Số liệu nhanh và trạng thái hệ thống' },
  { id: 'import', label: 'Nhập dữ liệu', hint: 'Đi vào màn import và checklist thao tác' },
  { id: 'export', label: 'Xuất dữ liệu', hint: 'CSV, danh bạ và nhịp xuất dữ liệu' },
  { id: 'routes', label: 'Tuyến telesale', hint: 'Thêm, sửa, xóa tuyến chăm sóc' },
  { id: 'stores', label: 'Danh sách cửa hàng', hint: 'Xem chi tiết cửa hàng theo dạng list' },
]

const ADMIN_TAB_ROUTES = {
  overview: '/admin/overview',
  import: '/admin/import',
  export: '/admin/export',
  routes: '/admin/routes',
  stores: '/admin/stores',
}

const ADMIN_TAB_TITLES = {
  overview: 'Tổng quan admin - NPP Hà Công',
  import: 'Nhập dữ liệu admin - NPP Hà Công',
  export: 'Xuất dữ liệu admin - NPP Hà Công',
  routes: 'Tuyến telesale admin - NPP Hà Công',
  stores: 'Danh sách cửa hàng admin - NPP Hà Công',
}

const DEFAULT_ROUTE_FORM = {
  id: '',
  name: '',
  wards: [],
  callDays: [],
}

const WEEKDAY_OPTIONS = [
  { value: 'mon', label: 'T2' },
  { value: 'tue', label: 'T3' },
  { value: 'wed', label: 'T4' },
  { value: 'thu', label: 'T5' },
  { value: 'fri', label: 'T6' },
  { value: 'sat', label: 'T7' },
  { value: 'sun', label: 'CN' },
]

function hasValidCoordinates(store) {
  const lat = Number(store?.latitude)
  const lng = Number(store?.longitude)
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

function hasPhone(store) {
  return Boolean(String(store?.phone || '').trim() || String(store?.phone_secondary || '').trim())
}

function normalizeToken(value) {
  return String(value || '').trim().toLowerCase()
}

function formatDateTime(value) {
  if (!value) return 'Chưa có dữ liệu'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu'
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function getWeekdayLabel(value) {
  return WEEKDAY_OPTIONS.find((option) => option.value === value)?.label || value
}

function normalizeRouteRow(row) {
  return {
    ...row,
    wards: Array.isArray(row?.wards) ? row.wards.filter(Boolean) : [],
    call_days: Array.isArray(row?.call_days) ? row.call_days.filter(Boolean) : [],
  }
}

function AdminOverviewPanel({ stores, loading, onRefresh }) {
  const summary = useMemo(() => {
    const totalStores = stores.length
    const verifiedStores = stores.filter((store) => store.active === true).length
    const pendingStores = totalStores - verifiedStores
    const potentialStores = stores.filter((store) => store.is_potential).length
    const storesWithPhone = stores.filter(hasPhone).length
    const storesWithLocation = stores.filter(hasValidCoordinates).length
    const districts = new Set()
    const wards = new Set()
    let lastUpdatedAt = null

    stores.forEach((store) => {
      if (store.district) districts.add(store.district)
      if (store.ward) wards.add(store.ward)
      const updatedAt = new Date(store.updated_at || store.created_at || '').getTime()
      if (!Number.isNaN(updatedAt) && (!lastUpdatedAt || updatedAt > lastUpdatedAt)) {
        lastUpdatedAt = updatedAt
      }
    })

    return {
      totalStores,
      verifiedStores,
      pendingStores,
      potentialStores,
      storesWithPhone,
      storesWithLocation,
      districtCount: districts.size,
      wardCount: wards.size,
      lastUpdatedAt: lastUpdatedAt ? new Date(lastUpdatedAt).toISOString() : null,
    }
  }, [stores])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm text-gray-400">Màn tổng quan admin</p>
          <h2 className="text-2xl font-bold text-gray-100">Bảng điều hành dữ liệu</h2>
          <p className="max-w-3xl text-base text-gray-300">
            Theo dõi nhanh tiến độ xác thực, độ đầy đủ dữ liệu và nhóm cửa hàng đang phục vụ telesale.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onRefresh} disabled={loading}>
          {loading ? 'Đang tải...' : 'Làm mới dữ liệu'}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Tổng cửa hàng', value: summary.totalStores, tone: 'text-gray-100 border-gray-800 bg-gray-950' },
          { label: 'Đã xác thực', value: summary.verifiedStores, tone: 'text-green-200 border-green-900/60 bg-green-950/20' },
          { label: 'Chờ xác thực', value: summary.pendingStores, tone: 'text-amber-200 border-amber-900/60 bg-amber-950/20' },
          { label: 'Tiềm năng telesale', value: summary.potentialStores, tone: 'text-sky-200 border-sky-900/60 bg-sky-950/20' },
        ].map((item) => (
          <div key={item.label} className={`rounded-2xl border p-4 ${item.tone}`}>
            <p className="text-sm text-gray-400">{item.label}</p>
            <p className="mt-2 text-4xl font-bold">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
          <p className="text-sm text-gray-400">Cửa hàng có số điện thoại</p>
          <p className="mt-2 text-3xl font-semibold text-gray-100">{summary.storesWithPhone}</p>
        </div>
        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
          <p className="text-sm text-gray-400">Cửa hàng có vị trí</p>
          <p className="mt-2 text-3xl font-semibold text-gray-100">{summary.storesWithLocation}</p>
        </div>
        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
          <p className="text-sm text-gray-400">Dữ liệu mới nhất</p>
          <p className="mt-2 text-xl font-semibold text-gray-100">{formatDateTime(summary.lastUpdatedAt)}</p>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
          <p className="text-sm text-gray-400">Phạm vi dữ liệu</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-800 bg-black/30 p-3">
              <p className="text-sm text-gray-400">Số huyện có dữ liệu</p>
              <p className="mt-1 text-2xl font-semibold text-gray-100">{summary.districtCount}</p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-black/30 p-3">
              <p className="text-sm text-gray-400">Số xã/phường có dữ liệu</p>
              <p className="mt-1 text-2xl font-semibold text-gray-100">{summary.wardCount}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
          <p className="text-sm text-gray-400">Lối đi nhanh</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Button asChild>
              <Link href="/admin/overview">Mở màn tổng quan</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/store/verify">Mở màn xác thực</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/store/reports">Mở màn báo cáo</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/telesale/overview">Mở telesale</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AdminImportPanel() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm text-gray-400">Màn nhập dữ liệu</p>
        <h2 className="text-2xl font-bold text-gray-100">Nhập nhiều cửa hàng theo quy trình admin</h2>
        <p className="max-w-3xl text-base text-gray-300">
          Dùng file CSV mẫu, kiểm tra preview nghi trùng rồi mới nhập. Màn này là hub desktop để vào đúng flow nhập hiện có.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
          <h3 className="text-xl font-semibold text-gray-100">Checklist trước khi nhập</h3>
          <div className="mt-4 space-y-3">
            {[
              'File phải có đủ các cột bắt buộc: Tên cửa hàng, Xã / Phường, Quận / Huyện.',
              'Màn import sẽ đọc danh sách store hiện có qua cache để dò nghi trùng trước khi ghi dữ liệu.',
              'Chỉ các dòng trạng thái hợp lệ mới được nhập vào hệ thống.',
              'Sau khi nhập xong, cache và sự kiện đồng bộ store sẽ được cập nhật theo flow hiện có.',
            ].map((item) => (
              <div key={item} className="rounded-xl border border-gray-800 bg-black/30 px-4 py-3 text-base text-gray-300">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
          <h3 className="text-xl font-semibold text-gray-100">Thao tác</h3>
          <div className="mt-4 flex flex-col gap-3">
            <Button asChild>
              <Link href="/admin/import">Mở màn nhập dữ liệu</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/store/verify">Kiểm tra chờ xác thực</Link>
            </Button>
          </div>
          <div className="mt-5 rounded-xl border border-sky-900/60 bg-sky-950/20 p-4 text-base text-sky-100">
            Gợi ý: nên xử lý import trên desktop để xem preview nghi trùng và lỗi dữ liệu dễ hơn mobile.
          </div>
        </div>
      </div>
    </div>
  )
}

function AdminExportPanel({ stores }) {
  const storesWithPhone = useMemo(() => stores.filter(hasPhone), [stores])

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm text-gray-400">Màn xuất dữ liệu</p>
        <h2 className="text-2xl font-bold text-gray-100">Xuất CSV và danh bạ từ cùng một hub</h2>
        <p className="max-w-3xl text-base text-gray-300">
          Dữ liệu xuất vẫn lấy trực tiếp từ Supabase theo route hiện có. Khu vực này gom thống kê và nút mở nhanh theo tác vụ.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
          <p className="text-sm text-gray-400">Tổng cửa hàng hiện có</p>
          <p className="mt-2 text-3xl font-semibold text-gray-100">{stores.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
          <p className="text-sm text-gray-400">Cửa hàng có số điện thoại</p>
          <p className="mt-2 text-3xl font-semibold text-gray-100">{storesWithPhone.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
          <p className="text-sm text-gray-400">Loại xuất</p>
          <p className="mt-2 text-xl font-semibold text-gray-100">CSV, VCF, màn đầy đủ</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
          <h3 className="text-xl font-semibold text-gray-100">Xuất dữ liệu tổng</h3>
          <p className="mt-2 text-base text-gray-300">
            Bao gồm toàn bộ cửa hàng chưa xóa mềm để đưa sang Excel hoặc xử lý ngoài hệ thống.
          </p>
          <div className="mt-4">
            <Button asChild>
              <Link href="/store/export-data">Mở xuất CSV</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
          <h3 className="text-xl font-semibold text-gray-100">Xuất danh bạ gọi điện</h3>
          <p className="mt-2 text-base text-gray-300">
            Dùng cho máy gọi hoặc điện thoại. Chỉ lấy các cửa hàng có số điện thoại hợp lệ.
          </p>
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link href="/store/export-contacts">Mở xuất VCF</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
          <h3 className="text-xl font-semibold text-gray-100">Màn xuất đầy đủ</h3>
          <p className="mt-2 text-base text-gray-300">
            Giữ lại route cũ nếu cần làm việc theo đúng flow đang có của hệ thống.
          </p>
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link href="/admin/export">Mở màn xuất dữ liệu</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RouteEditor({
  routeForm,
  routeError,
  editingRouteId,
  routeSaving,
  routeLoading,
  routeModalOpen,
  onOpenChange,
  onChange,
  onToggleWard,
  onToggleCallDay,
  onSubmit,
  onReset,
}) {
  const wardGroups = useMemo(() => Object.entries(DISTRICT_WARD_SUGGESTIONS), [])

  return (
    <Dialog open={routeModalOpen} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col overflow-hidden rounded-[28px]">
        <div className="border-b border-gray-800 px-5 py-4">
          <DialogTitle className="text-2xl font-bold text-gray-100">
            {editingRouteId ? 'Sửa tuyến' : 'Thêm tuyến'}
          </DialogTitle>
          <DialogDescription className="mt-2 text-base text-gray-300">
            Mỗi tuyến chỉ gồm tên, danh sách xã và các ngày gọi lặp lại trong tuần.
          </DialogDescription>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {routeError && (
            <div className="rounded-xl border border-red-900/70 bg-red-950/20 px-4 py-3 text-base text-red-200">
              {routeError}
            </div>
          )}

          <label className="mt-1 block space-y-2">
            <span className="text-sm text-gray-400">Tên tuyến</span>
            <input
              type="text"
              value={routeForm.name}
              onChange={(event) => onChange('name', event.target.value)}
              className="h-11 w-full rounded-xl border border-gray-700 bg-gray-900 px-3 text-base text-gray-100 outline-none"
              placeholder="Ví dụ: Tuyến Dương Liễu"
            />
          </label>

          <div className="mt-5 space-y-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm text-gray-400">Xã thuộc tuyến</p>
                <p className="mt-1 text-sm text-gray-500">Chọn trực tiếp trên từng chip xã. Chip sáng là đã chọn.</p>
              </div>
              <div className="rounded-full border border-blue-900/60 bg-blue-950/20 px-3 py-2 text-sm text-blue-100">
                Đã chọn {routeForm.wards.length} xã
              </div>
            </div>

            {routeForm.wards.length > 0 && (
              <div className="flex flex-wrap gap-2 rounded-2xl border border-gray-800 bg-black/20 p-3">
                {routeForm.wards.map((ward) => (
                  <button
                    key={`selected-${ward}`}
                    type="button"
                    onClick={() => onToggleWard(ward)}
                    className="rounded-full border border-blue-500 bg-blue-500/12 px-3 py-2 text-sm text-blue-100 transition hover:bg-blue-500/20"
                  >
                    {ward}
                  </button>
                ))}
              </div>
            )}

            <div className="max-h-96 space-y-3 overflow-y-auto rounded-2xl border border-gray-800 bg-black/20 p-3">
              {wardGroups.map(([district, wards]) => (
                <div key={district} className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-base font-semibold text-gray-100">{district}</p>
                    <span className="text-sm text-gray-500">
                      {wards.filter((ward) => routeForm.wards.includes(ward)).length}/{wards.length} xã
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {wards.map((ward) => {
                      const checked = routeForm.wards.includes(ward)
                      return (
                        <button
                          key={`${district}-${ward}`}
                          type="button"
                          onClick={() => onToggleWard(ward)}
                          className={`min-h-11 rounded-full border px-4 py-2 text-base transition ${
                            checked
                              ? 'border-blue-500 bg-blue-500/12 text-blue-100'
                              : 'border-gray-800 bg-black/30 text-gray-300 hover:border-gray-700 hover:bg-gray-900'
                          }`}
                        >
                          {ward}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div>
              <p className="text-sm text-gray-400">Ngày gọi của tuyến</p>
              <p className="mt-1 text-sm text-gray-500">Ví dụ: tuyến Dương Liễu hiển thị vào T2 và T5.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              {WEEKDAY_OPTIONS.map((day) => {
                const checked = routeForm.callDays.includes(day.value)
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => onToggleCallDay(day.value)}
                    className={`min-h-11 rounded-2xl border px-3 py-2 text-base transition ${
                      checked
                        ? 'border-blue-500 bg-blue-500/12 text-blue-100'
                        : 'border-gray-800 bg-black/30 text-gray-300 hover:border-gray-700 hover:bg-gray-900'
                    }`}
                  >
                    {day.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 px-5 py-4">
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={onSubmit} disabled={routeSaving || routeLoading}>
              {editingRouteId ? 'Lưu thay đổi tuyến' : 'Thêm tuyến'}
            </Button>
            <Button type="button" variant="outline" onClick={onReset} disabled={routeSaving || routeLoading}>
              Làm trống
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={routeSaving}>
              Đóng
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RouteList({ routes, stores, routeSaving, assigningStoreId, onEdit, onDelete, onAssignStore }) {
  const routeStats = useMemo(() => routes.map((route) => {
    const assignedStores = stores.filter((store) => store.route_id === route.id)
    return {
      ...route,
      assignedStores,
      assignedStoreCount: assignedStores.length,
      assignedPotentialStores: assignedStores.filter((store) => store.is_potential).length,
    }
  }), [routes, stores])

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-100">Danh sách tuyến</h3>
          <p className="text-base text-gray-300">CRUD trực tiếp trên sidebar admin desktop.</p>
        </div>
        <div className="rounded-full border border-gray-800 bg-black/30 px-3 py-2 text-sm text-gray-300">
          {routeStats.length} tuyến
        </div>
      </div>

      {routeStats.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-gray-700 bg-black/20 px-4 py-8 text-center text-base text-gray-400">
          Chưa có tuyến nào. Tạo tuyến mới ở form bên trái để bắt đầu.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {routeStats.map((route) => (
            <div key={route.id} className="rounded-2xl border border-gray-800 bg-black/30 p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-xl font-semibold text-gray-100">{route.name}</h4>
                    {route.call_days.length > 0 && (
                      <span className="rounded-full border border-sky-900/60 bg-sky-950/20 px-3 py-1 text-sm text-sky-100">
                        {route.call_days.map(getWeekdayLabel).join(' • ')}
                      </span>
                    )}
                  </div>
                  <p className="text-base text-gray-300">
                    Xã/phường: {route.wards.length > 0 ? route.wards.join(', ') : 'Chưa chọn xã'}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:min-w-80">
                  <div className="rounded-xl border border-gray-800 bg-gray-950 p-3">
                    <p className="text-sm text-gray-400">Cửa hàng đã gán</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-100">{route.assignedStoreCount}</p>
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-gray-950 p-3">
                    <p className="text-sm text-gray-400">Store tiềm năng</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-100">{route.assignedPotentialStores}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={() => onEdit(route)} disabled={routeSaving}>
                  Sửa tuyến
                </Button>
                <Button type="button" variant="destructive" onClick={() => onDelete(route.id)} disabled={routeSaving}>
                  Xóa tuyến
                </Button>
                <span className="self-center text-sm text-gray-500">
                  Cập nhật: {formatDateTime(route.updated_at)}
                </span>
              </div>

              <div className="mt-4 rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-base font-semibold text-gray-100">Gán cửa hàng vào tuyến</p>
                  <span className="text-sm text-gray-400">
                    1 cửa hàng chỉ thuộc 1 tuyến
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {stores
                    .filter((store) => route.wards.includes(store.ward))
                    .slice(0, 12)
                    .map((store) => (
                      <div key={`${route.id}-${store.id}`} className="flex flex-col gap-3 rounded-xl border border-gray-800 bg-black/30 p-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-base font-medium text-gray-100">{store.name}</p>
                          <p className="text-sm text-gray-400">{formatAddressParts(store) || 'Chưa có địa chỉ'}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant={store.route_id === route.id ? 'secondary' : 'outline'}
                            className="h-10 px-4"
                            disabled={assigningStoreId === store.id}
                            onClick={() => onAssignStore(store.id, store.route_id === route.id ? null : route.id)}
                          >
                            {assigningStoreId === store.id
                              ? 'Đang lưu...'
                              : (store.route_id === route.id ? 'Bỏ gán khỏi tuyến' : 'Gán vào tuyến')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  {stores.filter((store) => route.wards.includes(store.ward)).length === 0 && (
                    <div className="rounded-xl border border-dashed border-gray-700 bg-black/20 px-4 py-6 text-base text-gray-400">
                      Chưa có cửa hàng nào thuộc các xã của tuyến này.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AdminRoutesPanel({
  stores,
  routes,
  routeForm,
  routeError,
  editingRouteId,
  routeSaving,
  routeLoading,
  assigningStoreId,
  routeModalOpen,
  onOpenRouteModal,
  onRouteModalChange,
  onFormChange,
  onToggleWard,
  onToggleCallDay,
  onRouteSubmit,
  onRouteReset,
  onRouteEdit,
  onRouteDelete,
  onAssignStore,
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-gray-400">Màn tuyến telesale</p>
          <h2 className="text-2xl font-bold text-gray-100">Quản lý tuyến gọi theo xã và ngày</h2>
          <p className="mt-1 text-base text-gray-300">
            Tuyến được mở trong modal để tập trung nhập liệu, còn danh sách tuyến vẫn nằm ngoài để theo dõi và gán store.
          </p>
        </div>
        <Button type="button" onClick={onOpenRouteModal} disabled={routeLoading || routeSaving}>
          {editingRouteId ? 'Tiếp tục sửa tuyến' : 'Thêm tuyến'}
        </Button>
      </div>

      <RouteEditor
        routeForm={routeForm}
        routeError={routeError}
        editingRouteId={editingRouteId}
        routeSaving={routeSaving}
        routeLoading={routeLoading}
        routeModalOpen={routeModalOpen}
        onOpenChange={onRouteModalChange}
        onChange={onFormChange}
        onToggleWard={onToggleWard}
        onToggleCallDay={onToggleCallDay}
        onSubmit={onRouteSubmit}
        onReset={onRouteReset}
      />

      <RouteList
        routes={routes}
        stores={stores}
        routeSaving={routeSaving}
        assigningStoreId={assigningStoreId}
        onEdit={onRouteEdit}
        onDelete={onRouteDelete}
        onAssignStore={onAssignStore}
      />
    </div>
  )
}

function AdminStoresPanel({ stores }) {
  const [keyword, setKeyword] = useState('')
  const [districtFilter, setDistrictFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const districtOptions = useMemo(() => (
    Array.from(new Set(stores.map((store) => String(store.district || '').trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'vi'))
  ), [stores])

  const filteredStores = useMemo(() => {
    const normalizedKeyword = normalizeToken(keyword)
    return stores.filter((store) => {
      if (districtFilter && store.district !== districtFilter) return false
      if (statusFilter === 'potential' && !store.is_potential) return false
      if (statusFilter === 'verified' && store.active !== true) return false
      if (statusFilter === 'pending' && store.active === true) return false
      if (statusFilter === 'missing-phone' && hasPhone(store)) return false

      if (!normalizedKeyword) return true
      const haystack = normalizeToken([
        store.name,
        store.store_type,
        store.address_detail,
        store.ward,
        store.district,
        store.phone,
        store.phone_secondary,
      ].filter(Boolean).join(' '))
      return haystack.includes(normalizedKeyword)
    })
  }, [districtFilter, keyword, statusFilter, stores])

  const visibleStores = filteredStores.slice(0, 120)

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm text-gray-400">Màn danh sách cửa hàng chi tiết</p>
        <h2 className="text-2xl font-bold text-gray-100">Danh sách dạng list cho admin desktop</h2>
        <p className="max-w-3xl text-base text-gray-300">
          Tập trung vào quét nhanh thông tin, tình trạng xác thực, dữ liệu liên hệ và lối mở sang màn sửa chi tiết.
        </p>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.4fr_0.8fr_0.8fr_auto]">
        <label className="space-y-2">
          <span className="text-sm text-gray-400">Tìm nhanh</span>
          <input
            type="text"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            className="h-11 w-full rounded-xl border border-gray-700 bg-gray-900 px-3 text-base text-gray-100 outline-none"
            placeholder="Tên cửa hàng, địa chỉ, số điện thoại..."
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm text-gray-400">Quận / huyện</span>
          <select
            value={districtFilter}
            onChange={(event) => setDistrictFilter(event.target.value)}
            className="h-11 w-full rounded-xl border border-gray-700 bg-gray-900 px-3 text-base text-gray-100 outline-none"
          >
            <option value="">Tất cả</option>
            {districtOptions.map((district) => (
              <option key={district} value={district}>{district}</option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm text-gray-400">Trạng thái</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-11 w-full rounded-xl border border-gray-700 bg-gray-900 px-3 text-base text-gray-100 outline-none"
          >
            <option value="all">Tất cả</option>
            <option value="verified">Đã xác thực</option>
            <option value="pending">Chờ xác thực</option>
            <option value="potential">Tiềm năng telesale</option>
            <option value="missing-phone">Thiếu số điện thoại</option>
          </select>
        </label>

        <div className="flex items-end">
          <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-base text-gray-300">
            {filteredStores.length} kết quả
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {visibleStores.map((store) => (
          <div key={store.id} className="rounded-2xl border border-gray-800 bg-gray-950 p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold text-gray-100">{store.name || 'Chưa có tên'}</h3>
                  <span className="rounded-full border border-gray-800 bg-black/30 px-3 py-1 text-sm text-gray-300">
                    {store.store_type || 'Chưa rõ loại'}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-sm ${
                    store.active
                      ? 'border border-green-900/60 bg-green-950/20 text-green-200'
                      : 'border border-amber-900/60 bg-amber-950/20 text-amber-200'
                  }`}>
                    {store.active ? 'Đã xác thực' : 'Chờ xác thực'}
                  </span>
                  {store.is_potential && (
                    <span className="rounded-full border border-sky-900/60 bg-sky-950/20 px-3 py-1 text-sm text-sky-100">
                      Tiềm năng
                    </span>
                  )}
                </div>
                <p className="text-base text-gray-300">{formatAddressParts(store) || 'Chưa có địa chỉ'}</p>
                <div className="flex flex-wrap gap-2 text-sm text-gray-300">
                  <span className="rounded-full border border-gray-800 bg-black/30 px-3 py-1">
                    {store.phone ? `SĐT 1: ${store.phone}` : 'Thiếu SĐT 1'}
                  </span>
                  <span className="rounded-full border border-gray-800 bg-black/30 px-3 py-1">
                    {store.phone_secondary ? `SĐT 2: ${store.phone_secondary}` : 'Không có SĐT 2'}
                  </span>
                  <span className="rounded-full border border-gray-800 bg-black/30 px-3 py-1">
                    {hasValidCoordinates(store) ? 'Đã có vị trí' : 'Chưa có vị trí'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 xl:justify-end">
                <Button asChild variant="outline">
                  <Link href={`/store/edit/${store.id}`}>Sửa cửa hàng</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/store/${store.id}`}>Xem chi tiết</Link>
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredStores.length > visibleStores.length && (
        <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-base text-gray-400">
          Đang hiển thị 120 cửa hàng đầu tiên để giữ trải nghiệm mượt trên desktop.
        </div>
      )}
    </div>
  )
}

export default function AccountScreen({ forcedAdminTab = '' }) {
  const router = useRouter()
  const { user, role, isAdmin, isTelesale, isAuthenticated, loading: authLoading, signOut } = useAuth() || {}
  const isAdminRouteMode = Boolean(forcedAdminTab)

  const [pageReady, setPageReady] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [activeTab, setActiveTab] = useState(forcedAdminTab || 'overview')
  const [stores, setStores] = useState([])
  const [loadingStores, setLoadingStores] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [routes, setRoutes] = useState([])
  const [routeForm, setRouteForm] = useState(DEFAULT_ROUTE_FORM)
  const [editingRouteId, setEditingRouteId] = useState('')
  const [routeError, setRouteError] = useState('')
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeSaving, setRouteSaving] = useState(false)
  const [assigningStoreId, setAssigningStoreId] = useState('')
  const [routeModalOpen, setRouteModalOpen] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      setPageReady(false)
      router.replace('/login?from=/account')
      return
    }
    setPageReady(true)
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (!forcedAdminTab) return
    setActiveTab(forcedAdminTab)
  }, [forcedAdminTab])

  useEffect(() => {
    if (!pageReady || !isAdmin || isAdminRouteMode) return
    router.replace('/admin/overview')
  }, [isAdmin, isAdminRouteMode, pageReady, router])

  const loadAdminData = useCallback(async () => {
    if (!isAdmin) return
    setLoadingStores(true)
    setLoadError('')
    try {
      const data = await getOrRefreshStores()
      setStores(data || [])
    } catch {
      setStores([])
      setLoadError('Không tải được dữ liệu admin. Vui lòng thử lại.')
    } finally {
      setLoadingStores(false)
    }
  }, [isAdmin])

  const loadRoutes = useCallback(async () => {
    if (!isAdmin) return
    setRouteLoading(true)
    try {
        const { data, error } = await supabase
          .from('routes')
        .select('id, name, wards, call_days, created_at, updated_at')
        .order('name', { ascending: true })

      if (error) throw error
      setRoutes((data || []).map(normalizeRouteRow))
    } catch (error) {
      console.error(error)
      setRoutes([])
      setRouteError('Không tải được danh sách tuyến. Hãy kiểm tra migration mới của DB.')
    } finally {
      setRouteLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    if (!pageReady || !isAdmin) return
    loadAdminData()
    loadRoutes()
  }, [isAdmin, loadAdminData, loadRoutes, pageReady])

  useEffect(() => {
    if (!pageReady || !isAdmin || typeof window === 'undefined') return undefined
    const handleStoresChanged = () => loadAdminData()
    window.addEventListener('storevis:stores-changed', handleStoresChanged)
    return () => window.removeEventListener('storevis:stores-changed', handleStoresChanged)
  }, [isAdmin, loadAdminData, pageReady])

  const handleSignOut = async () => {
    if (!signOut || signingOut) return
    setSigningOut(true)
    const { error } = await signOut()
    setSigningOut(false)

    if (error) {
      console.error('Sign out returned error:', error)
    }

    router.replace('/login')
  }

  const handleRouteFormChange = useCallback((field, value) => {
    setRouteForm((prev) => ({ ...prev, [field]: value }))
    setRouteError('')
  }, [])

  const handleToggleWard = useCallback((ward) => {
    setRouteForm((prev) => ({
      ...prev,
      wards: prev.wards.includes(ward)
        ? prev.wards.filter((item) => item !== ward)
        : [...prev.wards, ward],
    }))
    setRouteError('')
  }, [])

  const handleToggleCallDay = useCallback((day) => {
    setRouteForm((prev) => ({
      ...prev,
      callDays: prev.callDays.includes(day)
        ? prev.callDays.filter((item) => item !== day)
        : [...prev.callDays, day],
    }))
    setRouteError('')
  }, [])

  const resetRouteForm = useCallback(() => {
    setRouteForm(DEFAULT_ROUTE_FORM)
    setEditingRouteId('')
    setRouteError('')
  }, [])

  const handleRouteModalChange = useCallback((open) => {
    setRouteModalOpen(open)
    if (!open) {
      setRouteError('')
    }
  }, [])

  const handleOpenRouteModal = useCallback(() => {
    setRouteModalOpen(true)
  }, [])

  const handleRouteSubmit = useCallback(() => {
    async function run() {
      const trimmedName = routeForm.name.trim()
      if (!trimmedName) {
        setRouteError('Tên tuyến là bắt buộc.')
        return
      }
      if (routeForm.wards.length === 0) {
        setRouteError('Phải chọn ít nhất 1 xã cho tuyến.')
        return
      }
      if (routeForm.callDays.length === 0) {
        setRouteError('Phải chọn ít nhất 1 ngày gọi cho tuyến.')
        return
      }

      setRouteSaving(true)
      setRouteError('')

      const payload = {
        name: trimmedName,
        wards: routeForm.wards,
        call_days: routeForm.callDays,
        updated_at: new Date().toISOString(),
      }

      try {
        if (editingRouteId) {
          const { data, error } = await supabase
            .from('routes')
            .update(payload)
            .eq('id', editingRouteId)
            .select('id, name, wards, call_days, created_at, updated_at')
            .single()
          if (error) throw error
          setRoutes((prev) => prev.map((route) => (route.id === editingRouteId ? normalizeRouteRow(data) : route)))
        } else {
          const { data, error } = await supabase
            .from('routes')
            .insert([payload])
            .select('id, name, wards, call_days, created_at, updated_at')
            .single()
          if (error) throw error
          setRoutes((prev) => [...prev, normalizeRouteRow(data)].sort((a, b) => a.name.localeCompare(b.name, 'vi')))
        }
        setRouteModalOpen(false)
        resetRouteForm()
      } catch (error) {
        console.error(error)
        setRouteError('Không lưu được tuyến. Hãy kiểm tra migration và quyền admin.')
      } finally {
        setRouteSaving(false)
      }
    }

    run()
  }, [editingRouteId, resetRouteForm, routeForm])

  const handleRouteEdit = useCallback((route) => {
    setEditingRouteId(route.id)
    setRouteForm({
      id: route.id,
      name: route.name || '',
      wards: Array.isArray(route.wards) ? route.wards : [],
      callDays: Array.isArray(route.call_days) ? route.call_days : [],
    })
    setRouteError('')
    setActiveTab('routes')
    setRouteModalOpen(true)
  }, [])

  const handleRouteDelete = useCallback((routeId) => {
    async function run() {
      setRouteSaving(true)
      setRouteError('')
      try {
        const { error } = await supabase.from('routes').delete().eq('id', routeId)
        if (error) throw error
        setRoutes((prev) => prev.filter((route) => route.id !== routeId))
        setStores((prev) => prev.map((store) => (
          store.route_id === routeId
            ? { ...store, route_id: null, updated_at: new Date().toISOString() }
            : store
        )))
        if (editingRouteId === routeId) resetRouteForm()
      } catch (error) {
        console.error(error)
        setRouteError('Không xóa được tuyến.')
      } finally {
        setRouteSaving(false)
      }
    }

    run()
  }, [editingRouteId, resetRouteForm])

  const handleAssignStore = useCallback((storeId, routeId) => {
    async function run() {
      setAssigningStoreId(storeId)
      setRouteError('')
      const timestamp = new Date().toISOString()
      try {
        const { error } = await supabase
          .from('stores')
          .update({ route_id: routeId, updated_at: timestamp })
          .eq('id', storeId)
        if (error) throw error

        setStores((prev) => prev.map((store) => (
          String(store.id) === String(storeId)
            ? { ...store, route_id: routeId, updated_at: timestamp }
            : store
        )))
        await updateStoreInCache(storeId, { route_id: routeId, updated_at: timestamp })
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('storevis:stores-changed', {
            detail: { id: storeId, shouldRefetchAll: false },
          }))
        }
      } catch (error) {
        console.error(error)
        setRouteError('Không gán được cửa hàng vào tuyến.')
      } finally {
        setAssigningStoreId('')
      }
    }

    run()
  }, [])

  const adminContent = useMemo(() => {
    if (activeTab === 'import') return <AdminImportPanel />
    if (activeTab === 'export') return <AdminExportPanel stores={stores} />
    if (activeTab === 'routes') {
      return (
        <AdminRoutesPanel
          stores={stores}
          routes={routes}
          routeForm={routeForm}
          routeError={routeError}
          editingRouteId={editingRouteId}
          routeSaving={routeSaving}
          routeLoading={routeLoading}
          assigningStoreId={assigningStoreId}
          routeModalOpen={routeModalOpen}
          onOpenRouteModal={handleOpenRouteModal}
          onRouteModalChange={handleRouteModalChange}
          onFormChange={handleRouteFormChange}
          onToggleWard={handleToggleWard}
          onToggleCallDay={handleToggleCallDay}
          onRouteSubmit={handleRouteSubmit}
          onRouteReset={resetRouteForm}
          onRouteEdit={handleRouteEdit}
          onRouteDelete={handleRouteDelete}
          onAssignStore={handleAssignStore}
        />
      )
    }
    if (activeTab === 'stores') return <AdminStoresPanel stores={stores} />
    return <AdminOverviewPanel stores={stores} loading={loadingStores} onRefresh={loadAdminData} />
  }, [
    activeTab,
    editingRouteId,
    handleRouteDelete,
    handleRouteEdit,
    handleRouteFormChange,
    handleOpenRouteModal,
    handleRouteModalChange,
    handleAssignStore,
    handleRouteSubmit,
    handleToggleCallDay,
    handleToggleWard,
    loadAdminData,
    assigningStoreId,
    loadingStores,
    resetRouteForm,
    routeError,
    routeForm,
    routeLoading,
    routeModalOpen,
    routeSaving,
    routes,
    stores,
  ])

  const pageTitle = isAdminRouteMode
    ? (ADMIN_TAB_TITLES[activeTab] || 'Admin - NPP Hà Công')
    : 'Tài khoản - NPP Hà Công'

  if (authLoading || !pageReady) {
    return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />
  }

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
      </Head>

      <div className="min-h-screen bg-black">
        <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-4 sm:py-6">
          <Card className="overflow-hidden rounded-[28px] border border-gray-800 bg-gray-950">
            <CardContent className="p-0">
              <div className="border-b border-gray-800 px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm text-gray-400">Tài khoản đăng nhập</p>
                    <h1 className="truncate text-2xl font-bold text-gray-100">{user?.email}</h1>
                    <p className="text-base text-gray-300">
                      Quyền: {isAdmin ? 'Admin' : role === 'telesale' ? 'Telesale' : 'Khách'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {(isAdmin || isTelesale) && (
                      <Button asChild variant="outline">
                        <Link href="/telesale/overview">Mở telesale</Link>
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleSignOut}
                      disabled={signingOut}
                    >
                      {signingOut ? 'Đang xuất...' : 'Đăng xuất'}
                    </Button>
                  </div>
                </div>
              </div>

              {isAdmin && isAdminRouteMode ? (
                <div className="grid min-h-[calc(100dvh-14rem)] xl:grid-cols-[320px_minmax(0,1fr)]">
                  <aside className="border-r border-gray-800 bg-black/30 p-4 sm:p-5">
                    <div className="space-y-2">
                      <p className="text-sm text-gray-400">Workspace admin</p>
                      <p className="text-lg font-semibold text-gray-100">Điều hướng quản trị desktop</p>
                    </div>

                    <div className="mt-5 space-y-3">
                      {ADMIN_TABS.map((tab) => (
                        <Link
                          key={tab.id}
                          href={ADMIN_TAB_ROUTES[tab.id] || '/admin/overview'}
                          className={`block w-full rounded-2xl border px-4 py-4 text-left transition ${
                            activeTab === tab.id
                              ? 'border-blue-500 bg-blue-500/12 text-blue-100'
                              : 'border-gray-800 bg-gray-950 text-gray-200 hover:border-gray-700 hover:bg-gray-900'
                          }`}
                        >
                          <div className="text-lg font-semibold">{tab.label}</div>
                          <div className="mt-1 text-sm text-gray-400">{tab.hint}</div>
                        </Link>
                      ))}
                    </div>

                    <div className="mt-5 rounded-2xl border border-gray-800 bg-gray-950 p-4">
                      <p className="text-sm text-gray-400">Ghi chú triển khai</p>
                      <p className="mt-2 text-base text-gray-300">
                        Các route admin cũ vẫn được giữ để không phá flow. Giao diện quản trị chính giờ tập trung về màn desktop này.
                      </p>
                    </div>
                  </aside>

                  <main className="space-y-5 p-4 sm:p-5 xl:p-6">
                    {loadError && (
                      <div className="rounded-2xl border border-red-900/70 bg-red-950/20 px-4 py-3 text-base text-red-200">
                        {loadError}
                      </div>
                    )}
                    {adminContent}
                  </main>
                </div>
              ) : (
                <div className="p-4 sm:p-5">
                  <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-2xl border border-gray-800 bg-black/30 p-5">
                      <p className="text-sm text-gray-400">{isAdmin ? 'Điểm vào admin' : 'Không gian telesale'}</p>
                      <h2 className="mt-2 text-2xl font-bold text-gray-100">
                        {isAdmin ? 'Quản trị được tách thành các route riêng' : 'Màn làm việc nhanh cho telesale'}
                      </h2>
                      <p className="mt-2 text-base text-gray-300">
                        {isAdmin
                          ? 'Các màn admin cũ đã được thay bằng hệ route desktop riêng: tổng quan, nhập dữ liệu, xuất dữ liệu, tuyến telesale và danh sách cửa hàng.'
                          : 'Telesale chỉ cần vào danh sách ưu tiên gọi, cập nhật kết quả cuộc gọi và theo dõi trạng thái đơn.'}
                      </p>
                      <div className="mt-5 flex flex-wrap gap-3">
                        {isAdmin ? (
                          <>
                            <Button asChild>
                              <Link href="/admin/overview">Mở quản trị admin</Link>
                            </Button>
                            <Button asChild variant="outline">
                              <Link href="/admin/routes">Mở tuyến telesale</Link>
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button asChild>
                              <Link href="/telesale/overview">Mở màn telesale</Link>
                            </Button>
                            <Button asChild variant="outline">
                              <Link href="/store/create">Thêm cửa hàng mới</Link>
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
                      <p className="text-sm text-gray-400">{isAdmin ? 'Các route admin mới' : 'Giới hạn quyền'}</p>
                      <div className="mt-4 space-y-3">
                        {(isAdmin
                          ? [
                            '/admin/overview',
                            '/admin/import',
                            '/admin/export',
                            '/admin/routes',
                            '/admin/stores',
                          ]
                          : [
                            'Telesale không thấy các màn import, export, xác thực hoặc báo cáo admin.',
                            'Telesale vẫn dùng chung flow tạo store và cập nhật kết quả gọi điện.',
                            'Nếu cần quyền quản trị dữ liệu, tài khoản phải có role admin trong app_metadata.',
                          ]).map((item) => (
                          <div key={item} className="rounded-xl border border-gray-800 bg-black/30 px-4 py-3 text-base text-gray-300">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
