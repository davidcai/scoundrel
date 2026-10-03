extends Node
## FX director — Phase 3 form (godot-plan.md, "Scene and effects").
##
## The full beat language mirrored from src/ui/motion.ts + board-scene.ts:
## deal-in with flip reveal, sweep to the deck edge, monster fly-to-handoff,
## potion dissolve, weapon-zone sweep, undo rewind, blocked-action nudge,
## camera shake, damage vignette pulse, kill sparks, terminal confetti/embers,
## and the reduced-motion fallbacks (opacity-only ≤120ms, soft terminal fade).
##
## Motion tokens mirror src/ui/motion.ts / board-scene.ts (120–350ms envelope).
## Every movement tween ENDS on the authoritative rect (or leaves the room
## entirely); the board kills all beats and snaps sprites before a new action
## beat starts (plan motion policy). Transient nodes (particles, vignettes,
## departed sprites) are registered for the cancellation sweep.
##
## `run_beat(duration_ms)` returns the beat's settle deadline for the board's
## settled-on-quiescence scheduling.

const REDUCED_FADE_MS := 120.0
const DEAL_MS := 300.0
const DEAL_STAGGER_MS := 70.0
const FLIP_MS := 260.0
const FLIP_DELAY_MS := 80.0
const FLIGHT_MS := 340.0
const SWEEP_MS := 280.0
const SWEEP_STAGGER_MS := 45.0
const DISSOLVE_MS := 260.0
const REWIND_MS := 240.0
const SETTLE_MS := 260.0
const NUDGE_MS := 150.0
const SHAKE_MS := 120.0
const VIGNETTE_MS := 280.0
const TERMINAL_MS := 700.0
const WIPE_MS := 380.0

## Palette mirrored from FX_COLOR in src/game/fx.ts.
const GOLD := Color(0.941176, 0.756863, 0.411765)
const DANGER := Color(0.878431, 0.337255, 0.309804)
const EMBER := Color(0.611765, 0.247059, 0.223529)
const HP := Color(0.294118, 0.705882, 0.466667)
const WHITE := Color.WHITE

## Current motion policy (policy messages override the per-sync value until
## the next sync arrives).
var _reduced_motion := false
## Cancellation registries.
var _tweens: Array[Tween] = []
var _transients: Array[Node] = []
var _vignette: ColorRect = null

## Called by the board scene on `policy` messages.
func set_policy(reduced_motion: bool) -> void:
	_reduced_motion = reduced_motion
	if _reduced_motion:
		cancel_all() # plan: on policy changes cancel running tweens/particles immediately

## Kill every tracked tween and free every transient node (plan motion
## policy: cancel everything in flight before the next reconcile). The BOARD
## snaps sprites and frees departed ones itself.
func cancel_all() -> void:
	for tween in _tweens:
		if tween != null and tween.is_valid():
			tween.kill()
	_tweens.clear()
	for node in _transients:
		if node != null and is_instance_valid(node):
			node.queue_free()
	_transients.clear()
	if _vignette != null and is_instance_valid(_vignette):
		_vignette.queue_free()
		_vignette = null

func _track(tween: Tween) -> Tween:
	_tweens.append(tween)
	return tween

func _track_node(node: Node) -> void:
	_transients.append(node)

## The beat's total duration in ms (the board schedules `settled` for the
## current revision at this deadline, invalidated by the next action sync).
func run_beat(duration_ms: float) -> float:
	return duration_ms

func _viewport_size(board: Node2D) -> Vector2:
	return board.get_viewport().get_visible_rect().size

# ── Beats ────────────────────────────────────────────────────────────────────

## Staggered deal: fly in from the deck edge with a card-back flip reveal.
## `entries` = [{sprite, rect}]; the carried card re-enters LAST with a pulse.
## Returns total duration ms.
func deal_in(board: Node2D, entries: Array, carried_id: String, base_delay_ms: float) -> float:
	if _reduced_motion:
		return _reduced_arrivals(entries)
	if entries.is_empty():
		return 0.0
	var deck_x := _viewport_size(board).x + _entry_width(entries) * 0.75
	var total := base_delay_ms
	var ordered := entries.duplicate()
	if carried_id != "":
		ordered = ordered.filter(func(e: Dictionary) -> bool: return e["sprite"].card_id != carried_id)
		ordered.append(entries.filter(func(e: Dictionary) -> bool: return e["sprite"].card_id == carried_id)[0])
	for i in ordered.size():
		var entry: Dictionary = ordered[i]
		var sprite: Node2D = entry["sprite"]
		var rect: Rect2 = entry["rect"]
		var delay_ms := base_delay_ms + i * DEAL_STAGGER_MS
		var target := rect.get_center()
		sprite.position = Vector2(deck_x, target.y - 10.0)
		sprite.modulate.a = 0.0
		sprite.scale = Vector2(0.96, 0.96)
		sprite.show_back()
		var tween := _track(board.create_tween())
		tween.tween_interval(delay_ms / 1000.0)
		tween.tween_property(sprite, "modulate:a", 1.0, 0.11).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
		tween.parallel().tween_property(sprite, "position", target, DEAL_MS / 1000.0).set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
		tween.parallel().tween_property(sprite, "scale", Vector2.ONE, DEAL_MS / 1000.0).set_trans(Tween.TRANS_QUINT).set_ease(Tween.EASE_OUT)
		sprite.play_flip_reveal(FLIP_MS, delay_ms + FLIP_DELAY_MS)
		if sprite.card_id == carried_id:
			_pulse_sprite(board, sprite, delay_ms + FLIP_MS + 60.0)
		total = maxf(total, delay_ms + DEAL_MS + FLIP_DELAY_MS + FLIP_MS)
	return total

## Departures sweep toward the deck edge and fade; sprites are freed on land.
## Returns total duration ms.
func sweep_to_edge(board: Node2D, sprites: Array, base_delay_ms: float) -> float:
	if _reduced_motion:
		for sprite: Node2D in sprites:
			sprite.queue_free()
		return 0.0
	for sprite: Node2D in sprites:
		_track_node(sprite)
	var deck_x := _viewport_size(board).x + 180.0
	var total := base_delay_ms
	for i in sprites.size():
		var sprite: Node2D = sprites[i]
		var delay_ms := base_delay_ms + i * SWEEP_STAGGER_MS
		var tween := _track(board.create_tween())
		tween.tween_interval(delay_ms / 1000.0)
		tween.set_parallel(true)
		tween.tween_property(sprite, "position:x", deck_x, SWEEP_MS / 1000.0).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
		tween.tween_property(sprite, "position:y", sprite.position.y + 14.0, SWEEP_MS / 1000.0).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
		tween.tween_property(sprite, "modulate:a", 0.0, SWEEP_MS / 1000.0).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
		tween.chain().tween_callback(func() -> void: sprite.queue_free())
		total = maxf(total, delay_ms + SWEEP_MS)
	return total

## MonsterDefeated: the monster flies toward the kill-stack side and hands off
## at the canvas edge, scaling to the stack's 0.85 and fading across the final
## third. Frees the sprite on land. Returns total duration ms.
func fly_to_handoff(board: Node2D, sprite: Node2D) -> float:
	if _reduced_motion:
		sprite.queue_free()
		return 0.0
	_track_node(sprite)
	_kill_spark(board, sprite.position)
	var size := _viewport_size(board)
	var handoff := Vector2(maxf(sprite.position.x, size.x * 0.65), size.y + 220.0)
	var tween := _track(board.create_tween())
	tween.set_parallel(true)
	tween.tween_property(sprite, "position", handoff, FLIGHT_MS / 1000.0).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tween.tween_property(sprite, "scale", sprite.scale * 0.85, FLIGHT_MS / 1000.0).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tween.tween_property(sprite, "modulate:a", 0.0, FLIGHT_MS * 0.3 / 1000.0).set_delay(FLIGHT_MS * 0.7 / 1000.0).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tween.chain().tween_callback(func() -> void: sprite.queue_free())
	return FLIGHT_MS

## PotionQuaffed: dissolve in place; wasted = shorter and dimmed.
func dissolve(board: Node2D, sprite: Node2D, wasted: bool) -> float:
	if _reduced_motion:
		sprite.queue_free()
		return 0.0
	_track_node(sprite)
	var duration := 180.0 if wasted else DISSOLVE_MS
	if wasted:
		sprite.modulate = Color(0.596078, 0.635294, 0.721569, sprite.modulate.a) # mist #98a2b8
	var tween := _track(board.create_tween())
	tween.set_parallel(true)
	tween.tween_property(sprite, "modulate:a", 0.0, duration / 1000.0).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	tween.tween_property(sprite, "scale", sprite.scale * (1.04 if wasted else 1.1), duration / 1000.0).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	tween.chain().tween_callback(func() -> void: sprite.queue_free())
	return duration

## WeaponEquipped: the equipped weapon sweeps out toward the weapon zone.
func sweep_to_weapon(board: Node2D, sprite: Node2D) -> float:
	if _reduced_motion:
		sprite.queue_free()
		return 0.0
	_track_node(sprite)
	var card_width := 192.0
	var size := _viewport_size(board)
	var tween := _track(board.create_tween())
	tween.set_parallel(true)
	tween.tween_property(sprite, "position", Vector2(-card_width, size.y + card_width * 0.85), SWEEP_MS / 1000.0).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	tween.tween_property(sprite, "scale", sprite.scale * 0.92, SWEEP_MS / 1000.0).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	tween.tween_property(sprite, "modulate:a", 0.0, SWEEP_MS * 0.5 / 1000.0).set_delay(SWEEP_MS * 0.5 / 1000.0).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tween.chain().tween_callback(func() -> void: sprite.queue_free())
	return SWEEP_MS

## UndoDone: re-appearing cards rise quietly back in from the bottom edge.
func rewind_in(board: Node2D, entries: Array, base_delay_ms: float) -> float:
	if _reduced_motion:
		return _reduced_arrivals(entries)
	var total := base_delay_ms
	for i in entries.size():
		var entry: Dictionary = entries[i]
		var sprite: Node2D = entry["sprite"]
		var rect: Rect2 = entry["rect"]
		var delay_ms := base_delay_ms + i * 40.0
		sprite.position = Vector2(rect.get_center().x, _viewport_size(board).y + rect.size.y * 0.4)
		sprite.modulate.a = 0.0
		var tween := _track(board.create_tween())
		tween.tween_interval(delay_ms / 1000.0)
		tween.set_parallel(true)
		tween.tween_property(sprite, "position", rect.get_center(), REWIND_MS / 1000.0).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		tween.tween_property(sprite, "modulate:a", 1.0, REWIND_MS / 1000.0).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		total = maxf(total, delay_ms + REWIND_MS)
	return total

## RunAwayBlocked / InvalidAction: a small canvas nudge (≤3px, 150ms).
func nudge(board: Node2D, sprites: Array) -> float:
	if _reduced_motion or sprites.is_empty():
		return 0.0
	var base_x: float = sprites[0].position.x
	var tween := _track(board.create_tween())
	tween.tween_property(board, "position:x", board.position.x - 3.0, NUDGE_MS * 0.25 / 1000.0)
	tween.tween_property(board, "position:x", board.position.x + 3.0, NUDGE_MS * 0.25 / 1000.0)
	tween.tween_property(board, "position:x", board.position.x - 2.0, NUDGE_MS * 0.25 / 1000.0)
	tween.tween_property(board, "position:x", board.position.x, NUDGE_MS * 0.25 / 1000.0)
	return NUDGE_MS

## Camera-shake equivalent: shake the board root briefly (MonsterDefeated).
func shake(board: Node2D) -> float:
	if _reduced_motion:
		return 0.0
	var origin := board.position
	var tween := _track(board.create_tween())
	tween.tween_property(board, "position", origin + Vector2(3.0, 2.0), SHAKE_MS * 0.3 / 1000.0)
	tween.tween_property(board, "position", origin - Vector2(3.0, 1.0), SHAKE_MS * 0.3 / 1000.0)
	tween.tween_property(board, "position", origin, SHAKE_MS * 0.4 / 1000.0)
	return SHAKE_MS

## Red damage pulse (MonsterDefeated, damage > 0).
func pulse_vignette(board: Node2D, peak: float, duration_ms: float) -> void:
	if _reduced_motion:
		return
	_vignette_pulse(board, DANGER, peak, duration_ms, false)

## Defeat vignette (GameLost): rises to its strength and HOLDS.
func settle_vignette(board: Node2D, strength: float, duration_ms: float) -> void:
	if _reduced_motion:
		return
	_vignette_pulse(board, DANGER, strength, duration_ms, true)

func _vignette_pulse(board: Node2D, color: Color, peak: float, duration_ms: float, hold: bool) -> void:
	var rect := _ensure_vignette(board)
	var material := rect.material as ShaderMaterial
	var half := duration_ms * 0.5 / 1000.0
	var tween := _track(board.create_tween())
	if hold:
		tween.tween_method(func(v: float) -> void: material.set_shader_parameter("strength", v), 0.0, peak, duration_ms / 1000.0).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	else:
		tween.tween_method(func(v: float) -> void: material.set_shader_parameter("strength", v), 0.0, peak, half).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
		tween.tween_method(func(v: float) -> void: material.set_shader_parameter("strength", v), peak, 0.0, half).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)

func _ensure_vignette(board: Node2D) -> ColorRect:
	if _vignette != null and is_instance_valid(_vignette):
		return _vignette
	var layer := CanvasLayer.new()
	layer.layer = 90
	var rect := ColorRect.new()
	rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var material := ShaderMaterial.new()
	material.shader = load("res://shaders/vignette.gdshader")
	material.set_shader_parameter("strength", 0.0)
	rect.material = material
	layer.add_child(rect)
	board.add_child(layer)
	_track_node(layer)
	_vignette = rect
	return rect

## Kill spark (MonsterDefeated): a short radial burst of gold/white sparks.
func _kill_spark(board: Node2D, at: Vector2) -> void:
	if _reduced_motion:
		return
	var spark := CPUParticles2D.new()
	spark.position = at
	spark.one_shot = true
	spark.explosiveness = 1.0
	spark.amount = 18
	spark.lifetime = 0.43
	spark.direction = Vector2(0, -1)
	spark.spread = 70.0
	spark.initial_velocity_min = 70.0
	spark.initial_velocity_max = 230.0
	spark.gravity = Vector2(0, 380)
	spark.scale_amount_min = 2.0
	spark.scale_amount_max = 4.0
	spark.color_ramp = _spark_ramp()
	board.add_child(spark)
	_track_node(spark)
	spark.emitting = true
	var cleanup := _track(board.create_tween())
	cleanup.tween_interval(0.6)
	cleanup.tween_callback(func() -> void: spark.queue_free())

func _spark_ramp() -> Gradient:
	var gradient := Gradient.new()
	gradient.set_color(0, WHITE)
	gradient.set_color(1, GOLD)
	gradient.add_point(0.7, DANGER)
	return gradient

## Victory confetti (GameWon): gold/green/white pieces raining from the top.
func confetti(board: Node2D) -> float:
	if _reduced_motion:
		return 0.0
	var size := _viewport_size(board)
	var confetti := CPUParticles2D.new()
	confetti.position = Vector2(size.x * 0.5, -12.0)
	confetti.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	confetti.emission_rect_extents = Vector2(size.x * 0.5, 4.0)
	confetti.amount = 60
	confetti.lifetime = 1.6
	confetti.direction = Vector2(0, 1)
	confetti.spread = 12.0
	confetti.initial_velocity_min = 40.0
	confetti.initial_velocity_max = 120.0
	confetti.gravity = Vector2(0, 260)
	confetti.scale_amount_min = 2.0
	confetti.scale_amount_max = 3.5
	confetti.color_ramp = _confetti_ramp()
	board.add_child(confetti)
	_track_node(confetti)
	confetti.emitting = true
	var stop := _track(board.create_tween())
	stop.tween_interval(0.8)
	stop.tween_callback(func() -> void: confetti.emitting = false)
	var cleanup := _track(board.create_tween())
	cleanup.tween_interval(2.4)
	cleanup.tween_callback(func() -> void: confetti.queue_free())
	return TERMINAL_MS

func _confetti_ramp() -> Gradient:
	var gradient := Gradient.new()
	gradient.set_color(0, GOLD)
	gradient.set_color(1, HP)
	gradient.add_point(0.5, WHITE)
	return gradient

## Defeat embers (GameLost): slow dark-red embers drifting down.
func embers(board: Node2D) -> float:
	if _reduced_motion:
		return 0.0
	var size := _viewport_size(board)
	var embers_node := CPUParticles2D.new()
	embers_node.position = Vector2(size.x * 0.5, -8.0)
	embers_node.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	embers_node.emission_rect_extents = Vector2(size.x * 0.5, 4.0)
	embers_node.amount = 30
	embers_node.lifetime = 2.4
	embers_node.direction = Vector2(0, 1)
	embers_node.spread = 15.0
	embers_node.initial_velocity_min = 18.0
	embers_node.initial_velocity_max = 55.0
	embers_node.gravity = Vector2(0, 60)
	embers_node.scale_amount_min = 2.0
	embers_node.scale_amount_max = 3.0
	embers_node.color_ramp = _ember_ramp()
	board.add_child(embers_node)
	_track_node(embers_node)
	embers_node.emitting = true
	var stop := _track(board.create_tween())
	stop.tween_interval(1.4)
	stop.tween_callback(func() -> void: embers_node.emitting = false)
	var cleanup := _track(board.create_tween())
	cleanup.tween_interval(3.0)
	cleanup.tween_callback(func() -> void: embers_node.queue_free())
	return TERMINAL_MS

func _ember_ramp() -> Gradient:
	var gradient := Gradient.new()
	gradient.set_color(0, EMBER)
	gradient.set_color(1, DANGER)
	return gradient

## Reduced-motion celebration: a single soft full-canvas fade (opacity only).
func soft_fade(board: Node2D, color: Color, peak: float) -> float:
	if _reduced_motion == false:
		return 0.0
	var layer := CanvasLayer.new()
	layer.layer = 90
	var rect := ColorRect.new()
	rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rect.color = color
	rect.modulate.a = 0.0
	layer.add_child(rect)
	board.add_child(layer)
	_track_node(layer)
	var tween := _track(board.create_tween())
	tween.tween_property(rect, "modulate:a", peak, 0.2).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tween.tween_property(rect, "modulate:a", 0.0, 0.2).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	return 400.0

## Room wipe reveal (deals): a dark curtain fades away from the room.
func wipe(board: Node2D) -> float:
	if _reduced_motion:
		return 0.0
	var layer := CanvasLayer.new()
	layer.layer = 80
	var rect := ColorRect.new()
	rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rect.color = Color(0.0509804, 0.0666667, 0.0980392, 0.85)
	layer.add_child(rect)
	board.add_child(layer)
	_track_node(layer)
	var tween := _track(board.create_tween())
	tween.tween_property(rect, "modulate:a", 0.0, WIPE_MS / 1000.0).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tween.tween_callback(func() -> void: layer.queue_free())
	return WIPE_MS

## Carried-card re-entry emphasis: one gold scale pulse.
func repulse(board: Node2D, sprite: Node2D) -> void:
	_pulse_sprite(board, sprite, 0.0)

## Carried-card re-entry emphasis implementation (delayed variant).
func _pulse_sprite(board: Node2D, sprite: Node2D, delay_ms: float) -> void:
	if _reduced_motion:
		return
	var tween := _track(board.create_tween())
	tween.tween_interval(delay_ms / 1000.0)
	tween.tween_property(sprite, "scale", sprite.scale * 1.06, 0.1).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tween.tween_property(sprite, "scale", Vector2.ONE, 0.12).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)

## Reduced-motion arrivals: opacity-only fade at their rects (≤120ms).
func _reduced_arrivals(entries: Array) -> float:
	for entry: Dictionary in entries:
		var sprite: Node2D = entry["sprite"]
		sprite.modulate.a = 0.0
		var tween := _track(sprite.create_tween())
		tween.tween_property(sprite, "modulate:a", 1.0, REDUCED_FADE_MS / 1000.0)
	return REDUCED_FADE_MS

func _entry_width(entries: Array) -> float:
	if entries.is_empty():
		return 192.0
	var rect: Rect2 = entries[0]["rect"]
	return rect.size.x
