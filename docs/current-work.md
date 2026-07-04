# Current Work

## Goal
Fix compass heading to rotate the map on the store creation page — permission is now requested before navigation, but map didn't re-render with heading because the event listener was never set up.

## Task Type
Bugfix

## In Scope
- Fix bootstrap compass flow: don't re-request permission (pre-navigation already did it), just listen for events with retry
- Pre-request compass permission at all navigation entry points to `/store/create`

## Out of Scope
- GPS flow (already works without gesture)
- Other pages (edit, report, etc.)

## Must Preserve
- No persistent compass errors displayed on map
- "Get location" button retry still works
- GPS bootstrap timing (100ms delay)

---

## Done
✅ `helper/geolocation.js:224-234` — new `preRequestCompassPermission()` utility: fires `DeviceOrientationEvent.requestPermission()` within user gesture (lightweight, safe no-op on Android/desktop)

✅ `components/layout/app-navbar.jsx` — added `onClick` to desktop dropdown and mobile tab bar `<Link>` for `/store/create`

✅ `components/layout/sidebar.jsx` — combined `preRequestCompassPermission()` with existing `onClose` onClick for `/store/create` link

✅ `helper/useHomeSearchController.js` — calls `preRequestCompassPermission()` before `router.push()` in `handleCreateStoreClick`

✅ `helper/useStoreCreateController.js:295-316` — changed bootstrap compass call:
- `requestPermission: false` instead of `true` — pre-navigation already handles iOS permission request
- Added retry after 2.5s in case iOS permission dialog is still showing on first attempt
- Proper cleanup of retry timer in `useEffect` return

## Verification
- `npm run lint` — 0 errors
- `npx next build` — successful

## Risks / Next
- 2.5s retry delay is a reasonable heuristic; if user delays responding to the permission dialog beyond ~3.5s total (first 1200ms + retry 2500ms after), heading won't be available on this retry. The "Get location" button still works as a manual fallback.
- Direct URL entry bypasses pre-navigation request; heading falls back to original behavior (try on mount, may fail on iOS, "Get location" retry works).
