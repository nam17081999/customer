# Current Work

## Goal
- Adjust the printable sales invoice to match the compact paper order sample provided by the user.

## Task Type
- Feature

## Why
- The current invoice is too modern/card-like.
- The user wants a compact paper-style delivery invoice: dense header, bordered item table, amount in words, notes, and signature columns.

## In Scope
- `helper/orderInventoryFlow.js`
- `pages/orders/[id].js`
- Unit tests before implementation.
- Paper-style invoice layout and amount-in-words helper.

## Out of Scope
- PDF generation.
- Debt/payment tracking.
- Changing order creation/cancel behavior.
- Adding new dependencies.

## Must Preserve
- Admin-only order detail access.
- Existing order detail/cancel behavior.
- No hard delete or inventory mutation changes.
- Vietnamese UTF-8 text.
- 1900px workbench and mobile readability.

## Inputs / Repro / Expected
- Current: invoice exists but does not look like the provided paper sample.
- Expected:
  - Printable invoice has compact paper layout similar to the image.
  - Header shows company/distributor, bank info, date, order number, customer, address, and salesperson placeholder.
  - Bordered table has STT, item name, unit, quantity, unit price, amount.
  - Footer has total amount, amount in Vietnamese words, payment QR/bank info, note, and signature columns.

## Constraints
- Test-first helper coverage.
- Use VietQR Quick Link image URL; no QR package dependency.

## Required Verification
- Initial focused tests must fail before implementation.
- Focused unit tests for amount-in-words and invoice helpers.
- Full `npm run test`.
- `npm run lint`.
- `npm run build`.
- `git diff --check`.
- `npm run text:check`.
- Checklist:
  - Checklist chung cho mọi task
  - Tiếng Việt / UI Safety

## Definition of Done
- Tests are written first and pass after implementation.
- `/orders/[id]` print invoice matches the compact paper-style sample more closely.
- Verification passes or residual risk is recorded.

## Plan
- Add failing tests for Vietnamese amount in words in the invoice model.
- Implement amount-in-words helper.
- Replace the invoice template with a compact bordered paper-style layout.
- Run focused and full verification.

## Done
- Added test-first coverage for:
  - Vietnamese amount-in-words formatting.
  - invoice model exposing `totalAmountInWords`.
- Added `formatVietnameseMoneyInWords()` for integer VND amounts.
- Updated `/orders/[id]` print template to match the provided sample more closely:
  - A5 portrait print page.
  - compact paper-style header.
  - customer/address/phone/salesperson lines.
  - bordered item table with `STT`, `Tên hàng hóa`, `ĐVT`, `SL`, `Đ.Giá`, `T.Tiền`.
  - total amount row and amount in words.
  - short customer notes.
  - three signature columns: `Khách hàng`, `Thủ kho`, `Kế toán`.
  - compact HDBank transfer info and QR retained.

## Verification
- Initial focused test failed before implementation, as expected:
  - missing `formatVietnameseMoneyInWords`
  - missing `totalAmountInWords`
- Pass: focused `npm run test -- __tests__/helper/orderInventoryFlow.test.js`
  - 1 test file passed
  - 26 tests passed
- Pass: full `npm run test`
  - 33 test files passed
  - 427 tests passed
- Pass: `npm run lint`
  - 0 errors
  - 1 warning for external QR `<img>`
- Pass: `npm run build`
  - compiled successfully
  - same external QR `<img>` warning
- Pass: `git diff --check`.
- Pass: `npm run text:check`.
- Checklist verified:
  - Checklist chung cho mọi task: scoped implementation, test-first, full verification passed.
  - Tiếng Việt / UI Safety: UTF-8 scan passed; invoice remains readable and print-focused.

## Risks / Next
- No authenticated browser print-preview smoke was run against a real admin session.
- Company address/phone are placeholders because no official values were provided.
- VietQR image depends on external `img.vietqr.io` availability.
