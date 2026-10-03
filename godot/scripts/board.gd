extends Node2D
## The board scene (godot-plan.md, "Scene and effects" — Phase 2 form).
##
## Keyed reconciliation against the latest host envelope, static style:
## sprites are created/removed/repositioned to the authoritative TypeScript
## rects; arrival fades are the fx-director's job. Phase 2 ordering rules:
##
## - `runGeneration` change → EVERY sprite is dropped and rebuilt (a run
##   replacement cancels all old effects even if the seed matches).
## - `layoutRevision` change → every sprite re-applies its rect.
## - Room-identical syncs (selection-only, repeated selection) re-apply
##   selection emphasis and never restart anything.
## - After each applied revision renders one frame, the scene acknowledges it
##   (`applied`) and reports quiescence (`settled`) — static Phase 2 boards
##   settle with every applied; Phase 3 choreography will defer it.
## - With the envelope's diagnostics flag on, rendered sprite bounds are
##   reported per applied revision (sprite-parity e2e input).
##
## Presentation-only boundary (plan rule): no gameplay, no storage, no clocks,
## no input handlers, no text. State diffs decide existence; the projection is
## already validated by WebBridge.

const CARD_SPRITE_SCENE := preload("res://scenes/card-sprite.tscn")

@onready var _fx: Node = $FxDirector

var _sprites: Dictionary = {} # cardId (String) -> CardSprite
var _rects: Dictionary = {} # cardId (String) -> Rect2 (applied; diagnostics input)
var _session_id := ""
## Newest received sync (revision + ordering + projection); host sends are
## latest-wins, so only the newest entry ever matters.
var _latest: Dictionary = {}
## Ordering state actually RENDERED (applied vs acked are tracked separately:
## a sync landing during the render-frame wait must still be rendered —
## acking a revision that was never rendered would strand the board on stale
## truth, the Phase 1 EnterNextRoom bug).
var _applied_revision := 0
var _applied_generation := 0
var _applied_layout := 0
var _acked_revision := 0
## Serializes the reconcile→render→ack loop while awaiting the render frame.
var _applying := false
## Room signature of the last applied revision — identical signatures are
## selection-only beats (never restart anything).
var _last_room_signature := ""
## Hovered card ids (hover_received is transient and not replayed).
var _hovered: Dictionary = {}

func _ready() -> void:
	WebBridge.sync_received.connect(_on_sync)
	WebBridge.hover_received.connect(_on_hover)
	WebBridge.policy_received.connect(_on_policy)
	WebBridge.dispose_requested.connect(_on_dispose)
	WebBridge.bridge_failed.connect(_on_bridge_failed)
	# Autoload order: WebBridge may have validated syncs before this scene
	# connected — pull the retained latest so the first render never waits
	# for a newer store change to arrive.
	var pending := WebBridge.take_latest_sync()
	if not pending.is_empty():
		_on_sync(pending)

## Boot/protocol failure surfaced before any sync: the host falls back to DOM
## on its own; nothing to draw.
func _on_bridge_failed(_code: String, _message: String) -> void:
	pass

func _on_dispose() -> void:
	# Graceful quit — the host removes the iframe as the hard boundary.
	get_tree().quit()

func _on_policy(reduced_motion: bool) -> void:
	_fx.set_policy(reduced_motion)

func _on_hover(card_id: String, over: bool) -> void:
	# Transient (never replayed): a hover for a missing card is ignored.
	if over:
		_hovered[card_id] = true
	else:
		_hovered.erase(card_id)
	if _sprites.has(card_id):
		_sprites[card_id].set_hovered(over)

func _on_sync(envelope: Dictionary) -> void:
	_session_id = envelope["session_id"]
	var revision: int = envelope["revision"]
	var generation: int = envelope["run_generation"]
	var layout: int = envelope["layout_revision"]
	if revision <= int(_latest.get("revision", 0)):
		return # strictly older than what we already hold (latest-wins)
	_latest = envelope
	if _applying:
		return # the apply loop below will pick this revision up
	_applying = true
	# Reconcile → render one frame → ack, until the held truth is rendered.
	# Applied and acked are tracked SEPARATELY: a sync that lands during the
	# frame-wait must itself be reconciled (the Phase 1 EnterNextRoom bug).
	while _applied_revision < int(_latest.get("revision", 0)):
		var target: Dictionary = _latest
		var target_revision: int = target["revision"]
		var target_generation: int = target["run_generation"]
		var target_layout: int = target["layout_revision"]
		if target_generation != _applied_generation:
			_clear_all_sprites() # run replacement: no old effect survives
		_reconcile(target)
		_applied_revision = target_revision
		_applied_generation = target_generation
		_applied_layout = target_layout
		_mark("sync-r%d-reconciled sprites=%d" % [_applied_revision, _sprites.size()])
		await get_tree().process_frame
		_acked_revision = _applied_revision
		WebBridge.send_applied(_session_id, _acked_revision, _applied_generation, _applied_layout)
		WebBridge.send_settled(_session_id, _acked_revision, _applied_generation, _applied_layout)
		if bool(target.get("diagnostics", false)):
			WebBridge.send_diagnostics(_session_id, _acked_revision, _applied_generation, _applied_layout, _diagnostic_rects())
	_applying = false

## Development diagnostic (Phase 1 spike): stage markers visible from the host.
func _mark(stage: String) -> void:
	JavaScriptBridge.eval("window.__boardMarks = (window.__boardMarks || []); window.__boardMarks.push('%s')" % stage, true)

## Diff the current sprite set against the projection's room. Static form:
## instant removal/instant placement (choreography is Phase 3; every tween
## added later must still END on these rects).
func _reconcile(envelope: Dictionary) -> void:
	var projection: Dictionary = envelope["projection"]
	var room: Array = projection.get("room", [])
	var wanted: Dictionary = {}
	for entry: Variant in room:
		var card: Dictionary = entry
		wanted[card["cardId"]] = card

	var signature := _room_signature(room)
	var selection_only := signature == _last_room_signature

	# Removals: cards no longer in the room (skipped on selection-only beats —
	# the room is identical, so nothing can be absent).
	if not selection_only:
		for card_id: String in _sprites.keys():
			if not wanted.has(card_id):
				_sprites[card_id].queue_free()
				_sprites.erase(card_id)
				_rects.erase(card_id)

	# Additions + repositioning; selection is exclusive.
	var selected_id: Variant = projection.get("selectedCardId")
	for card_id: String in wanted:
		var card: Dictionary = wanted[card_id]
		var rect := Rect2(
			Vector2(card["x"] as float, card["y"] as float),
			Vector2(card["width"] as float, card["height"] as float)
		)
		var sprite: Node2D = _sprites.get(card_id)
		var is_new := sprite == null
		if is_new:
			sprite = CARD_SPRITE_SCENE.instantiate()
			add_child(sprite)
			_sprites[card_id] = sprite
			sprite.set_up(card_id, rect)
		elif not selection_only:
			sprite.set_rect(rect)
		_rects[card_id] = rect
		sprite.set_selected(selected_id == card_id)
		sprite.set_hovered(_hovered.has(card_id))
		if is_new:
			_fx.on_card_appeared(sprite, projection.get("reducedMotion", false))
	_last_room_signature = signature

## Run replacement: every sprite is dropped (the new generation rebuilds).
func _clear_all_sprites() -> void:
	for card_id: String in _sprites.keys():
		_sprites[card_id].queue_free()
	_sprites.clear()
	_rects.clear()
	_last_room_signature = ""

func _room_signature(room: Array) -> String:
	var parts: PackedStringArray = []
	for entry: Variant in room:
		var card: Dictionary = entry
		parts.append("%s:%s,%s,%s,%s" % [
			card["cardId"],
			card["x"], card["y"], card["width"], card["height"],
		])
	return "|".join(parts)

## Rendered sprite bounds in room-box CSS px — the sprite-parity e2e input.
func _diagnostic_rects() -> Array:
	var rects: Array = []
	for card_id: String in _rects.keys():
		var rect: Rect2 = _rects[card_id]
		rects.append({
			"cardId": card_id,
			"x": rect.position.x,
			"y": rect.position.y,
			"width": rect.size.x,
			"height": rect.size.y,
		})
	return rects
