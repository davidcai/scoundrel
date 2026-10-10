# godot/ — Scoundrel board frame (Phase 1 spike)

A minimal Godot 4.7.2 project exported to the web and embedded by the React
app as a same-origin iframe confined to the room rectangle. See
[docs/plans/godot-plan.md](../docs/plans/godot-plan.md) (plan of record) and
[docs/plans/godot-phase0-baseline.md](../docs/plans/godot-phase0-baseline.md)
(frozen Phase 0 decisions). The frame is a decorative room renderer: it owns
NO gameplay, input, text, storage, or clocks.

## Layout

- `project.godot` — Compatibility renderer, stretch disabled. Logical units are canvas BACKING pixels (CSS px × devicePixelRatio); the frame scales host CSS rects by `DisplayServer.screen_get_scale()` (see `board.gd` `_dpr`).
- `export_presets.cfg` — single-threaded Web preset, custom shell, content-versioned output `../public/godot/<build-id>/board.html` (id derived by `scripts/export-godot.mjs` from every artifact's SHA-256).
- `scenes/board.tscn` + `scripts/board.gd` — keyed room reconciliation; applies host projections, acknowledges rendered revisions.
- `scenes/card-sprite.tscn` + `scripts/card-sprite.gd` — one room card (texture/placeholder, selection emphasis). No input.
- `scripts/web-bridge.gd` — frame-side transport (JavaScriptBridge): envelope validation, `applied`/`error` sends.
- `scripts/fx-director.gd` — the beat language (deal-in + flip, sweeps, dissolve, handoff, rewind, nudge/shake, vignette, particles), mirroring `src/ui/motion.ts` + `src/game/board-scene.ts`.
- `web/board-shell.html` — custom export shell: host↔frame postMessage router, latest-sync buffer, engine boot (no canvas auto-focus).
- `toolchain.json` — pinned 4.7.2 editor/templates URLs + official SHA-512 sums (never follow a moving `stable`).
- `assets/cards/` — GENERATED import staging (44 resized PNG derivatives of `assets/*.jpg`, by `scripts/prepare-godot-assets.mjs`). Never hand-edit; the authored JPEGs stay the only source.
- `tests/` — NOT present: the GDScript side has no in-repo test runner; the frame is verified by `e2e/godot-board.spec.ts` + scripted browser traces.

## Commands

```sh
pnpm godot:assets   # stage the 44 card derivatives + manifest
pnpm godot:import   # headless import ×2 with the lossy-0.8 patch between passes
pnpm godot:export   # full pipeline: toolchain (download on first use) → assets → import → export → check
pnpm check:godot    # validate + measure an existing export (public/godot/<build-id>/)
```

The first `godot:export` downloads the pinned editor + export templates
(~1.3 GB) into `.toolchain/` (gitignored) and verifies checksums; everything
runs in Godot self-contained mode — nothing is installed system-wide.

## Geometry contract

With `stretch/mode=disabled`, Godot's logical size is the canvas BACKING store
(CSS × devicePixelRatio): `board.gd` scales every host CSS rect ONCE by
`DisplayServer.screen_get_scale()` and reports parity rects divided back to
CSS px. "1 logical unit = 1 CSS px" holds only at DPR 1
(docs/plans/godot-phase0-baseline.md §7 correction + §10).
