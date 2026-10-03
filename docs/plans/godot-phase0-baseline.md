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

### Deployed serving check (Vercel preview spike, 2026-10-01)

A production build with `VITE_RENDERER=godot` was deployed as a static upload to a throwaway project (**https://scoundrel-godot-spike.vercel.app**, CLI deploy of `dist/`, not the production project; the repo's Git-integration builds cannot run the Godot toolchain, and `public/godot/` is gitignored). Results, per the plan's Vercel requirements:

| Artifact     | Content-Type               | Content-Encoding | Actual transfer |
| ------------ | -------------------------- | ---------------- | --------------- |
| `board.wasm` | `application/wasm` ✓       | **br** ✓         | 9.11 MiB        |
| `board.pck`  | `application/octet-stream` | **br** ✓         | 4.10 MiB        |
| `board.js`   | `text/javascript`          | br ✓             | 71 kB           |
| `board.html` | `text/html`                | br ✓             | 2.4 kB          |

- **The plan's "edge does not compress .wasm/.pck" risk does not materialize on Vercel**: both binaries arrive brotli-compressed. Godot-only cold transfer ≈ **13.3 MiB** (still ~2.7× the 5 MiB budget; the wasm dominates — same conclusion as §7 payload).
- Caching: served `Cache-Control: public, max-age=0, must-revalidate` — warm-cache readiness requires the Phase 4 content-versioned directory + immutable headers.
- The deployed app was verified end-to-end in a browser: the frame booted from the production build (renderer baked in, no dev overrides), promoted live, and the DOM hit-layer/selection ring/action panel work over the canvas (zh-locale UI rendered — bonus i18n sanity check).
- Deviation note: the repo's Vercel Git integration builds this branch fine but would ship the app **without** the Godot artifacts (toolchain absent + `public/godot/` gitignored) — the deploy-ownership question (CI-built `dist` vs toolchain-in-Vercel-build) is the plan's anticipated Phase 4 decision and is now evidenced.

### EnterNextRoom stale-canvas bug (found by the owner on the deployed spike; fixed, verified on dev + deployment)

Symptom: after "Enter next room", the canvas kept showing the old room (the carried card only). Root cause was a two-sided race, both fixed:

1. **Host (stale-geometry send)**: during the carry state the room has 1 card, so `useBoardLayout` computes 1 rect. `act(EnterNextRoom)` grows the room to 4, and GodotBoard's store subscription fired synchronously BEFORE React recomputed the layout — sending a projection built against the stale 1-rect layout (1 card). Fix: the subscription defers its send by one microtask (`queueMicrotask`), so React's discrete-event commit — which recomputes the layout — lands first; the layout effect's send in that commit carries the corrected geometry (the microtask duplicate is harmless, latest-wins).
2. **Frame (acked-but-never-rendered, the actual defect)**: `board.gd`'s apply loop set `_acked_revision = _latest_revision` after the render-frame wait, so a sync arriving during the wait was acknowledged WITHOUT being reconciled — the corrected 4-card projection was always exactly the one skipped, stranding the canvas. Fix: applied and acked revisions are tracked separately (`_applied_revision`); the loop keeps reconciling until the held truth is rendered and acks what it actually rendered. This restores the plan invariant "reconcile statically from its last applied projection to the newest truth".

Verified by scripted browser traces (equip → drink → equip → enter) on both the dev server and the redeployed production site: the canvas now reconciles the full new room (markers show both revisions rendered, sprites=4, carried card badge intact). Also fixed in passing: Godot's importer churns `.tmp` files inside `godot/assets/cards/` (not just `.godot/`), which crashed Vite's watcher on Windows — the staging dir is now watcher-excluded too.

Second owner-reported alignment bug, same session: the selected card's gold ring floated ~6px off the canvas card. Root cause: `.card[data-selected='true'] { transform: translateY(-6px) }` (and the −4px hover lift) — a pre-canvas DOM affordance that moves the hit-layer button (ring, focus outline, carried badge ride it) while the canvas sprite stays put. Measured on the deployed site: host and frame agreed on the rect exactly (wrapper inline left/top == frame's applied marker); only the button was displaced by exactly the lift. Fix (styles.css): in `.room.canvas-live`, hover/selected transforms are disabled so every DOM artifact stays glued to the sprite; Phase 3 mirrors the lift in the frame's motion language (the projection already carries selection). Verified by measurement (`transform: none`, button/wrapper delta 0.00) and screenshot on dev + deployment. This is now a canvas-live contract rule: DOM hit-layer transforms require a mirrored canvas beat or must be disabled.

Owner also reported the ring not following viewport resizes; extensive automated resize repro (instant 1280→900→1200, 25-step smooth drag, mid-drag sampling, a non-1.0 DPR tab) showed DOM and frame tracking within 0.02px in every case — unreproduced; most likely a stale (pre-fix) tab, since deployments do not auto-reload open tabs. If it persists after a hard refresh, browser zoom (DPR change at the owner's 125% display scaling) is the prime suspect per the plan's DPR test matrix.

### Readiness (first indicative measurements, cached loads, desktop Chromium, stock template)

Measured from the live Vercel deployment (in-page timer, domcontentloaded → canvas-live flip), 3 runs: **905 / 1011 / 1123 ms** warm. In-frame resource timings: `board.wasm` 150–192 ms, `board.pck` 30–82 ms, `board.js` 26–37 ms (transferSize ≈ 300 B each — served from cache). The ≤ 2 s warm budget is comfortably met on the cached desktop path; these are preliminary (n=3, cached only — true cold and throttled-profile runs, plus the ≥10-run p95 protocol, are the Phase 4 gate).

### Stripped export template spike — results (2026-10-01)

Local build route established (no admin needed — web builds need only Python+SCons+Emscripten, no MSVC): Python 3.12 + SCons installed per-user, emsdk 6.0.11 (`$HOME/emsdk`), Godot 4.7.2 source shallow-cloned at the pinned tag into `.toolchain/godot-src/`, build script `.toolchain/build-stripped-template.sh` (gitignored — throwaway spike tooling; the exact scons flag list: `threads=no` (NOT default — 4.7 defaults threads ON, the plan's single-threaded export must pass it explicitly), `disable_3d=yes disable_physics_2d=yes vulkan=no`, and ~40 `module_*_enabled=no` (media formats, VRAM texture codecs, fonts, TLS/networking, 3D authoring) keeping gdscript, regex, webp (lossy texture decode), text_server_fb). Findings:

- Stripped build: **4:45** on 16 threads (LTO variant 6:19); wasm 39.5 → 21.7 MiB raw; template zip 10.2 → 5.7 MB. Boot-verified: the stripped engine boots the frame, loads textures, reconciles the room — for BOTH the plain and LTO builds.
- **Import-cache trap (fixed in export-godot.mjs)**: the editor's reimport trigger does NOT refresh already-imported sources when only the `.import` params change — pass-1 lossless `.ctex` silently survived the second import pass and explicit re-imports, shipping WebP-lossless textures (PCK 9.4 MiB and incompressible). Fix: the patch step now clears `.godot/imported` so pass 2 rebuilds it with the patched params. Symptom check for the future: a PCK that gzip-compresses to ≈ its raw size means lossless textures shipped.
- **LTO (`lto=full`) is not a worthwhile lever** once modules are stripped: 9.55 → 9.39 MiB gzip (−1.7%) for +50% build time. Not adopted.
- Payload-variant frontier (LTO stripped template, lossy WebP import):

| Variant            | Total gzip   | Total brotli | PCK      |
| ------------------ | ------------ | ------------ | -------- |
| **576 px / q 0.8** | **9.39 MiB** | **8.36 MiB** | ~4.3 MiB |
| 448 px / q 0.8     | 7.78 MiB     | 6.74 MiB     | ~2.4 MiB |
| 448 px / q 0.7     | 7.21 MiB     | 6.17 MiB     | ~1.9 MiB |
| 384 px / q 0.8     | 7.06 MiB     | 6.02 MiB     | ~1.7 MiB |

- **Budget verdict + owner decision (2026-10-01): the frozen 5 MiB compressed stop line is not reachable with acceptable texture quality, and the owner adopted the 576 px/q 0.8 variant.** The quality bar is parity with the Phaser/DOM renderer, which serves the full-resolution source art; the owner judged the 448 px variant too soft. The 5 MiB Payload stop line is revised by this decision: the shipping payload is **9.39 MiB gzip / 8.36 MiB brotli**. Readiness still fits — 8.36 MiB brotli ≈ 6.7 s transfer at the 10 Mbps phone profile, inside the ≤ 8 s budget with compile/boot — so the plan's joint Payload×Readiness derivation holds on the readiness side. The 448/384 px rows remain documented for Phase 4 if payload pressure re-emerges. Reaching 5 MiB would need ~14 kB/card textures (≈320 px at q 0.6) — rejected.
- The custom template is installed as `web_nothreads_release.zip` in the self-contained toolchain (stock backed up as `web_nothreads_release.zip.stock.bak`). Before any adoption (Phase 4), the emsdk pin must be identified from the official 4.7.2 build scripts (local builds used emsdk 6.0.11, newer than the official pin) and the template build moved to CI with cache.

### Not yet done in Phase 1 (per plan slices)

- ~~Owner decision (plan exit condition)~~ **Resolved**: the owner adopted the 576 px/q 0.8 variant for Phaser-parity quality (see the budget verdict above).
- Real-device matrix runs on the §4.3 signed-off devices (desktop named; iPhone 15 Pro Max pending; Android skipped by owner decision); throttled cold-readiness runs per the plan's 10 Mbps profile.
- Sprite-parity e2e (rendered Godot bounds vs DOM rects ≤1px) — Phase 2, with the full protocol envelope.
- e2e spec (`e2e/godot-board.spec.ts`) written but gated on `GODOT_E2E=1` + a production build with `VITE_RENDERER=godot`; not yet run in CI.
