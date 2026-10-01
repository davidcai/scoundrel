extends Node2D
## The board scene (godot-plan.md, "Scene and effects" — Phase 1 form).
##
## Keyed reconciliation against the latest host projection, static Phase 1
## style: sprites are created/removed/repositioned to the authoritative
## TypeScript rects; arrival fades are the fx-director's job. After each
## applied revision renders one frame, the scene acknowledges it (`applied`) —
## the host's first matching acknowledgement promotes the canvas live.
##
## Presentation-only boundary (plan rule): no gameplay, no storage, no clocks,
## no input handlers, no text. State diffs decide existence; the projection is
## already validated by WebBridge.

const CARD_SPRITE_SCENE := preload("res://scenes/card-sprite.tscn")

@onready var _fx: Node = $FxDirector

var _sprites: Dictionary = {} # cardId (String) -> CardSprite
var _session_id := ""
## Newest unacknowledged sync (revision, projection); host sends are
## latest-wins, so only the newest entry ever matters.
var _latest_revision := 0
var _latest_projection: Dictionary = {}
var _acked_revision := 0
## Serializes the apply→render→ack loop while awaiting the render frame.
var _applying := false

func _ready() -> void:
	WebBridge.sync_received.connect(_on_sync)
	WebBridge.dispose_requested.connect(_on_dispose)
	WebBridge.bridge_failed.connect(_on_bridge_failed)
	# Autoload order: WebBridge may have validated syncs before this scene
	# connected — pull the retained latest so the first render never waits
	# for a newer store change to arrive.
	var pending := WebBridge.take_latest_sync()
	if not pending.is_empty():
		_on_sync(pending["session_id"], pending["revision"], pending["projection"])

## Boot/protocol failure surfaced before any sync: the host falls back to DOM
## on its own; nothing to draw.
func _on_bridge_failed(_code: String, _message: String) -> void:
	pass

func _on_dispose() -> void:
	# Graceful quit — the host removes the iframe as the hard boundary.
	get_tree().quit()

func _on_sync(session_id: String, revision: int, projection: Dictionary) -> void:
	_session_id = session_id
	if revision <= _latest_revision:
		return # strictly older than what we already hold (latest-wins)
	_latest_revision = revision
	_latest_projection = projection
	if _applying:
		return # the apply loop below will pick this revision up
	_applying = true
	# Apply → render one frame → ack, until every held revision is rendered.
	while _acked_revision < _latest_revision:
		_mark("sync-r%d-reconcile" % revision)
		_reconcile(_latest_projection)
		var room_now: Array = _latest_projection.get("room", [])
		var first_desc := "none"
		if not room_now.is_empty():
			var first: Dictionary = room_now[0]
			first_desc = "%s@%s" % [first.get("cardId"), str(first.get("x"))]
		_mark("sync-r%d-reconciled sprites=%d first=%s" % [revision, _sprites.size(), first_desc])
		_mark("sync-r%d-reconciled" % revision)
		await get_tree().process_frame
		_acked_revision = _latest_revision
		WebBridge.send_applied(_session_id, _acked_revision)
		_mark("sync-r%d-acked" % _acked_revision)
	_applying = false

## Development diagnostic (Phase 1 spike): stage markers visible from the host.
func _mark(stage: String) -> void:
	JavaScriptBridge.eval("window.__boardMarks = (window.__boardMarks || []); window.__boardMarks.push('%s')" % stage, true)

## Diff the current sprite set against the projection's room. Static Phase 1
## form: instant removal/instant placement (choreography is Phase 3; every
## tween added later must still END on these rects).
func _reconcile(projection: Dictionary) -> void:
	var room: Array = projection.get("room", [])
	var wanted: Dictionary = {}
	for entry: Variant in room:
		var card: Dictionary = entry
		wanted[card["cardId"]] = card

	# Removals: cards no longer in the room.
	for card_id: String in _sprites.keys():
		if not wanted.has(card_id):
			_sprites[card_id].queue_free()
			_sprites.erase(card_id)

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
		else:
			sprite.set_rect(rect)
		sprite.set_selected(selected_id == card_id)
		if is_new:
			_fx.on_card_appeared(sprite, projection.get("reducedMotion", false))
