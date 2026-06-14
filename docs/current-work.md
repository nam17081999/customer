# Current Work

## Goal
- Add notification bell to mobile navbar + create /notifications page for mobile.

## Task Type
feature

## In Scope
- `components/layout/app-navbar.jsx` — add notification link to mobileLinks array
- `pages/notifications.js` — new full-page notifications view

## Out of Scope
- Changing desktop notification behavior
- Backend notification API changes
- Notification preferences/settings page

## Must Preserve
- Desktop notification bell + NotificationsPanel unchanged
- Mobile navbar existing 5-tab layout (only add 6th if admin)
- Badge count sync via notification-store
- Auth check: only show for isAdmin

## Changes
1. **`components/layout/app-navbar.jsx`** — Added conditional notification link to `mobileLinks` array: shows Bell icon with `badgeCount` badge, only when `isAdmin` is true. Uses existing `NavBadge` component.
2. **`pages/notifications.js`** — New full-page notifications view. Copies logic from `NotificationsPanel` (IntersectionObserver auto-mark-read, loadFeed, group by low-stock/reports, mark all read). Admin-only with redirect to `/` if not admin. Responsive: mobile-first full-bleed, desktop card with rounded border.

## Verification
- `npm run lint` → 0 errors (2 new warnings: unused eslint-disable directives matching existing pattern in navbar — harmless)
- `npm run build` → ✔ Build succeeds, `/notifications` route 2.27 kB
- Route appears in build output as static page

## Risks / Next
- None identified. Changes are additive and follow existing patterns exactly.
