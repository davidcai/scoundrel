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
 ┌──────────────┐  5:7 ratio, --card-w (96px default)
 │▓▓▓▓ crown ▓▓│  6px suit-meaning strip (club/spade/diamond/heart)
 │ A♠        ♠ │
 │    pips     │  2-stepped columns, lower column rotated 180° (physical-deck flip)
 │    /court   │  J/Q/K/A → big glyph + monogram letter
 │ ♠        ♠A │  corner chips: rank + mini glyph, bottom-right rotated
 └──────────────┘  frame: ink border, chamfered corners, hard cast shadow
```

- Parchment face + ink frame, always. Suit color appears in pips, corners, crown.
- Face-down: raised dark hatch + stepped-dagger glyph.
- Interactive states: hover/focus lifts −6px; `selected` lifts + focus-yellow ring; `disabled` desaturates, no lift. Tap target ≥ 44px is handled by card width ≥ 92px in play contexts.

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
