extends Node2D
## One room card, keyed by its CardId (godot-plan.md: "Key sprites by CardId").
##
## Visual contract mirrors the DOM/Phaser baseline: the artwork texture scaled
## into the authoritative rect, a shape-only placeholder until the texture
## exists, a shapes-only card BACK for the deal flip reveal, selection/hover
## emphasis, and the motion-policy primitives (`snap_to`/`freeze`) every beat
## must respect: tween targets end on the rect, cancellation snaps to it.
## NO input handling: the canvas is decorative (plan rule).

const TEXTURE_DIR := "res://assets/cards/"
## Room background tone — mirrors `.card` in src/styles.css (#0d1119).
const PLACEHOLDER_COLOR := Color(0.0509804, 0.0666667, 0.0980392)
## Card-back palette — mirrors `.fx-card-back` in src/styles.css.
const BACK_PANEL := Color(0.0784314, 0.0980392, 0.1490196) # #141926
const BACK_BORDER := Color(0.172549, 0.211765, 0.313725) # #2c3650
const BACK_GOLD := Color(0.85098, 0.643137, 0.290196) # #d9a44a
## Selection emphasis multiplier (gold-tinted, subtle; the DOM ring is the
## real selection indicator).
const SELECTED_TINT := Color(1.12, 1.06, 0.88)
## Hover alpha dip (mirrors card-sprite.ts HOVER_ALPHA).
const HOVER_ALPHA := 0.82

var _card_id := ""
var _face: Sprite2D
var _placeholder: Polygon2D
## Shapes-only card back (panel + inner gold frame), above the face while the
## deal flip is in progress. Mirrors drawCardBack in card-sprite.ts.
var _back: Node2D
var _back_panel: ColorRect
var _back_frame: ColorRect
## The last applied rect — the resting ground truth every tween ends at and
## cancellation snaps to.
var _rect := Rect2()
## Tweens this sprite created (flip reveal) — the cancellation registry. Beat
## tweens are tracked by the fx-director and killed there first.
var _tweens: Array[Tween] = []

func _make_tween() -> Tween:
	var tween := create_tween()
	_tweens.append(tween)
	return tween

func _kill_tweens() -> void:
	for tween in _tweens:
		if tween != null and tween.is_valid():
			tween.kill()
	_tweens.clear()
var _face_rest_scale := Vector2.ONE

func _ready() -> void:
	# Placeholder first, face on top, back on top of both (children draw in
	# insertion order; an opaque back above the face is the flip cover).
	_placeholder = Polygon2D.new()
	add_child(_placeholder)
	_face = Sprite2D.new()
	_face.centered = true
	add_child(_face)
	_back = Node2D.new()
	_back.visible = false
	add_child(_back)
	_back_panel = ColorRect.new()
	_back.add_child(_back_panel)
	_back_panel.color = BACK_PANEL
	_back_frame = ColorRect.new()
	_back.add_child(_back_frame)
	_back_frame.color = Color(BACK_GOLD, 0.3)

## First placement. `rect` is in room-box CSS px (the scene's logical space).
func set_up(card_id: String, rect: Rect2) -> void:
	_card_id = card_id
	_apply_rect(rect)
	_load_face()

func set_rect(rect: Rect2) -> void:
	_apply_rect(rect)

## Motion-policy snap: kill every tween this sprite owns and re-apply the
## authoritative rect — the resting ground truth (idempotent).
func snap_to(rect: Rect2) -> void:
	_kill_tweens()
	_apply_rect(rect)
	set_selected(false)
	set_hovered(false)

## Motion-policy freeze: kill tweens but leave the transform (departure beats
## animate FROM the frozen state).
func freeze() -> void:
	_kill_tweens()

func set_selected(selected: bool) -> void:
	if selected:
		_face.modulate = SELECTED_TINT
		_placeholder.modulate = SELECTED_TINT
	else:
		_face.modulate = Color.WHITE
		_placeholder.modulate = Color.WHITE

## Hover emphasis from the host's `hover` message — the alpha dip mirrors the
## Phaser fallback (card-sprite.ts HOVER_ALPHA 0.82); deliberately NOT a tween.
func set_hovered(hovered: bool) -> void:
	if hovered:
		modulate = Color(1.0, 1.0, 1.0, HOVER_ALPHA)
	else:
		modulate = Color(1.0, 1.0, 1.0, 1.0)

## Deal state: opaque back panel on top, ready for play_flip_reveal.
func show_back() -> void:
	_back.visible = true
	_back.scale = Vector2.ONE
	modulate.a = 1.0

## Two-phase scaleX flip (back folds away, face unfolds) — the Godot mirror
## of playFlipReveal in card-sprite.ts. The face lands on its RESTING scale.
func play_flip_reveal(duration_ms: float, delay_ms: float) -> void:
	var half := maxf(40.0, duration_ms * 0.5)
	var back_tween := _make_tween()
	back_tween.tween_interval(delay_ms / 1000.0)
	back_tween.tween_property(_back, "scale:x", 0.0, half / 1000.0).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	back_tween.tween_callback(func() -> void: _back.visible = false)
	var face_tween := _make_tween()
	face_tween.tween_interval((delay_ms + half) / 1000.0)
	face_tween.tween_property(_face, "scale:x", _face_rest_scale.x, half / 1000.0).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	face_tween.parallel().tween_property(_placeholder, "scale:x", 1.0, half / 1000.0).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)

func _apply_rect(rect: Rect2) -> void:
	_rect = rect
	position = rect.get_center()
	var half := rect.size * 0.5
	_placeholder.polygon = PackedVector2Array([
		Vector2(-half.x, -half.y),
		Vector2(half.x, -half.y),
		Vector2(half.x, half.y),
		Vector2(-half.x, half.y),
	])
	_placeholder.color = PLACEHOLDER_COLOR
	_back_panel.position = -half
	_back_panel.size = rect.size
	var inset := maxf(6.0, minf(rect.size.x, rect.size.y) * 0.05)
	_back_frame.position = -half + Vector2(inset, inset)
	_back_frame.size = rect.size - Vector2(inset * 2.0, inset * 2.0)
	if _face.texture != null:
		_face_rest_scale = rect.size / _face.texture.get_size()
		_face.scale = _face_rest_scale
	else:
		_face_rest_scale = Vector2.ONE

## Baked-in import (PCK): the deck ships inside the frame, no network fetch.
## A failed/unknown id keeps the placeholder (validate texture at import time).
func _load_face() -> void:
	var path := TEXTURE_DIR + _card_id + ".png"
	if not ResourceLoader.exists(path):
		return
	var texture: Texture2D = load(path)
	if texture == null:
		return
	_face.texture = texture
	# Re-apply scale for the (possible) layout that arrived before the load.
	var size: Vector2 = texture.get_size()
	if size.x > 0.0 and size.y > 0.0:
		_face_rest_scale = _rect.size / size
		_face.scale = _face_rest_scale
