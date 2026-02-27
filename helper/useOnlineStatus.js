import { useState, useEffect, useRef } from "react";

const PING_TIMEOUT = 5000; // ms

/**
 * Ping a lightweight endpoint that bypasses the Service Worker cache.
 * Uses AbortController to enforce a hard timeout so we never hang.
 * Returns `true` if the network is reachable, `false` otherwise.
 */
async function pingNetwork() {
  // If browser already says offline, skip the fetch entirely — this
  // value is always trustworthy when it says `false`.
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT);

  try {
    const res = await fetch(
      `/manifest.json?__connectivity_check&_t=${Date.now()}`,
      { method: "HEAD", cache: "no-store", signal: controller.signal }
    );
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * React hook that tracks browser online/offline status.
 *
 * Strategy (most optimal balance of speed vs accuracy):
 *
 *  • Default state: `true` — SSR-safe, no false "offline" flash.
 *  • `offline` event  → **trust immediately** (navigator.onLine = false is
 *    always accurate — the OS genuinely lost its network interface).
 *  • `online` event   → set online for snappy UX, then **verify with ping**;
 *    if the ping fails revert to offline (handles macOS/VPN false-positives).
 *  • On mount → only ping when navigator.onLine is true (cheap early check).
 *
 * Returns `{ isOnline, wasOffline }`.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    function markOnline() {
      if (!mountedRef.current) return;
      setIsOnline(true);
    }

    function markOffline() {
      if (!mountedRef.current) return;
      setIsOnline(false);
      setWasOffline(true);
    }

    // ── Mount check ──────────────────────────────────────────────────
    // Only ping if the browser *claims* online — skip wasted request
    // when navigator.onLine is already false (always trustworthy).
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      markOffline();
    } else {
      pingNetwork().then((ok) => (ok ? markOnline() : markOffline()));
    }

    // ── Event handlers ───────────────────────────────────────────────
    function handleOffline() {
      // navigator.onLine === false is always correct → trust instantly.
      markOffline();
    }

    function handleOnline() {
      // navigator.onLine === true can lie (macOS, VPN, captive portal).
      // Show online instantly for responsive UX, then verify.
      markOnline();
      pingNetwork().then((ok) => {
        if (!ok) markOffline();
      });
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline, wasOffline };
}
