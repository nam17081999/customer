# Current Work

## Goal
Redesign store edit page (`/store/edit/[id]`) to use the same flat single-page form layout as the create page (`/store/create`) instead of the multi-step form.

## Task Type
UI/UX Enhancement

## In Scope
- `pages/store/edit/[id].js` — rewrite from multi-step form to flat layout matching create page
- `helper/useStoreEditController.js` — expose `setFieldErrors` for flat layout form field error handling
- Retain all existing edit/supplement business logic, validation, auth gates, and save flows

## Out of Scope
- Changing create page layout
- Changing `StoreSupplementForm` or `StoreStepFormLayout` components
- Removing old components (still may be used elsewhere or kept for reference)
- Changing `storeEditFlow.js` business logic
- Changing supplement mode behavior

## Must Preserve
- Edit mode: admin-only auth gate, 3-step validation (name → district/ward → phones) executed on submit
- Supplement mode: non-auth access, field locks based on existing store data
- Active toggle in edit mode (not supplement)
- District/ward/phone validation
- Cache updates (`updateStoreInCache` + `storevis:stores-changed` event)
- Audit log (`logStoreEditHistory`)
- Non-admin supplement submits report
- Map location picker, geolocation, maps link fields
- ConfirmDialog before final save

---

## Done
✅ `pages/store/edit/[id].js` redesigned to flat single-page form:
- Removed `StoreSupplementForm` and `StoreStepFormLayout` dependencies
- Matches create page layout: sticky top bar → Name + StoreType → Map → District/Ward `<select>` → Address → Phone → Phone2 → Note → Active toggle (edit only) → Fixed bottom submit
- Supplement mode: locked fields shown as disabled with visual feedback
- Locked fields: name, storeType, addressDetail, ward, district, phone, phoneSecondary, note
- Map: uses `StoreLocationPicker` dynamic import with same props as create
- District/Ward: uses `StoreDistrictWardPicker` `<select>` (same as create), not chip buttons
- Fixed bottom bar: same pattern as create
- ConfirmDialog: uses new `onOpenChange` API for close handling

✅ `helper/useStoreEditController.js` — added `setFieldData` to return object (was missing)

## Verification
- `npm run lint` — 0 errors
- `npx next build` — successful, edit page at 14.3 kB

## Risks / Next
- The old `StoreSupplementForm.jsx` and `StoreStepFormLayout.jsx` are no longer used by the edit page but remain in the codebase. They can be cleaned up in a future refactor if not used elsewhere.
- The supplement mode field locking logic now relies on inline `isLocked()` checks rather than the old `lockedInputClass`/`lockedChipClass` from SupplementForm. Visual behavior is equivalent.