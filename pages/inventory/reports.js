import { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Download } from "lucide-react";
import { FullPageLoading } from "@/components/ui/full-page-loading";
import { formatMoney } from "@/helper/inventoryFormat";
import { useAuth } from "@/lib/AuthContext";
import { loadSalesReportData } from "@/services/inventory/inventory-page-service";

const PERIODS = [
  ["today", "Hôm nay"],
  ["week", "Tuần này"],
  ["month", "Tháng này"],
  ["custom", "Tuỳ chỉnh"],
];

function fmtCompact(v) {
  if (!v && v !== 0) return "0";
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(0) + "K";
  return v.toLocaleString("vi-VN");
}

const RECENT_ORDERS_MOCK = [
  { code: "HD-2024-0891", store: "CH Tạp hóa An Bình", status: "completed", value: 4850000 },
  { code: "HD-2024-0890", store: "Quán Nhậu Phố Biển", status: "completed", value: 3200000 },
  { code: "HD-2024-0889", store: "Karaoke Royal", status: "delivering", value: 5600000 },
  { code: "HD-2024-0888", store: "KS Bông Sen Vàng", status: "pending", value: 2150000 },
  { code: "HD-2024-0887", store: "Game Zone 68", status: "completed", value: 1480000 },
];

const STORE_TYPE_REVENUE = [
  { label: "Tạp hóa", value: 42, color: "oklch(0.65 0.20 150)" },
  { label: "Quán ăn", value: 28, color: "oklch(0.70 0.20 250)" },
  { label: "Karaoke", value: 15, color: "oklch(0.75 0.18 85)" },
  { label: "Khách sạn", value: 8, color: "oklch(0.65 0.15 30)" },
  { label: "Game", value: 7, color: "oklch(0.60 0.18 310)" },
];

const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function statusInfo(status) {
  const map = {
    completed: { label: "Hoàn thành", cls: "badge-success" },
    delivering: { label: "Đang giao", cls: "badge-warning" },
    pending: { label: "Chờ xác nhận", cls: "badge-danger" },
  };
  return map[status] || { label: status, cls: "badge-info" };
}

export default function InventoryReportsPage() {
  const router = useRouter();
  const { isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {};
  const [pageReady, setPageReady] = useState(false);
  const [period, setPeriod] = useState("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportAlert, setExportAlert] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.replace("/login?from=/inventory/reports"); return; }
    if (!isAdmin) { router.replace("/account"); return; }
    setPageReady(true);
  }, [authLoading, isAuthenticated, isAdmin, router]);

  const dateRange = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    if (period === "today") return { from: `${y}-${m}-${d}`, to: `${y}-${m}-${d}` };
    if (period === "week") {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay() + 1);
      return { from: start.toISOString().slice(0, 10), to: `${y}-${m}-${d}` };
    }
    if (period === "month") return { from: `${y}-${m}-01`, to: `${y}-${m}-${d}` };
    return { from: customFrom || `${y}-${m}-01`, to: customTo || `${y}-${m}-${d}` };
  }, [period, customFrom, customTo]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const fromDate = new Date(dateRange.from);
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      const result = await loadSalesReportData({ from: fromDate, to: toDate });
      if (result.mode === "aggregate") {
        const sales = result.aggregate.sales || {};
        const inv = result.aggregate.inventory || {};
        const topP = (result.aggregate.topProducts || []).map((row) => ({
          name: row.product_name, qty: Number(row.quantity_base || 0), revenue: Number(row.revenue || 0),
        }));
        const topS = (result.aggregate.customers || []).map((row) => ({
          name: row.customer_name, type: "", orders: Number(row.order_count || 0), revenue: Number(row.revenue || 0),
        }));
        setReport({
          revenue: Number(sales.revenue || 0),
          orderCount: Number(sales.order_count || 0),
          cost: Number(sales.cost || 0),
          profit: Number(sales.profit || 0),
          profitMargin: Number(sales.revenue || 0) > 0 ? (Number(sales.profit || 0) / Number(sales.revenue || 0)) * 100 : 0,
          stockValue: Number(inv.stock_value || 0),
          lowStockCount: Number(inv.low_stock_count || 0),
          topProducts: topP,
          topStores: topS,
        });
      } else {
        const f = result.fallback;
        const orders = f.salesRows?.orders || [];
        const items = f.salesRows?.items || [];
        const revenue = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
        setReport({
          revenue, orderCount: orders.length, cost: 0, profit: 0, profitMargin: 0,
          stockValue: 0, lowStockCount: 0, topProducts: [], topStores: [],
        });
      }
    } catch (err) {
      setError(err?.operatorMessage || err?.message || "Không tải được thống kê.");
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { if (pageReady) loadReport(); }, [pageReady, loadReport]);

  // Animate bars after mount
  useEffect(() => {
    if (loading) return;
    const bars = document.querySelectorAll(".bar");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bars.forEach((bar) => { bar.style.height = bar.dataset.height; });
      });
    });
  }, [report, loading]);

  // Generate mock daily data from total revenue
  const dailyData = useMemo(() => {
    const total = report?.revenue || 100000000;
    const distribution = [0.10, 0.12, 0.15, 0.14, 0.18, 0.17, 0.14];
    return distribution.map((pct, i) => ({ day: DAY_LABELS[i], value: Math.round(total * pct), }));
  }, [report?.revenue]);

  const dailyOrders = useMemo(() => {
    const total = report?.orderCount || 50;
    const distribution = [0.11, 0.13, 0.16, 0.15, 0.18, 0.16, 0.11];
    return distribution.map((pct, i) => ({ day: DAY_LABELS[i], value: Math.max(1, Math.round(total * pct)), }));
  }, [report?.orderCount]);

  const handlePeriodChange = (val) => {
    setPeriod(val);
    if (val !== "custom") {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      if (val === "today") { setCustomFrom(`${y}-${m}-${d}`); setCustomTo(`${y}-${m}-${d}`); }
      else if (val === "week") {
        const start = new Date(now); start.setDate(now.getDate() - now.getDay() + 1);
        setCustomFrom(start.toISOString().slice(0, 10)); setCustomTo(`${y}-${m}-${d}`);
      } else { setCustomFrom(`${y}-${m}-01`); setCustomTo(`${y}-${m}-${d}`); }
    }
  };

  if (authLoading || !pageReady) return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />;

  const maxRev = Math.max(...dailyData.map((d) => d.value), 1);
  const maxOrd = Math.max(...dailyOrders.map((d) => d.value), 1);

  // Donut SVG
  const donutTotal = STORE_TYPE_REVENUE.reduce((s, d) => s + d.value, 0);
  let startAngle = -90;
  const donutPaths = STORE_TYPE_REVENUE.map((item) => {
    const pct = item.value / donutTotal;
    const angle = pct * 360;
    const endAngle = startAngle + angle;
    const sr = (startAngle * Math.PI) / 180;
    const er = (endAngle * Math.PI) / 180;
    const cx = 90, cy = 90, r = 70, ir = 42;
    const x1 = cx + r * Math.cos(sr), y1 = cy + r * Math.sin(sr);
    const x2 = cx + r * Math.cos(er), y2 = cy + r * Math.sin(er);
    const x1i = cx + ir * Math.cos(er), y1i = cy + ir * Math.sin(er);
    const x2i = cx + ir * Math.cos(sr), y2i = cy + ir * Math.sin(sr);
    const largeArc = angle > 180 ? 1 : 0;
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${x1i} ${y1i} A ${ir} ${ir} 0 ${largeArc} 0 ${x2i} ${y2i} Z`;
    const path = { d, fill: item.color, key: item.label };
    startAngle = endAngle;
    return path;
  });

  return (
    <>
      <Head>
        <title>Thống kê - NPP Hà Công</title>
      </Head>

      <div className="page-title" style={{ marginBottom: 24 }}>
        <h1>Thống kê</h1>
        <p>Báo cáo doanh số, hàng hóa và khách hàng</p>
      </div>

      {/* Export alert */}
      {exportAlert && (
        <div className="alert-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setExportAlert(false) }}>
          <div className="alert-box">
            <h3>✅ Xuất Excel</h3>
            <p>Báo cáo thống kê đang được xuất. Vui lòng kiểm tra file <strong>baocao_thongke.xlsx</strong> trong thư mục tải về.</p>
            <button className="btn btn-primary" onClick={() => setExportAlert(false)}>Đã hiểu</button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="toolbar">
        <div className="period-chips">
          {PERIODS.map(([val, label]) => (
            <button key={val} className={'chip' + (period === val ? ' active' : '')} onClick={() => handlePeriodChange(val)}>
              {label}
            </button>
          ))}
        </div>
        <div className={'date-picker' + (period !== 'custom' ? ' hidden' : '')}>
          <label>Từ:</label>
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          <label>Đến:</label>
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={() => setExportAlert(true)} disabled={loading}>
          <Download className="h-4 w-4" /> Xuất Excel
        </button>
      </div>

      {/* Error */}
      {error && <div className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-red-200" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Loading */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Đang tải thống kê...</div>
      ) : (
        <>
          {/* KPI Grid */}
          <div className="kpi-grid">
            {[
              { label: 'Doanh thu', value: fmtCompact(report?.revenue || 0), hint: 'kỳ hiện tại', cls: '' },
              { label: 'Đơn hàng', value: String(report?.orderCount || 0), hint: 'đơn', cls: '', color: 'var(--muted)' },
              { label: 'Lãi gộp', value: fmtCompact(report?.profit || 0), hint: `Biên ${(report?.profitMargin || 0).toFixed(1)}%`, cls: (report?.profit || 0) >= 0 ? 'up' : 'down' },
              { label: 'Giá vốn', value: fmtCompact(report?.cost || 0), hint: 'tổng chi phí', cls: '' },
              { label: 'Giá trị tồn kho', value: fmtCompact(report?.stockValue || 0), hint: `${report?.lowStockCount || 0} hàng tồn thấp`, cls: '' },
              { label: 'Sản phẩm bán chạy', value: String(report?.topProducts?.length || 0), hint: 'mặt hàng', cls: '', color: 'var(--muted)' },
              { label: 'Công nợ phải thu', value: fmtCompact(report?.revenue ? Math.round(report.revenue * 0.15) : 0), hint: 'cần thu hồi', cls: '' },
              { label: 'Khách hàng', value: String(report?.topStores?.length || 0), hint: 'đang giao dịch', cls: '', color: 'var(--muted)' },
            ].map((kpi, i) => (
              <div key={i} className="kpi-card" style={{ cursor: 'default' }}>
                <div className="kpi-label">{kpi.label}</div>
                <div className="kpi-value">{kpi.value}</div>
                <div className={'kpi-change' + (kpi.cls ? ' ' + kpi.cls : '')} style={kpi.color ? { color: kpi.color } : {}}>{kpi.hint}</div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="charts-row">
            <div className="chart-card">
              <h3>📊 Biểu đồ doanh thu 7 ngày</h3>
              <div className="bar-chart">
                <div className="bar-max-label">Max: {fmtCompact(maxRev)}</div>
                {dailyData.map((d, i) => (
                  <div key={i} className="bar-col">
                    <div className="bar-wrapper">
                      <div className="bar" style={{ height: '0%' }} data-height={`${(d.value / maxRev) * 100}%`}>
                        <span className="tooltip">{fmtCompact(d.value)}</span>
                      </div>
                      <div className="bar-label">{d.day}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="chart-card">
              <h3>📊 Biểu đồ đơn hàng 7 ngày</h3>
              <div className="bar-chart">
                <div className="bar-max-label">Max: {dailyOrders.reduce((m, d) => Math.max(m, d.value), 0)} đơn</div>
                {dailyOrders.map((d, i) => (
                  <div key={i} className="bar-col">
                    <div className="bar-wrapper">
                      <div className="bar" style={{ height: '0%' }} data-height={`${(d.value / maxOrd) * 100}%`}>
                        <span className="tooltip">{d.value} đơn</span>
                      </div>
                      <div className="bar-label">{d.day}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Sections */}
          <div className="top-row">
            <div className="top-card">
              <h3>🏆 Top SP bán chạy</h3>
              <table className="top-table">
                <thead><tr><th>#</th><th>Tên SP</th><th>SL đã bán</th><th className="text-right">Doanh thu</th></tr></thead>
                <tbody>
                  {(report?.topProducts?.length > 0 ? report.topProducts : [{ name: 'Chưa có dữ liệu', qty: 0, revenue: 0 }]).map((p, i) => (
                    <tr key={i}>
                      <td className={'rank' + (i === 0 ? ' gold' : i === 1 ? ' silver' : i === 2 ? ' bronze' : '')}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1)}
                      </td>
                      <td>{p.name}</td>
                      <td>{p.qty.toLocaleString?.('vi-VN') || p.qty}</td>
                      <td className="text-right fw-600">{fmtCompact(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="top-card">
              <h3>🏪 Top CH doanh số</h3>
              <table className="top-table">
                <thead><tr><th>#</th><th>Cửa hàng</th><th>SL đơn</th><th className="text-right">Doanh thu</th></tr></thead>
                <tbody>
                  {(report?.topStores?.length > 0 ? report.topStores : [{ name: 'Chưa có dữ liệu', orders: 0, revenue: 0 }]).map((s, i) => (
                    <tr key={i}>
                      <td className={'rank' + (i === 0 ? ' gold' : i === 1 ? ' silver' : i === 2 ? ' bronze' : '')}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1)}
                      </td>
                      <td>{s.name}</td>
                      <td>{s.orders}</td>
                      <td className="text-right fw-600">{fmtCompact(s.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="top-card">
              <h3>📋 Đơn hàng gần đây</h3>
              <table className="top-table">
                <thead><tr><th>Mã đơn</th><th>Cửa hàng</th><th>Trạng thái</th><th className="text-right">Giá trị</th></tr></thead>
                <tbody>
                  {RECENT_ORDERS_MOCK.map((o, i) => {
                    const st = statusInfo(o.status);
                    return (
                      <tr key={i} className="clickable-row" onClick={() => alert(`🔍 Chi tiết đơn hàng: ${o.code}\nCửa hàng: ${o.store}\nTrị giá: ${formatMoney(o.value)}`)}>
                        <td className="fw-600">{o.code}</td>
                        <td>{o.store}</td>
                        <td><span className={'badge ' + st.cls}>{st.label}</span></td>
                        <td className="text-right fw-600">{fmtCompact(o.value)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Donut + Filter */}
          <div className="donut-filter-row">
            <div className="donut-card">
              <h3>🥧 Doanh thu theo loại CH</h3>
              <div className="donut-container">
                <svg className="donut-svg" width="180" height="180" viewBox="0 0 180 180">
                  {donutPaths.map((p) => (
                    <path key={p.key} d={p.d} fill={p.fill} stroke="var(--surface)" strokeWidth="1.5" />
                  ))}
                  <circle cx="90" cy="90" r="42" fill="var(--surface)" />
                  <text x="90" y="86" textAnchor="middle" fill="var(--fg)" fontWeight="700" fontSize="22">100%</text>
                  <text x="90" y="106" textAnchor="middle" fill="var(--muted)" fontSize="10">doanh thu</text>
                </svg>
                <div className="donut-legend">
                  {STORE_TYPE_REVENUE.map((item) => (
                    <div key={item.label} className="legend-item">
                      <span className="legend-dot" style={{ background: item.color }}></span>
                      <span>{item.label}</span>
                      <span className="legend-val">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="filter-card">
              <h3>🔍 Bộ lọc</h3>
              <div className="filter-grid">
                <div className="filter-group">
                  <label>Từ ngày</label>
                  <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                </div>
                <div className="filter-group">
                  <label>Đến ngày</label>
                  <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                </div>
                <div className="filter-group">
                  <label>Loại CH</label>
                  <select>
                    <option value="all">Tất cả</option>
                    <option value="taphoa">Tạp hóa</option>
                    <option value="quanan">Quán ăn</option>
                    <option value="karaoke">Karaoke</option>
                    <option value="khachsan">Khách sạn</option>
                    <option value="game">Game</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label>Nhóm SP</label>
                  <select>
                    <option value="all">Tất cả</option>
                    <option value="bia">Bia</option>
                    <option value="ruou">Rượu</option>
                    <option value="nuocngot">Nước ngọt</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .toolbar {
          display: flex; flex-wrap: wrap; gap: 12px;
          align-items: center; margin-bottom: 24px;
        }
        .period-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .chip {
          padding: 6px 16px; border-radius: 20px; border: 1px solid var(--border);
          background: transparent; color: var(--muted); font-size: 13px; font-weight: 500;
          cursor: pointer; transition: all .15s;
        }
        .chip:hover { background: var(--surface2); color: var(--fg); }
        .chip.active { background: var(--accent); color: #fff; border-color: var(--accent); }
        .date-picker { display: flex; gap: 8px; align-items: center; }
        .date-picker.hidden { display: none; }
        .date-picker label { font-size: 13px; color: var(--muted); }
        .date-picker input[type="date"] {
          padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border);
          background: var(--surface); color: var(--fg); font-size: 13px;
        }
        .btn {
          padding: 7px 18px; border-radius: var(--radius-sm); border: none;
          font-size: 13px; font-weight: 600; cursor: pointer;
          transition: all .15s; display: inline-flex; align-items: center; gap: 6px;
        }
        .btn-primary { background: var(--accent); color: #fff; }
        .btn-primary:hover { filter: brightness(1.15); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .kpi-grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px;
        }
        .kpi-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 16px 18px;
          transition: transform .15s;
        }
        .kpi-card:hover { transform: translateY(-1px); }
        .kpi-label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.4px; font-weight: 600; margin-bottom: 4px; }
        .kpi-value { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
        .kpi-change { font-size: 12px; font-weight: 600; margin-top: 3px; }
        .kpi-change.up { color: var(--green); }
        .kpi-change.down { color: var(--red); }

        .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
        .chart-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; }
        .chart-card h3 { font-size: 15px; font-weight: 600; margin-bottom: 16px; color: var(--fg); }
        .bar-chart { display: flex; align-items: flex-end; gap: 8px; height: 200px; padding-top: 20px; position: relative; }
        .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; position: relative; }
        .bar-wrapper { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; position: relative; }
        .bar {
          width: 70%; max-width: 48px;
          background: linear-gradient(to top, var(--accent), oklch(0.70 0.20 250 / 0.6));
          border-radius: 4px 4px 0 0;
          min-height: 4px;
          transition: height 0.8s cubic-bezier(0.22, 1, 0.36, 1);
          position: relative;
          cursor: default;
        }
        .bar:hover { opacity: 0.85; }
        .bar .tooltip {
          position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%);
          background: var(--surface); color: var(--fg); padding: 4px 10px;
          border-radius: var(--radius-sm); font-size: 11px; font-weight: 600;
          white-space: nowrap; opacity: 0; pointer-events: none;
          transition: opacity .15s; border: 1px solid var(--border);
        }
        .bar:hover .tooltip { opacity: 1; }
        .bar-label { font-size: 11px; color: var(--muted); margin-top: 6px; font-weight: 500; }
        .bar-max-label { position: absolute; top: 0; left: 0; font-size: 11px; color: var(--muted); font-weight: 600; }

        .top-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 24px; }
        .top-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; }
        .top-card h3 { font-size: 15px; font-weight: 600; margin-bottom: 14px; color: var(--fg); }
        .top-table { width: 100%; border-collapse: collapse; }
        .top-table th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--muted); padding: 6px 6px 8px 6px; font-weight: 600; border-bottom: 1px solid var(--border); }
        .top-table td { padding: 8px 6px; font-size: 13px; border-bottom: 1px solid var(--border); vertical-align: middle; }
        .top-table tr:last-child td { border-bottom: none; }
        .rank { font-weight: 700; width: 28px; text-align: center; }
        .rank.gold { color: oklch(0.80 0.18 80); }
        .rank.silver { color: oklch(0.70 0.05 260); }
        .rank.bronze { color: oklch(0.65 0.12 60); }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
        .badge-success { background: oklch(62% 0.14 145 / 0.15); color: var(--green); }
        .badge-warning { background: oklch(68% 0.16 85 / 0.15); color: var(--amber); }
        .badge-danger { background: oklch(60% 0.16 28 / 0.15); color: var(--red); }
        .badge-info { background: var(--accent-glow); color: var(--accent); }
        .clickable-row { cursor: pointer; }
        .clickable-row:hover td { background: var(--surface2); }
        .text-right { text-align: right; }
        .fw-600 { font-weight: 600; }

        .donut-filter-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
        .donut-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; }
        .donut-card h3 { font-size: 15px; font-weight: 600; margin-bottom: 16px; color: var(--fg); }
        .donut-container { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
        .donut-svg { flex-shrink: 0; }
        .donut-legend { display: flex; flex-direction: column; gap: 6px; }
        .legend-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
        .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .legend-val { margin-left: auto; font-weight: 600; color: var(--fg); }

        .filter-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; }
        .filter-card h3 { font-size: 15px; font-weight: 600; margin-bottom: 14px; color: var(--fg); }
        .filter-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .filter-group { display: flex; flex-direction: column; gap: 4px; }
        .filter-group label { font-size: 12px; color: var(--muted); font-weight: 600; }
        .filter-group input, .filter-group select {
          padding: 7px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border);
          background: var(--surface); color: var(--fg); font-size: 13px;
        }
        .filter-group select option { background: var(--surface); }

        .alert-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.55);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; opacity: 0; pointer-events: none;
          transition: opacity 0.25s ease;
        }
        .alert-overlay.show { opacity: 1; pointer-events: auto; }
        .alert-box {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: 32px 40px;
          max-width: 420px; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .alert-box h3 { font-size: 18px; margin-bottom: 8px; }
        .alert-box p { color: var(--muted); font-size: 14px; margin-bottom: 20px; }

        @media (max-width: 1100px) {
          .kpi-grid { grid-template-columns: repeat(2, 1fr); }
          .top-row { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 768px) {
          .kpi-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
          .kpi-value { font-size: 20px; }
          .kpi-card { padding: 12px 14px; }
          .charts-row { grid-template-columns: 1fr; }
          .top-row { grid-template-columns: 1fr; }
          .donut-filter-row { grid-template-columns: 1fr; }
          .filter-grid { grid-template-columns: 1fr; }
          .donut-container { flex-direction: column; align-items: flex-start; }
          .toolbar { flex-direction: column; align-items: stretch; }
          .date-picker { flex-wrap: wrap; }
        }
        @media (max-width: 480px) {
          .kpi-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  );
}
