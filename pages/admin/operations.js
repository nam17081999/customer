import { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { Activity, AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FullPageLoading } from "@/components/ui/full-page-loading";
import { useAuth } from "@/lib/AuthContext";
import {
  getDashboardAggregateReport,
  getInventoryReconciliationReport,
  listOperationAuditEvents,
  listInventoryReconciliationRuns,
  runInventoryReconciliationCheck,
} from "@/api/inventory/inventory-client";
import { formatMoney } from "@/api/inventory/inventory-client";

function formatDateTime(value) {
  if (!value) return "Chưa có dữ liệu";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có dữ liệu";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function AdminOperationsPage() {
  const router = useRouter();
  const {
    user,
    isAdmin,
    isAuthenticated,
    loading: authLoading,
  } = useAuth() || {};
  const [pageReady, setPageReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [aggregate, setAggregate] = useState(null);
  const [reconciliationRows, setReconciliationRows] = useState([]);
  const [runs, setRuns] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/login?from=/admin/operations");
      return;
    }
    if (!isAdmin) {
      router.replace("/account");
      return;
    }
    setPageReady(true);
  }, [authLoading, isAuthenticated, isAdmin, router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dashboard, report, runRows, auditRows] = await Promise.all([
        getDashboardAggregateReport().catch(() => null),
        getInventoryReconciliationReport().catch(() => []),
        listInventoryReconciliationRuns(25).catch(() => []),
        listOperationAuditEvents({ limit: 25 }).catch(() => []),
      ]);
      setAggregate(dashboard);
      setReconciliationRows(report || []);
      setRuns(runRows || []);
      setAuditEvents(auditRows || []);
    } catch (err) {
      setError(err?.message || "Không tải được trung tâm vận hành.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pageReady) loadData();
  }, [pageReady, loadData]);

  const issueRows = useMemo(
    () =>
      reconciliationRows.filter((row) => (row.issue_codes || []).length > 0),
    [reconciliationRows],
  );
  const failedRuns = useMemo(
    () => runs.filter((run) => run.status === "failed"),
    [runs],
  );

  const handleRunCheck = async () => {
    if (checking) return;
    setChecking(true);
    setError("");
    try {
      await runInventoryReconciliationCheck(user?.id || null);
      await loadData();
    } catch (err) {
      setError(err?.message || "Không chạy được đối soát.");
    } finally {
      setChecking(false);
    }
  };

  if (authLoading || !pageReady)
    return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />;

  return (
    <>
      <Head>
        <title>Trung tâm vận hành - NPP Hà Công</title>
      </Head>
      <main className="min-h-full text-gray-100">
        <div className="mx-auto max-w-[1900px] space-y-4 px-3 py-4 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold">
                <Activity className="h-6 w-6" /> Trung tâm vận hành
              </h1>
              <p className="text-base text-gray-400">
                Sức khỏe hệ thống, đối soát tồn kho, cảnh báo và lịch sử repair.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleRunCheck}
                disabled={checking || loading}
              >
                <ShieldCheck className="h-4 w-4" />{" "}
                {checking ? "Đang đối soát..." : "Chạy đối soát"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={loadData}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4" /> Làm mới
              </Button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-400">Doanh thu active</p>
                <p className="text-2xl font-bold text-green-200">
                  {formatMoney(aggregate?.sales?.revenue || 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-400">Giá trị tồn</p>
                <p className="text-2xl font-bold text-sky-200">
                  {formatMoney(aggregate?.inventory?.stock_value || 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-400">Lỗi đối soát</p>
                <p className="text-2xl font-bold text-amber-200">
                  {issueRows.length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-400">Run lỗi</p>
                <p className="text-2xl font-bold text-red-200">
                  {failedRuns.length}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardContent className="p-0">
                <div className="border-b border-gray-800 p-4">
                  <h2 className="text-lg font-semibold">Cảnh báo tồn kho</h2>
                  <p className="text-sm text-gray-400">
                    Các dòng có drift/âm/orphan cần xử lý trước khi repair.
                  </p>
                </div>
                {loading ? (
                  <div className="p-4 text-gray-400">Đang tải...</div>
                ) : issueRows.length === 0 ? (
                  <div className="p-4 text-green-200">
                    Không có lỗi đối soát.
                  </div>
                ) : (
                  issueRows.slice(0, 20).map((row) => (
                    <div
                      key={row.product_id}
                      className="border-b border-gray-900 px-4 py-3 last:border-b-0"
                    >
                      <p className="font-semibold">{row.product_name}</p>
                      <p className="text-sm text-amber-200">
                        {(row.issue_codes || []).join(", ")}
                      </p>
                      <p className="text-sm text-gray-400">
                        Stock {row.stock_on_hand_base_qty} · Replay{" "}
                        {row.replay_on_hand_base_qty}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="border-b border-gray-800 p-4">
                  <h2 className="text-lg font-semibold">Lịch sử đối soát</h2>
                  <p className="text-sm text-gray-400">
                    Run check/repair gần nhất.
                  </p>
                </div>
                {runs.length === 0 ? (
                  <div className="p-4 text-gray-400">Chưa có lịch sử.</div>
                ) : (
                  runs.map((run) => (
                    <div
                      key={run.id}
                      className="border-b border-gray-900 px-4 py-3 last:border-b-0"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">{run.run_type}</p>
                        <span
                          className={
                            run.status === "failed"
                              ? "text-red-200"
                              : "text-green-200"
                          }
                        >
                          {run.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">
                        {formatDateTime(run.started_at)}
                      </p>
                      <p className="text-sm text-gray-400">
                        Mismatch {run.mismatch_count || 0} · Repair{" "}
                        {run.repaired_count || 0}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="space-y-3 p-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <AlertTriangle className="h-5 w-5 text-amber-300" /> Thao tác
                nguy hiểm
              </h2>
              <p className="text-base text-gray-300">
                Chỉ chạy repair sau khi export backup và xác nhận không có
                orphan/negative replay. Repair không ghi lại lợi nhuận lịch sử.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href="/inventory/stock">Mở đối soát kho</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/inventory/reports">Mở báo cáo</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/inventory/products/import">
                    Preview import CSV
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="border-b border-gray-800 p-4">
                <h2 className="text-lg font-semibold">
                  Audit sự kiện vận hành
                </h2>
                <p className="text-sm text-gray-400">
                  Import, repair, reconciliation và thao tác nguy hiểm gần nhất.
                </p>
              </div>
              {auditEvents.length === 0 ? (
                <div className="p-4 text-gray-400">Chưa có audit event.</div>
              ) : (
                auditEvents.map((event) => (
                  <div
                    key={event.id}
                    className="grid gap-2 border-b border-gray-900 px-4 py-3 last:border-b-0 md:grid-cols-[170px_120px_1fr_180px]"
                  >
                    <span className="font-semibold">{event.event_type}</span>
                    <span
                      className={
                        event.severity === "error" ||
                        event.severity === "critical"
                          ? "text-red-200"
                          : event.severity === "warning"
                            ? "text-amber-200"
                            : "text-green-200"
                      }
                    >
                      {event.severity}
                    </span>
                    <span className="truncate text-gray-300">
                      {event.request_id || event.entity_id || event.entity_type}
                    </span>
                    <span className="text-sm text-gray-400">
                      {formatDateTime(event.created_at)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
