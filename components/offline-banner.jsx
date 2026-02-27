import { useOnlineStatus } from "@/helper/useOnlineStatus";
import { useState, useEffect } from "react";

/**
 * A banner that slides in from the top when the user goes offline,
 * and shows a brief "back online" confirmation when connectivity returns.
 */
export default function OfflineBanner() {
  const { isOnline, wasOffline } = useOnlineStatus();
  const [showBackOnline, setShowBackOnline] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowBackOnline(true);
      const timer = setTimeout(() => setShowBackOnline(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Listen for sync completion events
  useEffect(() => {
    function onSyncDone(e) {
      const { synced, failed } = e.detail;
      let msg = `Đã đồng bộ ${synced} cửa hàng`;
      if (failed) msg += ` (${failed} thất bại)`;
      setSyncMsg(msg);
      setTimeout(() => setSyncMsg(""), 5000);
    }
    window.addEventListener("offline-sync-done", onSyncDone);
    return () => window.removeEventListener("offline-sync-done", onSyncDone);
  }, []);

  // Show sync message even when online
  if (syncMsg) {
    return (
      <div className="flex items-center justify-center gap-1.5 px-3 py-1 text-xs font-medium text-white bg-blue-600">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
        </svg>
        <span>{syncMsg}</span>
      </div>
    );
  }

  if (isOnline && !showBackOnline) return null;

  return (
    <div
      className={`flex items-center justify-center gap-1.5 px-3 py-1 text-xs font-medium text-white transition-all duration-300 ${
        isOnline ? "bg-green-600" : "bg-red-600"
      }`}
    >
      {isOnline ? (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3 w-3"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span>Đã kết nối lại</span>
        </>
      ) : (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3 w-3"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>Bạn đang offline — Dữ liệu có thể không cập nhật</span>
        </>
      )}
    </div>
  );
}
