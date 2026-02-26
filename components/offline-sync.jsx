import { useEffect, useRef, useCallback } from "react";
import { useOnlineStatus } from "@/helper/useOnlineStatus";

/**
 * Invisible component that syncs the offline store queue when connectivity
 * returns. Shows toast-style messages via the provided `showMessage` callback
 * (or falls back to console).
 *
 * Mount once in _app.js.
 */
export default function OfflineSync() {
  const { isOnline, wasOffline } = useOnlineStatus();
  const syncingRef = useRef(false);

  const doSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;

    try {
      const { getPendingCount, processOfflineQueue } = await import(
        "@/lib/offlineQueue"
      );
      const count = await getPendingCount();
      if (count === 0) return;

      console.log(`[OfflineSync] ${count} store(s) pending – syncing…`);
      const { synced, failed } = await processOfflineQueue();

      if (synced > 0) {
        // Dispatch a custom event so any listening UI can show a toast
        window.dispatchEvent(
          new CustomEvent("offline-sync-done", {
            detail: { synced, failed },
          })
        );
        console.log(
          `[OfflineSync] Synced ${synced} store(s)${failed ? `, ${failed} failed` : ""}`
        );
      }
    } catch (err) {
      console.error("[OfflineSync] Sync error:", err);
    } finally {
      syncingRef.current = false;
    }
  }, []);

  // Sync when transitioning from offline → online
  useEffect(() => {
    if (isOnline && wasOffline) {
      doSync();
    }
  }, [isOnline, wasOffline, doSync]);

  // Also attempt sync on mount (page refresh while online after queueing)
  useEffect(() => {
    if (navigator.onLine) {
      doSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null; // no DOM
}
