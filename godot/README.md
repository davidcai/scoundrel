# godot/ — Scoundrel board frame (Phase 1 spike)

A minimal Godot 4.7.2 project exported to the web and embedded by the React
app as a same-origin iframe confined to the room rectangle. See
[docs/plans/godot-plan.md](../docs/plans/godot-plan.md) (plan of record) and
[docs/plans/godot-phase0-baseline.md](../docs/plans/godot-phase0-baseline.md)
(frozen Phase 0 decisions). The frame is a decorative room renderer: it owns
NO gameplay, input, text, storage, or clocks.

## Layout

- `project.godot` — Compatibility renderer, stretch disabled (1 unit = 1 CSS px), `WebBridge` autoload.
- `export_presets.cfg` — single-threaded Web preset, custom shell, output `../public/godot/spike/board.html`.
- `scenes/board.tscn` + `scripts/board.gd` — keyed room reconciliation; applies host projections, acknowledges rendered revisions.
- `scenes/card-sprite.tscn` + `scripts/card-sprite.gd` — one room card (texture/placeholder, selection emphasis). No input.
- `scripts/web-bridge.gd` — frame-side transport (JavaScriptBridge): envelope validation, `applied`/`error` sends.
- `scripts/fx-director.gd` — arrival presentation (Phase 1: reduced-motion ≤120 ms fade); full beat language is Phase 3.
- `web/board-shell.html` — custom export shell: host↔frame postMessage router, latest-sync buffer, engine boot (no canvas auto-focus).
- `toolchain.json` — pinned 4.7.2 editor/templates URLs + official SHA-512 sums (never follow a moving `stable`).
- `assets/cards/` — GENERATED import staging (44 resized PNG derivatives of `assets/*.jpg`, by `scripts/prepare-godot-assets.mjs`). Never hand-edit; the authored JPEGs stay the only source.
- `tests/` — reserved for GDScript headless projection/animation-policy tests (plan Phase 3 slice).

## Commands

```sh
pnpm godot:assets   # stage the 44 card derivatives + manifest
pnpm godot:import   # headless import ×2 with the lossy-0.8 patch between passes
pnpm godot:export   # full pipeline: toolchain (download on first use) → assets → import → export → check
pnpm check:godot    # validate + measure an existing export (public/godot/spike/)
```

The first `godot:export` downloads the pinned editor + export templates
(~1.3 GB) into `.toolchain/` (gitignored) and verifies checksums; everything
runs in Godot self-contained mode — nothing is installed system-wide.

## Phase 1 open items (verified at first real export)

- Shell placeholder expansion (`$GODOT_URL`/`$GODOT_CONFIG`) and the `Engine`
  API surface against the pinned version's generated output.
- 1 Godot logical unit = 1 CSS px under `stretch/mode=disabled` + adaptive
  canvas resize + HiDPI (geometry contract for the projection rects).
- Web canvas transparency is NOT assumed: the frame draws the room background
  itself (opaque baseline per plan).
