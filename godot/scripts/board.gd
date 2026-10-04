extends Node2D
## The board scene (godot-plan.md, "Scene and effects" — Phase 3 form).
##
## Keyed reconciliation + the motion language: sprites are created/removed/
## repositioned against the authoritative TypeScript rects; the fx-director
## runs the beat chosen by the sync's action hint (deal/flip, sweep, handoff,
## dissolve, rewind, nudge, shake, vignette, sparks, confetti/embers), with
## the plan's motion policy:
##
## - On every ACTION sync, in-flight beats are killed and survivors snap to
##   their rects BEFORE the new beat starts; selection-only syncs (identical
##   room signature) never restart anything.
## - A runGeneration change drops EVERY sprite (a run replacement cancels all
##   old effects even if the seed matches).
## - A resumed run's first reconcile is static (no mount deal).
## - `settled` fires when the beat's choreography deadline passes, scoped to
##   the revision it was scheduled for — cancelled choreography never
##   acknowledges a stale revision.
## - Tab visibility: focus loss snaps everything to the last sync's truth.
##
## Presentation-only boundary (plan rule): no gameplay, no storage, no clocks,
## no input handlers, no text.

const CARD_SPRITE_SCENE := preload("res://scenes/card-sprite.tscn")

## Beat constants (mirrors board-scene.ts DUR / fx.ts FX_COLOR).
const WIPE_SLACK_MS := 100.0
const VIGNETTE_MS_DEFAULT := 280.0
const TERMINAL_VIGNETTE_MS := 700.0
const TERMINAL_MS := 700.0
const GOLD_COLOR := Color(0.941176, 0.756863, 0.411765)
const DANGER_COLOR := Color(0.878431, 0.337255, 0.309804)

@onready var _fx: Node = $FxDirector

var _sprites: Dictionary = {} # cardId (String) -> CardSprite
var _rects: Dictionary = {} # cardId (String) -> Rect2 (applied; diagnostics input)
var _session_id := ""
## Newest received sync (revision + ordering + projection + hint); host sends
## are latest-wins, so only the newest entry ever matters.
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
## Room identity of the last applied revision — identical signatures are
## selection-only beats (never restart anything).
var _last_room_signature := ""
## The mount deal fires once per session on the first sync with a dealt room
## (unless the run was resumed from storage — static reconcile).
var _dealt_once := false
## Pending `settled` deadline (invalidated by newer action syncs).
var _settle_revision := 0

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

## Tab hidden/focused out: frame timing is untrustworthy — kill beats and
## snap everything to the last sync's truth (plan motion policy).
func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT or what == NOTIFICATION_APPLICATION_PAUSED:
		_kill_beats_and_snap()

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
	if _sprites.has(card_id):
		_sprites[card_id].set_hovered(over)

func _on_sync(envelope: Dictionary) -> void:
	_session_id = envelope["session_id"]
	var revision: int = envelope["revision"]
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
		await _apply_latest(_latest)
	_applying = false

## Apply one envelope: reconcile (with kill-and-snap), choreograph, render a
## frame, acknowledge, and schedule `settled` for THIS revision.
func _apply_latest(target: Dictionary) -> void:
	var revision: int = target["revision"]
	# Envelope fields are Variant: JSON null cannot be assigned to a hard-typed
	# Dictionary (the assignment errors and the variable stays null), so every
	# nullable envelope field is untyped + explicitly coalesced.
	var hint: Variant = target.get("action")
	if hint == null or not (hint is Dictionary):
		hint = {}

	var generation: int = target["run_generation"]
	var projection: Dictionary = target["projection"]
	var room: Array = projection.get("room", [])

	if generation != _applied_generation and _applied_revision != 0:
		_clear_all_sprites() # run replacement: no old effect survives

	var diff := _reconcile(projection)
	_applied_revision = revision
	_applied_generation = generation
	_applied_layout = int(target["layout_revision"])

	var beat_ms := _choreograph(diff, target, hint)

	# Render one frame before acknowledging.
	await get_tree().process_frame
	_acked_revision = _applied_revision
	WebBridge.send_applied(_session_id, _acked_revision, _applied_generation, _applied_layout)
	_schedule_settled(_acked_revision, beat_ms)
	if bool(target.get("diagnostics", false)):
		WebBridge.send_diagnostics(_session_id, _acked_revision, _applied_generation, _applied_layout, _diagnostic_rects())

## Choreography: choose the beat from the hint + the diff, run it, and return
## its total duration ms (0 = static — settle immediately).
func _choreograph(diff: Dictionary, target: Dictionary, hint: Dictionary) -> float:
	var projection: Dictionary = target["projection"]
	var reduced: bool = projection.get("reducedMotion", false)
	var room_changed: bool = diff["room_changed"]
	var selection_only: bool = diff["selection_only"]
	var room: Array = projection.get("room", [])

	# Selection-only: highlight change only — never kill or restart anything.
	if selection_only:
		return 0.0

	if room.is_empty():
		return 0.0

	# The mount deal: first sync with a dealt room, unless the run resumed.
	# A hint-bearing sync is an ACTION (equip/drink/…) — it must run its own
	# beat even on the first dealt room, or the hint is silently swallowed.
	if not _dealt_once and hint.is_empty():
		_dealt_once = true
		if bool(projection.get("runResumed", false)):
			return 0.0 # resume: static reconcile (plan rule)
		var carried: String = _carried_id(projection)
		var mount_ms: float = _fx.deal_in(self, _entries_for(room), carried, 0.0)
		_fx.wipe(self)
		return mount_ms + WIPE_SLACK_MS

	# Action beats need the hint; a room change without one (defensive —
	# hint-less sync with a diffed room) falls back to a full swap.
	if hint.is_empty():
		if room_changed:
			var swap_ms: float = _fx.sweep_to_edge(self, diff["departed"].values(), 0.0)
			swap_ms = maxf(swap_ms, _fx.deal_in(self, _entries_for(room), "", 140.0))
			_fx.wipe(self)
			return swap_ms + WIPE_SLACK_MS
		return 0.0

	match hint.get("type", ""):
		"RoomDealt":
			var ms: float = _fx.sweep_to_edge(self, diff["departed"].values(), 0.0)
			var carried_id := _optional_card(hint, "carriedFrom")
			var arrived := _entries_for(room).filter(func(e: Dictionary) -> bool:
				return e["sprite"].card_id != carried_id)
			if carried_id != "" and _sprites.has(carried_id):
				_fx.repulse(self, _sprites[carried_id])
			ms = maxf(ms, _fx.deal_in(self, arrived, carried_id, 0.0))
			_fx.wipe(self)
			return ms + WIPE_SLACK_MS
		"RanAway":
			var ms: float = _fx.sweep_to_edge(self, diff["departed"].values(), 0.0)
			ms = maxf(ms, _fx.deal_in(self, _entries_for(room), "", 140.0))
			return ms
		"MonsterDefeated":
			var monster: Node2D = diff["departed"].get(_optional_card(hint, "cardId"), null)
			var ms := 0.0
			if monster != null:
				ms = _fx.fly_to_handoff(self, monster)
			if float(hint.get("damage", 0.0)) > 0.0:
				_fx.shake(self)
				_fx.pulse_vignette(self, 0.55, VIGNETTE_MS_DEFAULT)
			return ms
		"PotionQuaffed":
			var potion: Node2D = diff["departed"].get(_optional_card(hint, "cardId"), null)
			if potion != null:
				return _fx.dissolve(self, potion, bool(hint.get("wasted", false)))
			return 0.0
		"WeaponEquipped":
			var weapon: Node2D = diff["departed"].get(_optional_card(hint, "cardId"), null)
			if weapon != null:
				return _fx.sweep_to_weapon(self, weapon)
			return 0.0
		"UndoDone":
			return _fx.rewind_in(self, _entries_for(room), 0.0)
		"RunAwayBlocked", "InvalidAction":
			return _fx.nudge(self, _sprites.values())
		"GameWon":
			if reduced:
				_fx.soft_fade(self, GOLD_COLOR, 0.14)
			else:
				_fx.confetti(self)
				_fx.pulse_vignette(self, 0.35, TERMINAL_VIGNETTE_MS)
			return TERMINAL_MS
		"GameLost":
			if reduced:
				_fx.soft_fade(self, DANGER_COLOR, 0.18)
			else:
				_fx.embers(self)
				_fx.settle_vignette(self, 0.5, TERMINAL_VIGNETTE_MS)
			return TERMINAL_MS
	return 0.0

func _optional_card(hint: Dictionary, field: String) -> String:
	var value: Variant = hint.get(field, null)
	return value if value != null else ""

func _carried_id(projection: Dictionary) -> String:
	var value: Variant = projection.get("carriedCardId", null)
	return value if value != null else ""

## Motion-policy sweep: kill every in-flight beat and snap all survivors to
## their authoritative rects.
func _kill_beats_and_snap() -> void:
	_fx.cancel_all()
	for card_id: String in _sprites.keys():
		if _rects.has(card_id):
			_sprites[card_id].snap_to(_rects[card_id])

## Schedule `settled` for the given revision at the beat's deadline. A newer
## action sync invalidates the pending one (the callback re-checks scope).
func _schedule_settled(revision: int, beat_ms: float) -> void:
	_settle_revision = revision
	if beat_ms <= 0.0:
		WebBridge.send_settled(_session_id, revision, _applied_generation, _applied_layout)
		return
	var timer := get_tree().create_timer(beat_ms / 1000.0 + 0.05)
	timer.timeout.connect(func() -> void:
		if _settle_revision == revision and _acked_revision == revision:
			WebBridge.send_settled(_session_id, revision, _applied_generation, _applied_layout))

## Diff the current sprite set against the projection's room. Returns the
## arrived entries (sprite+rect), the departed sprites (kept for the beats),
## and the selection-only/room-changed classification.
func _reconcile(projection: Dictionary) -> Dictionary:
	var room: Array = projection.get("room", [])
	var wanted: Dictionary = {}
	for entry: Variant in room:
		var card: Dictionary = entry
		wanted[card["cardId"]] = card

	var signature := _room_signature(room)
	var selection_only := signature == _last_room_signature and _dealt_once
	var room_changed := not selection_only
	var arrived: Array = []
	var departed: Dictionary = {}

	# Kill-and-snap BEFORE mutating sprite sets: in-flight beats stop here so
	# the new beat starts from resting truth (plan motion policy). Skipped on
	# selection-only beats — they never restart anything.
	if not selection_only:
		for card_id: String in _sprites.keys():
			if wanted.has(card_id) and _rects.has(card_id):
				_sprites[card_id].snap_to(_rects[card_id])

	for card_id: String in _sprites.keys():
		if not wanted.has(card_id):
			# Departed: NOT freed here — the beat animates it out (or the
			# fallback path frees it when no beat runs).
			departed[card_id] = _sprites[card_id]

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
			arrived.append({"sprite": sprite, "rect": rect})
		elif not selection_only:
			sprite.set_rect(rect)
		_rects[card_id] = rect
		sprite.set_selected(selected_id == card_id)
		sprite.set_hovered(false)

	# Remove departed from the live registries (sprites freed by their beat).
	for card_id: String in departed.keys():
		_sprites.erase(card_id)
		_rects.erase(card_id)

	# No beat will run for these departures (selection-only path) → free now.
	if selection_only and not departed.is_empty():
		for sprite: Node2D in departed.values():
			sprite.queue_free()
		departed.clear()

	_last_room_signature = signature
	return {
		"arrived": arrived,
		"departed": departed,
		"selection_only": selection_only,
		"room_changed": room_changed,
	}

## Run replacement: every sprite is dropped (the new generation rebuilds).
func _clear_all_sprites() -> void:
	_fx.cancel_all()
	for card_id: String in _sprites.keys():
		_sprites[card_id].queue_free()
	_sprites.clear()
	_rects.clear()
	_last_room_signature = ""
	_dealt_once = false

func _entries_for(room: Array) -> Array:
	var entries: Array = []
	for entry: Variant in room:
		var card: Dictionary = entry
		var card_id: String = card["cardId"]
		if _sprites.has(card_id) and _rects.has(card_id):
			entries.append({"sprite": _sprites[card_id], "rect": _rects[card_id]})
	return entries

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
