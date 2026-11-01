# Scoundrel design plan

The [PRD](prd.md) owns product goals, requirements, scope, and acceptance outcomes, as defined by [INFO-002](prd.md#info-002). This plan records presentation choices and the design handoff sequence. Requirement changes belong in the PRD; default gameplay changes belong in the [game rules](rules.md).

## Visual treatment

Supports [DEC-001](prd.md#dec-001) and [REQ-016](prd.md#req-016).

Use crisp typography, depth, shadow, and high contrast to give the interface a mysterious, adventurous atmosphere. Keep labels and controls distinct from decorative artwork so the dark theme remains readable.

## Card table and feedback

Supports [REQ-003](prd.md#req-003), [REQ-004](prd.md#req-004), [REQ-005](prd.md#req-005), and [REQ-006](prd.md#req-006).

- Place the weapon card on the left and its defeated-monster stack on the right. Render defeated monsters as physical cards, with the most recently defeated monster on top.
- Mark the carried card with a tint or badge so players can recognize it after the next deal.
- Use a selection highlight and a nearby action preview before confirmation. Present weapon and barehanded choices together when both are available.
- Give weapon swaps visible discard feedback. Distinguish healing feedback from a consumed potion that restores no health.

## Contextual learning

Supports [REQ-007](prd.md#req-007), [REQ-015](prd.md#req-015), and [REQ-017](prd.md#req-017).

Use contextual tooltips for card meanings, the weapon's degradation chain, and run-away restrictions. Put explanations beside the relevant card or action. Make the same explanations available on focus and touch rather than relying on hover alone.

## Design handoff sequence

The original design sequence remains the basis for handoff:

1. Establish the style guide, title screen, and play screen. Review these against [DEC-001](prd.md#dec-001), [REQ-001](prd.md#req-001), and [REQ-003](prd.md#req-003) through [REQ-008](prd.md#req-008), including the access needs in [REQ-016](prd.md#req-016) and [REQ-017](prd.md#req-017).
2. Once the style guide is approved, extend that visual language to statistics, settings, and the result scorecard. Review against [REQ-009](prd.md#req-009), [REQ-011](prd.md#req-011), [REQ-012](prd.md#req-012), [REQ-013](prd.md#req-013), and [REQ-014](prd.md#req-014).

Use the PRD's [product acceptance checks](prd.md#product-acceptance) for the final product review rather than keeping a separate feature checklist here.
