# Scoundrel design plan

The [PRD](prd.md) owns product goals, requirements, scope, and acceptance outcomes, as defined by [INFO-002](prd.md#info-002). This plan records presentation choices and the design handoff sequence. Requirement changes belong in the PRD; default gameplay changes belong in the [game rules](rules.md).

## Design approval status

**Approved by the user on 2026-11-06 as the dark green revision.** Scope: this written style guide, including the revised D1 accent and the unchanged D2–D4 values, typography, color tokens, spacing, component states, and the title/play/result compositions. Dark green style direction approved by user 2026-11-06 (review page); supersedes the 2026-11-01 warm leather direction. The approval followed a 2026-11-06 direction review of a throw-away style demo (`.design-demo-green`, not shipped and not part of the repository). Earlier independent checks on the earlier revisions found and resolved issues before passing: task-14 returned NOT SAFE with two majors (missing state pairings and a hover gold-on-art contradiction), which were fixed before its targeted task-16 re-check passed clean; task-18 passed with minor documentation residuals, addressed in task-19 and confirmed clean in task-20; the green revision recomputes every measured contrast pair for the new tokens and is ready for independent review (task-45). See [Approved style guide](#proposed-style-guide-draft). This approval does not authorize deployment, merging into main, or opening a pull request; those remain separate decisions and deployment/merge remain unauthorized.

The written style guide was first approved on 2026-11-01 with the scope recorded above; that approval satisfied the design gate required before the phase 3 design review, and Phase 3 was accepted under it. This dark green revision was approved afterwards on 2026-11-06 and supersedes the earlier direction. Any later change to the guide, its tokens, or its D1–D4 values requires a new approval recorded in this section and in §10; do not reintroduce the removed design references. The 2026-11-01 direction approval covered the warm leather look demonstrated in the throw-away demo; it is superseded by the 2026-11-06 green approval and is retained only as historical record in this section and §10 D1.

**Post-approval correction recorded 2026-11-06.** The user reviewed the play screen (`#/play?seed=222de3701f5a3b1f&config=0`) and directed three presentation corrections, implemented in the same-day play-screen work and reflected in this guide at that time: room-card captions then showed the capitalized card type ("Monster", "Weapon", or "Potion") followed by the card's state fragments instead of the former positional card-index text; the orange weapon-edge damage indicator and the weapon-rail broken-value caption are removed, so weapon broken/degradation state is no longer rendered in the play UI (the preview still explains weapon ineligibility); and the card accessible name is now the visible caption verbatim followed by the card identity. These corrections supersede the corresponding lines in §3–§6; they do not change tokens, typography, spacing, or the 2026-11-06 dark-green approval. These round-1 caption corrections were later superseded by the round-2 corrections below: visible captions are now type-only (plus the ineligible reason), and selected/carried state is conveyed by the selection ring and mat, the "Carried" badge, and the accessible name, so §2–§7 carry the round-2 wording.

**Post-approval correction recorded 2026-11-06 (round 2, user-directed).** The user reviewed the play screen again (`#/play?seed=222de3701f5a3b1f&config=0`) and directed a second round of presentation corrections, implemented the same day and reflected below: visible card captions show only the card type ("Monster", "Weapon", "Potion") plus the ineligible "Not usable — <reason>" fragment, with no selected, carried, or positional fragments; selection is ring and mat only; a "Carried" badge sits inside the card frame at bottom-centre and the accessible name still announces the "Carried" and "Selected" state words; the defeated-monster rail is labelled "Defeated monsters" with no count or overflow line (thumbnails and screen-reader names remain); the preview loses its dismiss button (Escape, clicking the selected card again, choosing another card, or the compact sheet close clears selection), monster preview titles are matchups ("Monster 5 vs. Weapon 4" or "Monster 14 vs. barehanded"), and confirm buttons include damage taken; and the header no longer duplicates the room label or shows a potion indicator, persistent outcome line, or seed — the health label and bar form one row, and the seed moves to the bottom-right with a visible "Seed: " prefix. These corrections supersede the corresponding lines in §2–§7; they do not change tokens, the type scale, spacing, the 2026-11-06 dark-green approval, or D1–D4.

**Post-approval correction recorded 2026-11-06 (round 3, user-directed).** The user reviewed the play screen at `#/play?seed=dd478153b5f45e01&config=0` and directed three further presentation corrections, implemented the same day and reflected below: the draw-pile status now sits immediately to the right of the health label/bar in the header (visible "Dungeon" and "N cards remaining" text, with the accessible name "Dungeon, N cards remaining"); the seed moves from its fixed corner into the bottom-right corner of the action-bar panel; and both play-screen "Help" buttons are removed (the header duplicate and the action-bar ghost button), so the play screen has no Help entry point; the full help dialog remains reachable from the title screen's "Rules and help" control. The right-rail dungeon pile and the medium/compact dungeon chip are removed with this move; the wide main grid is now two columns. These corrections supersede the corresponding lines in §3, §5, §6 and §7; they do not change tokens, the type scale, spacing, the 2026-11-06 dark-green approval, or D1–D4.

**Post-approval correction recorded 2026-11-08 (round 3 follow-up, user-directed).** The user reviewed the play screen at `#/play?seed=f88912171cc798ce&config=0` and directed that the room-actions panel stop floating: it now sits in normal page flow beneath the selected-card section instead of being sticky on wide/medium or fixed on compact. The seed keeps its bottom-right position inside that panel, and the compact preview sheet now opens at the viewport bottom without reserving action-bar height. This supersedes the sticky/fixed action-bar lines in §6 and §7; it does not change tokens, typography, spacing, the 2026-11-06 approval, or D1–D4.

**Post-approval correction recorded 2026-11-08 (round 4, user-directed).** On the same play screen the user directed four refinements, implemented the same day: the room-actions panel now sits inside the selected-card panel beneath the card choices (still in normal flow, no sticky/fixed positioning); the health bar track is wider (200px on wide/medium, 160px on compact); the dungeon caption and accessible name read "Dungeon, N cards" (visible "Dungeon" + "N cards"); and the confirm labels use "Fight barehanded (-N HP)" / "Use weapon (-N HP)" instead of a damage phrase. This supersedes the corresponding lines in §3 and §6; it does not change tokens, typography, the 2026-11-06 approval, or D1–D4.

## Visual treatment

Supports [DEC-001](prd.md#dec-001) and [REQ-016](prd.md#req-016).

Use crisp typography, depth, shadow, and high contrast to give the interface a mysterious, adventurous atmosphere. Keep labels and controls distinct from decorative artwork so the dark theme remains readable.

## Card artwork

Supports [DEC-001](prd.md#dec-001).

Use the 44 PNG card illustrations in [assets/](../assets/) and preserve their suit-and-rank filenames. The JPEG images in [assets-old/](../assets-old/) are archived references only: do not load, bundle, copy, or use them as fallback artwork in the product.

## Card table and feedback

Supports [REQ-003](prd.md#req-003), [REQ-004](prd.md#req-004), [REQ-005](prd.md#req-005), and [REQ-006](prd.md#req-006).

- Place the weapon card on the left and its defeated-monster stack on the right. Render defeated monsters as physical cards, with the most recently defeated monster on top.
- Mark the carried card with the "Carried" badge inside its frame so players can recognize it after the next deal.
- Use a selection highlight and a nearby action preview before confirmation. Present weapon and barehanded choices together when both are available.
- Give weapon swaps visible discard feedback. Distinguish healing feedback from a consumed potion that restores no health.

## Contextual learning

Supports [REQ-007](prd.md#req-007), [REQ-015](prd.md#req-015), and [REQ-017](prd.md#req-017).

Use contextual tooltips for card meanings, the weapon's degradation chain, and run-away restrictions. Put explanations beside the relevant card or action. Make the same explanations available on focus and touch rather than relying on hover alone.

<a id="proposed-style-guide-draft"></a>

## Approved style guide (2026-11-06 revision)

**Status: approved by the user on 2026-11-06 as the dark green revision (supersedes the 2026-11-01 warm leather approval).** Scope: the written style guide as recorded in this section, including the revised D1 and the unchanged D2–D4. Independent checks: `qa-verifier` re-ran contrast and accessibility checks on earlier revisions — task-14 returned NOT SAFE with two majors (missing state pairings and a hover gold-on-art contradiction), fixed before its targeted task-16 re-check passed clean; task-18 passed with minor documentation residuals, addressed in task-19 and confirmed clean in task-20 — and the Lead applied the final minor wording clarifications afterwards. The green revision recomputes every measured contrast pair for the new tokens and is ready for independent review (task-45). The guide records the title, play, and result presentation plus the small-screen and keyboard coverage called for by the phase 1 acceptance check. It adds no dependency, source file, or executable test, and it does not authorize implementation.

**How to use this guide:** §1 records the direction, §2–§9 are build-ready detail, and §10 records the approved D1–D4 values. Implementation uses this guide as the presentation source of truth. Any change to the guide or to a recorded D1–D4 value requires a new recorded approval in [Design approval status](#design-approval-status); no implementation starts from this guide's approval alone.

### 1. Direction and principles

The interface is a dark dungeon table that makes the light watercolor card art the brightest thing on screen: deep forest near-black surfaces lit by a static light-green torchlight wash, pale green-tinted text, a single light-green accent, and depth from shadow and hairline borders rather than ornament. It supports [DEC-001](prd.md#dec-001) and [REQ-016](prd.md#req-016).

- **The art is the hero.** The current 44 PNGs are the only card artwork ([Card artwork](#card-artwork)); the UI supplies the dark mat, frame, and shadow around each light illustration. This guide introduces no new card art, card backs, or decorative raster assets.
- **Light-green torchlight, not flat black.** A static, low-opacity light-green glow sits over the deep forest ground (10% at most, §3); it is decorative, and any text placed on the page background is measured against the wash's worst case, not just the unwashed token (§3).
- **Readable first.** Text and controls never sit directly on card art; controls keep a solid surface and the contrast in §3. Labels and controls stay visually distinct from illustration detail, per [Visual treatment](#visual-treatment).
- **Every state has a non-color signal.** Eligible/ineligible, selected/carried, healed/wasted, and health/damage pair color with a shape or outline, a label or badge, and screen-reader text. Color is never the only carrier ([REQ-017](prd.md#req-017)).
- **Motion is never essential.** Every animated cue has a static equivalent, and reduced-motion mode removes non-essential motion (§7).
- **Touch and keyboard are equal inputs.** Targets, focus order, and help work without hover ([REQ-016](prd.md#req-016), [REQ-017](prd.md#req-017)).
- **Dependency-free.** Tokens are CSS custom properties and the font stacks use installed fonts only; self-hosting a display face remains a later decision (D2).

### 2. Typography

Three stacks, no webfont files required by this guide:

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
| `--text-caption` | 0.75rem / 12px | 400 | 1.4 | Non-essential metadata only; zh uses 0.875rem; the carried badge is the sole 700-weight, state-carrying use (§5) |

Rules: body text never below 1rem; Chinese never below 0.875rem; 0.75rem is allowed only for non-essential Latin metadata and never carries state, except the carried badge — a short 700-weight pill whose text is also part of the accessible name (§5). Normal case everywhere: no uppercase transforms and no uppercase letter-spacing in either language. Line length targets 45–75 characters (EN) or 25–40 characters per line (zh). Use `text-wrap: balance` for headings and `text-wrap: pretty` for body where supported. The printed rank and suit in the artwork's top-left corner are illustration, not UI text; do not overlay typography there (§4).

### 3. Color tokens and contrast evidence

Dark dungeon-crawler identity ([DEC-001](prd.md#dec-001)): a deep forest near-black ground under a static light-green torchlight wash, pale green-tinted text, and a single light-green accent.

| Token | Hex | Role |
| --- | --- | --- |
| `--bg-0` | `#05110A` | App backdrop under the torchlight wash, theater surround, result screen ground, card mat at rest |
| `--bg-1` | `#0A1A10` | Action bar, framed sub-surfaces, pressed page edges |
| `--surface-1` | `#0F2417` | Panels, header, dialogs, table body, preview |
| `--surface-2` | `#14301F` | Raised surfaces, banners, secondary buttons, hover, table header |
| `--surface-3` | `#1B3D28` | Pressed and selected surfaces, selected-card mat |
| `--border-1` | `#2A4A33` | Decorative dividers and the quieter ineligible-card frame; never the sole boundary of an interactive control |
| `--border-2` | `#55805F` | Essential borders: inputs, panels, button outline, card frame, action-bar top |
| `--text-1` | `#EAF4E4` | Primary text, feedback messages, table body |
| `--text-2` | `#CDE2C5` | Secondary text, labels, captions, card metadata |
| `--text-muted` | `#A3BC9B` | Tertiary metadata, placeholder, helper text, seed text |
| `--text-disabled` | `#90A88C` | Disabled labels (still readable; see §5) |
| `--accent` | `#A9E08A` | Single primary accent: primary buttons, links, active toggles, usable-weapon text, and health fill; never a border or text at the artwork edge |
| `--accent-hover` | `#C8F2AB` | Hover/pressed accent (same value as `--selection`) |
| `--accent-ink` | `#07130A` | Text and icons on accent fills |
| `--focus` | `#DFF5C4` | Focus ring, independent of the accent choice |
| `--selection` | `#A9E08A` | Selection ring on the selected card (same value as `--accent`); drawn outside the artwork |
| `--health` | `#6FD98A` | Health fill, positive health numbers |
| `--health-track` | `#1B3324` | Health-bar track (framed by `--border-2`) |
| `--damage` | `#E08E74` | Damage numbers, destructive actions, error text, danger banner edge |
| `--weapon-ok` | `#A9E08A` | "Weapon usable" plain status text, weapon-eligible cues |
| `--weapon-no` | `#93A78E` | "Not usable" caption, weapon-ineligible cue |
| `--heal` | `#7FDB95` | Potion-healed feedback |
| `--wasted` | `#DDBE6A` | Potion-wasted feedback |
| `--scrim` | `rgb(5 17 10 / 72%)` | Dialog backdrop |
| `--art-paper` | `#F7F4EC` | Reference only: sampled paper tone of the PNGs; never painted behind text |

Ratios below use the WCAG 2.2 relative-luminance formula computed from the hex values above (not sampled from images). Page-background pairs are measured against the worst case of the static light-green torchlight wash — a 10% `--accent` overlay over `--bg-0` (composite `#152617`) — so they remain valid wherever the wash appears; the wash itself is decorative. The tables list every essential text and UI-boundary pair the UI uses, plus a deliberate non-use table; decorative-only hairlines, shadows, and art-overlay composites are excluded and marked decorative. State cues are: the card type and the ineligible reason in the caption text; a ring and a `--surface-3` mat for selection; and a "Carried" badge inside the card frame at bottom-centre (the only badge placed over the artwork in any state). The assignment table names the exact foreground and background tokens for every visible caption, label, badge, and line. `--border-1` is decorative except as the quieter ineligible-card frame, where the caption carries the state; `--scrim` and shadows are non-text overlays and carry no contrast requirement. Light green is the single primary accent: it is used for primary buttons, links, active toggles, usable-weapon text, health fill, focus/selection rings, and the carried badge fill; it never treats the artwork edge as a text or border surface (cards normally keep the fixed 1px `--border-2` frame plus 1px `--bg-0` inner separator — the ineligible state alone quiets the frame to 1px `--border-1`, because its caption carries the state; hover uses lift and shadow, and rings sit outside the mat). The carried badge is the single user-directed exception: a filled accent pill over the lower centre of the artwork, with `--accent-ink` text at 12.40:1; it is not a text or border treatment at the artwork edge.

**Normal text — threshold 4.5:1**

| Pair | Ratio | Result |
| --- | --- | --- |
| `--text-1` on `--bg-1` | 15.89:1 | pass |
| `--text-1` on `--surface-1` | 14.44:1 | pass |
| `--text-1` on `--surface-2` | 12.61:1 | pass |
| `--text-1` on `--surface-3` | 10.64:1 | pass |
| `--text-2` on `--bg-1` | 13.08:1 | pass |
| `--text-2` on `--surface-1` | 11.89:1 | pass |
| `--text-2` on `--surface-2` | 10.38:1 | pass |
| `--text-2` on `--surface-3` | 8.76:1 | pass |
| `--text-muted` on `--bg-1` | 8.75:1 | pass |
| `--text-muted` on `--surface-1` | 7.96:1 | pass |
| `--text-muted` on `--surface-2` | 6.94:1 | pass |
| `--text-muted` on `--surface-3` | 5.86:1 | pass |
| `--text-disabled` on `--surface-1` | 6.35:1 | pass |
| `--text-disabled` on `--surface-2` | 5.55:1 | pass (WCAG exempts disabled text; this stays readable on purpose) |
| `--accent` on `--bg-1` | 11.74:1 | pass |
| `--accent` on `--surface-1` | 10.67:1 | pass |
| `--accent` on `--surface-2` | 9.32:1 | pass |
| `--accent-hover` on `--bg-1` | 14.33:1 | pass |
| `--accent-hover` on `--surface-1` | 13.03:1 | pass |
| `--accent-hover` on `--surface-2` | 11.37:1 | pass |
| `--accent-ink` on `--accent` (primary button) | 12.40:1 | pass |
| `--accent-ink` on `--accent-hover` (hover/pressed) | 15.13:1 | pass |
| `--heal` on `--surface-2` | 8.47:1 | pass |
| `--damage` on `--surface-1` | 6.45:1 | pass |
| `--damage` on `--surface-2` | 5.63:1 | pass |
| `--damage` on `--surface-3` | 4.75:1 | pass |
| `--wasted` on `--surface-1` | 9.06:1 | pass |
| `--wasted` on `--surface-2` | 7.91:1 | pass |
| `--weapon-ok` on `--surface-1` | 10.67:1 | pass |
| `--weapon-ok` on `--surface-2` | 9.32:1 | pass |
| `--weapon-no` on `--surface-1` | 6.35:1 | pass |
| `--weapon-no` on `--surface-2` | 5.54:1 | pass |
| `--weapon-no` on `--surface-3` | 4.68:1 | pass |
| `--text-1` on `--bg-0` over the 10% light-green wash | 14.04:1 | pass |
| `--text-2` on `--bg-0` over the 10% light-green wash | 11.56:1 | pass |
| `--text-muted` on `--bg-0` over the 10% light-green wash | 7.74:1 | pass |
| `--accent` on `--bg-0` over the 10% light-green wash | 10.38:1 | pass |
| `--accent-hover` on `--bg-0` over the 10% light-green wash | 12.67:1 | pass |
| `--selection` on `--bg-0` over the 10% light-green wash | 10.38:1 | pass |
| `--damage` on `--bg-0` over the 10% light-green wash | 6.27:1 | pass |
| `--weapon-no` on `--bg-0` over the 10% light-green wash | 6.17:1 | pass |

**Large text and UI boundaries — threshold 3:1**

| Pair | Ratio | Result |
| --- | --- | --- |
| `--border-2` on `--bg-1` | 3.97:1 | pass |
| `--border-2` on `--surface-1` | 3.61:1 | pass |
| `--border-2` on `--surface-2` | 3.15:1 | pass |
| `--border-2` on `--bg-0` over the 10% light-green wash (outline buttons, card frames) | 3.51:1 | pass |
| `--border-2` on card paper (`--art-paper`) | 4.12:1 | pass (card frame vs. light art) |
| `--focus` on `--bg-1` | 15.41:1 | pass |
| `--focus` on `--surface-1` | 14.00:1 | pass |
| `--focus` on `--surface-2` | 12.22:1 | pass |
| `--focus` on `--surface-3` | 10.31:1 | pass |
| `--focus` on `--bg-0` over the 10% light-green wash | 13.62:1 | pass |
| `--selection` on `--bg-0` over the 10% light-green wash (selected card ring) | 10.38:1 | pass |
| `--health` on `--health-track` | 7.74:1 | pass |
| `--health` on `--surface-1` | 9.31:1 | pass |

**Deliberate non-uses.** These are measured so they are not applied by mistake:

| Pair | Ratio | Rule |
| --- | --- | --- |
| `--accent` on card art | 1.39:1 | Light green is never text or a border at the artwork edge in any state; the card frame is always `--border-2`, hover uses lift and shadow, and rings sit outside the mat. The carried badge is the sole exception: a filled accent pill over the lower centre of the art, its text measured as `--accent-ink` on `--accent` (12.40:1) |
| `--selection` on card art | 1.39:1 | Selection rings are drawn outside the artwork at a 6px offset, never inside the illustration |
| `--focus` on `--accent` | 1.31:1 | The focus ring is outside the control at a 2px offset, measured against the surrounding surface (10.31–15.41:1, or 13.62:1 over the wash); the offset exposes that surface as the gap |
| `--health-track` on `--surface-1` | 1.20:1 | The track is not the boundary; a 1px `--border-2` frame wraps the bar (3.61:1), and the fill-to-track ratio is 7.74:1 |
| `--border-1` on `--surface-1` | 1.65:1 | Decorative separators only; interactive boundaries always use `--border-2` |
| `--border-1` on `--bg-0` over the 10% light-green wash (ineligible-card frame) | 1.61:1 | The ineligible frame is intentionally quieter; the dimmed art and the "Not usable" caption carry the state, so this hairline is not an essential boundary |
| `--border-2` on `--surface-3` | 2.66:1 | Never an essential boundary against `--surface-3`; a pressed secondary button keeps its 1px `--border-2`, whose boundary is measured against the surrounding page or panel (3.15–3.97:1), and the fill change is a supplementary cue |

**Text, caption, and label assignments.** Each visible caption, label, badge, and line names its exact tokens; the ratio column refers to the tables above. Selection is carried by the ring and mat and announced in the accessible name; the carried state is carried by the badge and announced in the accessible name; ineligibility is carried by the caption.

| Element | Size token | Foreground | Background | Ratio |
| --- | --- | --- | --- | --- |
| Title wordmark | `--text-display` | `--accent-hover` | `--bg-0` (over the torchlight wash) | 12.67:1 |
| Title premise | `--text-body` | `--text-2` | `--bg-0` (over the wash) | 11.56:1 |
| Title ghost/secondary action label | `--text-label` | `--text-2` | `--bg-0` (over the wash) | 11.56:1 (hover `--text-1` on `--surface-2`, 12.61:1); 1px `--border-2` outline 3.51:1 |
| Primary button label | `--text-label` | `--accent-ink` | `--accent` | 12.40:1 (hover/pressed `--accent-ink` on `--accent-hover`, 15.13:1) |
| Secondary button label | `--text-label` | `--text-1` | `--surface-2` | 12.61:1 (pressed/hover `--text-1` on `--surface-3`, 10.64:1) |
| Ghost/icon button label | `--text-label` | `--text-2` | `--surface-1` | 11.89:1 (on `--bg-1`: 13.08:1) |
| Destructive button label | `--text-label` | `--damage` | `--surface-2` | 5.63:1 |
| Disabled button label | `--text-label` | `--text-disabled` | `--surface-2` | 5.55:1 (WCAG exempts disabled text; kept readable with a visible reason) |
| Tooltip text | `--text-small` | `--text-1` | `--surface-3` | 10.64:1 |
| Skip link (when focused) | `--text-label` | `--text-1` | `--surface-1` | 14.44:1 |
| Title footer | `--text-caption` | `--text-muted` | `--bg-0` (over the wash) | 7.74:1 |
| Header primary label/value | `--text-label` / `--text-card-value` | `--text-1` | `--surface-1` | 14.44:1 |
| Center room heading | `--text-h1` | `--text-1` | `--bg-0` (over the wash) | 14.04:1 |
| Rail/section headings (Weapon, Defeated monsters) | `--text-h3` | `--text-2` | `--bg-0` (over the wash) | 11.56:1 |
| Room hint line | `--text-small` | `--text-2` | `--bg-0` (over the wash) | 11.56:1 |
| Action-bar helper/disabled reason | `--text-small` | `--text-muted` | `--bg-1` | 8.75:1 |
| Action-bar seed label ("Seed: ") | `--text-caption` | `--text-muted` | `--bg-1` | 8.75:1 |
| Action-bar seed value (mono) | `--text-caption` | `--text-2` | `--bg-1` | 13.08:1 |
| Room-card caption (card type only, e.g. "Monster"; whole line) | `--text-small` | `--text-2` | `--bg-0` (over the wash) | 11.56:1 |
| Ineligible room-card caption ("Type · Not usable — <reason>") | `--text-small` | `--weapon-no` | `--bg-0` (over the wash) | 6.17:1 |
| Weapon caption (rail heading "Weapon 5") | `--text-h3` | `--text-2` | `--bg-0` (over the wash) | 11.56:1 |
| "Weapon usable" plain status text | `--text-label` | `--weapon-ok` | `--surface-1` | 10.67:1 |
| Empty weapon-slot caption ("No weapon") and barehanded hint | `--text-small` | `--text-muted` | `--bg-0` (over the wash) | 7.74:1 |
| Empty defeated-monsters caption ("No monsters defeated") | `--text-small` | `--text-2` | `--bg-0` (over the wash) | 11.56:1 |
| Carried badge text ("Carried") | `--text-caption` | `--accent-ink` | `--accent` | 12.40:1 (badge fill over the art; 1px `--accent` border decorative) |
| Header dungeon title ("Dungeon") | `--text-small` | `--text-1` | `--surface-1` | 14.44:1 |
| Header dungeon caption ("N cards") | `--text-small` | `--text-2` | `--surface-1` | 11.89:1 |
| Preview title | `--text-h3` | `--text-1` | `--surface-1` | 14.44:1 |
| Preview rules line | `--text-body` | `--text-2` | `--surface-1` | 11.89:1 |
| Feedback message | `--text-body` | `--text-1` | `--surface-2` | 12.61:1 |
| Dialog title | `--text-h2` | `--text-1` | `--surface-1` | 14.44:1 |
| Dialog body | `--text-body` | `--text-2` | `--surface-1` | 11.89:1 |
| Input label | `--text-label` | `--text-2` | `--surface-1` | 11.89:1 |
| Input text | `--text-body` | `--text-1` | `--surface-1` | 14.44:1 |
| Input placeholder | `--text-body` | `--text-muted` | `--surface-1` | 7.96:1 |
| Disabled input text | `--text-body` | `--text-disabled` | `--surface-1` | 6.35:1 |
| Input error text | `--text-small` | `--damage` | `--surface-1` | 6.45:1 |
| Table header | `--text-label` | `--text-2` | `--surface-2` | 10.38:1 |
| Table body | `--text-small` | `--text-1` | `--surface-1` | 14.44:1 |
| Result headline and score | `--text-h1` / `--text-score` | `--text-1` | `--bg-0` (over the wash) | 14.04:1 |
| Result labels | `--text-label` | `--text-2` | `--bg-0` (over the wash) | 11.56:1 |
| Result seed value (mono) | `--text-card-meta` | `--text-muted` | `--bg-0` (over the wash) | 7.74:1 |
| Result rules value | `--text-body` | `--text-2` | `--bg-0` (over the wash) | 11.56:1 |
| Replay field | `--text-small` | `--text-1` | `--surface-1` | 14.44:1 |

**Card caption and badge.** A card's visible caption is one line under the card showing only the capitalized card type ("Monster", "Weapon", or "Potion") and, when the card cannot be resolved, the "Not usable — <reason>" fragment, joined by " · " in English or "，" in Chinese; there are no selected, carried, or positional fragments. The caption uses `--text-small` in `--text-2` over the wash (11.56:1) as a single colour; the ineligible state switches the whole caption to `--weapon-no` over the wash (6.17:1). Selected state is shown by the ring and mat only. Carried state is shown by a "Carried" badge inside the card frame at bottom-centre: 12px/700 text in `--accent-ink` on the `--accent` fill (12.40:1), with a decorative 1px `--accent` border, over the lower artwork and clear of the printed rank/suit. The visible caption is an exact prefix of the card's accessible name, which appends the card name and any "Carried"/"Selected" state words (§5); badge text is also present in that name. Examples: "Monster", "Weapon · Not usable — <reason>", and "怪物".


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

- **Radii:** `--radius-1` 4px (decorative data chips; never a state chip on a card), `--radius-2` 8px (buttons, inputs, tooltips), `--radius-3` 12px (cards, panels, dialogs), `--radius-4` 16px (bottom sheets), `--radius-pill` 999px (pills, bars).
- **Border widths:** `--border-hairline` 1px structure; `--border-strong` 2px selected/focused containers and essential frames (not the focus ring itself); `--border-accent` 3px banner leading edge.
- **Elevation:** `--shadow-1` `0 1px 2px rgb(0 0 0 / 45%)` (default cards); `--shadow-2` `0 8px 24px rgb(0 0 0 / 45%)` (hover/selected card, sticky action bar); `--shadow-3` `0 24px 64px rgb(0 0 0 / 55%)` (dialogs, help, tooltips); `--shadow-pressed` `inset 0 2px 0 rgb(0 0 0 / 35%)`; `--shadow-focus-halo` `0 0 0 4px rgb(223 245 196 / 22%)` as optional decoration only.
- **Focus-ring geometry (all components — buttons, cards, inputs, links):** `outline: 2px solid var(--focus); outline-offset: 2px;` with the ring radius following the target (minimum 4px). The 2px offset exposes the surrounding surface as the gap; no extra gap token is used. The ring is never removed in any state; hover, selected, and disabled styles keep it visible. The tightest ring-to-surface ratio in this guide is 10.31:1 (`--focus` on `--surface-3`); the other listed surfaces are 12.22–15.41:1, and the ring is 13.62:1 over the page light-green wash. Any scroll container or grid gives focusable children at least 8px of padding so the selected-card ring (6px offset plus 2px stroke) and the focus ring are not clipped. In forced-colors mode, use `outline: 2px solid CanvasText` and let the system palette replace the custom colors.
- **Card geometry:** every card is exactly 2:3, matching the 1024×1536 source PNGs. Wide layouts use `clamp(160px, 14vw, 200px)` width; medium `clamp(140px, 30vw, 180px)`; compact 2×2 `min(40vw, 168px)` but never below 132px. Cards are `aspect-ratio: 2 / 3`, `object-fit: cover`, 12px radius, and always on a `--bg-0` mat at rest; the selected state raises the mat to `--surface-3` (§5). The edge treatment is fixed in every state except the ineligible state: a 1px `--border-2` frame plus a 1px `--bg-0` inner separator between the frame and the artwork (`box-shadow: inset 0 0 0 1px var(--bg-0)`), with `--shadow-1` at rest and `--shadow-2` on hover/selection. The ineligible state alone quiets the frame to 1px `--border-1` (§5 and the non-use table), with its caption carrying the state. The light-green accent never touches the artwork edge in any state; hover is lift plus shadow; the selected ring uses a 2px `--selection` outline at a 6px offset outside the mat, and the focus ring uses the 2px `--focus` geometry above at 2px offset. When a selected card is also focused, both rings remain visible and distinct. State treatment: the caption shows the card type and any "Not usable — <reason>" reason; selection is the 2px ring outside the mat plus the `--surface-3` mat; carried state is the "Carried" badge inside the frame at bottom-centre (the single badge over the artwork, clear of the top-left rank/suit, 12.40:1); the accessible name carries the "Carried" and "Selected" words (§5). Use explicit `width`/`height` attributes or the aspect ratio to reserve space and prevent layout shift.
- **Card safe area:** the printed rank and suit occupy the top-left corner of the illustration; do not crop or overlay the top-left 28%×30% region, and place no chip or badge over the art except the carried badge at the bottom-centre of the frame (the single user-directed exception, clear of the rank/suit region). Below 132px width, switch to metadata rows instead of shrinking the card.

### 5. Component states

**Buttons.** Primary (light-green accent fill, `--accent-ink` label, 44px minimum height, 48px on desktop, 20px horizontal padding, `--radius-2`, `--text-label`):

- Default: `--accent` fill, 1px `--accent-hover` outline, `--shadow-1`; label 12.40:1.
- Hover (only when `hover: hover` and `pointer: fine`): `--accent-hover` fill, `--shadow-2`, 120ms; no size change; label 15.13:1.
- Pressed: `--accent-hover` fill, `translateY(1px)`, `--shadow-pressed`; label 15.13:1.
- Focus-visible: 2px `--focus` ring, 2px offset on the surrounding surface (10.31–15.41:1 across the surfaces above; 13.62:1 over the wash); never removed.
- Disabled: flat `--surface-2` fill, `--text-disabled` label (5.55:1), 1px `--border-1`; `aria-disabled="true"` and still focusable so the reason is reachable; a visible reason or tooltip explains it ("No weapon to use", "The room is still unresolved"); no hover or press response.
- Secondary: `--surface-2` fill, `--text-1` (12.61:1), 1px `--border-2`; hover `--surface-3` with `--border-2`; pressed `--surface-3` with `--shadow-pressed`. Ghost/icon-only: transparent fill, `--text-2` or `--text-muted` label, 44×44 hit area for a 24px icon, required `aria-label`, visible tooltip, hover `--surface-2`.
- Destructive (confirm discarding a run): `--surface-2` fill, `--damage` label (5.63:1), 1px `--damage` border; the word is explicit ("Discard run"), never an icon alone.
- Loading: keep the label, add `aria-busy="true"` and static "Loading…" text; never a spinner-only state.

Focus-visible, disabled, and loading rules apply to every button role, and hover/pressed use each role's fill pair above; no button changes size between states.

**Cards.** Every interactive card is a button with a ≥44×44 hit area and an accessible name formed from the visible caption verbatim, then the card identity: `a11y.cardLabel` = "{caption}, {cardName}" in English and "{caption}，{cardName}" in Chinese, then any state words appended in a fixed order: "Carried" before "Selected" (for example "Monster, Ace of spades · Selected" and "Potion, Seven of hearts · Carried"). This satisfies WCAG 2.5.3 Label in Name because the visible caption (including the badge text "Carried") is an exact prefix; there is no duplicate kind suffix. The visible caption itself shows only the card type plus any ineligible reason; selection is the ring and mat only, and carried state is the badge inside the frame (§3).

| State | Treatment | Non-color cue |
| --- | --- | --- |
| Default | Art on `--bg-0` mat, 1px `--border-2` frame plus 1px `--bg-0` inner separator, 12px radius, `--shadow-1` | Caption under the card: the card type only, e.g. "Monster" (whole caption line in `--text-small` `--text-2`, 11.56:1 over the wash) |
| Hover | Lift 2px, frame stays 1px `--border-2` plus `--bg-0` separator, `--shadow-2`, 120ms; pointer only; no light green at the art edge | Same caption; no state change on hover |
| Focus-visible | 2px `--focus` ring outside the mat at 2px offset (same geometry as buttons and inputs); grid padding ≥8px | Ring plus the focused card's caption and preview |
| Selected | 2px `--selection` ring outside the mat at 6px offset, `--surface-3` mat, no transform; `aria-pressed="true"`; caption unchanged; the accessible name appends "Selected"; preview updates. When also focused, both rings remain visible and distinct | Ring, mat, preview heading, and the announced state word |
| Ineligible | No lift; art `grayscale(0.55) brightness(0.82)`; frame quiets to 1px `--border-1` (the caption is essential, the hairline decorative); `aria-disabled="true"` but still focusable for help/selection; caption "Type · Not usable — <reason>" (`--weapon-no` over the wash, 6.17:1); action buttons disabled with a reason | Caption text and dimmed art; printed rank remains legible (verified in the visual review) |
| Carried | 1px `--border-2` frame plus `--bg-0` separator; a "Carried" badge inside the frame at bottom-centre (`--text-caption` 700, `--accent-ink` on `--accent`, 12.40:1, decorative 1px `--accent` border, clear of the top-left rank/suit); caption unchanged; the accessible name appends "Carried" | Badge text plus the announced state word |
| Defeated-monster thumbnail | Non-interactive thumbnail 96px wide with the standard 1px `--border-2` frame plus 1px `--bg-0` separator (no hover lift); each card is overlapped by the next with a −52px margin so a 44px strip exposes its rank and suit; newest on top/right; the rail renders the thumbnails that fit the measured width and adds no count or overflow text; thumbnails are `aria-hidden` and the section exposes a visually-hidden name list under the "Defeated monsters" heading (empty state: "No monsters defeated"); never overflow or clip the rail | Heading and screen-reader name list, not overlap alone |
| Empty weapon slot | 2:3 dashed `--border-1` outline, `--text-muted` "No weapon", hint "You fight barehanded" | Text |

**Feedback banners.** Variants: info (`--border-2` edge), success (`--heal`), warning (`--wasted`), danger (`--damage`). `--surface-2` fill, 3px left edge, 24px icon, `--text-1` message (12.61:1), optional action, `--radius-2`, max width 480px, stacked above the action bar. Banners are visual mirrors only: they carry no live-region roles themselves, and the §7 polite and assertive regions announce the same strings once. Errors persist until dismissed; success may auto-dismiss after 6s, but the §7 polite region announces the outcome once, and no persistent visible outcome line is rendered on the play screen. Dismiss button 44×44 with an accessible name. Message text carries the meaning: "Potion restored 5 health. Health 13 / 20." / "Potion wasted — health is already 20 / 20." / "Weapon discarded (7). Weapon is now 9."

**Dialogs and help.** `--surface-1` panel, 1px `--border-2`, 12px radius, `--shadow-3`, 24px padding; scrim `--scrim`; `--text-h2` title; body `--text-2` (11.89:1); 44×44 close button top-right; actions right-aligned with secondary before primary. Help is max 560px wide and includes rules summary, card meanings, the weapon chain, and run-away restrictions as text. Modal behavior: `aria-modal="true"`, labelled title, focus trap, Esc closes, focus returns to the trigger. Compact screens use a bottom sheet with the same tokens and a 44px close button, with safe-area padding. The compact selected-card preview is that sheet: it has a 44×44 "Close preview" button and no separate dismiss action; Escape, re-clicking the card, choosing another card, or the close button clears the selection.

**Inputs.** Visible label `--text-label` `--text-2`; 48px height (44px minimum); `--surface-1` fill, 1px `--border-2`, 8px radius; 16px `--text-1` text (prevents iOS zoom); placeholder `--text-muted` (7.96:1); helper text `--text-muted`; focus ring as above. Error: 1px `--damage` border, icon, `--damage` message (6.45:1), `aria-invalid="true"` and `aria-describedby`. Disabled fields use `--text-disabled` plus a visible reason. The replay-link field uses mono, is read-only, selects its text on focus, and has a 44×44 copy button with an announced result.

**Statistics tables.** Panel `--surface-1` with 1px `--border-2`, 12px radius; header row `--surface-2`, `--text-2` `--text-label`, bottom 2px `--border-2`; body rows `--text-1`, 1px `--border-1` separators, hover `--surface-2`; numeric cells right-aligned with tabular figures; sortable headers are buttons with a 24×24 minimum target (44×44 preferred), `aria-sort`, and the focus ring; row hover or striping is never the only cue. Compact screens wrap the table in a focusable, labelled scroll region (`role="region"`, `tabindex="0"`) rather than shrinking text; score and seed values are never truncated.

### 6. Title, play, and result composition

Breakpoints: compact below 768px, medium 768–1199px, wide 1200px and up. Content max width 1440px; gutters 16px / 24px / 32px.

**Title screen.** Full-viewport `--bg-0` with the static torchlight wash (§3); a decorative `aria-hidden="true"` fan of three current card PNGs at ≤20% opacity, kept outside the 720px text column or covered by a `--bg-0` scrim wherever it passes behind text, so the measured page-background pairs stay valid (or use a plain vignette if art loading is a concern); centered content column, max 720px. Wordmark `--text-display` in `--accent-hover` over the wash (12.67:1); one-line premise `--text-body` in `--text-2` over the wash (11.56:1); stacked actions: primary "New run", secondary "Continue" when a save exists, ghost "Rules and help" and ghost "Language: English / 简体中文" (`aria-pressed` state) with 1px `--border-2` outline over the wash (3.51:1) and `--text-2` label (11.56:1; hover `--text-1` on `--surface-2`, 12.61:1); all labels `--text-label` and 44px minimum. The custom-seed field stays collapsed under "Custom seed" until expanded. Footer holds build/version in `--text-caption` in `--text-muted` over the wash (7.74:1). No autoplaying sound; at most one 200ms fade.

**Play screen — wide.** Page ground `--bg-0` with the static torchlight wash; header (64px, `--surface-1`, 1px bottom `--border-2`): left, the health cluster in one row — label "Health 13 / 20" (`--text-label` and `--text-card-value` in `--text-1` on `--surface-1`, 14.44:1) immediately followed by a wider 12px bar (200px track on wide/medium; `flex: 0 0 200px`) with a 1px `--border-2` frame, `--health` fill on `--health-track` (fill-to-track 7.74:1; frame 3.61:1), exposed as `role="progressbar"` with `aria-valuetext`, and then the inline dungeon status — visible "Dungeon" (`--text-1`, 14.44:1) and "N cards" (`--text-2`, 11.89:1) on `--surface-1` — wrapped in a single `role="img"` labelled "Dungeon, N cards". The header carries no other readouts and no Help button; the play screen exposes no Help entry point (Help opens from the title screen). Main grid `minmax(180px, 240px) minmax(0, 1fr)` with 24px gaps:

- Left rail: weapon slot (card plus a "Weapon 5" heading in `--text-h3` `--text-2` over the wash, 11.56:1; or the empty slot) and the "Defeated monsters" section (heading in `--text-h3` `--text-2` over the wash, 11.56:1; newest on top/right; 96px-wide thumbnails overlapped by 52px so a 44px strip with rank and suit stays exposed; no count or overflow line is rendered; a visually-hidden name list carries the state for assistive technology; the empty state says "No monsters defeated").
- Center: room heading (display serif, `--text-h1`, `--text-1` over the wash, 14.04:1) with the room hint line (`--text-small`, `--text-2`, 11.56:1); four card buttons in one row (or 2×2 when the center is narrower than 680px), each with a caption line showing only the card type as defined in §3 (whole line in `--text-small` `--text-2` over the wash, 11.56:1; e.g. "Monster", "Weapon"; ineligible cards show "Type · Not usable — <reason>" in `--weapon-no`, 6.17:1), a carried "Carried" badge inside the frame, and no selected text (selection is the ring and mat only); the selected card's preview sits beside it and contains the room-actions panel beneath the card choices — for monsters the title is the matchup "Monster 5 vs. Weapon 4" or "Monster 14 vs. barehanded"; for weapons and potions the unchanged "{cardName} — weapon" / "{cardName} — potion" titles — the plain `--weapon-ok` "Weapon usable" status (10.67:1 on `--surface-1`), the rules line, and both choices together: eligible confirm buttons "Use weapon (-N HP)" and "Fight barehanded (-N HP)", with a plain disabled "Use weapon" and the barehanded choice when the weapon is ineligible; no dismiss button is shown — Escape, clicking the selected card again, choosing another card, or the compact sheet close clears the selection; selection is announced in the polite live region.
The seed sits inside the action bar as its bottom-right corner: mono `--text-caption` text on `--bg-1`, the visible label "Seed: " in `--text-muted` (8.75:1) and the value in `--text-2` (13.08:1), with the accessible name "Run seed <seed>". It is not a live region and shows no status message.

Room-actions section (inside the selected-card panel, separated by a 1px `--border-1` rule; not sticky or fixed): primary "Enter next room" (44px; disabled with reason until the room resolves), secondary "Run away" (44px; disabled with reason when the rules forbid it), ghost "Undo" (44×44); the right column stacks the helper/disabled-reason line in `--text-small` `--text-muted` on the panel surface (8.75:1 against `--bg-1`) above the seed, putting the seed in the panel's bottom-right corner; order follows rule order, not color order. No in-run score is shown during play: the score is defined only by the outcome (surviving health on a win, remaining monsters on a loss), so the result screen owns it.

**Play screen — compact.** Single column. Sticky compact header: health label and a 160px bar in one row followed by the inline dungeon status ("Dungeon" + "N cards"), wrapping onto a second line when needed; there is no header Help button and no other readout. The room grid becomes 2×2 with cards at least 132px wide, type-only captions kept visible, and the carried badge inside the frame. The weapon slot and "Defeated monsters" section become a labelled two-up row above the actions, horizontally scrollable with a visible scroll affordance (never a hidden carousel); the rail renders the thumbnails that fit, with no count or overflow line. The selected-card preview is a bottom sheet at the viewport bottom with the matchup title, both choices, and a 44×44 "Close preview" button; Escape, re-clicking the card, choosing another card, or the close button clears it. The room-actions panel sits in normal flow after the room grid (the compact preview is a sheet, so the room actions are not duplicated inside it); its seed sits in the bottom-right corner with the visible "Seed: " prefix, and the panel respects `env(safe-area-inset-bottom)`; no information depends on hover; the play screen has no Help entry point, and the full help dialog opens from the title screen's "Rules and help" control.

**Play screen — medium.** Two columns: the weapon/kill rail plus the center room in 2×2; the same inline dungeon status sits in the header beside the health cluster; the rail uses the same fit-based thumbnail set as the wide layout, with no count line.

**Result screen.** Centered panel max 640px on `--bg-0` over the wash; outcome heading `--text-h1` with an icon and text ("You survived" / "You fell" — text, not color alone), and the score `--text-score` with sign and label, both in `--text-1` over the wash (14.04:1), with supporting labels in `--text-2` over the wash (11.56:1); a breakdown table (surviving health or remaining monsters, potion used/wasted, cards defeated) using the §5 table styling; seed and rules values as plain text (mono for the seed); replay-link row (read-only mono field, 44×44 "Copy link", result announced); actions in order: primary "New run", secondary "Back to title", ghost "View statistics". The result summary is announced once in the polite status region and focus moves to the result heading. Statistics and settings screens are step 2 of the [design handoff sequence](#design-handoff-sequence); this guide only fixes their typography, table, and dialog language.

**Touch targets.** Primary card and action controls are at least 44×44 CSS px ([REQ-016](prd.md#req-016)). Every other control is at least 24×24 with at least 8px between adjacent targets, and aimed at 44×44; hit areas are measured on the interactive box, not the icon. Inline text links (help, replay link) get a 24px minimum height and 8px separation. No adjacent targets closer than 8px, and the room-actions panel respects the bottom safe area.

### 7. Feedback, motion, and announcements

Durations: `--motion-1` 120ms (hover, press, focus), `--motion-2` 200ms (panels, preview, banners), `--motion-3` 280ms (result reveal, room deal); exits 160ms. Easing `cubic-bezier(0.2, 0.6, 0.2, 1)` for enters, ease-out for exits. Animate opacity and transform only, never layout; no more than three flashes in any one second; no autoplay sound.

**Reduced motion.** Honor `prefers-reduced-motion: reduce` and an in-app "Reduce motion" preference stored with the other preferences. In that mode: no card lift, deal, stack, slide, parallax, or particle animation; transitions become instant or at most a 120ms opacity change; focus and selection rings appear instantly; background effects stay static. Motion never carries essential state in either mode.

**Screen-reader rules.** One polite live region after the header for action outcomes (health, damage, potion, weapon, escape, undo, room state) and one assertive alert region for invalid actions. There is no separate visible outcome line on the play screen; the polite live region is the single announcement of each outcome, so nothing is announced twice. Announce concise sentences with numbers ("Used weapon 5 on 8 of clubs; health 13 of 20"), and never re-announce the whole board on every change. After a room is dealt, focus moves to the first card (or the room heading in compact view); after "Enter next room", focus returns to that button if the room resolves; after undo, focus returns to the restored selection. Decorative art is `aria-hidden`; the weapon and defeated-monster rail have text equivalents (the defeated-monster thumbnails are `aria-hidden` with a visually-hidden name list); the health bar has `aria-valuetext`.

**Focus order.** The DOM order is header → weapon/defeated-monster rail → room cards → selected-card preview → action bar; the wide grid places the weapon rail visually left of the room, so Tab order and reading order stay logical. Tab sequence: skip link "Skip to room" → header health and dungeon status → room cards in document order (roving tabindex; arrow keys move within the grid, Home/End to the ends) → selected-card preview choices → action bar (Enter next room, Run away, Undo); the weapon/defeated-monster rail is presentation only, with its name list in reading order. Dialogs temporarily trap focus; there are no other keyboard traps. Tab and Shift+Tab traverse each control group once — the card grid is a single tab stop, and arrow keys move within it — so every action is reachable by following this order; Enter or Space activates the focused control, and Esc dismisses applicable overlays. No function is keyboard-only and no shortcut is required. Visible focus is present in every state, including hover and selected.

**Help without hover.** Contextual help opens on focus, on tap, and on hover; it closes with Esc or blur and is wired with `aria-describedby`. Help text is also available in the full help dialog and is never conveyed by hover alone ([Contextual learning](#contextual-learning), [REQ-017](prd.md#req-017)).

### 8. Content and internationalization

Tone, English: terse, second person, sentence case, verb-led, no exclamation marks, no filler. Tone, Simplified Chinese: concise standard Mandarin with the same information, not a literal translation; full-width punctuation; no exclamation marks. Use the glossary below for consistent terms (draft, pending translation review).

| English | zh-Hans |
| --- | --- |
| Health | 生命值 |
| Weapon | 武器 |
| Barehanded | 徒手 |
| Potion | 药水 |
| Wasted | 浪费 |
| Dungeon | 地牢 |
| Room | 房间 |
| Defeated monsters | 已击败的怪物 |
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

**Approved as revised on 2026-11-06.** The user approved the dark green direction from a throw-away review page and then approved this revised written guide with the D1–D4 values below as recorded (D2–D4 unchanged from the 2026-11-01 approval; D1 revised to the light-green accent). The approval is recorded in [Design approval status](#design-approval-status); changes require a new recorded approval.

**D1. Primary accent — light green (approved 2026-11-06).** `--accent #A9E08A`, `--accent-hover #C8F2AB`, `--accent-ink #07130A`, and `--selection #A9E08A`. Evidence: accent text 10.67:1 on `--surface-1` and 9.32:1 on `--surface-2`; ink on accent 12.40:1, on hover 15.13:1. Light green is the single primary accent and stays away from the card art: it is never text or a border at the artwork edge, with the carried badge as the sole user-directed exception (§3 non-uses). The 2026-11-01 warm antique-brass values (`--gold #C9A15A`, `--gold-bright #E3BE7C`, `--gold-ink #1A1204`, `--selection #E3BE7C`) are superseded and retained only as this historical record; they are not live tokens and must not be reintroduced.

**D2. Display typography — system display serif stack (approved 2026-11-01).** `"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Noto Serif SC", "Source Han Serif SC", "Songti SC", SimSun, serif` for the wordmark, screen titles, room and section headings, dialog titles, and the result headline, in normal case with no all-caps or uppercase letter-spacing; the UI sans stack covers body, data, labels, and buttons; mono covers the seed, replay link, and tabular figures (§2). The all-sans and self-hosted-display alternatives were dropped by the approved direction; a self-hosted display face remains a possible later enhancement, not part of this guide.

**D3. Card framing — dark mat treatment (approved 2026-11-01; light-green wording updated 2026-11-06).** Art on a `--bg-0` mat with a 1px `--border-2` frame, a 1px `--bg-0` inner separator, and `--shadow-1` (the ineligible state is the sole exception: its frame quiets to 1px `--border-1` and the caption carries the state); hover lifts 2px and adds `--shadow-2`; the selected state uses a 2px `--selection` ring at a 6px offset outside the mat with a `--surface-3` mat; focus uses the 2px `--focus` ring at a 2px offset; light green never touches the artwork edge (the carried badge is the sole exception), selection is the ring plus mat, and the caption, badge, and accessible name carry state (§4, §5). The borderless-art and heavy-board-game-frame alternatives were dropped by the approved direction: borderless rings would sit on the art at 1.39:1, and the heavy frame over-decorates a four-up grid.

**D4. Compact room layout — 2×2 card grid (approved 2026-11-01).** Below 768px, all four cards stay visible in a 2×2 grid at ≥132px wide with caption lines under each card; the horizontal-scrolling row and stacked-list alternatives were dropped by the approved direction because they hide cards or push play below the first view (§6).

**Approval record.** The user approved this written style guide as the dark green revision on 2026-11-06, including D1 revised to the light-green accent and the D2–D4 values recorded above (D2–D4 unchanged from the 2026-11-01 approval). The 2026-11-01 warm leather approval is superseded. Scope: typography, color tokens, spacing, component states, and the title/play/result compositions. Independent checks on earlier revisions found and resolved issues before passing (task-14 returned NOT SAFE with two majors, fixed before its targeted task-16 re-check passed clean; task-18 passed with minor documentation residuals, addressed in task-19 and confirmed clean in task-20); the green revision's recomputed contrast evidence is ready for independent review (task-45). Changes to this guide require a new recorded approval in [Design approval status](#design-approval-status). This approval does not authorize deployment, merging into main, or opening PRs; those remain separate decisions.

**Not covered by this guide (later steps):** final copy strings and translation review; a commissioned card-back illustration (none exists; the play screen no longer renders a dungeon pile); any later self-hosted display face; sound and haptics; and the statistics/settings visual layer, which follows step 2 of the [design handoff sequence](#design-handoff-sequence) after approval.

## Design handoff sequence

Use this sequence for design handoff:

1. Establish the style guide, title screen, and play screen. Review these against [DEC-001](prd.md#dec-001), [REQ-001](prd.md#req-001), and [REQ-003](prd.md#req-003) through [REQ-008](prd.md#req-008), including the access needs in [REQ-016](prd.md#req-016) and [REQ-017](prd.md#req-017). Record the style-guide approval in the section above.
2. Once the style guide is approved and recorded in the section above, extend that visual language to statistics, settings, and the result scorecard. Review against [REQ-009](prd.md#req-009), [REQ-011](prd.md#req-011), [REQ-012](prd.md#req-012), [REQ-013](prd.md#req-013), and [REQ-014](prd.md#req-014). **Completed 2026-11-02.**

### Design handoff status

- **Step 1 — style guide, title screen, and play screen:** reviewed and approved on 2026-11-01; the approval is recorded in [Design approval status](#design-approval-status).
- **Step 2 — statistics, settings, and result scorecard:** reviewed and completed on 2026-11-02 after the Phase 4b UI landed. The review covered the extension of the approved visual language to those screens against [REQ-009](prd.md#req-009), [REQ-011](prd.md#req-011), [REQ-012](prd.md#req-012), [REQ-013](prd.md#req-013), and [REQ-014](prd.md#req-014). Evidence came from an independent product/design review and an independent QA visual and accessibility review; their findings were fixed in commit `454c4cd6`. Verification screenshots were captured in the ignored `.artifacts/phase4b-design/` and `.artifacts/phase5/screens/` directories.

This record completes the design handoff sequence. It is not a new approval gate and does not re-approve the written style guide: the guide's current approval is the 2026-11-06 dark green revision recorded in [Design approval status](#design-approval-status), and any change to it, its tokens, or its typography still requires a new recorded approval.

One accepted deviation is recorded. The result breakdown shows "Potions wasted" because the engine tracks wasted potions only; the approved guide's illustrative "potion used/wasted" wording stays illustration and does not require a used-potions count. No rules, tokens, or typography change.

Use the PRD's [product acceptance checks](prd.md#product-acceptance) for the final product review rather than keeping a separate feature checklist here.
