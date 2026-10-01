extends Node
## Frame-side transport bridge (godot-plan.md, "Transport contract and
## synchronization" — Phase 1 minimal subset).
##
## Registered as the `WebBridge` autoload. Lives only in the web export:
##   host `sync`/`dispose` (JSON string via postMessage → the shell script)
##     → this node validates the envelope → signals the Board scene
##   Board acknowledges rendered revisions via send_applied().
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

signal sync_received(session_id: String, revision: int, projection: Dictionary)
signal dispose_requested
signal bridge_failed(code: String, message: String)

const PROTOCOL_VERSION := 1
const MAX_ROOM_CARDS := 4
const PHASES: PackedStringArray = ["playing", "won", "lost"]

var _sink: JavaScriptObject = null
var _window: JavaScriptObject = null
var _listening := false
var _errored := false
var _card_id_regex: RegEx = RegEx.new()
## Latest validated sync, retained until the Board scene pulls it — the
## autoload becomes ready before the main scene, so signal-only delivery
## would lose the first (and often only) sync.
var _latest_sync := {}

func _ready() -> void:
	_mark("0-start")
	_card_id_regex.compile("^(club|diamond|heart|spade)-(2|3|4|5|6|7|8|9|10|j|q|k|a)$")
	if not OS.has_feature("web"):
		_fail("non-web", "WebBridge requires a web export (JavaScriptBridge unavailable)")
		return
	_mark("1-web-feature-ok")
	_window = JavaScriptBridge.get_interface("window")
	_mark("2-interface-ok")
	# The shell script must have registered these host functions during parse.
	var shell_ready: bool = JavaScriptBridge.eval("typeof scoundrelSetSink === 'function' && typeof scoundrelHostSend === 'function'", true)
	_mark("3-eval-shell=" + str(shell_ready))
	if not (shell_ready is bool and shell_ready):
		_fail("boot", "shell bridge functions missing (stale or foreign shell?)")
		return
	# Keep the callback object referenced for the runtime lifetime (plan note).
	_sink = JavaScriptBridge.create_callback(_on_host_message)
	_mark("4-callback-created")
	# CALL the shell's setter with the callback object — assigning to the
	# property would replace the setter itself (the Phase 1 handshake bug).
	_window.scoundrelSetSink(_sink)
	_mark("5-sink-set")
	# Listen BEFORE the handshake: scoundrelHostBridgeReady() drains the
	# shell's buffered sync synchronously into the sink — with the flag still
	# down, that first (and often only) message would be silently dropped.
	_listening = true
	_window.scoundrelHostBridgeReady()
	_mark("6-ready-signalled")

## Development diagnostic (Phase 1 spike): stage marker visible from the host.
func _mark(stage: String) -> void:
	JavaScriptBridge.eval("window.__bridgeStage = '%s'" % stage, true)

## Frame → host: acknowledge a rendered revision.
func send_applied(session_id: String, revision: int) -> void:
	_send({"kind": "applied", "protocolVersion": PROTOCOL_VERSION, "sessionId": session_id, "revision": revision})

## Frame → host: structured fatal failure (host falls back to DOM).
func send_error(code: String, message: String, session_id: String = "") -> void:
	_send({"kind": "error", "protocolVersion": PROTOCOL_VERSION, "sessionId": session_id, "code": code, "message": message})

## The Board scene pulls any sync that arrived before it connected (autoload
## init order) — consumed once; empty when there is nothing pending.
func take_latest_sync() -> Dictionary:
	var latest := _latest_sync
	_latest_sync = {}
	return latest

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
	match envelope.get("kind"):
		"sync":
			var revision: Variant = envelope.get("revision")
			if not (_is_int(revision) and revision >= 1):
				_fail("protocol", "invalid revision")
				return
			var projection: Variant = envelope.get("projection")
			if not (projection is Dictionary):
				_fail("protocol", "invalid projection")
				return
			if not _valid_projection(projection):
				_fail("protocol", "projection failed validation")
				return
			# Retain for the Board scene: autoload _ready runs BEFORE the main
			# scene connects, so an emission here would be lost — the scene
			# pulls take_latest_sync() when it is ready (see board.gd).
			_latest_sync = {"session_id": session_id, "revision": revision, "projection": projection}
			sync_received.emit(session_id, revision, projection)
		"dispose":
			_listening = false
			dispose_requested.emit()
		_:
			_fail("protocol", "unknown message kind")

func _is_int(value: Variant) -> bool:
	return value is int or (value is float and is_equal_approx(value, round(value as float)))

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
