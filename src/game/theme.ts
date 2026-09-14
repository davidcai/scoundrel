/**
 * Scoundrel theme tokens, ported from the pre-migration styles.css `:root`
 * variables and typography rules (dark RPG palette with a gold accent).
 * Sizes are in canvas pixels; the old CSS base was 16px (= 1rem).
 */

export const COLORS = {
  /** Page background (`--bg`). */
  bg: '#0a0d13',
  /** Deep background used at the bottom of panel gradients (`--bg-deep`). */
  bgDeep: '#05070b',
  /** Main panel surface (`--panel`). */
  panel: '#141926',
  /** Lighter panel surface, e.g. button gradients (`--panel-2`). */
  panelLight: '#1b2234',
  /** Lightest panel surface, e.g. switch tracks (`--panel-3`). */
  panelLighter: '#232c44',
  /** Panel/border stroke (`--border`). */
  border: '#2c3650',
  /** Primary text (`--text`). */
  text: '#eceae6',
  /** Muted/secondary text (`--muted`). */
  muted: '#98a2b8',
  /** Gold accent: buttons, borders, wins (`--accent`). */
  gold: '#d9a44a',
  /** Bright gold accent: hovers, highlights (`--accent-bright`). */
  goldBright: '#f0c169',
  /** Text on gold surfaces (`--accent-ink`). */
  goldInk: '#1d1503',
  /** Danger: damage, losses (`--danger`). */
  danger: '#e0564f',
  /** Dark danger: danger borders (`--danger-dark`). */
  dangerDark: '#7a2f2c',
  /** Success / HP / won state (`--hp`). */
  success: '#4bb477',
  /** Dark success: HP bar track (`--hp-dark`). */
  successDark: '#1f5e3a',
  /** Red suit color (hearts/diamonds, `--red-card`). */
  suitRed: '#e0655f',
  /** Light suit color (clubs/spades, same as primary text). */
  suitLight: '#eceae6',
  /** Translucent scrim behind overlays (`.confirm-card` backdrop). */
  overlay: 'rgba(3, 5, 9, 0.82)',
} as const;

export const FONT = {
  /** UI font stack (body text, buttons, labels). */
  family: "'Segoe UI', system-ui, -apple-system, sans-serif",
  /** Serif display stack (title word, game-over headings). */
  display: "'Palatino Linotype', Palatino, Georgia, serif",
  /** Monospace stack (values, stats). */
  mono: "'Cascadia Code', ui-monospace, SFMono-Regular, Menlo, monospace",
  size: {
    /** Hero title word (max of `clamp(3rem, 9vw, 5.5rem)`). */
    title: 88,
    /** Panel headings `h2` (1.6rem). */
    h1: 25.6,
    /** Confirm/dialog headings (1.1rem). */
    h2: 17.6,
    /** Stats/weapon values (0.95rem). */
    value: 15.2,
    /** Small buttons (0.85rem). */
    small: 13.6,
    /** Uppercase zone labels (0.72rem). */
    label: 11.5,
    /** Tiny labels/legends (0.68rem). */
    tiny: 10.9,
  },
} as const;

export const RADIUS = {
  /** Card corners (`--card-radius`). */
  card: 12,
  /** Buttons (`.btn`). */
  button: 10,
  /** Chips/pills (border-radius 999px). */
  pill: 999,
  /** Sections like the action panel / confirm card. */
  section: 14,
  /** Large panels (`.panel`). */
  panel: 16,
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  /** Screen padding (`.screen`). */
  screen: 20,
  /** Bottom clearance after the main panel. */
  screenBottom: 48,
  /** Card row gap (min of `clamp(10px, 2.5vw, 22px)`). */
  cards: 10,
} as const;
