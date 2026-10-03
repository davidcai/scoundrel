extends Node2D
## One room card, keyed by its CardId (godot-plan.md: "Key sprites by CardId").
##
## Visual contract mirrors the DOM/Phaser baseline: the artwork texture scaled
## into the authoritative rect, a shape-only placeholder until the texture
## exists (missing artwork must never render blank or as text), and a subtle
## selection emphasis (the DOM `.selected-ring` stays the a11y contract).
## NO input handling: the canvas is decorative (plan rule).

const TEXTURE_DIR := "res://assets/cards/"
## Room background tone — mirrors `.card` in src/styles.css (#0d1119).
const PLACEHOLDER_COLOR := Color(0.0509804, 0.0666667, 0.0980392)
## Selection emphasis multiplier (gold-tinted, subtle; the DOM ring is the
## real selection indicator).
const SELECTED_TINT := Color(1.12, 1.06, 0.88)
## Hover alpha dip (mirrors card-sprite.ts HOVER_ALPHA).
const HOVER_ALPHA := 0.82

var _card_id := ""
var _face: Sprite2D
var _placeholder: Polygon2D

func _ready() -> void:
	# Placeholder first, face on top: children draw in insertion order, and an
	# opaque placeholder above the face would hide the artwork completely.
	_placeholder = Polygon2D.new()
	add_child(_placeholder)
	_face = Sprite2D.new()
	_face.centered = true
	add_child(_face)

## First placement. `rect` is in room-box CSS px (the scene's logical space).
func set_up(card_id: String, rect: Rect2) -> void:
	_card_id = card_id
	position = rect.get_center()
	_apply_rect(rect)
	_load_face()

func set_rect(rect: Rect2) -> void:
	position = rect.get_center()
	_apply_rect(rect)

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
		modulate = Color.WHITE

## Development diagnostic (Phase 1 spike): stage markers visible from the host.
func _mark(stage: String) -> void:
	JavaScriptBridge.eval("window.__boardMarks = (window.__boardMarks || []); window.__boardMarks.push('%s')" % stage, true)

func _apply_rect(rect: Rect2) -> void:
	var half := rect.size * 0.5
	_placeholder.polygon = PackedVector2Array([
		Vector2(-half.x, -half.y),
		Vector2(half.x, -half.y),
		Vector2(half.x, half.y),
		Vector2(-half.x, half.y),
	])
	_placeholder.color = PLACEHOLDER_COLOR
	if _face.texture != null:
		var size: Vector2 = _face.texture.get_size()
		if size.x > 0.0 and size.y > 0.0:
			_face.scale = rect.size / size

## Baked-in import (PCK): the deck ships inside the frame, no network fetch.
## A failed/unknown id keeps the placeholder (validate texture at import time).
func _load_face() -> void:
	var path := TEXTURE_DIR + _card_id + ".png"
	if not ResourceLoader.exists(path):
		_mark("tex-missing " + path)
		return
	var texture: Texture2D = load(path)
	if texture == null:
		_mark("tex-null " + path)
		return
	_mark("tex-ok " + _card_id)
	_face.texture = texture
	# Re-apply scale for the (possible) layout that arrived before the load.
	var size: Vector2 = texture.get_size()
	if size.x > 0.0 and size.y > 0.0:
		var half := _placeholder.polygon
		if half.size() >= 4:
			var rect_size := Vector2(
				(half[1].x - half[0].x),
				(half[2].y - half[1].y)
			)
			_face.scale = rect_size / size
