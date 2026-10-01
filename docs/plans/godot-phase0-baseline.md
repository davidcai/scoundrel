# Godot adoption — Phase 0 baseline report and frozen decisions

Status: Phase 0 deliverable, 2026-09-30. Companion to [godot-plan.md](godot-plan.md) (the plan of record; terminology and gates are defined there). Measurements in this file were taken on branch `feat/godot-zai-glm` at repository state `75dcd55` (plan doc merged) with a clean working tree, Node 24.16.0 local (CI uses Node 22; build output is equivalent for these purposes), pnpm 11.7.0. All numbers below are measured, not estimated, except where explicitly marked proposed.

## 1. Measured baseline (current app, Phaser renderer)

### Bundle (production build, `pnpm build`)

| Artifact                  | Raw            | gzip         |
| ------------------------- | -------------- | ------------ |
| `index-*.js` (main chunk) | 309.0 kB       | 97.3 kB      |
| `phaser.esm-*.js` (lazy)  | 1,685.7 kB     | 379.8 kB     |
| `board-scene-*.js` (lazy) | 18.9 kB        | 6.3 kB       |
| `index-*.css`             | 16.0 kB        | 4.4 kB       |
| **JS total** (3 chunks)   | **2,013.7 kB** | **483.5 kB** |

`scripts/check-bundle-size.mjs` (the CI gate, its own gzip accounting): per-chunk ≤ 420 KB, total ≤ 550 KB — **passing** (phaser.esm 372.7 KB, index 95.8 KB, board-scene 6.1 KB; total 474.6/550.0 KB). Any Godot work must keep this gate green; the Godot export payload is measured separately by `check:godot` (see §5).

### Artwork (source JPEGs, 44 files)

44,489,224 bytes ≈ **38.6 MiB raw** (JPEG; gzip adds ~0 — matches the plan's 38.61/38.11 MiB source-file measurement). Each file is served as a separate hashed Vite asset; cold-page artwork transfer is therefore part of the total-page baseline against which Godot-only payload is reported incrementally.

### Tests

- Unit + integration suite (`pnpm test`): green at this state (verified this session).
- Bundle gate: passing (above).
- e2e (`pnpm e2e`) was **not run** this session (requires Playwright browsers); CI is the reference for e2e status. No e2e regressions are expected from Phase 0/1 work because the Godot path is behind a renderer switch that defaults to Phaser.

## 2. Pinned toolchain

`godot/toolchain.json` pins **Godot 4.7.2 stable** (released 2026-08-18, GitHub tag `4.7.2-stable`) with exact download URLs, byte sizes, and official SHA-512 sums for the Windows x86-64 and Linux x86-64 editors plus the shared export-templates `tpz`. Checksums were fetched from the release's official `SHA512-SUMS.txt` on 2026-09-30 and cross-checked against the GitHub release metadata (asset byte sizes match). The export wrapper (`scripts/export-godot.mjs`) verifies sums before extraction and refuses a moving `stable` download. Renderer: Compatibility. Export: single-threaded Web (`variant/thread_support=false`).

## 3. Frozen budgets (Payload × Readiness, jointly derived per plan)

Transfer time at the 10 Mbps / 100 ms test profile: 5 MiB compressed ≈ 4.2 s.

| Budget                | Frozen value                                                                                                                                            | Derivation                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Payload               | ≤ **5 MiB** compressed cold payload (hard numeric stop at the Phase 4 gate); **working target ≤ 4.5 MiB** for margin                                    | 4.2 s transfer leaves 0.8 s for phone wasm compile + boot inside the 8 s readiness budget; 4.5 MiB leaves ~1.1 s |
| Readiness             | cold ≤ 5 s desktop / ≤ 8 s lower-end phone; warm ≤ 2 s; measured as median and p95 over ≥ 10 runs, gated on p95                                         | plan gate row; the working target above is what actually fits, 5 MiB is the stop line                            |
| Bundle (JS)           | existing 420/550 KB gate unchanged; Godot loader/JS must stay outside `dist/assets/*.js` or be added as an explicit new budget row                      | preserves the existing CI contract                                                                               |
| Readiness attribution | measure download, wasm compile, init, first applied frame separately (`check:godot` reports per-file sizes; browser tracing supplies the runtime split) | plan §CI: "Measure download, compile, initialization, and first applied frame separately"                        |

## 4. Phase 0 decisions (frozen)

1. **Stripped export template: yes, spike it inside Phase 1.** The stock Godot 4.3+ web `.wasm` alone is ~5 MB brotli (upstream figure, to be confirmed at pin time) — before loader/PCK/textures — so the 5 MiB gate can only pass with a stripped custom template (disable 3D and unused modules). Discovering that after building Phase 2 would waste the app-integration work, so the template spike runs inside Phase 1. Its maintenance cost stays excluded from the baseline estimate, per the plan.
2. **Comparison effect (authoring-value gate): the monster-defeat beat.** Representative because it exercises every effect class the board uses: particles (kill spark), tween choreography (fly-to-handoff arc + fade), shader/camera FX (danger vignette), and the canvas-boundary handoff to DOM chrome. Existing Phaser reference: `flyToKillHandoff` + `killSpark` + `pulseVignette` (src/game/board-scene.ts, src/game/fx.ts). Named approver: David Cai. Comparison criteria (frozen): (a) ≥ 55 fps during the beat on named devices, (b) visual coherence at or above Phaser's (spark shape/decay, handoff arc, vignette), (c) the beat is editable in the Godot editor and reviewable without rebuilding the host app.
3. **Named device matrix — signed off by the owner, 2026-09-30** (owner answers; two deviations from the plan's proposed midrange classes, accepted for now):
   - Desktop reference: **owner's mini PC — AMD Ryzen 7 8845HS, AMD Radeon 780M iGPU, ~30 GB RAM, Chrome stable, 60 Hz** (frozen as the desktop measurement surface; all desktop numbers in this document were captured on it).
   - Android: **skipped by owner decision** (no Android device available). Consequence, recorded explicitly: the midrange-Android Chrome gate is unmeasured until a device is available; desktop Chromium emulation does not substitute (plan rule). Revisit before Phase 4's device matrix.
   - iOS: **iPhone 15 Pro Max, Safari current** — a flagship, not the plan's proposed SE/12 class. Consequence: iOS results will be optimistic for the wasm-memory and WebGL-eviction checks; a lower-end iOS data point should be borrowed (friend/family device or a used SE) before the Phase 4 gate is treated as passed.
4. **Branch/worktree**: implementation runs on `feat/godot-zai-glm` (this repo's checkout); the plan document itself was authored on `codex/godot-plan` and merged. Commits/pushes require explicit owner approval.
5. **Test scenarios** (fixture trace, frozen from plan §Test plan 4): seed `s20` deals diamond-5, heart-9, spade-8, diamond-9; exercise equip/potion/fight, carryover, next room, undo, blocked and successful flee, overlapping flee/redeal, weapon swap/kill stack, all eight config combinations, final 1–4-card rooms, both terminal outcomes, abandon/restart, hydration, terminal reload. Playwright renderer-parity runs fix `Date.now` via `page.clock.setFixedTime(new Date('2026-09-30T12:00:00Z'))` per plan §Test plan 5.

## 5. Protocol v1 — Phase 1 minimal subset (fixture/protocol design)

The plan's Phase 2 envelope (`protocolVersion/buildId/sessionId/revision/runGeneration/layoutRevision/fxSeq`) is **not** built now. Phase 1 implements exactly the plan's minimal subset, designed so the Phase 2 fields slot in without breaking the frame:

- Host → frame: `sync` (`protocolVersion`, `sessionId`, `revision` monotonic from 1, `projection`) and `dispose`. Latest sync wins inside the frame (the shell coalesces; no parent-side queue).
- Frame → host: `applied` (`sessionId`, `revision` — emitted after the frame renders an applied revision; the first one promotes the canvas live) and `error` (`code`, `message` — fatal, host falls back to DOM).
- Validation both ends: same-origin only, `event.source` checks, `protocolVersion`, sessionId match, known kinds, card-ID format, finite dimensions, room ≤ 4 cards.
- `BoardProjection` carries room cards with rects (CSS px, relative to the `.room` border box — the iframe's box), selection/carried identity, phase, and the effective reduced-motion flag. No engine types cross the boundary; `board-protocol.ts` stays Godot/store-free.

## 6. Open items carried to Phase 1

- Confirm the pinned 4.7.2 shell placeholder set (`$GODOT_URL`, `$GODOT_CONFIG`) and the `Engine` API surface against the actually generated export output; the shell treats generated output as version-specific (plan rule).
- Confirm 1 Godot logical unit = 1 CSS px under `stretch/mode=disabled` + adaptive canvas resize + HiDPI, via the geometry checks (Phase 1/2).
- Real-device naming/sign-off (§4.3) and the Vercel preview spike.
- Stock-export payload measurement (full 44-card deck) against the §3 budgets → go/no-go input.

## 7. Phase 1 spike — first measured export and browser validation (2026-09-30/10-01)

The full pipeline ran on this machine: pinned toolchain download (both archives checksum-verified), 44-card asset staging, two-pass import with the lossy-0.8 patch, release export, and artifact validation (`pnpm godot:export`). The exported frame was then booted in Chromium against the dev server with the renderer switch (`#/play?seed=s20&renderer=godot`) and verified end-to-end: live promotion on the frame's first applied revision, the four s20 room cards rendered by the Godot canvas at the authoritative layout positions, DOM hit-layer selection + action panel working over the canvas, and an equip action reconciling the canvas (card removed, survivors re-centered) while the DOM weapon zone took the card at the room boundary.

### Payload (stock template, 44-card deck, `check:godot`)

| File                             | Raw          | gzip          | brotli        |
| -------------------------------- | ------------ | ------------- | ------------- |
| `board.wasm`                     | 37.68 MiB    | 9.68 MiB      | 7.92 MiB      |
| `board.pck` (44 lossy-0.8 cards) | 4.33 MiB     | ~4.2 MiB      | ~4.2 MiB      |
| `board.js` (loader)              | 280 kB       | ~90 kB        | ~80 kB        |
| support (html/icons/worklets)    | ~50 kB       | —             | —             |
| **Total cold payload**           | **42.1 MiB** | **13.89 MiB** | **12.12 MiB** |

**Decision input (exactly as the plan predicted): the stock export misses the 5 MiB budget by ~8.9 MiB gzip, with the wasm alone at 9.68 MiB gzip.** The 44-card lossy-0.8 PCK is only 4.33 MiB (≈98 kB/card) — textures are NOT the problem; the unstripped engine runtime is. This confirms Phase 0 decision §4.1: the stripped export template spike is mandatory inside Phase 1, and readiness budgets must be re-derived from it. Deck completeness verified: 44/44 card textures in the PCK.

### Confirmed in practice (was listed as open above)

- Shell placeholders `$GODOT_URL`/`$GODOT_CONFIG` expand as documented for the pinned 4.7.2; the `Engine` API (`startGame` overrides incl. `canvasResizePolicy`, `focusCanvas`) works as documented.
- 1 Godot logical unit = 1 CSS px confirmed under `stretch/mode=disabled` + adaptive canvas resize (`window.innerWidth` ≡ iframe box; canvas backing follows devicePixelRatio).

### Integration fixes the spike surfaced (now in code)

1. Iframes are replaced elements: `position: absolute; inset: 0` alone keeps the intrinsic 300×150 box — the frame CSS needs explicit `width/height: 100%` (styles.css).
2. The dev renderer override must read the hash-route query (`#/play?...&renderer=godot`), not just `location.search` (renderer-selection.ts).
3. Vite's watcher crashes (Windows EBUSY) on Godot's import-cache churn — `godot/.godot`, `.toolchain`, `public/godot` are excluded from the watcher (vite.config.ts).
4. Frame handshake ordering (GDScript): the shell's setter must be CALLED (not assigned over), `_listening` must be up before `scoundrelHostBridgeReady()` drains the shell buffer, and the Board scene pulls `WebBridge.take_latest_sync()` because the autoload is ready before the main scene connects. Diagnostics (`window.__boardMarks`, `scoundrelSinkState`, `scoundrelConsoleLog`) are kept for Phase 2 debugging and must be removed at Phase 4 hardening.

### Not yet done in Phase 1 (per plan slices)

- Stripped export template spike → payload re-measurement against the 5 MiB budget.
- Real-device matrix runs on the §4.3 signed-off devices (desktop named; iPhone 15 Pro Max pending; Android skipped by owner decision), cold/warm readiness timings, Vercel preview serving check (MIME/compression of `.wasm`/`.pck`).
- Sprite-parity e2e (rendered Godot bounds vs DOM rects ≤1px) — Phase 2, with the full protocol envelope.
- e2e spec (`e2e/godot-board.spec.ts`) written but gated on `GODOT_E2E=1` + a production build with `VITE_RENDERER=godot`; not yet run in CI.
