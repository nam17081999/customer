# UI Design System (summary)

Goal: provide tokens and presentation components to modernize UI while preserving business logic.

Tokens
- Colors: `slate`, `zinc`, `indigo`, `blue`, `emerald`, `amber`, `danger` (see `tailwind.config.js`).
- Border radius: `xl` = 12px, `2xl` = 16px.
- Spacing scale: baseline 4px, `spacing.13` = 3.25rem for large gaps.

Typography
- Mobile-first scale, system font stack (Inter, system-ui).

Components (presentation-only)
- `PrimaryButton` — main CTA (composes existing `Button`).
- `FAB` — floating action button for quick create/search.
- `InputV2` — consistent input sizing.
- `DataTable` — wrapper with sticky header styling.
- `Skeleton` — lightweight loading placeholder.
- `BottomNav` — mobile bottom navigation presentation.

Guidelines
- Only use these components for presentation. Do not change props expected by business logic components.
- Prefer `PrimaryButton` for prominent CTAs (submit, reconciliation, checkout).
- Use `FAB` for single, high-value quick actions on mobile.

Migration notes
- Add new components behind feature flags where required. The new components are backward compatible wrappers.
