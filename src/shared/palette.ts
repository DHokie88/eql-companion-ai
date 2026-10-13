/**
 * Shared colours for the Companion 1.17 dark-and-gold appearance.
 *
 * Plain constants rather than an MUI palette, because the MUI theme is not the only consumer:
 * `renderer/src/theme/theme.ts` builds the main window's theme FROM these, but the overlay, tray
 * and cursor bundles deliberately run without a ThemeProvider (overlay/main.tsx), the main
 * process paints every window's background before a renderer has loaded (windows.ts / tray.ts),
 * and scripts/gen-icon.mts draws the brand mark. Each of them used to carry its own literal copy
 * of the old gold; now each carries a reference here, and a rework is one file.
 *
 * RELATIVE IMPORTS ONLY. `@shared/*` is a bundler alias that node-run unit tests do not resolve,
 * and several consumers (tierChip.ts, resistColors.ts) are reached from those tests.
 *
 * One file cannot import this: `src/renderer/tray.html` paints `bg` as a literal for its first
 * frame — keep it equal by hand.
 *
 * Contrast is MEASURED, not assumed: tests/palette.test.mts computes WCAG ratios for every text
 * use (tokens on `paper`, `ink` on every tier chip, the resist axes) and fails under 4.5.
 */
export const PALETTE = {
  /** window / page ground — and what the main process builds every window on */
  bg: '#0f1115',
  /** cards, panels, the tray notice's buttons */
  paper: '#171a21',
  /** near-black foreground on a saturated chip (the tier chips); the theme's ink */
  ink: '#0f1115',
  /** body text */
  text: '#ffffff',
  /** THE ACCENT: buttons, links, the active tab, the damage meter's chrome, "you" in a meter */
  accent: '#d9b25f',
  /** the accent's highlight — the icon's bright edge */
  accentHi: '#e4c781',
  /** secondary actions; "pet", DoTs, the cold axis */
  cyan: '#6fb3d2',
  /** a dimmer, cooler wash of `cyan` — somebody ELSE's pet (KIND_COLOR.allyPet) */
  cyanDim: '#3a86ad',
  /** success; healing, quests, the poison axis */
  green: '#5fbf72',
  /** warning; the series slot the old purple held (spells, invocations, AA points, D3) */
  amber: '#e0a94a',
  /** error; the enemy, damage shields */
  red: '#f87171',
  /** the retro-wave second neon — gradients and glows only, never a series colour */
  magenta: '#f472b6'
} as const

/**
 * Use the same readable system face for headings, data and standalone overlays.
 * Keep the three keys for existing consumers; none requests a decorative font.
 */
export const FONTS = {
  display: "Inter, 'Segoe UI', Roboto, system-ui, sans-serif",
  mono: "Inter, 'Segoe UI', Roboto, system-ui, sans-serif",
  body: "Inter, 'Segoe UI', Roboto, system-ui, sans-serif"
} as const

/** The signature rule: magenta → violet → cyan. Horizontal unless a surface asks otherwise. */
export const NEON = `linear-gradient(90deg, ${PALETTE.magenta}, ${PALETTE.accent}, ${PALETTE.cyan})`
export const NEON_VERTICAL = `linear-gradient(180deg, ${PALETTE.magenta}, ${PALETTE.accent}, ${PALETTE.cyan})`

/** `hex` at `alpha`, as a CSS `rgba()` — for the bundles that have no MUI `alpha()`. */
export function withAlpha(hex: string, alpha: number | string): string {
  const n = parseInt(hex.slice(1, 7), 16)
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`
}
