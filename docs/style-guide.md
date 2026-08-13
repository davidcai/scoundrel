# Scoundrel — Pixel-Roguelike Style Guide

One page of decisions. Tokens live in `src/ui/styles/tokens.css`; keep them in sync.

## Palette

| Token                                                                                  | Hex                               | Use                                                                                                        |
| -------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `--void`                                                                               | `#07060c`                         | True-black accents, deepest shadow                                                                         |
| `--bg`                                                                                 | `#100d1a`                         | Page background                                                                                            |
| `--bg-raised`                                                                          | `#1a1626`                         | Panels, cards-back                                                                                         |
| `--bg-inset`                                                                           | `#0b0913`                         | Panel headers, wells, tooltip fill                                                                         |
| `--line` / `--line-mid` / `--line-light`                                               | `#05040a` / `#332b47` / `#57506e` | Frame steps (dark → light)                                                                                 |
| `--steel`                                                                              | `#98a0b8`                         | Icons, strokes, non-text decoration                                                                        |
| `--text` / `--text-dim`                                                                | `#d7dbea` / `#b3b9ce`             | Contrast-checked body text on darks                                                                        |
| `--parchment` / `--ink`                                                                | `#e7dbc0` / `#221b2a`             | Card faces / text & pips on cards                                                                          |
| `--flame` / `--ember` / `--ember-deep`                                                 | `#ffc14d` / `#d7642b` / `#8f3a1a` | Torch accents, primary action, ember shading                                                               |
| `--club` `#4e8a3d` · `--spade` `#5d4eb4` · `--diamond` `#b0812a` · `--heart` `#cd4157` |                                   | **Suit language**: vermin green / spectral violet = monsters · forged bronze = weapon · blood red = potion |
| `--focus` `#ffd23e` · `--danger` `#d24557`                                             |                                   | Focus rings, errors/harm                                                                                   |

Dungeon darks dominate; torch amber is the single accent; steel and parchment support.

## Type

- **Display**: _Press Start 2P_ (bundled via `@fontsource`). Screen titles `26–52px (clamped)`, section titles 14–18px, labels/buttons 12px, always `letter-spacing` ≥ 1px, uppercase where it matters.
- **Body**: _VT323_ (bundled) at `20px` default / 24px large — never below 17px; below that it collapses.
- Never set paragraphs in Press Start.

## Spacing

4px grid: `--space-1…16` = 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px. No off-scale values.

## Border & bevel recipe

3px stepped bevels, **no blur, no soft shadows, no border-radius**:

```css
/* raised (panels, buttons) */ /* sunken (wells, tooltip bg, stacks) */
border: 3px solid var(--line-mid);
border: 3px solid var(--line);
box-shadow:
  inset 3px 3px 0 0 var(--bevel-light),
  inset -3px -3px 0 0 var(--bevel-dark);
box-shadow:
  inset 3px 3px 0 0 var(--bevel-dark),
  inset -3px -3px 0 0 var(--bevel-light);
```

- Cast shadows are **hard offsets only**: `6px 6px 0 0 var(--shadow)`.
- Pixel corner chamfer via `clip-path` polygon with 4px diagonal cuts (see `.card`).
- Classes `.bevel-raised` / `.bevel-sunken` in `components.css`. Recipe is the contract.

## Card anatomy (`.card`)

```
 ╔══════════════╗  5:7 ratio, --card-w (128px default; ALL interior type
 ║▓▓▓ crown ▓▓▓║  scales off --card-w via calc — cards stay proportioned)
 ║┌──┐        ┌─┐│  crown: 6px suit strip; corner chips: solid parchment pad,
 ║│A♠│  pips  └─┘│  ink frame, hard suit-colored undercut
 ║└──┘ 2-col    ││  pips: 2-stepped columns, lower column rotated 180°
 ║       /court ││  field insets: 30%/20% of width top/bottom — pip rows BEGIN
 ║  ┌─┐        ││  and END clear of the corner chips (no stray-pip confusion)
 ║  └─┘       S│A│  court: big glyph + ink monogram with suit keyline
 ╚══════════════╝  frame: ink border, chamfered corners, hard cast shadow
```

- Parchment face + ink frame, always. Face is **flat** — no stripes, no texture (artwork never gets segmented).
- **In-card suit shades are darker than scene accents** (contrast ≥4.5:1 on parchment): club `#2e5620`, spade `#42378f`, diamond `#7a5514`, heart `#a1203a`. The bright scene shades (`--club` etc.) are for dark-backdrop use only (HUD hearts, inline glyphs, About rules list).
- Rank chips: ink rank char (13% of card width — ≥15px on room cards) with a 2px suit-colored hard drop keyline; suit glyph below in the dark in-card shade.
- Play-screen sizes: room `clamp(112px, 30vw, 148px)` (short windows ≤860px tall drop to 118px so the full table fits; weapon/kill scale 88→78px); About legend 96px; weapon zone 88px.
- Face-down: raised dark hatch + stepped-dagger glyph.
- Interactive states: hover/focus lifts −6px; `selected` lifts + focus-yellow ring; `disabled` desaturates, no lift.

## Motion

One rule: **stepped, not eased.** Durations 80–160ms, timing `steps(n, end)`.

- Card/button lift & press: `steps(2,end)` transforms; press collapses the cast shadow, not just translates.
- Torch flicker & glow (key art): `steps(1,end)` opacity/scale keyframes, ~1–1.6s loops.
- Everything honors `prefers-reduced-motion` (global kill switch in `base.css`, plus inside the key-art SVG).

## Do / Don't

**Do** — hard shadows; pixel `clip-path` chamfers; parchment cards on dark dungeon backdrops; amber as the single warm accent; VT323 for all prose; `image-rendering: pixelated` + `shape-rendering: crispEdges` on raster/SVG art.

**Don't** — gradients on text; blurred shadows or glows on UI chrome (glow only inside key art); border-radius; system fonts; Press Start for body copy; easing curves; emoji glyphs for suits (use `<SuitGlyph>`).

## Component contracts

- `<Card cardId>` — parses `${Rank}${Suit}`; face-down, selected, disabled, onClick (renders real `<button>`) variants. SR label: “8 of Clubs, monster, value 8”.
- `<PixelButton variant="steel|ember|ghost">` — steel = default, ember = primary, ghost = quiet chrome.
- `<Panel title? shadowed?>` — beveled frame with optional header strip.
- `<Tooltip content placement?>{(props) => <button {...props}/>}</Tooltip>` — render-prop so `aria-describedby` lands on the real trigger; hover, focus, Escape, and ≥450ms tap-and-hold. Focus never leaves the trigger.
- `<SuitGlyph suit>` — 8×8 bitmap pips; sized by `font-size`, colored by CSS classes.
- Key art: `src/assets/title-backdrop.svg` (dungeon doorway, torches, stairs; self-contained flicker).
