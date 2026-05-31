// Tailwind theme mapping based on design-system/tokens.json
const tokens = require('./tokens.json')

function mapColors(colors) {
  const out = {}
  Object.keys(colors).forEach((k) => {
    const v = colors[k]
    if (typeof v === 'string') out[k] = v
    else if (v.DEFAULT) out[k] = v.DEFAULT
  })
  return out
}

module.exports = {
  extend: {
    colors: mapColors(tokens.colors),
    borderRadius: {
      sm: tokens.radii.sm,
      md: tokens.radii.md,
      lg: tokens.radii.lg,
      pill: tokens.radii.pill,
    },
    spacing: {
      xs: tokens.spacing.xs,
      sm: tokens.spacing.sm,
      md: tokens.spacing.md,
      lg: tokens.spacing.lg,
      xl: tokens.spacing.xl,
    },
    fontSize: {
      base: tokens.type.mobile.base,
    },
    boxShadow: {
      low: tokens.elevation.low,
      medium: tokens.elevation.medium,
    },
  },
}
