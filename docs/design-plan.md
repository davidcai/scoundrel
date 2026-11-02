# Scoundrel design plan

The [PRD](prd.md) owns product goals, requirements, scope, and acceptance outcomes, as defined by [INFO-002](prd.md#info-002). This plan records presentation choices and the design handoff sequence. Requirement changes belong in the PRD; default gameplay changes belong in the [game rules](rules.md).

## Design approval status

**Approved by the user on 2026-11-01 as drafted.** Scope: this written style guide, including the recorded D1–D4 values, typography, color tokens, spacing, component states, and the title/play/result compositions. The approval followed a 2026-11-01 direction review of a throw-away style demo that is not part of this repository. Independent contrast and accessibility checks (task-14 with its targeted task-16 re-check on the earlier revision; task-18 and task-20 on the warm-direction revision) found no blockers or majors, and every claimed contrast ratio recomputes exactly. See [Approved style guide](#proposed-style-guide-draft). Approval of this guide does not authorize implementation or deployment; those remain separate decisions.

The written style guide was approved on 2026-11-01 with the scope recorded above, satisfying the design gate required before the phase 3 design review. Any later change to the guide, its tokens, or its D1–D4 values requires a new approval recorded in this section and in §10; do not reintroduce the removed design references. The 2026-11-01 direction approval covers the look demonstrated in the throw-away demo and is subsumed by this written-guide approval.

## Visual treatment

Supports [DEC-001](prd.md#dec-001) and [REQ-016](prd.md#req-016).

Use crisp typography, depth, shadow, and high contrast to give the interface a mysterious, adventurous atmosphere. Keep labels and controls distinct from decorative artwork so the dark theme remains readable.

## Card artwork

Supports [DEC-001](prd.md#dec-001).

Use the 44 PNG card illustrations in [assets/](../assets/) and preserve their suit-and-rank filenames. The JPEG images in [assets-old/](../assets-old/) are archived references only: do not load, bundle, copy, or use them as fallback artwork in the product.

## Card table and feedback

Supports [REQ-003](prd.md#req-003), [REQ-004](prd.md#req-004), [REQ-005](prd.md#req-005), and [REQ-006](prd.md#req-006).

- Place the weapon card on the left and its defeated-monster stack on the right. Render defeated monsters as physical cards, with the most recently defeated monster on top.
- Mark the carried card in its caption line (for example, a "Carried" entry) so players can recognize it after the next deal.
- Use a selection highlight and a nearby action preview before confirmation. Present weapon and barehanded choices together when both are available.
- Give weapon swaps visible discard feedback. Distinguish healing feedback from a consumed potion that restores no health.

## Contextual learning

Supports [REQ-007](prd.md#req-007), [REQ-015](prd.md#req-015), and [REQ-017](prd.md#req-017).

Use contextual tooltips for card meanings, the weapon's degradation chain, and run-away restrictions. Put explanations beside the relevant card or action. Make the same explanations available on focus and touch rather than relying on hover alone.

<a id="proposed-style-guide-draft"></a>

## Approved style guide (2026-11-01)

**Status: approved by the user on 2026-11-01 as drafted.** Scope: the written style guide as recorded in this section, including D1–D4. Independent checks: `qa-verifier` re-ran contrast and accessibility checks (task-14 and targeted task-16 on the earlier revision; task-18 and task-20 on the warm-direction revision) with no blockers or majors, and the Lead applied the final minor wording clarifications afterwards. The guide records the title, play, and result presentation plus the small-screen and keyboard coverage called for by the phase 1 acceptance check. It adds no dependency, source file, or executable test, and it does not authorize implementation.

**How to use this guide:** §1 records the direction, §2–§9 are build-ready detail, and §10 records the approved D1–D4 values. Implementation uses this guide as the presentation source of truth. Any change to the guide or to a recorded D1–D4 value requires a new recorded approval in [Design approval status](#design-approval-status); no implementation starts from this guide's approval alone.

### 1. Direction and principles

The interface is a dark dungeon table that makes the light watercolor card art the brightest thing on screen: near-black warm-umber surfaces lit by a static torchlight wash, warm parchment text, an antique-brass accent, and depth from shadow and hairline borders rather than ornament. It supports [DEC-001](prd.md#dec-001) and [REQ-016](prd.md#req-016).

- **The art is the hero.** The current 44 PNGs are the only card artwork ([Card artwork](#card-artwork)); the UI supplies the dark mat, frame, and shadow around each light illustration. This draft introduces no new card art, card backs, or decorative raster assets.
- **Warm torchlight, not flat black.** A static, low-opacity antique-brass glow sits over the near-black ground (10% at most, §3); it is decorative, and any text placed on the page background is measured against the wash's worst case, not just the unwashed token (§3). The dungeon card backs are CSS-only warm surfaces (§6).
- **Readable first.** Text and controls never sit directly on card art; controls keep a solid surface and the contrast in §3. Labels and controls stay visually distinct from illustration detail, per [Visual treatment](#visual-treatment).
- **Every state has a non-color signal.** Eligible/ineligible, selected/carried, healed/wasted, and health/damage pair color with an icon, a label, and screen-reader text. Color is never the only carrier ([REQ-017](prd.md#req-017)).
- **Motion is never essential.** Every animated cue has a static equivalent, and reduced-motion mode removes non-essential motion (§7).
- **Touch and keyboard are equal inputs.** Targets, focus order, and help work without hover ([REQ-016](prd.md#req-016), [REQ-017](prd.md#req-017)).
- **Dependency-free.** Tokens are CSS custom properties and the font stacks use installed fonts only; self-hosting a display face remains a later decision (D2).

### 2. Typography

Three stacks, no webfont files required by this draft:

| Token | Stack |
| --- | --- |
| `--font-display` | `"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Noto Serif SC", "Source Han Serif SC", "Songti SC", SimSun, serif` |
| `--font-ui` | `"Inter", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif` |
| `--font-mono` | `"JetBrains Mono", "Cascadia Code", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` |

- Display serif is for the wordmark, screen titles, room and section headings, dialog titles, and the result headline. UI sans covers body copy, data, labels, and buttons; mono is for the seed, the replay link, and tabular figures. Headings use normal case: no all-caps and no uppercase letter-spacing.
- **Simplified Chinese:** the CJK fallbacks sit after the Latin faces in each stack, so Latin glyphs use the Latin face and Chinese glyphs fall through to a native CJK face. Set the document `lang` attribute to the active language (`en` or `zh-Hans`) and update it when the language changes; never hard-code `zh-Hans` while English is active. Chinese body text uses `--font-ui`. For Chinese screen headings, use the display serif only when one of its named CJK serif faces (`Noto Serif SC`, `Source Han Serif SC`, `Songti SC`, `SimSun`) is actually available (verify with `document.fonts.check('1rem "Noto Serif SC"')` or the equivalent for the other families); otherwise the heading uses `--font-ui`. No synthetic italic or bold.
- No italics for Chinese, no synthetic bold, no letter-spacing or uppercase transform on Chinese. Arabic numerals stay Latin in both languages.

Scale (1rem = 16px):

| Token | rem / px | Weight | Line height | Use |
| --- | --- | --- | --- | --- |
| `--text-display` | 2.75rem / 44px (clamp 2.25–2.75rem) | 700 | 1.05 | Wordmark, title screen |
| `--text-h1` | 2rem / 32px | 700 | 1.15 | Screen titles, result headline |
| `--text-h2` | 1.5rem / 24px | 600 | 1.25 | Section and dialog titles |
| `--text-h3` | 1.125rem / 18px | 600 | 1.3 | Card-group headings, room label |
| `--text-body` | 1rem / 16px | 400 | 1.6 EN / 1.75 zh | Body copy, help, dialog text |
| `--text-body-strong` | 1rem / 16px | 600 | 1.6 EN / 1.75 zh | Emphasized body, card action labels |
| `--text-small` | 0.875rem / 14px | 400 | 1.5 EN / 1.7 zh | Secondary copy, essential captions |
| `--text-label` | 0.875rem / 14px | 600 | 1.3 | Buttons, fields, table headers |
| `--text-card-value` | 1.25rem / 20px | 700 | 1.2; tabular numerals | Header health value; card values stay in caption text, never a chip or over card art |
| `--text-card-meta` | 0.875rem / 14px | 500 | 1.4 | Suit/rank metadata in lists |
| `--text-score` | 2.5rem / 40px | 700 | 1.1; tabular numerals | Result score, final health |
| `--text-caption` | 0.75rem / 12px | 400 | 1.4 | Non-essential metadata only; zh uses 0.875rem |

Rules: body text never below 1rem; Chinese never below 0.875rem; 0.75rem is allowed only for non-essential Latin metadata and never carries state. Normal case everywhere: no uppercase transforms and no uppercase letter-spacing in either language. Line length targets 45–75 characters (EN) or 25–40 characters per line (zh). Use `text-wrap: balance` for headings and `text-wrap: pretty` for body where supported. The printed rank and suit in the artwork's top-left corner are illustration, not UI text; do not overlay typography there (§4).

### 3. Color tokens and contrast evidence

Dark dungeon-crawler identity ([DEC-001](prd.md#dec-001)): warm near-black ground under a static antique-brass torchlight wash, parchment text, and an antique-brass accent.

| Token | Hex | Role |
| --- | --- | --- |
| `--bg-0` | `#0A0805` | App backdrop under the torchlight wash, theater surround, result screen ground, card mat at rest |
| `--bg-1` | `#110E09` | Action bar, framed sub-surfaces, pressed page edges |
| `--surface-1` | `#1A150E` | Panels, header, dialogs, table body, preview |
| `--surface-2` | `#241D13` | Raised surfaces, banners, secondary buttons, hover, table header, CSS card backs |
| `--surface-3` | `#2E2619` | Pressed and selected surfaces, selected-card mat |
| `--border-1` | `#3E3526` | Decorative dividers and the quieter ineligible-card frame; never the sole boundary of an interactive control |
| `--border-2` | `#7A6A50` | Essential borders: inputs, panels, button outline, card frame, action-bar top |
| `--text-1` | `#F2EAD8` | Primary text, feedback messages, table body |
| `--text-2` | `#D8CCB4` | Secondary text, labels, captions, card metadata |
| `--text-muted` | `#A99C84` | Tertiary metadata, placeholder, helper text, seed text |
| `--text-disabled` | `#978D78` | Disabled labels (still readable; see §5) |
| `--gold` | `#C9A15A` | Accent: primary buttons, carried/weapon card captions, accent text; never a border at the artwork edge |
| `--gold-bright` | `#E3BE7C` | Hover/pressed accent, selection ring, dungeon-count chip fill |
| `--gold-ink` | `#1A1204` | Text and icons on accent fills |
| `--focus` | `#E9DCC0` | Focus ring, independent of the accent choice |
| `--selection` | `#E3BE7C` | Selection ring and selected-card caption (same value as `--gold-bright`) |
| `--health` | `#7DBE88` | Health fill, positive health numbers |
| `--health-track` | `#2B2318` | Health-bar track (framed by `--border-2`) |
| `--damage` | `#D4816B` | Damage numbers, destructive actions, broken caption |
| `--weapon-ok` | `#A9B57E` | "Weapon usable" plain status text, weapon-eligible cues |
| `--weapon-no` | `#9A8F78` | "Not usable" caption, weapon-ineligible cue |
| `--heal` | `#8FBF8F` | Potion-healed feedback |
| `--wasted` | `#D9A45B` | Potion-wasted feedback |
| `--scrim` | `rgb(8 5 3 / 72%)` | Dialog backdrop |
| `--art-paper` | `#F7F4EC` | Reference only: sampled paper tone of the PNGs; never painted behind text |

Ratios below use the WCAG 2.2 relative-luminance formula computed from the hex values above (not sampled from images). Page-background pairs are measured against the worst case of the static torchlight wash — a 10% `--gold` overlay over `--bg-0` (composite `#1D170E`) — so they remain valid wherever the wash appears; the wash itself is decorative. The tables list every essential text and UI-boundary pair the UI uses, plus a deliberate non-use table; decorative-only hairlines, shadows, and art-overlay composites are excluded and marked decorative. Card state is carried by caption text, not by chips or badges, and the assignment table names the exact foreground and background tokens for every visible caption, label, and status line. `--border-1` is decorative except as the quieter ineligible-card frame, where the caption carries the state; `--scrim` and shadows are non-text overlays and carry no contrast requirement.

**Normal text — threshold 4.5:1**

| Pair | Ratio | Result |
| --- | --- | --- |
| `--text-1` on `--bg-1` | 16.08:1 | pass |
| `--text-1` on `--surface-1` | 15.15:1 | pass |
| `--text-1` on `--surface-2` | 13.92:1 | pass |
| `--text-1` on `--surface-3` | 12.46:1 | pass |
| `--text-2` on `--bg-1` | 12.12:1 | pass |
| `--text-2` on `--surface-1` | 11.42:1 | pass |
| `--text-2` on `--surface-2` | 10.49:1 | pass |
| `--text-2` on `--surface-3` | 9.39:1 | pass |
| `--text-muted` on `--bg-1` | 7.13:1 | pass |
| `--text-muted` on `--surface-1` | 6.72:1 | pass |
| `--text-muted` on `--surface-2` | 6.17:1 | pass |
| `--text-muted` on `--surface-3` | 5.52:1 | pass |
| `--text-disabled` on `--surface-1` | 5.53:1 | pass |
| `--text-disabled` on `--surface-2` | 5.08:1 | pass (WCAG exempts disabled text; this stays readable on purpose) |
| `--gold` on `--bg-1` | 8.00:1 | pass |
| `--gold` on `--surface-1` | 7.54:1 | pass |
| `--gold` on `--surface-2` | 6.93:1 | pass |
| `--gold-bright` on `--bg-1` | 10.93:1 | pass |
| `--gold-bright` on `--surface-1` | 10.30:1 | pass |
| `--gold-bright` on `--surface-2` | 9.46:1 | pass |
| `--gold-ink` on `--gold` (primary button) | 7.71:1 | pass |
| `--gold-ink` on `--gold-bright` (hover/pressed) | 10.53:1 | pass |
| `--heal` on `--surface-2` | 7.95:1 | pass |
| `--damage` on `--surface-1` | 6.18:1 | pass |
| `--damage` on `--surface-2` | 5.68:1 | pass |
| `--damage` on `--surface-3` | 5.08:1 | pass |
| `--wasted` on `--surface-1` | 8.13:1 | pass |
| `--wasted` on `--surface-2` | 7.47:1 | pass |
| `--weapon-ok` on `--surface-1` | 8.29:1 | pass |
| `--weapon-ok` on `--surface-2` | 7.62:1 | pass |
| `--weapon-no` on `--surface-1` | 5.68:1 | pass |
| `--weapon-no` on `--surface-2` | 5.22:1 | pass |
| `--weapon-no` on `--surface-3` | 4.67:1 | pass |
| `--text-1` on `--bg-0` over the 10% torchlight wash | 14.85:1 | pass |
| `--text-2` on `--bg-0` over the 10% torchlight wash | 11.19:1 | pass |
| `--text-muted` on `--bg-0` over the 10% torchlight wash | 6.58:1 | pass |
| `--gold` on `--bg-0` over the 10% torchlight wash | 7.39:1 | pass |
| `--gold-bright` on `--bg-0` over the 10% torchlight wash | 10.09:1 | pass |
| `--selection` on `--bg-0` over the 10% torchlight wash | 10.09:1 | pass |
| `--damage` on `--bg-0` over the 10% torchlight wash | 6.06:1 | pass |
| `--weapon-no` on `--bg-0` over the 10% torchlight wash | 5.57:1 | pass |

**Large text and UI boundaries — threshold 3:1**

| Pair | Ratio | Result |
| --- | --- | --- |
| `--border-2` on `--bg-1` | 3.67:1 | pass |
| `--border-2` on `--surface-1` | 3.46:1 | pass |
| `--border-2` on `--surface-2` | 3.18:1 | pass |
| `--border-2` on `--bg-0` over the 10% torchlight wash (outline buttons, card frames) | 3.39:1 | pass |
| `--border-2` on card paper (`--art-paper`) | 4.77:1 | pass (card frame vs. light art) |
| `--focus` on `--bg-1` | 14.18:1 | pass |
| `--focus` on `--surface-1` | 13.36:1 | pass |
| `--focus` on `--surface-2` | 12.27:1 | pass |
| `--focus` on `--surface-3` | 10.99:1 | pass |
| `--focus` on `--bg-0` over the 10% torchlight wash | 13.09:1 | pass |
| `--selection` on `--bg-0` over the 10% torchlight wash (selected card ring) | 10.09:1 | pass |
| `--health` on `--health-track` | 7.07:1 | pass |
| `--health` on `--surface-1` | 8.29:1 | pass |

**Deliberate non-uses.** These are measured so they are not applied by mistake:

| Pair | Ratio | Rule |
| --- | --- | --- |
| `--gold` on card art | 2.19:1 | Gold is never text or a border at the artwork edge in any state; the card frame is always `--border-2`, hover uses lift and shadow, and rings sit outside the mat |
| `--selection` on card art | 1.60:1 | Selection rings are drawn outside the artwork at a 6px offset, never inside the illustration |
| `--focus` on `--gold` | 1.77:1 | The focus ring is outside the control at a 2px offset, measured against the surrounding surface (10.99–14.73:1, or 13.09:1 over the wash); the offset exposes that surface as the gap |
| `--health-track` on `--surface-1` | 1.17:1 | The track is not the boundary; a 1px `--border-2` frame wraps the bar (3.46:1), and the fill-to-track ratio is 7.07:1 |
| `--border-1` on `--surface-1` | 1.50:1 | Decorative separators only; interactive boundaries always use `--border-2` |
| `--border-1` on `--bg-0` over the 10% torchlight wash (ineligible-card frame) | 1.47:1 | The ineligible frame is intentionally quieter; the dimmed art and the "Not usable" caption carry the state, so this hairline is not an essential boundary |
| `--border-2` on `--surface-3` | 2.85:1 | Never an essential boundary against `--surface-3`; a pressed secondary button keeps its 1px `--border-2`, whose boundary is measured against the surrounding page or panel (3.18–3.67:1), and the fill change is a supplementary cue |

**Text, caption, and label assignments.** Each visible caption, label, and status line names its exact tokens; the ratio column refers to the tables above. Card state is always also stated in caption text, never by a message-carrying chip or badge.

| Element | Size token | Foreground | Background | Ratio |
| --- | --- | --- | --- | --- |
| Title wordmark | `--text-display` | `--gold-bright` | `--bg-0` (over the torchlight wash) | 10.09:1 |
| Title premise | `--text-body` | `--text-2` | `--bg-0` (over the wash) | 11.19:1 |
| Title ghost/secondary action label | `--text-label` | `--text-2` | `--bg-0` (over the wash) | 11.19:1 (hover `--text-1` on `--surface-2`, 13.92:1); 1px `--border-2` outline 3.39:1 |
| Primary button label | `--text-label` | `--gold-ink` | `--gold` | 7.71:1 (hover/pressed `--gold-ink` on `--gold-bright`, 10.53:1) |
| Secondary button label | `--text-label` | `--text-1` | `--surface-2` | 13.92:1 (pressed/hover `--text-1` on `--surface-3`, 12.46:1) |
| Ghost/icon button label | `--text-label` | `--text-2` | `--surface-1` | 11.42:1 (on `--bg-1`: 12.12:1) |
| Destructive button label | `--text-label` | `--damage` | `--surface-2` | 5.68:1 |
| Disabled button label | `--text-label` | `--text-disabled` | `--surface-2` | 5.08:1 (WCAG exempts disabled text; kept readable with a visible reason) |
| Tooltip text | `--text-small` | `--text-1` | `--surface-3` | 12.46:1 |
| Skip link (when focused) | `--text-label` | `--text-1` | `--surface-1` | 15.15:1 |
| Title footer | `--text-caption` | `--text-muted` | `--bg-0` (over the wash) | 6.58:1 |
| Header primary label/value | `--text-label` / `--text-card-value` | `--text-1` | `--surface-1` | 15.15:1 |
| Header secondary label (room, carried) | `--text-label` | `--text-2` | `--surface-1` | 11.42:1 |
| Center room heading | `--text-h1` | `--text-1` | `--bg-0` (over the wash) | 14.85:1 |
| Rail/section headings (Weapon, Kill stack, Dungeon) | `--text-h3` | `--text-2` | `--bg-0` (over the wash) | 11.19:1 |
| Room hint line | `--text-small` | `--text-2` | `--bg-0` (over the wash) | 11.19:1 |
| Action-bar helper/disabled reason | `--text-small` | `--text-muted` | `--bg-1` | 7.13:1 |
| Potion-allowance "used" label | `--text-label` | `--wasted` | `--surface-1` | 8.13:1 |
| Seed (plain mono text) | `--text-card-meta` | `--text-muted` | `--surface-1` | 6.72:1 |
| "Card N of 4" label | `--text-small` | `--text-2` | `--bg-0` (over the wash) | 11.19:1 |
| Selected card caption ("Selected") | `--text-small` | `--selection` | `--bg-0` (over the wash) | 10.09:1 |
| Carried card caption ("Carried") | `--text-small` | `--gold` | `--bg-0` (over the wash) | 7.39:1 |
| Ineligible card caption ("Not usable — <reason>") | `--text-small` | `--weapon-no` | `--bg-0` (over the wash) | 5.57:1 |
| Broken card caption ("Broken — value N") | `--text-small` | `--damage` | `--bg-0` (over the wash) | 6.06:1 |
| Weapon caption | `--text-label` | `--gold` | `--bg-0` (over the wash) | 7.39:1 |
| "Weapon usable" plain status text | `--text-label` | `--weapon-ok` | `--surface-1` | 8.29:1 |
| Kill-stack caption and total | `--text-small` | `--text-2` | `--bg-0` (over the wash) | 11.19:1 |
| Kill-stack "… +N more" text | `--text-small` | `--text-2` | `--bg-0` (over the wash) | 11.19:1 |
| Dungeon count chip | `--text-label` | `--gold-ink` | `--gold-bright` | 10.53:1 (1px `--gold` border is decorative) |
| Dungeon caption | `--text-small` | `--text-2` | `--bg-0` (over the wash) | 11.19:1 |
| Preview title | `--text-h3` | `--text-1` | `--surface-1` | 15.15:1 |
| Preview rules line | `--text-body` | `--text-2` | `--surface-1` | 11.42:1 |
| Feedback message | `--text-body` | `--text-1` | `--surface-2` | 13.92:1 |
| Dialog title | `--text-h2` | `--text-1` | `--surface-1` | 15.15:1 |
| Dialog body | `--text-body` | `--text-2` | `--surface-1` | 11.42:1 |
| Input label | `--text-label` | `--text-2` | `--surface-1` | 11.42:1 |
| Input text | `--text-body` | `--text-1` | `--surface-1` | 15.15:1 |
| Input placeholder | `--text-body` | `--text-muted` | `--surface-1` | 6.72:1 |
| Disabled input text | `--text-body` | `--text-disabled` | `--surface-1` | 5.53:1 |
| Input error text | `--text-small` | `--damage` | `--surface-1` | 6.18:1 |
| Table header | `--text-label` | `--text-2` | `--surface-2` | 10.49:1 |
| Table body | `--text-small` | `--text-1` | `--surface-1` | 15.15:1 |
| Persistent status line | `--text-small` | `--text-2` | `--bg-0` (over the wash) | 11.19:1 (emphasized `--text-1`, 14.85:1) |
| Result headline and score | `--text-h1` / `--text-score` | `--text-1` | `--bg-0` (over the wash) | 14.85:1 |
| Result labels | `--text-label` | `--text-2` | `--bg-0` (over the wash) | 11.19:1 |
| Replay field | `--text-small` | `--text-1` | `--surface-1` | 15.15:1 |

**Combined card caption.** A card's caption composes in a fixed order on one line: "Card 4 of 4" in `--text-small` `--text-2` over the wash (11.19:1), then any state fragments separated by "·" in `--text-muted` over the wash (6.58:1). The fragments are "Carried" in `--gold` (7.39:1), "Selected" in `--selection` (10.09:1), "Not usable — <reason>" in `--weapon-no` (5.57:1), and "Broken — value N" in `--damage` (6.06:1). Example: "Card 4 of 4 · Carried · Not usable — potion used". The caption sentence is also part of the card's accessible name, appended after the identity and availability phrase defined in §5.

### 4. Space, shape, elevation, and card geometry

Spacing scale (8px rhythm; 4px only for dense icon alignment):

| Token | rem / px | Use |
| --- | --- | --- |
| `--space-1` | 0.25rem / 4px | Icon-to-label gap, chip padding |
| `--space-2` | 0.5rem / 8px | Tight stacks, small indicator alignment |
| `--space-3` | 0.75rem / 12px | Label-to-card, card-to-card in a stack |
| `--space-4` | 1rem / 16px | Card gap, field gap |
| `--space-5` | 1.25rem / 20px | Button horizontal padding |
| `--space-6` | 1.5rem / 24px | Panel padding, section gap |
| `--space-7` | 2rem / 32px | Screen gutters (wide), group separation |
| `--space-8` | 2.5rem / 40px | Screen top padding |
| `--space-9` | 3rem / 48px | Major section separation |
| `--space-10` | 4rem / 64px | Title-screen breathing room |
| `--space-11` | 5rem / 80px | Result screen vertical rhythm |

- **Radii:** `--radius-1` 4px (decorative and data chips such as the dungeon count chip; never a state chip on a card), `--radius-2` 8px (buttons, inputs, tooltips), `--radius-3` 12px (cards, panels, dialogs), `--radius-4` 16px (bottom sheets), `--radius-pill` 999px (pills, bars).
- **Border widths:** `--border-hairline` 1px structure; `--border-strong` 2px selected/focused containers and essential frames (not the focus ring itself); `--border-accent` 3px banner leading edge and the weapon-broken strip in the mat margin outside the card frame.
- **Elevation:** `--shadow-1` `0 1px 2px rgb(0 0 0 / 45%)` (default cards); `--shadow-2` `0 8px 24px rgb(0 0 0 / 45%)` (hover/selected card, sticky action bar); `--shadow-3` `0 24px 64px rgb(0 0 0 / 55%)` (dialogs, help, tooltips); `--shadow-pressed` `inset 0 2px 0 rgb(0 0 0 / 35%)`; `--shadow-focus-halo` `0 0 0 4px rgb(233 220 192 / 22%)` as optional decoration only.
- **Focus-ring geometry (all components — buttons, cards, inputs, links):** `outline: 2px solid var(--focus); outline-offset: 2px;` with the ring radius following the target (minimum 4px). The 2px offset exposes the surrounding surface as the gap; no extra gap token is used. The ring is never removed in any state; hover, selected, and disabled styles keep it visible. The tightest ring-to-surface ratio in this draft is 10.99:1 (`--focus` on `--surface-3`); the other listed surfaces are 12.27–14.73:1, and the ring is 13.09:1 over the page torchlight wash. Any scroll container or grid gives focusable children at least 8px of padding so the selected-card ring (6px offset plus 2px stroke) and the focus ring are not clipped. In forced-colors mode, use `outline: 2px solid CanvasText` and let the system palette replace the custom colors.
- **Card geometry:** every card is exactly 2:3, matching the 1024×1536 source PNGs. Wide layouts use `clamp(160px, 14vw, 200px)` width; medium `clamp(140px, 30vw, 180px)`; compact 2×2 `min(40vw, 168px)` but never below 132px. Cards are `aspect-ratio: 2 / 3`, `object-fit: cover`, 12px radius, and always on a `--bg-0` mat at rest; the selected state raises the mat to `--surface-3` (§5). The edge treatment is fixed in every state: a 1px `--border-2` frame plus a 1px `--bg-0` inner separator between the frame and the artwork (`box-shadow: inset 0 0 0 1px var(--bg-0)`), with `--shadow-1` at rest and `--shadow-2` on hover/selection. Gold never touches the artwork edge in any state; hover is lift plus shadow; the selected ring uses a 2px `--selection` outline at a 6px offset outside the mat, and the focus ring uses the 2px `--focus` geometry above at 2px offset. When a selected card is also focused, both rings remain visible and distinct. Card state ("Selected", "Carried", "Not usable — <reason>", "Broken — value N") is written in the caption line under the card, never carried by a chip or badge on the card. Use explicit `width`/`height` attributes or the aspect ratio to reserve space and prevent layout shift.
- **Card safe area:** the printed rank and suit occupy the top-left corner of the illustration; do not crop or overlay the top-left 28%×30% region, and do not place chips or badges over the art in any state. Below 132px width, switch to metadata rows instead of shrinking the card.

### 5. Component states

**Buttons.** Primary (gold fill, `--gold-ink` label, 44px minimum height, 48px on desktop, 20px horizontal padding, `--radius-2`, `--text-label`):

- Default: `--gold` fill, 1px `--gold-bright` outline, `--shadow-1`; label 7.71:1.
- Hover (only when `hover: hover` and `pointer: fine`): `--gold-bright` fill, `--shadow-2`, 120ms; no size change; label 10.53:1.
- Pressed: `--gold-bright` fill, `translateY(1px)`, `--shadow-pressed`; label 10.53:1.
- Focus-visible: 2px `--focus` ring, 2px offset on the surrounding surface (10.99–14.18:1 across the surfaces above; 13.09:1 over the wash); never removed.
- Disabled: flat `--surface-2` fill, `--text-disabled` label (5.08:1), 1px `--border-1`; `aria-disabled="true"` and still focusable so the reason is reachable; a visible reason or tooltip explains it ("No weapon to use", "The room is still unresolved"); no hover or press response.
- Secondary: `--surface-2` fill, `--text-1` (13.92:1), 1px `--border-2`; hover `--surface-3` with `--border-2`; pressed `--surface-3` with `--shadow-pressed`. Ghost/icon-only: transparent fill, `--text-2` or `--text-muted` label, 44×44 hit area for a 24px icon, required `aria-label`, visible tooltip, hover `--surface-2`.
- Destructive (confirm discarding a run): `--surface-2` fill, `--damage` label (5.68:1), 1px `--damage` border; the word is explicit ("Discard run"), never an icon alone.
- Loading: keep the label, add `aria-busy="true"` and static "Loading…" text; never a spinner-only state.

Focus-visible, disabled, and loading rules apply to every button role, and hover/pressed use each role's fill pair above; no button changes size between states.

**Cards.** Every interactive card is a button with a ≥44×44 hit area and an accessible name composed of its identity and availability plus the caption sentence (for example "Five of diamonds, weapon, usable; card 1 of 4"). State is written in the caption line under the card, composed in the order defined in §3 (for example "Card 4 of 4 · Carried · Not usable — potion used"); there are no message-carrying chips or badges on the card.

| State | Treatment | Non-color cue |
| --- | --- | --- |
| Default | Art on `--bg-0` mat, 1px `--border-2` frame plus 1px `--bg-0` inner separator, 12px radius, `--shadow-1` | Caption under the card: "Card 1 of 4" (`--text-small`, `--text-2`, 11.19:1 over the wash) |
| Hover | Lift 2px, frame stays 1px `--border-2` plus `--bg-0` separator, `--shadow-2`, 120ms; pointer only; no gold at the art edge | Same caption; no state change on hover |
| Focus-visible | 2px `--focus` ring outside the mat at 2px offset (same geometry as buttons and inputs); grid padding ≥8px | Ring plus position in the card list |
| Selected | 2px `--selection` ring outside the mat at 6px offset, `--surface-3` mat, no transform; `aria-pressed="true"`; caption "Selected" (`--selection` over the wash, 10.09:1); preview updates. When also focused, both rings remain visible and distinct | Caption text plus the preview heading |
| Ineligible | No lift; art `grayscale(0.55) brightness(0.82)`; frame quiets to 1px `--border-1` (the caption is essential, the hairline decorative); `aria-disabled="true"` but still focusable for help/selection; caption "Not usable — <reason>" (`--weapon-no` over the wash, 5.57:1); action buttons disabled with a reason | Caption text and dimmed art; printed rank remains legible (verified in the visual review) |
| Weapon broken | 3px `--damage` strip in the mat margin, outside the fixed frame (never adjacent to the artwork), plus caption "Broken — value N" (`--damage` over the wash, 6.06:1); art is not dimmed so the value stays readable; accessible description names the broken value | Caption text and value, not color alone |
| Carried | 1px `--border-2` frame plus `--bg-0` separator; caption appends "Carried" in `--gold` (7.39:1 over the wash); named in the accessible description and in the card list text | Caption text |
| Kill-stack card | Non-interactive thumbnail 96px wide; each card is overlapped by the next with a −52px margin so a 44px strip exposes its rank and suit; newest on top/right; the number visible is capped by the rail width: 4 at the 240px maximum (228px), 3 at 184px, 2 at 140px; any further cards become a "… +N more" plain-text line (not a chip); the compact scroll row may show more; never overflow or clip the rail; adjacent text list and total | Text list and count, not overlap alone |
| Empty weapon slot | 2:3 dashed `--border-1` outline, `--text-muted` "No weapon", hint "You fight barehanded" | Text |

**Feedback banners.** Variants: info (`--border-2` edge), success (`--heal`), warning (`--wasted`), danger (`--damage`). `--surface-2` fill, 3px left edge, 24px icon, `--text-1` message (13.92:1), optional action, `--radius-2`, max width 480px, stacked above the action bar. Banners are visual mirrors only: they carry no live-region roles themselves, and the §7 polite and assertive regions announce the same strings once. Errors persist until dismissed; success may auto-dismiss after 6s, but the outcome remains in the persistent visible status line defined in §6 and in the §7 live regions, so nothing is lost from the screen. Dismiss button 44×44 with an accessible name. Message text carries the meaning: "Potion restored 5 health. Health 13 / 20." / "Potion wasted — health is already 20 / 20." / "Weapon discarded (7). Weapon is now 9."

**Dialogs and help.** `--surface-1` panel, 1px `--border-2`, 12px radius, `--shadow-3`, 24px padding; scrim `--scrim`; `--text-h2` title; body `--text-2` (11.42:1); 44×44 close button top-right; actions right-aligned with secondary before primary. Help is max 560px wide and includes rules summary, card meanings, the weapon chain, and run-away restrictions as text. Modal behavior: `aria-modal="true"`, labelled title, focus trap, Esc closes, focus returns to the trigger. Compact screens use a bottom sheet with the same tokens and a 44px close button, with safe-area padding.

**Inputs.** Visible label `--text-label` `--text-2`; 48px height (44px minimum); `--surface-1` fill, 1px `--border-2`, 8px radius; 16px `--text-1` text (prevents iOS zoom); placeholder `--text-muted` (6.72:1); helper text `--text-muted`; focus ring as above. Error: 1px `--damage` border, icon, `--damage` message (6.18:1), `aria-invalid="true"` and `aria-describedby`. Disabled fields use `--text-disabled` plus a visible reason. The replay-link field uses mono, is read-only, selects its text on focus, and has a 44×44 copy button with an announced result.

**Statistics tables.** Panel `--surface-1` with 1px `--border-2`, 12px radius; header row `--surface-2`, `--text-2` `--text-label`, bottom 2px `--border-2`; body rows `--text-1`, 1px `--border-1` separators, hover `--surface-2`; numeric cells right-aligned with tabular figures; sortable headers are buttons with a 24×24 minimum target (44×44 preferred), `aria-sort`, and the focus ring; row hover or striping is never the only cue. Compact screens wrap the table in a focusable, labelled scroll region (`role="region"`, `tabindex="0"`) rather than shrinking text; score and seed values are never truncated.

### 6. Title, play, and result composition

Breakpoints: compact below 768px, medium 768–1199px, wide 1200px and up. Content max width 1440px; gutters 16px / 24px / 32px.

**Title screen.** Full-viewport `--bg-0` with the static torchlight wash (§3); a decorative `aria-hidden="true"` fan of three current card PNGs at ≤20% opacity, kept outside the 720px text column or covered by a `--bg-0` scrim wherever it passes behind text, so the measured page-background pairs stay valid (or use a plain vignette if art loading is a concern); centered content column, max 720px. Wordmark `--text-display` in `--gold-bright` over the wash (10.09:1); one-line premise `--text-body` in `--text-2` over the wash (11.19:1); stacked actions: primary "New run", secondary "Continue" when a save exists, ghost "Rules and help" and ghost "Language: English / 简体中文" (`aria-pressed` state) with 1px `--border-2` outline over the wash (3.39:1) and `--text-2` label (11.19:1; hover `--text-1` on `--surface-2`, 13.92:1); all labels `--text-label` and 44px minimum. The custom-seed field stays collapsed under "Custom seed" until expanded. Footer holds build/version in `--text-caption` in `--text-muted` over the wash (6.58:1). No autoplaying sound; at most one 200ms fade.

**Play screen — wide.** Page ground `--bg-0` with the static torchlight wash; header (64px, `--surface-1`, 1px bottom `--border-2`): left, the health cluster — label "Health 13 / 20" (`--text-label` and `--text-card-value` in `--text-1` on `--surface-1`, 15.15:1), a 12px bar with a 1px `--border-2` frame, `--health` fill on `--health-track` (fill-to-track 7.07:1; frame 3.46:1), exposed as `role="progressbar"` with `aria-valuetext`; center, the room label and potion allowance ("Potion available this room" or "Potion used") in `--text-label` `--text-2` on `--surface-1` (11.42:1; a used potion is `--wasted`, 8.13:1) plus carried status; right, the seed as plain mono text (`--text-card-meta` in `--text-muted` on `--surface-1`, 6.72:1, no chip or frame) and 44×44 "Help" icon button (`--text-2` on `--surface-1`, 11.42:1; plus "Settings" when that screen exists). Main grid `minmax(180px, 240px) minmax(0, 1fr) minmax(140px, 200px)` with 24px gaps:

- Left rail: weapon slot (card plus a "Weapon 5" caption in `--gold`, 7.39:1 over the wash; or the empty slot) and the kill stack (newest on top/right; 96px-wide cards overlapped by 52px so a 44px strip with rank and suit stays exposed; the visible count fits the rail — 4 at 240px, 3 at 184px, 2 at 140px, then a plain "… +N more" line; adjacent text list with total, `--text-2` over the wash, 11.19:1).
- Center: room heading (display serif, `--text-h1`, `--text-1` over the wash, 14.85:1) with the room hint line (`--text-small`, `--text-2`, 11.19:1); four card buttons in one row (or 2×2 when the center is narrower than 680px), each with a caption line "Card N of 4" (`--text-small` in `--text-2` over the wash, 11.19:1) that combines state fragments as defined in §3 (e.g. "Card 4 of 4 · Carried · Not usable — potion used"); the selected card's preview sits beside it — title "5 of diamonds — weapon", the plain `--weapon-ok` "Weapon usable" status (8.29:1 on `--surface-1`), the rules line, and both choices together: primary "Use weapon", secondary "Barehanded"; ineligible cards show "Not usable — <reason>" in the caption and an explanation instead of an enabled action; selection is announced in the polite status region.
- Right rail: dungeon pile as a CSS stack of warm dark card backs (base `--surface-2` with gold diagonal hairlines at 16% and 18%, 1px `--border-2` over the wash at 3.39:1, `--shadow-1`, no new artwork) with the remaining count and the accessible text "Dungeon, 29 cards remaining"; the count chip is 44px wide, `--gold-ink` on `--gold-bright` (10.53:1), with a 1px `--gold` border.

Below the room area and above the action bar sits a persistent status line: a reserved one-line region in `--text-small` `--text-2` on `--bg-0` over the wash (11.19:1; emphasized spans use `--text-1`, 14.85:1) showing the latest outcome and keeping auto-dismissed success messages visible until the next outcome replaces them. It is plain visible text, not a live region: only the §7 polite region is `aria-live`, and both display the same strings so nothing is announced twice.

Sticky action bar (72px, `--bg-1`, 1px top `--border-2`): primary "Enter next room" (44px; disabled with reason until the room resolves), secondary "Run away" (44px; disabled with reason when the rules forbid it), ghost "Undo" and "Help" (44×44); a helper/disabled-reason line in `--text-small` `--text-muted` on `--bg-1` (7.13:1) sits beside the buttons; order follows rule order, not color order. Help stays reachable while a card is selected. No in-run score is shown during play: the score is defined only by the outcome (surviving health on a win, remaining monsters on a loss), so the result screen owns it.

**Play screen — compact.** Single column. Sticky compact header: health, potion allowance, and a 44×44 Help button; the room grid becomes 2×2 with cards at least 132px wide and caption lines kept visible; weapon slot and kill stack become a labelled two-up row above the actions, horizontally scrollable with a visible scroll affordance (never a hidden carousel), and the scroll row may show more of the stack than the wide-rail cap; the dungeon count becomes a compact chip near the room label; the selected-card preview is a bottom sheet above the fixed action bar with both choices; the persistent status line sits above the fixed action bar; the action bar respects `env(safe-area-inset-bottom)`; no information depends on hover, and help opens on tap/focus and closes with Esc or the close button.

**Play screen — medium.** Two columns: the weapon/kill rail plus the center room in 2×2; the dungeon count moves into the header chip; the rail uses the same fit-based kill-stack cap as the wide layout.

**Result screen.** Centered panel max 640px on `--bg-0` over the wash; outcome heading `--text-h1` with an icon and text ("You survived" / "You fell" — text, not color alone), and the score `--text-score` with sign and label, both in `--text-1` over the wash (14.85:1), with supporting labels in `--text-2` over the wash (11.19:1); a breakdown table (surviving health or remaining monsters, potion used/wasted, cards defeated) using the §5 table styling; seed and rules values as plain text (mono for the seed); replay-link row (read-only mono field, 44×44 "Copy link", result announced); actions in order: primary "New run", secondary "Back to title", ghost "View statistics". The result summary is announced once in the polite status region and focus moves to the result heading. Statistics and settings screens are step 2 of the [design handoff sequence](#design-handoff-sequence); this draft only fixes their typography, table, and dialog language.

**Touch targets.** Primary card and action controls are at least 44×44 CSS px ([REQ-016](prd.md#req-016)). Every other control is at least 24×24 with at least 8px between adjacent targets, and aimed at 44×44; hit areas are measured on the interactive box, not the icon. Inline text links (help, replay link) get a 24px minimum height and 8px separation. No adjacent targets closer than 8px, and the fixed action bar respects the bottom safe area.

### 7. Feedback, motion, and announcements

Durations: `--motion-1` 120ms (hover, press, focus), `--motion-2` 200ms (panels, preview, banners), `--motion-3` 280ms (result reveal, room deal); exits 160ms. Easing `cubic-bezier(0.2, 0.6, 0.2, 1)` for enters, ease-out for exits. Animate opacity and transform only, never layout; no more than three flashes in any one second; no autoplay sound.

**Reduced motion.** Honor `prefers-reduced-motion: reduce` and an in-app "Reduce motion" preference stored with the other preferences. In that mode: no card lift, deal, stack, slide, parallax, or particle animation; transitions become instant or at most a 120ms opacity change; focus and selection rings appear instantly; background effects stay static. Motion never carries essential state in either mode.

**Screen-reader rules.** One polite live region after the header for action outcomes (health, damage, potion, weapon, escape, undo, room state) and one assertive alert region for invalid actions. The persistent visible status line in §6 is not a live region; it mirrors the same strings for sighted users, so outcomes are announced once. Announce concise sentences with numbers ("Used weapon 5 on 8 of clubs; health 13 of 20"), and never re-announce the whole board on every change. After a room is dealt, focus moves to the first card (or the room heading in compact view); after "Enter next room", focus returns to that button if the room resolves; after undo, focus returns to the restored selection. Decorative art is `aria-hidden`; the weapon and kill stack have text equivalents; the health bar has `aria-valuetext`.

**Focus order.** The DOM order is header → room cards → selected-card preview → weapon/kill rail → action bar → footer; the wide layout uses grid areas to place the weapon rail visually left of the room without changing that order, so Tab order and reading order stay logical. Tab sequence: skip link "Skip to room" → header help/settings → room cards in document order (roving tabindex; arrow keys move within the grid, Home/End to the ends) → selected-card preview choices → weapon/kill-stack inspect ("View kill stack") → action bar (Enter next room, Run away, Undo, Help) → footer. Dialogs temporarily trap focus; there are no other keyboard traps. Tab and Shift+Tab traverse each control group once — the card grid is a single tab stop, and arrow keys move within it — so every action is reachable by following this order; Enter or Space activates the focused control, and Esc dismisses applicable overlays. No function is keyboard-only and no shortcut is required. Visible focus is present in every state, including hover and selected.

**Help without hover.** Contextual help opens on focus, on tap, and on hover; it closes with Esc or blur and is wired with `aria-describedby`. Help text is also available in the full help dialog and is never conveyed by hover alone ([Contextual learning](#contextual-learning), [REQ-017](prd.md#req-017)).

### 8. Content and internationalization

Tone, English: terse, second person, sentence case, verb-led, no exclamation marks, no filler. Tone, Simplified Chinese: concise standard Mandarin with the same information, not a literal translation; full-width punctuation; no exclamation marks. Use the glossary below for consistent terms (draft, pending translation review).

| English | zh-Hans |
| --- | --- |
| Health | 生命值 |
| Weapon | 武器 |
| Broken | 损坏 |
| Barehanded | 徒手 |
| Potion | 药水 |
| Wasted | 浪费 |
| Dungeon | 地牢 |
| Room | 房间 |
| Kill stack | 击杀堆 |
| Carried | 携带 |
| Run away | 逃跑 |
| Next room | 下一房间 |
| Undo | 撤销 |
| Score | 得分 |
| Seed | 种子 |
| Replay link | 回放链接 |
| Not usable | 不可用 |
| Selected | 已选择 |
| Help | 帮助 |
| New run | 新的一局 |

Rules: no hard-coded display strings — visible copy, `aria-label` text, live-region sentences, and error messages come from `en` and `zh-Hans` message catalogs; accessible names compose from localized fragments with placeholders, not string concatenation; numbers and the score use `Intl.NumberFormat`; seed and replay-link characters stay Latin. Allow about 30% expansion for Chinese and wrap labels instead of truncating; never place essential text in an image. A missing zh-Hans key falls back to English and is logged in development — the English fallback required by [AC-005](prd.md#ac-005). Tooltips, banners, and the log reuse the same message keys so they cannot drift.

### 9. Accessibility acceptance checklist

This is the guide's self-check; the formal audit stays deferred per [REQ-017](prd.md#req-017).

- **Contrast:** every pair in §3 meets its threshold; focus ring, card frame, health bar, and card-state captions are re-checked against final surfaces ([REQ-017](prd.md#req-017), [AC-005](prd.md#ac-005)).
- **Touch:** primary controls at least 44×44; secondary controls at least 24×24 with 8px separation ([REQ-016](prd.md#req-016)).
- **Keyboard:** the full play flow works without a pointer; focus is visible everywhere; no traps except modal dialogs, which restore focus ([REQ-017](prd.md#req-017)).
- **Screen reader:** card names and states, both choices, feedback, and the result are announced; help is reachable and complete.
- **Zoom and reflow:** 200% zoom and a 320 CSS px viewport keep content and actions available without horizontal page scrolling (tables scroll inside their labelled region).
- **Motion:** reduced-motion mode removes non-essential motion; no essential information is motion-only.
- **Languages:** the full flow in English and Simplified Chinese, English fallback, no truncation of essential labels ([AC-005](prd.md#ac-005)).
- **Small screens:** the compact composition in §6 works from 320–767px with every action reachable.
- **Artwork:** current PNG artwork only per [Card artwork](#card-artwork); UI chrome never crops the printed rank/suit.

### 10. Decisions for the user

**Approved as drafted on 2026-11-01.** The user approved the visual direction from a throw-away demo and then approved this written guide with the D1–D4 values below as recorded. The approval is recorded in [Design approval status](#design-approval-status); changes require a new recorded approval.

**D1. Accent metal — warm antique brass (approved 2026-11-01).** `--gold #C9A15A`, `--gold-bright #E3BE7C`, `--gold-ink #1A1204`, and `--selection #E3BE7C`. Evidence: gold text 7.54:1 on `--surface-1` and 6.93:1 on `--surface-2`; ink on gold 7.71:1, on hover 10.53:1. The earlier cold-steel and aged-ember alternatives were dropped when the warm palette was fixed and are not offered as live options. The accent stays away from the card art: gold is never a text or border at the artwork edge (§3 non-uses).

**D2. Display typography — system display serif stack (approved 2026-11-01).** `"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Noto Serif SC", "Source Han Serif SC", "Songti SC", SimSun, serif` for the wordmark, screen titles, room and section headings, dialog titles, and the result headline, in normal case with no all-caps or uppercase letter-spacing; the UI sans stack covers body, data, labels, and buttons; mono covers the seed, replay link, and tabular figures (§2). The all-sans and self-hosted-display alternatives were dropped by the approved direction; a self-hosted display face remains a possible later enhancement, not part of this guide.

**D3. Card framing — dark mat treatment (approved 2026-11-01).** Art on a `--bg-0` mat with a 1px `--border-2` frame, a 1px `--bg-0` inner separator, and `--shadow-1`; hover lifts 2px and adds `--shadow-2`; the selected state uses a 2px `--selection` ring at a 6px offset outside the mat with a `--surface-3` mat; focus uses the 2px `--focus` ring at a 2px offset; gold never touches the artwork edge, and card state is written in the caption line (§4, §5). The borderless-art and heavy-board-game-frame alternatives were dropped by the approved direction: borderless rings would sit on the art at 1.60:1, and the heavy frame over-decorates a four-up grid.

**D4. Compact room layout — 2×2 card grid (approved 2026-11-01).** Below 768px, all four cards stay visible in a 2×2 grid at ≥132px wide with caption lines under each card; the horizontal-scrolling row and stacked-list alternatives were dropped by the approved direction because they hide cards or push play below the first view (§6).

**Approval record.** The user approved this written style guide as drafted on 2026-11-01, including the D1–D4 values recorded above. Scope: typography, color tokens, spacing, component states, and the title/play/result compositions. The independent contrast and accessibility checks were complete before approval (task-18: safe, no blockers or majors; task-14 and its targeted re-check task-16 reviewed the earlier revision). Changes to this guide require a new recorded approval in [Design approval status](#design-approval-status). Approval of this style guide does not authorize implementation or deployment; those remain separate decisions.

**Not covered by this guide (later steps):** final copy strings and translation review; a commissioned card-back illustration (none exists, so the dungeon pile is CSS-only for now); any later self-hosted display face; sound and haptics; and the statistics/settings visual layer, which follows step 2 of the [design handoff sequence](#design-handoff-sequence) after approval.

## Design handoff sequence

Use this sequence for design handoff:

1. Establish the style guide, title screen, and play screen. Review these against [DEC-001](prd.md#dec-001), [REQ-001](prd.md#req-001), and [REQ-003](prd.md#req-003) through [REQ-008](prd.md#req-008), including the access needs in [REQ-016](prd.md#req-016) and [REQ-017](prd.md#req-017). Record the style-guide approval in the section above.
2. Once the style guide is approved and recorded in the section above, extend that visual language to statistics, settings, and the result scorecard. Review against [REQ-009](prd.md#req-009), [REQ-011](prd.md#req-011), [REQ-012](prd.md#req-012), [REQ-013](prd.md#req-013), and [REQ-014](prd.md#req-014).

Use the PRD's [product acceptance checks](prd.md#product-acceptance) for the final product review rather than keeping a separate feature checklist here.
