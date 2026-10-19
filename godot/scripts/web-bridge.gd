extends Node
## Frame-side transport bridge (godot-plan.md, "Transport contract and
## synchronization" — Phase 2 envelope).
##
## Registered as the `WebBridge` autoload. Lives only in the web export:
##   host `sync`/`hover`/`policy`/`dispose` (JSON string via postMessage → the
##     shell script) → this node validates the envelope → signals the Board
##   Board acknowledges via send_applied/send_settled/send_diagnostics.
##
## The JS-side contract (shell: web/board-shell.html):
##   - `window.scoundrelSetSink(callback)` — the host-message sink. We hand it
##     a JavaScriptBridge callback that is kept referenced for the RUNTIME
##     LIFETIME (`_sink` member — a collected callback breaks the channel).
##   - `window.scoundrelHostBridgeReady()` — called after the sink is set; the
##     shell immediately replays its buffered latest sync.
##   - `window.scoundrelHostSend(json)` — frame → host postMessage (the shell
##     owns target-origin handling).
##
## Validation (plan: "Validate ... session, version, known message kinds, card
## IDs, finite dimensions, and payload bounds on both ends"): every inbound
## envelope is fully re-validated here — the shell only routes strings. A
## rejected envelope emits a structured `error` once and stops listening.
## This node never touches the engine, rules, storage, or clocks: it is a
## presentation-only pipe (plan boundary).

signal sync_received(envelope: Dictionary)
signal hover_received(card_id: String, over: bool)
signal policy_received(reduced_motion: bool)
signal dispose_requested
signal bridge_failed(code: String, message: String)

const PROTOCOL_VERSION := 1
const MAX_ROOM_CARDS := 4
const PHASES: PackedStringArray = ["playing", "won", "lost"]
const HINT_TYPES: PackedStringArray = [
	"RoomDealt", "RanAway", "MonsterDefeated", "WeaponEquipped", "PotionQuaffed",
	"UndoDone", "RunAwayBlocked", "InvalidAction", "GameWon", "GameLost",
]

var _sink: JavaScriptObject = null
var _window: JavaScriptObject = null
var _listening := false
var _errored := false
var _card_id_regex: RegEx = RegEx.new()
## Latest validated sync, retained until the Board scene pulls it — the
## autoload becomes ready before the main scene, so signal-only delivery
## would lose the first (and often only) sync.
var _latest_sync := {}
## The session's build id, echoed from the host's syncs (ProjectSettings'
## application/config/version is an EMPTY string by default, so a settings
## fallback never fires — the envelope is the source of truth).
var _last_build_id := "unknown"

func _ready() -> void:
	_card_id_regex.compile("^(club|diamond|heart|spade)-(2|3|4|5|6|7|8|9|10|j|q|k|a)$")
	if not OS.has_feature("web"):
		_fail("non-web", "WebBridge requires a web export (JavaScriptBridge unavailable)")
		return
	_window = JavaScriptBridge.get_interface("window")
	# The shell script must have registered these host functions during parse.
	var shell_ready: bool = JavaScriptBridge.eval("typeof scoundrelSetSink === 'function' && typeof scoundrelHostSend === 'function'", true)
	if not (shell_ready is bool and shell_ready):
		_fail("boot", "shell bridge functions missing (stale or foreign shell?)")
		return
	# Keep the callback object referenced for the runtime lifetime (plan note).
	_sink = JavaScriptBridge.create_callback(_on_host_message)
	# CALL the shell's setter with the callback object — assigning to the
	# property would replace the setter itself (the Phase 1 handshake bug).
	_window.scoundrelSetSink(_sink)
	# Listen BEFORE the handshake: scoundrelHostBridgeReady() drains the
	# shell's buffered sync synchronously into the sink — with the flag still
	# down, that first (and often only) message would be silently dropped.
	_listening = true
	_window.scoundrelHostBridgeReady()
	# Announce transport availability to the HOST (plan's bridge-ready): the
	# parent answers with its latest complete snapshot.
	send_bridge_ready()

## Frame → host: announce that the GDScript sink is registered.
func send_bridge_ready() -> void:
	_send({"kind": "bridge-ready", "protocolVersion": PROTOCOL_VERSION, "buildId": _build_id(), "sessionId": _session_hint()})

## Frame → host: acknowledge a rendered revision (echoes the ordered triple).
func send_applied(session_id: String, revision: int, run_generation: int, layout_revision: int) -> void:
	_send({"kind": "applied", "protocolVersion": PROTOCOL_VERSION, "buildId": _build_id(), "sessionId": session_id, "revision": revision, "runGeneration": run_generation, "layoutRevision": layout_revision})

## Frame → host: the revision has no active room choreography.
func send_settled(session_id: String, revision: int, run_generation: int, layout_revision: int) -> void:
	_send({"kind": "settled", "protocolVersion": PROTOCOL_VERSION, "buildId": _build_id(), "sessionId": session_id, "revision": revision, "runGeneration": run_generation, "layoutRevision": layout_revision})

## Frame → host: rendered sprite bounds (test/dev builds only).
func send_diagnostics(session_id: String, revision: int, run_generation: int, layout_revision: int, rects: Array) -> void:
	_send({"kind": "diagnostics", "protocolVersion": PROTOCOL_VERSION, "buildId": _build_id(), "sessionId": session_id, "revision": revision, "runGeneration": run_generation, "layoutRevision": layout_revision, "rects": rects})

## Frame → host: structured fatal failure (host falls back to DOM).
func send_error(code: String, message: String, session_id: String = "") -> void:
	_send({"kind": "error", "protocolVersion": PROTOCOL_VERSION, "buildId": _build_id(), "sessionId": session_id, "code": code, "message": message})

## The build id of the session: echoed from the host's sync envelopes.
func _build_id() -> String:
	return _last_build_id

## bridge-ready carries an empty session hint: the frame has not seen a sync
## yet, and the host only needs to know the sink exists for THIS frame.
func _session_hint() -> String:
	return "frame"

func _send(message: Dictionary) -> void:
	if _window == null:
		return
	_window.scoundrelHostSend(JSON.stringify(message))

func _fail(code: String, message: String) -> void:
	if _errored:
		return # one structured error, then silence
	_errored = true
	_listening = false
	send_error(code, message)
	bridge_failed.emit(code, message)

## JS sink entry point: args[0] is the raw JSON string from the shell.
func _on_host_message(args: Array) -> void:
	if not _listening:
		return
	if args.is_empty() or not (args[0] is String):
		_fail("protocol", "non-string host message")
		return
	var parsed: Variant = JSON.parse_string(args[0])
	if not (parsed is Dictionary):
		_fail("protocol", "message is not a JSON object")
		return
	var envelope: Dictionary = parsed
	if envelope.get("protocolVersion") != PROTOCOL_VERSION:
		_fail("protocol", "unsupported protocolVersion")
		return
	var session_id: Variant = envelope.get("sessionId")
	if not (session_id is String) or session_id.is_empty() or session_id.length() > 128:
		_fail("protocol", "invalid sessionId")
		return
	if not (envelope.get("buildId") is String) or (envelope.get("buildId") as String).is_empty():
		_fail("protocol", "invalid buildId")
		return
	_last_build_id = envelope.get("buildId") as String
	match envelope.get("kind"):
		"sync":
			_on_sync(envelope, session_id)
		"hover":
			var card_id: Variant = envelope.get("cardId")
			var over: Variant = envelope.get("over")
			if not (card_id is String) or _card_id_regex.search(card_id) == null or not (over is bool):
				_fail("protocol", "invalid hover")
				return
			hover_received.emit(card_id, over)
		"policy":
			var reduced: Variant = envelope.get("reducedMotion")
			if not (reduced is bool):
				_fail("protocol", "invalid policy")
				return
			policy_received.emit(reduced)
		"dispose":
			_listening = false
			dispose_requested.emit()
		_:
			_fail("protocol", "unknown message kind")

func _on_sync(envelope: Dictionary, session_id: String) -> void:
	var revision: Variant = envelope.get("revision")
	if not _is_int(revision) or (revision as int) < 1:
		_fail("protocol", "invalid revision")
		return
	var run_generation: Variant = envelope.get("runGeneration")
	if not _is_int(run_generation) or (run_generation as int) < 1:
		_fail("protocol", "invalid runGeneration")
		return
	var layout_revision: Variant = envelope.get("layoutRevision")
	if not _is_int(layout_revision) or (layout_revision as int) < 1:
		_fail("protocol", "invalid layoutRevision")
		return
	var fx_seq: Variant = envelope.get("fxSeq")
	if not _is_int(fx_seq) or (fx_seq as int) < 0:
		_fail("protocol", "invalid fxSeq")
		return
	var diagnostics: Variant = envelope.get("diagnostics")
	if not (diagnostics is bool):
		_fail("protocol", "invalid diagnostics flag")
		return
	var action: Variant = envelope.get("action")
	if action != null:
		if not (action is Dictionary) or not _valid_action(action):
			_fail("protocol", "invalid action hint")
			return
	var projection: Variant = envelope.get("projection")
	if not (projection is Dictionary):
		_fail("protocol", "invalid projection")
		return
	if not _valid_projection(projection):
		_fail("protocol", "projection failed validation")
		return
	# Retain for the Board scene: autoload _ready runs BEFORE the main scene
	# connects, so an emission here would be lost — the scene pulls
	# take_latest_sync() when it is ready (see board.gd).
	_latest_sync = {
		"session_id": session_id,
		"revision": revision,
		"run_generation": run_generation,
		"layout_revision": layout_revision,
		"fx_seq": fx_seq,
		"diagnostics": diagnostics,
		"action": action,
		"projection": projection,
	}
	sync_received.emit(_latest_sync)

## The Board scene pulls any sync that arrived before it connected (autoload
## init order) — consumed once; empty when there is nothing pending.
func take_latest_sync() -> Dictionary:
	var latest := _latest_sync
	_latest_sync = {}
	return latest

func _is_int(value: Variant) -> bool:
	return value is int or (value is float and is_finite(value as float) and is_equal_approx(value, round(value as float)))

## Choreography hint validation — mirrors parseActionHint in board-protocol.ts.
func _valid_action(hint: Dictionary) -> bool:
	if not (hint.get("type") in HINT_TYPES):
		return false
	var card_id: Variant = hint.get("cardId")
	if card_id != null and not (card_id is String and _card_id_regex.search(card_id) != null):
		return false
	var carried_from: Variant = hint.get("carriedFrom")
	if carried_from != null and not (carried_from is String and _card_id_regex.search(carried_from) != null):
		return false
	var damage: Variant = hint.get("damage")
	if damage != null and not (_is_finite_number(damage) and (damage as float) >= 0.0):
		return false
	var wasted: Variant = hint.get("wasted")
	if wasted != null and not (wasted is bool):
		return false
	var discarded_weapon: Variant = hint.get("discardedWeaponId")
	if discarded_weapon != null and not (discarded_weapon is String and _card_id_regex.search(discarded_weapon) != null):
		return false
	var discarded_monsters: Variant = hint.get("discardedMonsterIds")
	if discarded_monsters != null:
		if not (discarded_monsters is Array) or discarded_monsters.size() > 16:
			return false
		for id: Variant in discarded_monsters:
			if not (id is String and _card_id_regex.search(id) != null):
				return false
	return true

func _is_finite_number(value: Variant) -> bool:
	return (value is float or value is int) and is_finite(value as float)

## Full payload validation: room ≤ 4 unique cards with finite positive rects,
## card IDs matching the artwork filename format, known phase, boolean policy.
func _valid_projection(projection: Dictionary) -> bool:
	var room: Variant = projection.get("room")
	if not (room is Array) or room.size() > MAX_ROOM_CARDS:
		return false
	var seen: Dictionary = {}
	for entry: Variant in room:
		if not (entry is Dictionary):
			return false
		var card: Dictionary = entry
		var card_id: Variant = card.get("cardId")
		if not (card_id is String) or _card_id_regex.search(card_id) == null:
			return false
		if seen.has(card_id):
			return false
		seen[card_id] = true
		for field: String in ["x", "y", "width", "height"]:
			var value: Variant = card.get(field)
			if not _is_finite_number(value):
				return false
		if (card.get("width") as float) <= 0.0 or (card.get("height") as float) <= 0.0:
			return false
	for field: String in ["selectedCardId", "carriedCardId"]:
		var value: Variant = projection.get(field)
		if value == null:
			continue
		if not (value is String) or _card_id_regex.search(value) == null:
			return false
	if not (projection.get("phase") in PHASES):
		return false
	return projection.get("reducedMotion") is bool
