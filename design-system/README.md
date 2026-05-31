Design System — tokens & Tailwind mapping

This folder contains the initial Design Tokens for NPP Hà Công and a small helper to map tokens into Tailwind.

Files:
- `tokens.json`: canonical design tokens (colors, spacing, radii, type, sizes)
- `tailwind.theme.js`: small helper that reads `tokens.json` and exposes a Tailwind `extend` object

How to use:
1. Import and merge `require('./design-system/tailwind.theme.js')` into `tailwind.config.js` under `theme.extend`.
2. Use semantic token keys (e.g. `bg-primary`, `text-onSurface`) in new components inside `components/ui/v2`.

Notes:
- This is a starting point; we'll refine color scales (light/dark variants) and token names as we iterate.
- Do not change existing business logic or APIs — this is UI-only.
