extends Node
## FX director — Phase 2 form (godot-plan.md, "Scene and effects").
##
## Owns motion policy and arrival presentation for reconciled room cards:
## instant placement by default, a quiet opacity fade of at most 120ms under
## the reduced-motion policy (the plan's reduced-motion floor: "static
## reconciliation or a quiet fade of at most 120ms"). The policy arrives via
## `policy` messages (OS media-query flips) and per-sync projection values.
## Phase 3 grows this into the full beat language (deal/flip/resolve/sweep/
## undo) with the motion tokens mirrored from src/ui/motion.ts; every future
## tween must END on the authoritative rect.

const REDUCED_FADE_MS := 120.0

## Current motion policy (policy messages override the per-sync value until
## the next sync arrives).
var _reduced_motion := false

## Called by the board scene on `policy` messages.
func set_policy(reduced_motion: bool) -> void:
	_reduced_motion = reduced_motion

## Called by the board scene for every newly reconciled card.
func on_card_appeared(sprite: Node2D, reduced_motion: bool) -> void:
	if not reduced_motion:
		return # instant placement — no entrance beat in Phase 2
	sprite.modulate.a = 0.0
	var tween := sprite.create_tween()
	tween.tween_property(sprite, "modulate:a", 1.0, REDUCED_FADE_MS)
