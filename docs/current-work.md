# Current Work

## Goal
Heading captured ONCE when entering create page — map rotates to that heading and stays fixed (no real-time updates).

## Task Type
Bugfix

## In Scope
- One-shot `deviceorientation` listener in map component — captures first heading event, sets bearing, ignores subsequent events
- Bootstrap handles only GPS (heading is offloaded to map listener)

---

## Done
✅ `components/map/location-picker.jsx:520-545` — one-shot `deviceorientation` listener:
- Captures the FIRST heading event only (ignores subsequent ones)
- Sets map bearing directly — no React re-render
- Self-removes listener after capture (no leak)
- Works regardless of when iOS permission dialog resolves (even after GPS)

✅ `helper/useStoreCreateController.js:288-322` — bootstrap simplified to GPS only; heading capture removed (handled by map listener)

## Verification
- `npm run lint` — 0 errors
- `npx next build` — successful

## Two heading paths coexist
1. **Automatic (one-shot listener)**: Map mounts → listens for first `deviceorientation` event → sets bearing → done. No React re-render.
2. **"Get location" button**: `refreshCompassHeading()` → `setHeading()` → `useEffect([heading])` → `map.setBearing()`. Triggers React re-render (user-initiated, acceptable).
