# Screen mockups

Status: the user approved the visual direction of the desktop and mobile title/play-screen mockups on November 1, 2026. This approval covers the visual direction and layouts, not every future state or implementation behavior. The HTML files are static design documents with no scripts, routing, persistence, or game behavior. No application dependencies were added.

## Direction

Make Scoundrel feel like a quiet, dangerous card table.
Design for solo players who want a quick start and readable tactical decisions.
Use dark slate, warm paper, and a restrained green action accent.
Let the illustrated physical cards be the memorable feature.
Mode: operate during play; invite exploration on the title screen.

## Review the screens

| Screen | Desktop | Mobile | Static layout |
| --- | --- | --- | --- |
| Title | [1440px](title-desktop.png) | [390px](title-mobile.png) | [Title document](title.html) |
| Play | [1440px](play-desktop.png) | [390px](play-mobile.png) | [Play document](play.html) |

Open the PNGs for a direct visual review. Open the HTML documents in a browser to inspect responsive layout and keyboard focus. Buttons and links do not perform game actions.

## Design tokens

| Token | Choice |
| --- | --- |
| Display type | Baskerville, with Georgia as fallback |
| Body type | Arial, with a sans-serif fallback |
| Type scale | 16, 18, 24, 32, 48, 80px |
| Colors | Coal `#12191a`, table `#1c2525`, paper `#f4ecdc`, muted `#b9c2b8`, action `#d5e69b`, damage `#d6877a` |
| Spacing | 8px base, with 4px refinements |
| Corners | 4px controls, 8px cards |
| Shadow | One hard-edged dark table shadow beneath physical cards |

## Represented states

- Title shows a returning player with a saved run. Without a save, remove Continue and its saved-run details; New Run becomes the primary action. New Run's note makes the replacement consequence visible without adding confirmation.
- Play shows room 5 at its start: 14 health, 28 cards in the draw pile, weapon 5, last kill 10, and an 8 monster selected. The weapon is legal and would deal 3 damage. Barehanded would deal 8. Previews do not count as resolution, so escape is available. Undo is disabled until the room changes.
- A carried card is labeled in the room. The equipped weapon sits left of its defeated-monster stack; the last kill is visible. Only current `assets/` illustrations are used.
- Focus, hover, selection, and disabled control treatments are included in the static styles. Empty-save behavior is described above. Loading, invalid-seed, storage-error, result, and translated layouts remain future design work; these two mockups do not claim coverage of all application states.

## Review questions

1. Does the visual direction suit the card artwork?
2. Is the selected card, damage preview, and confirm action obvious?
3. Is the mobile arrangement readable enough, with four room cards above the action preview?

Supports [REQ-001](../prd.md#req-001), [REQ-003](../prd.md#req-003), [REQ-004](../prd.md#req-004), [REQ-005](../prd.md#req-005), [REQ-007](../prd.md#req-007), [REQ-008](../prd.md#req-008), [REQ-016](../prd.md#req-016), [REQ-017](../prd.md#req-017), and [DEC-001](../prd.md#dec-001).
