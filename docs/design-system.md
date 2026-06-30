# Design System - NPP Hà Công

## Overview

Modern minimal dark-theme admin workbench. Single dark mode — no light mode. All colors use oklch for perceptual uniformity. Base font: 16px (640px+), 17px (1280px+).

## Layout

### Sidebar (240px) + Header + Content
- Sidebar: fixed `w-60`, `min-h-screen`, background `var(--sidebar)` (oklch 11%)
- Header: `h-12` (48px), `bg-surface` with bottom border, page title + subtitle
- Content: `flex-1`, scrollable, padding `24px`

### Layout Components
- `AppLayout` (`components/layout/app-layout.jsx`) — wraps all authenticated pages
- `Sidebar` (`components/layout/sidebar.jsx`) — brand + nav sections + user card
- Page titles/subtitles defined in `pages/_app.js` via `PAGE_TITLES` map

## Typography

| Level | CSS | Size | Weight |
|---|---|---|---|
| Page title | `.page-title h1` | 22px | 700 |
| Page subtitle | `.page-title p` | 14px | 400 (muted) |
| Section heading (card header) | `.card-header h3` | 15px | 600 |
| Table header | `.data-table th` | 11px | 600 (uppercase) |
| Table cell | `.data-table td` | 14px | 400 |
| Body | base | 15px | 400 |
| Label/small | various | 11-13px | 500-600 |

Base font: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif`

## Color Tokens (CSS custom properties in `:root`)

| Token | Oklch Value | Usage |
|---|---|---|
| `--bg` | oklch(14% 0.015 250) | Page background |
| `--surface` | oklch(18% 0.012 250) | Card, table, panel background |
| `--surface2` | oklch(21% 0.015 250) | Hover state, secondary surface |
| `--fg` | oklch(92% 0.008 250) | Primary text |
| `--muted` | oklch(58% 0.012 250) | Secondary text, icons |
| `--border` | oklch(28% 0.012 250) | Borders, dividers |
| `--accent` | oklch(65% 0.18 245) | Primary accent (blue) |
| `--accent-glow` | oklch(55% 0.18 245 / 0.15) | Accent translucent background |
| `--green` | oklch(62% 0.14 145) | Success |
| `--amber` | oklch(68% 0.16 85) | Warning |
| `--red` | oklch(60% 0.16 28) | Error/danger |
| `--purple` | oklch(62% 0.14 290) | Special status |
| `--sidebar` | oklch(11% 0.01 250) | Sidebar background |

### Semantic Mappings

| Context | Token |
|---|---|
| Primary button | `background: var(--accent)` |
| Danger button | `background: var(--red)` |
| Success badge | `color: var(--green)` |
| Warning badge | `color: var(--amber)` |
| Info badge | `color: oklch(60% 0.16 245)` |

### Tailwind Theme (`@theme` block)

Gray scale: `--color-gray-50` through `--color-gray-950` map to oklch values (same hues as CSS vars). Use Tailwind classes like `bg-gray-900` or `text-gray-100` where convenient, but prefer CSS vars for semantic meaning.

## Components

### Buttons (`.btn`)

Base: `height: 36px`, `border-radius: 8px`, `font-size: 13px`, `font-weight: 600`

| Variant | Class | Style |
|---|---|---|
| Primary | `.btn-primary` | Background `var(--accent)`, white text |
| Outline | `.btn-outline` | Transparent bg, `1px solid var(--border)` |
| Danger | `.btn-danger` | Background `var(--red)`, white text |
| Success | `.btn-success` | Background `var(--green)`, white text |
| Small | `.btn-sm` | 32px height, 12px font |
| Extra small | `.btn-xs` | 28px height, 11px font |
| Icon | `.btn-icon` | 34x34 grid, border + muted color |
| Active icon | `.btn-icon.active` | Accent border + glow background |

### React Button (`components/ui/button.jsx`)
- Props: `variant` (primary/secondary/outline/ghost/danger/success), `size` (default/sm/lg/icon)
- Additional styles for Radix/Shadcn style buttons with proper disabled states

### Card (`.card` / `components/ui/card.jsx`)

Background `var(--surface)`, `1px solid var(--border)`, `border-radius: 12px`, overflow hidden.

- `.card-header`: flex row, 16px 20px padding, bottom border
- `.card-body`: 20px padding
- Header h3: 15px font, 600 weight

React export: `{ Card, CardHeader, CardBody, CardContent }`

### KPI Card (`.kpi-card` / `components/ui/kpi-card.jsx`)

Grid: `.kpi-grid` — 4 columns (responsive: 2 columns at <1100px, 1 column at <768px? no, grid collapses to 2 at 1100px, gap reduces at 768px).

Card structure: 18px 20px padding, optional `.shine` top accent bar (2px).
- `.kpi-label`: 11px, uppercase, 600 weight, muted
- `.kpi-value`: 28px, 700 weight, tight letter-spacing
- `.kpi-sub`: 12px, muted
- `.kpi-change`: 12px, 600 weight, `.up` → green, `.down` → red

React: `<KpiCard label value sub change changeDir />` + `<KpiGrid>` wrapper.

### Status Badge (`.status-badge` / `components/ui/status-badge.jsx`)
- Inline-flex, 12px, 500 weight, 3px 10px padding, 6px radius
- 6px dot via `::before` content (or `.dot` element)
- Variants: `success/active` (green), `warning/pending` (amber), `danger/inactive` (red), `info` (blue), `default/draft` (muted)
- React: `<StatusBadge status={value} />` — accepts any string, maps known statuses to CSS classes

### Pagination (`.pagination` / `components/ui/pagination.jsx`)
- Flex row, 4px gap, 12px 20px padding, top border
- `.page-btn`: 34x34, border, 13px font
- Active state: accent background, white text
- Prev/Next: chevron icons
- Ellipsis: `.page-ellipsis` (24px width, centered, muted)
- `.page-info`: 13px, muted, right-aligned

React: `<Pagination page totalPages onPageChange />`

### Search Box (`.search-box` / `components/ui/search-box.jsx`)
- Flex row, 8px gap, border, 6px 12px padding, 8px radius
- Focus: border becomes accent
- Input: bg none, 13px font, full width
- Lucide Search icon, optional clear button (`.search-clear`)

React: `<SearchBox value onChange placeholder />`

### Toggle (`.toggle-switch` / `components/ui/toggle.jsx`)
- 44x24 switch, 12px radius slider
- Checked: accent border + glow bg, knob translates 20px
- React: `<Toggle label description checked onChange />`

### Chip (`.chip` / `components/ui/chip.jsx`)
- 32px height, 0 12px padding, 999px radius, 13px font, 500 weight
- Border + surface bg, hover → accent border
- Active: accent glow bg + accent border + fg color
- Fuchsia variant: `.chip.fuchsia.active` — purple tint
- React: `<Chip active label onClick variant />`

### Data Table (`.data-table`)
- Full width, collapse borders
- th: 11px, uppercase, 600 weight, muted color, `surface2` background
- td: 14px, border-bottom separator
- Row hover: `surface2` background
- Sortable headers: `.sort-asc` / `.sort-desc` with `.sort-icon`

### Empty State (`.empty-state` / `components/ui/empty-state.jsx`)
- Centered, 60px 20px padding
- 48x48 icon (opacity 0.3), h3 (16px, 600 weight), p (14px)

### Toast (`.toast` / `components/ui/toast.jsx`)
- Slide-in notification, success/error variants
- Auto-dismiss, animated entrance
- Used via `useToast()` hook

### Confirm Dialog (`components/ui/confirm-dialog.jsx`)
- Overlay modal for destructive actions
- Title, description, confirm/cancel buttons
- Danger variant: red confirm button

## Filter Panel (`.filter-panel`)
- Collapsible desktop panel: `display: none` / `.open` → block
- `.filter-grid`: auto-fit, min 180px columns
- `.filter-actions`: right-aligned, top border separator
- Mobile sheet variant: `.filter-sheet` (bottom sheet, 85vh max, rounded top)
- `.filter-backdrop`: translucent blur overlay

## Table Container (`.table-container`)
- Wrapper with border + radius, overflow-x auto
- `.table-toolbar`: flex row, 12px 20px padding, bottom border
- `.table-wrapper`: min 900px for horizontal scroll

## Store Card Grid (`.store-grid`)
- `grid-template-columns: repeat(auto-fill, minmax(340px, 1fr))`, 12px gap
- `.store-card`: surface bg, border, 16px padding, hover → accent border
- Sections: `.store-card-top` (name + badge), `.store-card-body` (rows), `.store-card-meta` (type badges), `.store-card-actions` (buttons)

## Badges

### General Badge (`.badge`)
- 999px radius, 11px font, 600 weight
- Colors: `.badge-green`, `.badge-amber`, `.badge-red`, `.badge-purple`, `.badge-blue`

### Store Type Badges
- `.badge-tap-hoa` (blue), `.badge-quan-an` (green), `.badge-kho` (amber), `.badge-karaoke` (purple), `.badge-khach-san` (red), `.badge-game` (teal)

## Responsive Breakpoints

| Breakpoint | Changes |
|---|---|
| `<1100px` | KPI grid → 2 columns, cols-2 → 1 column, ops-grid → 2 columns |
| `<768px` | Store grid → 1 column, KPI value → 22px, ops-grid → 1 column, qa-grid → 2 columns |
| `<639px` | Table cells → smaller padding |

## Accessibility

- Focus-visible: 2px accent outline + offset
- Scrollbar: 6px, rounded, border-color thumb
- `scrollbar-gutter: stable` on html to prevent layout shift
- No `text-xs` for important data (prices, quantities, customer names, order statuses)
- Touch-friendly: min 44px tap targets for actions

## Vietnamese Copy

All UI text in UTF-8 Vietnamese. Key labels preserved (see page title map in `_app.js`, store search labels, etc.). No hardcoded ASCII replacements.

## Dialog/Modal

### CSS Modals (`.modal-overlay`)
- Fixed overlay with backdrop blur
- `.modal`: max 560px, surface bg, rounded-2xl, animate entrance
- Sections: `.modal-head` (title + close button), `.modal-body` (scrollable), `.modal-foot` (actions)

### Radix Dialog (existing `components/ui/dialog.jsx`)
- Used in complex interactions (order cancellation, etc.)
- Must have `DialogTitle` and `aria-describedby`

## Forms

- `.f-input`: 42px height, border, 14px font, focus → accent border
- `.f-input.error` → red border
- `.form-group`: flex column, 6px gap, label 12px uppercase
- Select: custom chevron via background-image SVG

## Scrollable Lists & Tables

- Only the scrollable region gets `overflow-y-auto`
- Table headers must be `sticky top-0` with opaque background
- Header must stay in place during vertical scroll

## Notes

- Do NOT use Tailwind `text-xs` or `text-[11px]` for important data
- Do NOT hard-delete stores (soft delete via `deleted_at`)
- Project no longer stores store photos
- Map flow: `/map` dark theme fixed, uses `StoreLocationPicker` with `dark={false}` for light map in forms
