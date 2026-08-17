# Scoundrel — Style Guide (Phase 1)

Status: contract for the Phase 1 UI build. Covers the visual foundation
(`src/ui/styles/tokens.css`, `src/ui/styles/base.css`) and directions for the
title and play screens. Phase 2 screens (stats, settings, scorecard) consume
the same tokens; their notes are marked as such.

---

## 1. Rationale

Two worlds, one screen:

- **The environment is the dungeon.** Deep charcoal, cold stone, thin
  hairlines, layers sinking into a black abyss. It is quiet, dim, and modern —
  Slay-the-Spire-sharp presentation, not a dungeon wallpaper.
- **The cards are artifacts pulled out of it.** Every card face is its
  full-bleed gravure JPG: hand-engraved graphite on light aged parchment.
  We do not redraw, restyle, or tint card art. The art already carries the
  theme; the UI's job is contrast.

The tension between cold dark chrome and warm lit parchment *is* the look.
Warmth is rationed: torchlight **ember** marks everything interactive;
**crimson** marks pain. Nothing else glows.

The engraved art is busy — fine hatching, stains, a serif corner index. At
60–100px thumbnails the art's own rank index smears. So rank legibility is the
**badge's** job, not the art's. See §5.

---

## 2. Usage contract

The UI builder must honor these rules. They are the interface between design
and components.

1. **Tokens only.** Components reference `var(--…)` from `tokens.css`. No raw
   hex, no raw px spacing/radius/duration values in component styles. If a
   value is missing, request a token; do not improvise one.
2. **Load order is fixed:** `tokens.css` → `base.css` → component CSS.
3. **Theme scope:** wrap the app root in `<div className="theme-scoundrel">`.
   `body` carries the dungeon shell background; screens render transparent
   over it.
4. **Card corners are kept corners.** A card is exactly two radiused boxes
   (frame, art) sharing `border-radius: var(--card-radius)`; both have
   `overflow: hidden`. Never square any corner, never add borders between the
   parchment edge and the art. Selection rings are `box-shadow` spreads at
   100% spread — never `outline` on cards (outlines square off under radius).
5. **Suit tinting lives in chrome, never on art.** Badges, HUD pips, and
   stack tags may tint by suit. Card art is never filtered, tinted, or
   desaturated except the disabled/greyed treatment in §5.
6. **Focus is never removed.** Chrome uses the global `:focus-visible` ring;
   cards use the inset ring recipe (§5.4).
7. **Fonts load via fontsource** (§4). No Google Fonts links, no system
   serif fallback for display text beyond the declared stacks.
8. **Names are stable.** Existing token names are API. New tokens get
   `--color-*`, `--space-*`, etc. prefixes and a one-line comment, like the
   rest.

---

## 3. Token catalog

All tokens live on `:root` in `src/ui/styles/tokens.css`.

### 3.1 Environment color

| Token | Value | Use |
| --- | --- | --- |
| `--color-abyss` | `#0d0f13` | Deepest background; focus-ring offset color; gradient terminus |
| `--color-stone-deep` | `#232830` | Background slab blends |
| `--color-stone` | `#3f4731` | Background slab blends (muted stone-green) |
| `--color-stone-warm` | `#462d26` | Background slab blends (warm sienna) |
| `--color-surface-1` | `#161a20` | Wells, zones, lowest UI plane |
| `--color-surface-2` | `#1c2129` | Panels |
| `--color-surface-3` | `#232933` | Raised chrome: actions bar, chips |
| `--color-surface-4` | `#2c333f` | Hover fills, pressed chips, scrollbar thumb |
| `--color-hairline` | `#2e3542` | Borders on dark surfaces. Never pure black. |
| `--color-hairline-strong` | `#454e5e` | HUD top rule, emphasized dividers |

### 3.2 Text

| Token | Value | Use |
| --- | --- | --- |
| `--color-text` | `#e9e4d8` | Primary text on all dark surfaces |
| `--color-text-muted` | `#a9a294` | Labels, secondary copy |
| `--color-text-faint` | `#6f6a5f` | Seed strings, empty-slot hints — floor for any text |
| `--color-text-inverse` | `#17130e` | Text/icons on bright accent fills (ember buttons) |
| `--color-text-on-parchment` | `#241d14` | Text on parchment sheets (scorecard) |

### 3.3 Parchment

| Token | Value | Use |
| --- | --- | --- |
| `--color-parchment` | `#cfc2a4` | Card frame undertone, scorecard sheets |
| `--color-parchment-deep` | `#ab9873` | Parchment shading |
| `--color-parchment-edge` | `#241d15` | 1px card-frame outline |
| `--color-parchment-ink` | `#2a2118` | Engraved-ink tone for rules text on sheets |

### 3.4 Accents

| Token | Value | Use — rationed |
| --- | --- | --- |
| `--color-ember` | `#e2a04c` | THE interactive accent: selection, hover, CTA borders |
| `--color-ember-bright` | `#f6be67` | Hover text, focus ring |
| `--color-ember-deep` | `#9c6524` | Ember borders on dark fills, link underlines |
| `--color-ember-glow` | `rgba(226,160,76,.34)` | Selection halos, torch pools |
| `--color-ember-glow-soft` | `rgba(226,160,76,.16)` | Dim pools behind menu items |
| `--color-crimson` | `#c93b3b` | Danger base |
| `--color-crimson-bright` | `#e0584f` | Danger hover, confirm ring |
| `--color-crimson-deep` | `#7e2222` | Danger borders, pressed |
| `--color-crimson-on-abyss` | `#e86a5f` | HP, damage numbers on dark — tuned for contrast |
| `--color-crimson-glow` | `rgba(201,59,59,.35)` | Lethal/damage halos |
| `--color-verdigris` | `#6fa08e` | Deck-count pip only — the run's remaining duration, cold counterpoint to ember |
| `--color-verdigris-dim` | `#40604f` | Deck pip border |
| `--color-success` | `#8aa86a` | Win screen accents only. Never an action color. |

Suit tints (HUD chips, kill-stack tags, badge glyph tint at full card sizes):

| Token | Value | Suit |
| --- | --- | --- |
| `--color-suit-monster` | `#c2c9d4` | Clubs, spades (steel-silver) |
| `--color-suit-weapon` | `#d8974b` | Diamonds (ember-bronze) |
| `--color-suit-potion` | `#d9534f` | Hearts (potion crimson) |

### 3.5 Fixed on-art pairs

These exist for the badge and its scrim — the only elements that live on top
of light parchment art.

| Token | Value | Use |
| --- | --- | --- |
| `--color-badge-bg` | `rgba(24,20,15,.88)` | Badge chip fill |
| `--color-badge-text` | `#f2ead9` | Badge rank + glyph |
| `--color-badge-border` | `rgba(242,234,217,.28)` | Badge hairline |
| `--color-vignette` | `rgba(16,13,10,.45)` | Top-left scrim gradient under the badge |

### 3.6 Typography

Families and modular scale (≈1.25). Usage rules in §4.

`--font-display`, `--font-ui`, `--font-number` ·
`--text-xs`(11px) → `--text-sm`(12) → `--text-md`(14) → `--text-body`(16) →
`--text-lg`(20) → `--text-xl`(24) → `--text-display`(36) →
`--text-hero`(clamp 44–88px) · weights 400/500/600/700 + `--weight-display` ·
leadings tight/body/caption · trackings display/hero/label.

### 3.7 Spacing, radii, card geometry

Spacing scale `--space-1…--space-8` (4→64px). Radii `--radius-sm/md/lg/pill`.
Chrome minimum hit target: 40px height (`--space-4` × 2.5) — design buttons
and menu items to it.

Cards never use chrome radii. Card geometry:

| Token | Value | Use |
| --- | --- | --- |
| `--card-ratio` | `5 / 7` | `aspect-ratio` on every card frame |
| `--card-radius` | `5.5%` | Of card **width**; frame and art both |
| `--card-inset` | `4%` | Of card width; badge/vignette offsets |
| `--card-width-room` | clamp(104px, 17vw, 176px) | Room row |
| `--card-width-hand` | clamp(64px, 10vw, 96px) | Kill stack, compact zones |
| `--card-width-thumb` | 60px | Absolute floor. Never render card art smaller. |

### 3.8 Shadows, rings, z, motion, badge

Shadow presets: `--shadow-1/2` (chrome), `--shadow-card`,
`--shadow-card-hover`, `--shadow-card-selected`, `--glow-ember`,
`--glow-torch`, `--glow-crimson`. Ring presets (box-shadow, 100% spread):
`--ring-hover`, `--ring-selected`, `--ring-confirm`, `--ring-focus-card`.
Z-layers `--z-base` → `--z-toast` (0/10/20/30/40/50/60). Motion
`--duration-instant/fast/med/slow` (90/140/220/380ms) with
`--ease-out/spring/in-out`. Badge tokens mirror §5. All already commented in
`tokens.css`; values there are canonical.

---

## 4. Typography

Two self-hosted variable fonts. Install exactly:

```bash
npm install @fontsource-variable/cinzel @fontsource-variable/inter
```

Import once at the app entry (component builder owns this):

```ts
import "@fontsource-variable/cinzel"; // weights 400–900, includes the opsz axis
import "@fontsource-variable/inter";  // weights 100–900
```

**Cinzel Variable** (`--font-display`) — the dungeon voice. Titles, screen
headings, the wordmark, zone headings. Engraved Roman capitals that sit
naturally beside the gravure card art. Rules:

- Display text is uppercase or title case, never sentence case.
- Weight 700 for headings, 800 for the wordmark only.
- Always apply `--tracking-display`; the wordmark uses `--tracking-hero`.
- Never below `--text-xl`. Cinzel is illegible as small UI text.

**Inter Variable** (`--font-ui`) — the HUD voice. Body, buttons, menus,
labels, tooltips, and **all numbers**. HP digits, deck count, damage previews,
badge ranks: `--font-number` (= Inter). Rules:

- Micro-labels (HP, DECK, SEED) are uppercase, `--text-sm`,
  `--weight-medium`, `--tracking-label`, `--color-text-muted`.
- Numbers use `font-variant-numeric: tabular-nums` wherever they update in
  place (HP, deck count) so digits don't jiggle.
- Body copy max measure ~65ch on sheets and About text.

Pairing logic: Cinzel carries fantasy at zero cost to HUD clarity; Inter
disappears — exactly what a card-game HUD needs. Both ship as variable single
files (~30–40KB woff2 each, subset by fontsource), self-hosted, offline-safe.

---

## 5. Card presentation

### 5.1 Frame and art

Every card is:

```css
.card-frame {
  aspect-ratio: var(--card-ratio);
  width: var(--card-width-room);        /* size tier per zone, §3.7 */
  border-radius: var(--card-radius);     /* 5.5% of width — poker feel */
  overflow: hidden;                      /* art bleeds to the rounded edge */
  background: var(--color-parchment);    /* under art while it loads */
  outline: 1px solid var(--color-parchment-edge); /* burned-edge hairline */
  box-shadow: var(--shadow-card);
  position: relative;                    /* badge + vignette anchor here */
}
.card-art {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;                     /* JPGs are already 5:7; cover is a guard */
}
```

`outline` (not `border`) for the edge hairline so it never shifts the art.
No borders, padding, gaps, or chrome anywhere else on the card.

### 5.2 The value badge — top-left, hugging the corner index

Placement decision: **the badge overlays the top-left corner, hugging the
art's engraved corner index.** The art's serif `A♠`-style index survives by
design — the gap between index and chip is handled by the fade scrim (below),
which softens the parchment behind the chip and visually "withdraws" the
inked index rather than colliding with it. Chosen over a bottom strip because
a strip steals vertical art, crowds short cards, and reads as UI bolted onto
the artifact; a corner chip reads as a wax seal on the parchment.

Three layers, top to bottom:

1. **Chip** — anchor at `left/top: var(--badge-offset-x/y)` (4% of card
   width). Background `--badge-bg`, text `--badge-text`, hairline
   `--badge-border`, radius `--badge-radius`, min-width `--badge-min-width`
   (grows for "10"), vertical padding `--badge-pad-block`. Content: rank
   character, with the suit glyph directly beneath or beside it; glyph tinted
   by suit token only at room sizes, monochrome `--badge-text` at thumbnails.
2. **Vignette scrim** — a radial-gradient layer under the chip, centered on
   the top-left corner, fading `--color-vignette` → transparent over ~55% of
   card width. It hides corner-index collision and keeps the chip legible over
   the busiest hatching. No blur on this layer.
3. **Chip backdrop-filter** — `backdrop-filter: blur(var(--badge-blur))` on
   the chip itself.

The catch: `backdrop-filter` breaks (`filter: none` in every engine) when any
ancestor has a `filter` — and our disabled-card treatment (`filter:
grayscale()`) is exactly such an ancestor. So: **do not let the chip inherit
the disabled filter.** Keep the art and the badge side-by-side inside the
frame (`<img class=card-art>` + `<span class=card-badge>`), apply grayscale
to `.card-art` only, and dim the chip with opacity for the disabled look.
This is why the tokens prescribe a **fixed** chip pair
(`--color-badge-bg/text`) rather than parchment-relative blends: the chip is
always floating over light art, so constant colors plus the scrim stay
legible everywhere without filter tricks. If a future design must filter the
whole frame, drop `backdrop-filter` from the chip in that subtree — the solid
`rgba(24,20,15,.88)` fill + scrim carries legibility alone.

Contrast, computed on the chip's worst case (fill at 88% alpha over the
art's mid parchment ~`#b3a184`): effective chip bg ≈ `#312a21`; badge text
`#f2ead9` on it ≈ **11.4:1**. Over the art's darkest hatching it only gets
better. Rank legibility at 60px is therefore the chip's, never the art's.

Type inside the chip: `--font-number`, semibold, tabular. Sizes scale with
the card tier: `--text-xs` at `--card-width-thumb`, `--text-sm` at hand size,
`--text-md` at room size. The chip never exceeds ~26% of card width.

### 5.3 Interaction states

State is light, lift, and ring — never border thickness changes (they shift
layout) and never art filters.

| State | Recipe |
| --- | --- |
| Rest | `--shadow-card` |
| Hover (pointer, selectable) | `transform: translateY(calc(var(--space-2) * -1))`, `--shadow-card-hover`, `--ring-hover`, `--duration-fast` `--ease-out`. Cursor `pointer`. |
| Selected | `--ring-selected` + `--shadow-card-selected`; lift persists. Pop in with `--ease-spring` `--duration-med`. Exactly one card selected at a time. |
| Confirm armed (damage preview showing) | Selected recipe, ring swaps to `--ring-confirm`; the damage number floats above the card in `--color-crimson-on-abyss`. Second click/Enter commits. |
| Keyboard focus | Art-side **inset ring**: `.card:focus-visible { outline: none; } .card:focus-visible::after { content:""; position:absolute; inset:0; border-radius:inherit; box-shadow: inset 0 0 0 2px var(--color-abyss), inset 0 0 0 4px var(--color-focus-ring); }` — readable over parchment without squaring corners. Combine with selection rings when both apply. |
| Carried card (unresolved 4th from last room) | Art is **not** tinted. Marker = bottom-edge ribbon: a `--space-2`-tall strip of `--color-surface-3` with 2px `--color-ember-deep` top edge and the label "CARRIED" in `--text-xs` ember, plus a small ember dot pinned to the badge's bottom-right corner. Ribbon sits inside the frame, above the art — same kept corners. |
| Resolved / spent this room | Art dims via an overlay `background: var(--color-scrim)` layer at 55% alpha over the art only; badge dims to 60% opacity. Not selectable; no hover lift. |
| Disabled (Run button & chrome, not cards) | `--color-surface-2` fill, `--color-disabled-text` text, hairline `--color-hairline`, no glow, no hover. Still focusable via `aria-disabled` so the reason ("Can't run twice in a row" / "Dungeon too small to run") is discoverable on focus/tooltip. Greyed ≠ invisible. |

Damage/heal numbers that float off cards on resolution: `--font-number`,
bold, `--text-lg`, crimson for damage, `--color-success`-free — heals use
ember-bright (crimson is damage/danger only; green is reserved for the win
screen). Float up `--space-6`, fade, `--duration-slow`, `--ease-out`.

### 5.4 Card sizes

- Room row: `--card-width-room`. Gap between the 4 room cards: `--space-4`.
- Weapon + kill stack: weapon at `--card-width-room`; kill stack at
  `--card-width-hand`, overlapping fanned right by ~35% of their width,
  last-killed on top (z-order ascending in kill order).
- Anywhere smaller than `--card-width-thumb` (60px): do not render the art —
  render the chip alone as a suit-tinted tile (surface-3 + suit-tinted glyph +
  rank). Art below 60px is mush and insults the engraving.

---

## 6. Screen directions (Phase 1)

Wireframes in words. Commit to density: this is a card table, not a marketing
page — keep everything for one decision visible without scrolling at
1280×800 and at 360px mobile width (zones stack vertically there).

### 6.1 Title screen (`#/`)

Vertical composition over the dungeon shell:

1. **Backdrop** — a deck-art composite, not a screenshot collage: 5–7 card
   arts (dragon, pendant, crossbow, one heart, one diamond) laid as a loose
   fan, rotated ±4–8°, emerging from the bottom third and partially off-canvas
   at the edges. Each at `--card-width-room` × ~1.3, `--shadow-2`, opacity
   0.5. Over the whole scene: `linear-gradient(transparent 30%, var(--color-abyss)
   85%)` so cards sink into darkness toward the top. A faint
   `--glow-torch` radial sits behind the wordmark — the only light source,
   positioned as if the cards are lit by a torch below frame. Blur nothing.
2. **Wordmark** — "SCOUNDREL", Cinzel 800, `--text-hero`,
   `--tracking-hero`, `--color-text`, with a one-pixel-feeling ember text
   glow (`text-shadow: 0 0 24px var(--color-ember-glow)`). Centered in the
   upper third. Under it, a hairline ember rule 48px wide, then the subtitle
   "a dungeon solitaire" in Inter, `--text-sm`, `--tracking-label`,
   uppercase, `--color-text-muted`.
3. **Menu** — a single centered column, `--space-2` gaps, each item 40px+
   tall, min-width 240px, Inter `--text-lg`: **Continue** (only if a save
   exists; ember text + `--glow-torch` halo behind it, listed first),
   **New Run**, **Enter Seed**, **Stats**, **Settings**, **About**. Items are
   text rows, not boxed buttons: hover reveals the torch halo +
   `translateX(var(--space-2))` and a left ember tick (2px bar,
   `--space-3` tall). Focus-visible mirrors hover. Enter activates;
   arrow-keys move through the list.
4. **Footer** — bottom center, `--color-text-faint`, `--text-xs`: version,
   rules credit link. Nothing else.

Load motion: backdrop scales 1.04→1 (`--duration-slow` × 3, `--ease-out`),
wordmark fades up, menu items stagger in at 60ms intervals, bottom to top —
as if dealt. All suppressed under reduced motion.

### 6.2 Play screen (`#/play`)

Three horizontal bands; the shell shows through the seams. Max content width
1200px, padding `--space-5` (mobile `--space-3`).

**Top — HUD bar** (sticky, `--z-actions`, `background: var(--color-abyss)`
at 92% + bottom `--color-hairline-strong` rule):

- Left: **HP cluster** — Inter tabular digits `--text-lg`
  `--color-crimson-on-abyss` ("17 / 20") beside a segmented heart meter: 20
  pips is noise, so use a 10-segment bar (each = 2 HP), filled segments
  crimson gradient toward `--color-crimson-deep`; damage ticks animate the
  digits (`--duration-med`). Label "HP" as micro-label above.
- Center: **Room progress** — "Room 7" in Cinzel `--text-lg`, and under it a
  thin track showing rooms explored vs. total (ember fill on surface-3).
- Right: **Deck pip + seed** — deck count as a verdigris chip (verdigris
  text on `--color-surface-2`, `--color-verdigris-dim` border, mini
  card-back glyph, count in tabular Inter); beside it "SEED
  `a3f9k2`" in `--color-text-faint` `--text-sm` monospace-leaning
  (`letter-spacing: 0.06em`), click-to-copy with a brief ember tick feedback.
  Run-state text ("Room — choose", "Confirm 8 damage?") appears in the
  actions bar instead, not the HUD.

**Middle — the table** (the generous band; min-height to fit room cards at
max tier):

- **Room row**, centered horizontally: 4 cards at `--card-width-room`,
  `--space-4` gaps, dealt left-to-right. This row owns the player's eye;
  nothing else in the band glows at rest. Empty slot (card already resolved)
  shows a surface-1 ghost with hairline `--color-hairline` dashed stroke and
  centered suit-tinted glyph at 30% opacity — same radius.
- Below-right of the row, separated by `--space-6`: **weapon zone**. A
  surface-1 well with `--color-hairline` border, `--radius-lg`, labeled
  "WEAPON" (micro-label). Inside: equipped weapon card at room size, kill
  stack fanned right at hand size; each kill-stack card carries its rank chip
  only when hovered/focused (keeps the fan quiet) — the top card's chip is
  always visible since it's the active threshold. Empty well shows a
  surface-2 ghost outline with a diamond glyph and hint "equip a ◆".
- Directly above the room row, when a monster is selected: the **preview
  line** — one sentence of Inter `--text-body`: e.g. "♠ K (13) vs ◆ 9 → take
  4" with the damage figure in `--color-crimson-on-abyss` bold, or "♥ 7 →
  heal 7 (capped at 20)" in ember-bright. This line is the confirm contract;
  it appears on first selection and the confirm ring arms.

**Bottom — actions bar** (`--z-actions`, surface-1 + top hairline rule):

- Left: context text — the run-state string, `--color-text-muted`,
  `--text-sm`.
- Right: buttons, `--space-3` gaps, 40px tall, `--radius-md`, Inter
  `--text-body` medium: **Confirm** (appears only while a selection is armed;
  ember fill `--color-ember-deep`→`--color-ember` gradient,
  `--color-text-inverse`, `--glow-ember` on hover), **Cancel** (ghost:
  hairline border, text-muted), **Undo Room** (ghost, with ↺), **Run Away**
  (crimson-outline ghost; disabled per §5.3 when
  `dungeon.length < 4` or already ran this room — tooltip/focus announces
  the reason). Destructive-adjacent never means hidden: Run Away stays
  visible and greys.
- Keyboard: `←→` moves across resolvable cards, `Enter` select→confirm,
  `Esc` cancel, `U` undo, `R` run. Focus-visible ring on everything.

Spacing rhythm: HUD `--space-5` under it to the table; room row sits in the
vertical middle of the band; `--space-6` between room row and weapon zone;
actions bar is `--space-4` tall-padding top/bottom. On small screens the
weapon zone slides under the room row full-width and the kill stack stays a
single-scroll row.

---

## 7. Accessibility

Contrast targets: **AA everywhere; AAA for body text.** Estimated pairs
(WCAG 2.x, computed):

| Foreground / background | Ratio | Verdict |
| --- | --- | --- |
| `--color-text` #e9e4d8 on `--color-abyss` #0d0f13 | ≈ 16.3:1 | AAA |
| `--color-text` on `--color-surface-2` #1c2129 | ≈ 14.1:1 | AAA |
| `--color-text-muted` #a9a294 on `--color-surface-2` | ≈ 7.6:1 | AAA |
| `--color-text-faint` #6f6a5f on `--color-abyss` | ≈ 4.7:1 | AA — floor; never go fainter |
| `--color-ember-bright` #f6be67 on `--color-abyss` | ≈ 9.9:1 | AAA |
| `--color-crimson-on-abyss` #e86a5f on `--color-abyss` | ≈ 6.4:1 | AA+ — HP and damage numbers |
| `--color-verdigris` #6fa08e on `--color-surface-2` | ≈ 5.0:1 | AA |
| `--color-text-inverse` #17130e on `--color-ember` #e2a04c | ≈ 9.4:1 | AAA (Confirm button) |
| `--color-badge-text` on worn chip (§5.2) | ≈ 11.4:1 | AAA |
| `--color-text-on-parchment` #241d14 on `--color-parchment` | ≈ 9.8:1 | AAA |

Rules:

- Never place ember text on parchment or parchment text on ember — the
  inverse pairings above are the only sanctioned accent-text pairs.
- Icons/glyphs with meaning (suit pips, deck glyph) meet 3:1 minimum against
  their surface; decorative glows are exempt.
- Every state reachable by pointer is reachable by keyboard. Focus order on
  the play screen: HUD (seed copy) → room cards left-to-right → weapon zone →
  actions bar (Confirm → Cancel → Undo → Run). Skip-link from HUD to the room
  row.
- Focus ring: chrome uses the global 2px `--color-focus-ring` outline on
  2px offset (≈10:1 vs abyss); cards use the inset ring in §5.3. Never
  remove `:focus-visible` styles; restyle only by strengthening.
- Live regions: result payloads (damage taken, healed, run blocked) announce
  via a polite live region; win/lose asserts. The preview line is
  `aria-live="polite"` so the confirm contract is spoken.
- Reduced motion: tokens zero all durations under
  `prefers-reduced-motion` and `base.css` kills lingering animations
  (`animation-duration: 0.01ms`). State changes snap; nothing depends on
  motion to be understood (selection has a persistent ring, not a pulse).
- Hit targets: ≥40px on chrome (§3.7); cards are large by nature.
  Drag-only interactions are banned; everything is click/tap + keyboard.

---

## 8. Do / Don't

**Do**

- Do build everything from tokens; request new ones instead of hardcoding.
- Do keep cards at `--card-radius`, art full-bleed, both corners kept.
- Do let the badge + vignette own rank legibility; let the engraved index be
  art.
- Do ration ember: if everything glows, nothing does. Interactive = ember,
  damage = crimson, deck duration = verdigris. That's the whole accent
  vocabulary.
- Do keep the shell quiet — slab texture should be discovered, not noticed.
- Do use Cinzel only large; Inter carries the game's voice.
- Do test every new screen at 60px card floor and at 360px viewport width.

**Don't**

- **No pixel or retro anything.** No pixel/bitmap fonts, no dithering, no
  CRT/scanline/NTSC effects, no 8-bit references, no chunky "retro" borders.
  The forbidden list is literal, not a vibe.
- Don't square card corners, border the art, add frames/mats inside the
  card, or carve bottom strips into it (badge decision is settled, §5.2).
- Don't put borders or outlines on cards for state — rings are box-shadows.
- Don't tint, hue-rotate, or filter card art (grayscale on `.card-art` for
  disabled is the single sanctioned exception).
- Don't use pure black (`#000`) anywhere — `--color-abyss` is the floor;
  hairlines use their tokens, not black.
- Don't introduce new accent hues (no blues as links/actions, no greens
  outside the win screen).
- Don't put text over card art except the badge system.
- Don't animate layout properties (width/height/top) — transform and opacity
  only, with the declared easings.
- Don't render card art below 60px — fall back to chip tiles (§5.4).
