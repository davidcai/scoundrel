# Scoundrel — Godot Introduction Plan

Status: proposal, 2026-09-30, revised the same day after a fact-check and strategic review (payload-gate re-sequencing, protocol slimming, extra risk rows). No implementation or runtime measurement has been performed for this plan. Based on repository commit `1e8a3b2` and official Godot documentation checked on this date. This document is the only intended file change on branch `codex/godot-plan`, in worktree `.worktrees/codex-godot-plan`.

## Recommendation

Godot can be introduced into Scoundrel. The most practical first step is to export a small Godot 2D project to the web and evaluate it as a replacement for the existing Phaser room renderer. Keep React for all interaction, accessible semantics, text, menus, and the weapon zone; keep Zustand and the pure TypeScript engine authoritative. Use GDScript only for presentation. Proceed to a production replacement only if the spike demonstrates a worthwhile visual or authoring benefit and passes the gates below.

A complete Godot game is also possible, but it is a separate product and migration decision: the current browser integration would not make the TypeScript engine available in a native Godot executable. A native edition needs a portable rules implementation, new platform services, a complete UI, and parity verification. Section [Standalone Godot edition](#standalone-godot-edition-optional-second-program) describes that path without making it a prerequisite for the web trial.

The game already has functioning Phaser animations and effects. Godot is not needed to implement any current rule, and introducing it does not inherently improve performance, load time, or accessibility. The proposed benefit is scene-based visual authoring and a possible foundation for future native presentation. Those benefits must be demonstrated against the existing app.

### Goals and boundaries

- Evaluate Godot scene/tween/shader tooling on the actual four-card room, with representative combat, healing, fleeing, and undo.
- Preserve rules, reproducible seeds, existing save data, share URLs, English/Chinese translations, keyboard access, and screen-reader behavior.
- Define a reproducible export/build/deploy pipeline compatible with Vite, the existing CI, and Vercel.
- Keep the existing Phaser and DOM paths available throughout evaluation; mount only one graphics runtime at a time.
- Do not port gameplay rules, replace menus, add networking/physics/3D, or expand the weapon-zone canvas ownership during the first program.

All files and commands proposed below are future implementation work. This planning change does not add Godot, dependencies, build scripts, generated exports, or new settings.

## What exists today

Use [rules.md](rules.md) for game rules and [spec.md](spec.md) for product requirements. The [completed Phaser adoption plan](plans/phaser-adoption-plan.md) explains prior decisions, but some of its opening descriptions describe the pre-implementation app. [phaser-plan.md](phaser-plan.md) is superseded. The following inventory reflects the current code rather than those historical descriptions.

| Area                       | Current implementation                                                                                 | Godot trial disposition                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Rules and RNG              | `src/engine/{engine,types,cards,rng}.ts`: pure reducer, pre-shuffled dungeon, derived legality queries | Keep unchanged                                     |
| State and effects          | `src/store/game-store.ts`: game, selection, `lastResult`, monotonic `fxSeq`, `runResumed`              | Keep authoritative; adapter subscribes             |
| Persistence                | Schema version 1; separate `scoundrel:settings`, `scoundrel:stats`, `scoundrel:run` wrappers           | Keep keys, wrappers, validators, and ownership     |
| Room graphics              | `src/game/{board-scene,card-sprite,fx}.ts`; Phaser 4.2.1                                               | Replace conditionally after comparison             |
| Integration                | `src/game/bridge.ts`, `src/ui/PhaserBoard.tsx`, `src/ui/PlayScreen.tsx`                                | Retain semantics; introduce transport/host adapter |
| Geometry                   | Pure `board-layout.ts`; browser-only `board-metrics.ts`; `use-board-layout.ts`                         | Compute in TypeScript once and transmit rectangles |
| DOM presentation           | Room card buttons, HUD, previews, confirmations, tooltips, weapon/kill stack, menus                    | Keep in React                                      |
| Motion                     | `motion.ts` and `use-motion-director.ts` separate room-pixel beats from DOM chrome beats               | Preserve ownership split and DOM fallback          |
| Accessibility and language | `CardView`, `LiveAnnouncer`, DOM focus management, typesafe-i18n `en`/`zh`                             | Keep all message text and semantics in DOM         |
| Assets                     | 44 JPEGs, indexed by `${suit}-${rank}`; Vite hashes URLs through `card-image.ts`                       | Same source art; generated Godot import staging    |
| Validation                 | Engine, store, bridge, motion/layout, RTL tests; Playwright gameplay, axe, board parity                | Retain and add Godot-specific browser verification |
| Hosting                    | Vite `BASE_URL`, hash routing, Vercel previews/production                                              | Publish additional static export artifacts         |

Important existing behavior to preserve:

- `GameConfig.potionsPerRoom` is `'one' | 'unlimited'`, not the older spec sketch's `1 | Infinity`. State includes `carriedCardId` and a room snapshot with its own snapshot field null, so it is JSON-safe.
- `startRun()` creates and deals in one store update, sets `lastResult` to null, and does not advance `fxSeq`. A new run must therefore be detected independently of the action counter.
- `hydrate()` sets `runResumed: true`; restored rooms reconcile silently. Explicit seed URLs can start a run before hydration, which must not overwrite it.
- Confirming a card action usually produces two store notifications: `act()` followed by `selectCard(null)`. Selection and hover must not retrigger action effects.
- Terminal results replace the per-action result and omit the resolved card identity. Infer final card movement and HP changes from state differences. `weaponBroke` is always false today; do not invent a break mechanic from that field.
- The play board remains mounted behind the terminal scorecard, and its `<main>` becomes `inert`. Preserve the modal focus behavior and existing terminal persistence/statistics behavior.
- The canvas is decorative and receives no pointer input. It owns only room artwork/effects. Card buttons, carried badges, focus/selection indicators, and the weapon/kill stack remain DOM responsibilities.
- Current parity tests check DOM rectangles and canvas placement against the shared layout. They do not directly read rendered Phaser sprite bounds. Godot adds another coordinate boundary, so shared inputs alone will be insufficient evidence of parity.

## Options and decision

| Option                                       | Benefit                                                            | Cost or limitation                                                                        | Decision                                   |
| -------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------ |
| Keep React + Phaser                          | Existing behavior, small integration surface, current tests/builds | No Godot authoring or native foundation                                                   | Baseline and rollback target               |
| React + Godot web room renderer              | Reuse rules/UI; evaluate scene-based art and effects               | WASM/PCK downloads, GDScript boundary, export tooling, lifecycle work                     | Recommended gated trial                    |
| React shell + Godot owning the whole play UI | More visual ownership                                              | Rebuild controls/geometry and maintain DOM equivalents; weakens existing test seams       | Defer; no current requirement justifies it |
| Full Godot web/native app                    | Unified scene UI, potential desktop/mobile distribution            | Rules port, services, localization, accessibility, save/replay compatibility, new testing | Optional second program                    |

During evaluation an explicit development build switch selects `dom`, `phaser`, or `godot`. It must not enter `GameConfig`, persisted settings, or replay URLs. Keep production defaulting to Phaser until the Phase 4 exit gate (see [Acceptance gates and measurements](#acceptance-gates-and-measurements)) passes. Retain DOM as the automatic graphics-failure fallback. A comparison build containing both libraries must lazy-load only the selected renderer; the final replacement build removes Phaser after the observation period.

## Godot web feasibility and version policy

The official archive lists **Godot 4.7.2 stable**, released 2026-08-18, as the newest stable release checked for this plan; 4.8 is a development series. Start with the standard Godot 4.7.2 editor and matching export templates, pinned by exact version and checksum in the future toolchain manifest. Recheck patch status before implementation and record any version change explicitly. Do not silently follow a moving `stable` download. [Official release archive](https://godotengine.org/download/archive/).

Use the Compatibility renderer, GDScript, and a single-threaded Web export. WebAssembly and WebGL 2 are required; unsupported browsers use DOM. Threaded export entails cross-origin isolation headers and is unnecessary for this board. The checked documentation says standard Godot 4 C# projects cannot export to the web, so C# and custom .NET web templates are excluded. [Web export requirements](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html).

Custom HTML shells can embed a Godot export in a page. Their generated configuration starts the runtime; treat generated loader/configuration as version-specific output rather than guessing its module API. [Custom HTML shell](https://docs.godotengine.org/en/stable/tutorials/platform/web/customizing_html5_shell.html).

Godot's web-only `JavaScriptBridge` can register a GDScript callback with a JavaScript host. Keep the callback object referenced for the runtime lifetime and use a small named interface. Avoid interpolated `eval`, imported gameplay code, or direct store access from GDScript. [JavaScriptBridge API](https://docs.godotengine.org/en/stable/tutorials/platform/web/javascript_bridge.html).

No Godot binary, export, or deployment was tested while writing this document. Transparency, mobile stability, input isolation, memory reclamation, effect appearance, and download size remain spike questions, not established capabilities of this integration.

## Target web architecture

```text
DOM click/key -> selection -> DOM preview/confirm
                                |
                                v
                   Zustand -> TS reducer -> save/stats/announcer
                       |
          projection + authoritative TS layout + motion policy
                       |
           React GodotBoard / transport adapter
                       |
          same-origin iframe with custom export shell
                       |
          JavaScriptBridge -> GDScript board scene
                       |
          decorative pixels + ready/error/render diagnostics
```

### Embed and lifecycle choice

Prefer a **same-origin iframe** confined to the room rectangle for the first spike. It scopes Godot's generated globals, canvas handlers, and document lifecycle away from the React page. A local frame host uses `postMessage` to receive projection updates, then invokes the registered GDScript callback through its JavaScript interface. This is a proposed integration design; the spike must verify transparent composition, clipping, performance, focus isolation, and cleanup in actual exports.

The tradeoff stated plainly: the frame's advantages are runtime-crash isolation and cleanup by removing one node; its costs are a second document, a message protocol, and the loader/shell lifecycle inside it. A direct-canvas host reuses the proven `PhaserBoard.tsx` mount/disposal lifecycle and needs no message protocol, but a wedged runtime then shares the page document. The frame stays the recommended first spike; record during Phase 1 which facts (composition, teardown, crash behavior) would justify switching, so the fallback decision is evidence-based.

The exported loader, shell, and GDScript are **trusted application code**. This frame scopes lifecycle and globals; it does not restrict access to the parent DOM or same-origin localStorage. Presentation-only ownership is an architectural rule, not a security guarantee enforced by the frame or message validators. Keep the export first-party and review its scripts/dependencies with the app. If untrusted content or runtime plugins become a requirement, redesign the trust boundary before including them; do not assume that adding both `allow-scripts` and `allow-same-origin` creates a secure sandbox. [Iframe scripting and sandbox limitations](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#scripting).

The iframe and canvas have no tab stop, are hidden from the accessibility tree, and take no pointer events. Remove automatic canvas focus from the custom shell; GDScript has no gameplay input handlers. Prove that arrow keys, shortcuts, and focus remain with the parent DOM. `pointer-events: none` alone does not prove keyboard or global-listener isolation.

Use the generated shell's `Engine` with an explicit canvas and locally controlled resize policy. Its API offers `startGame`, `requestQuit`, and `onExit`; quitting is a request, not a React-style synchronous destroy. [Shell API and configuration](https://docs.godotengine.org/en/stable/tutorials/platform/web/html5_shell_classref.html).

Lifecycle state machine: `idle -> loading -> booting -> synchronizing -> live`, with `failed` and `disposing` exits from every active state.

1. Keep DOM artwork/motion active while loading. Preflight WebAssembly/WebGL 2; do not fetch Godot on title/settings/stats routes or in jsdom.
2. Each mount gets a fresh session identifier and disposal flag. Subscribe to state immediately, retain only the latest snapshot until the frame can receive it, and check disposal after each asynchronous step.
3. Register the callback, validate protocol/build version, prepare textures, and send `bridge-ready(session)`. This signals transport availability, not permission to show the canvas. The parent enters `synchronizing` and sends its latest complete snapshot immediately; it must not wait for a rendered `ready` acknowledgement before sending state. Continue sending newer snapshots while synchronizing. The frame applies them statically and emits `ready(session, revision, layoutRevision)` after its first rendered frame, then `applied` after subsequent rendered updates.
4. Promote `canvas-live` on either `ready` or `applied` when its session, run generation, revision, and layout revision match the latest parent snapshot. A stale acknowledgement is not a failure: stay in `synchronizing`, send the latest snapshot if that revision is not already pending, and allow a later `applied` to complete promotion. Use the same path for state changes, selection changes, and resizes during boot; do not reset the boot deadline or require a second `ready`. Cancel active DOM room ghosts before promotion so two renderers do not animate the same pixels. DOM chrome motion continues.
5. On unmount or failure, mark the session disposed synchronously, unsubscribe, remove message/resize/visibility handlers, restore DOM ownership, request engine quit, and remove the iframe after acknowledgement or a bounded teardown timeout.
6. Late messages from an old frame cannot reactivate a board or affect the new session. StrictMode cleanup and rapid routes must not leave duplicate frames, callbacks, contexts, or animation loops.

Removing a frame is a lifecycle boundary, not proof of immediate WASM/GPU memory reclamation; measure repeated mounts. Single-threaded WASM can still block the browser main thread, so a frame does not guarantee crash responsiveness. If the frame approach fails composition or overhead gates, evaluate a direct-canvas host with equivalent safeguards and teardown measurements. Do not maintain two production embedding implementations.

### Proposed files and boundaries

```text
godot/
  project.godot
  export_presets.cfg             # named single-threaded Web preset
  scenes/board.tscn              # room only
  scenes/card-sprite.tscn
  scripts/board.gd               # keyed reconciliation and animation
  scripts/web-bridge.gd          # protocol validation / retained callback
  scripts/fx-director.gd
  shaders/                      # small Compatibility-tested 2D shaders
  web/board-shell.html           # source template; no automatic canvas focus
  assets/cards/                  # generated resized derivatives/imports, not another source
  tests/                        # headless projection/animation-policy tests
src/game/
  board-protocol.ts              # serializable DTOs, no Godot/store imports
  board-projection.ts            # engine state -> visual projection
  godot-transport.ts             # session-scoped frame messaging
  renderer-selection.ts         # development/build selection
  board-layout.ts                # existing authoritative geometry
  board-metrics.ts               # existing DOM metrics reader
src/ui/GodotBoard.tsx            # mount, fallback, ready/cleanup contract
scripts/
  prepare-godot-assets.mjs
  export-godot.mjs
  check-godot-artifacts.mjs
public/godot/<build-id>/          # generated deployable output, ignored
tests/board-protocol.test.ts
tests/GodotBoard.test.tsx
e2e/godot-board.spec.ts
```

Paths are proposals; retain kebab-case for non-React files. Ignore `.godot/`, generated import/staging assets, and web export output. Track scene/script/shader source, export presets without secrets, source asset manifest, and needed Godot `.uid` sidecars. Godot owns no localStorage, timestamps, stats, rule checks, translations, or user intent dispatch in the web trial. It can preview fixture projections in its native editor without pretending to run the actual game engine.

### Transport contract and synchronization

This subsection specifies the Phase 2 production protocol. Phase 1 does not build all of it: the spike needs only a minimal subset — `sessionId`, one monotonic `revision`, and a per-revision `ack` from the frame, plus a boot-error message and quit. The seven-field envelope, `runGeneration`/`layoutRevision` semantics, and the promotion/supersession rules below are written now as the Phase 2 target; implement and validate them only after Phase 1 has measured the runtime, and revise this subsection against those facts before building the full machinery.

Define protocol version 1 as a JSON-safe, bounded visual projection. Do not send the whole dungeon, settings/stats records, or recursive undo snapshot. Include only room card IDs/order, carried identity, selected/hovered identity, phase, HP/weapon/kill-stack information needed to explain effects, layout, and effective motion policy. The existing bridge can continue serving Phaser; the Godot adapter projects its state at the transport boundary.

Each envelope includes `protocolVersion`, `buildId`, `sessionId`, `revision`, `runGeneration`, `layoutRevision`, `fxSeq`, `kind`, and a payload. `revision` orders transport updates; `fxSeq` identifies action notifications; `runGeneration` distinguishes starts/replacements even when `fxSeq` and seed are unchanged. Derive generation from observed game start/replacement within the host; it is transient, not a save schema change. The discriminator is `runResumed`: a `startRun` (including an explicit-seed start) sets it false and bumps the generation, while a `hydrate` resume sets it true and must not.

| Message             | Direction       | Meaning                                                                                   |
| ------------------- | --------------- | ----------------------------------------------------------------------------------------- |
| `sync`              | Parent -> frame | Complete latest visual truth and geometry; optional action hint                           |
| `hover`             | Parent -> frame | Transient hover change, ignored for missing cards; not replayed                           |
| `policy`            | Parent -> frame | Motion/visibility updates; snap and cancel when necessary                                 |
| `dispose`           | Parent -> frame | Stop accepting updates and request quit                                                   |
| `bridge-ready`      | Frame -> parent | Callback and textures prepared; parent starts sending snapshots                           |
| `ready` / `applied` | Frame -> parent | First/subsequent rendered snapshot acknowledgement; either can complete initial promotion |
| `settled`           | Frame -> parent | Test/development acknowledgement that this revision has no active room choreography       |
| `error`             | Frame -> parent | Structured boot/asset/protocol failure; switch to DOM                                     |
| `diagnostics`       | Frame -> parent | Test/development rects, active effects, counters; disabled in production                  |

Validate origin, `event.source`, session, version, known message kinds, card IDs, finite dimensions, and payload bounds on both ends. Use an explicit target origin, not `*`. The frame never sends gameplay actions. Future canvas interaction would need a separate reviewed intent protocol validated by the TypeScript engine.

Use latest-state reconciliation, not an unbounded event queue. Same-origin `postMessage` delivery is FIFO-ordered, so revisions exist to coalesce superseded state, not to reorder delivery:

- Until `bridge-ready`, retain only the newest snapshot. After that signal, send updates while `synchronizing` as well as while `live`; displayed readiness never gates transport delivery. If actions occur during download/boot, reconcile statically until a matching rendered acknowledgement permits promotion; do not replay obsolete deal/action sequences.
- Once transport is available, serialize notifications in order. If a frame has fallen behind and snapshots are coalesced, discard skipped FX hints and reconcile statically from its last applied projection to the newest truth. A pending revision may be superseded by the latest complete snapshot without waiting for an older acknowledgement.
- Regression sequence: send revision 1, advance state and/or layout to revision 2 before `ready(1)` arrives, reject promotion for revision 1, deliver revision 2, and promote on `applied(2)`. Also exercise multiple superseding updates and disposal before that acknowledgement. `settled` is separately scoped to the current session/run/revision/layout and must never acknowledge cancelled choreography as the latest state.
- Key sprites by `CardId`, but distinguish departure and arrival animation instances when fleeing returns the same card. Never delete a newly re-dealt sprite because an older departure callback finishes.
- State diffs determine arrivals/departures, HP delta, weapon swaps, and terminal movement. `lastResult` provides hints only. Never reduce actions in Godot.
- Selection-only or repeated-selection updates change highlights without restarting animations. One `fxSeq` gets at most one action effect, including invalid actions that leave game state unchanged.
- A run replacement cancels all old effects even if the new seed matches. A resume/undo, visibility return, skipped update, or resize reconciles directly to the authoritative layout before continuing.
- Engine/store truth commits immediately. Animations never delay saving, stats, input legality, or the terminal modal. Rapid actions cancel superseded visual beats and settle to current truth.

## Geometry, appearance, and motion

### One layout calculation

React reads `.room` computed styles through `readRoomMetrics`, computes `computeBoardLayout`, sizes the room, and supplies that same ordered `CardId -> Rect` mapping to DOM hit targets and Godot. Do not translate the CSS clamps, padding, wrap decision, or layout algorithm into GDScript. This preserves desktop rows, mobile 2x2 wrap, and centered partial rows.

The frame's CSS box equals the room box. Rectangles are in CSS pixels relative to that box; report actual canvas CSS bounds, framebuffer size, viewport size, and the explicit transform into Godot coordinates. DPR affects backing resolution, not the logical coordinates supplied by React. Synchronize ResizeObserver, browser zoom, orientation, and DPR changes; never use default whole-window stretching or unexplained letterboxing. Ignore zero-size hidden layouts until a valid measurement arrives.

Expose rendered Godot card bounds in test builds and compare their mapped CSS coordinates with real DOM button rectangles. Assert every axis within 1 CSS pixel at rest, rather than inferring sprite parity from shared inputs. Test 1–4 card rooms, carryover, terminal state, desktop 1280x800, mobile 390x844, narrower widths, DPR 1/2/3, orientation changes, and 200% browser zoom. Record any pre-existing narrow-layout limitation separately instead of silently redesigning the app during adoption.

### Asset pipeline

Keep `assets/*.jpg` the only authored card source. Repository measurements at `1e8a3b2`: all 44 JPEGs total **38.61 MiB raw / 38.11 MiB gzip**, with dimensions 1152x1728 or 832x1248. The four `s20` room images alone total 3.21 MiB raw. These are source-file measurements, not Godot PCK/export measurements. Copying the full-resolution deck and relying on default imports is not a demonstrated route to the 5 MiB whole-export gate; Godot's default 2D import uses lossless compression. [Texture import/compression options](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_images.html).

A future Node asset-preparation script validates exactly the expected 44 IDs and generates resized PNG derivatives under Godot's staging directory, preserving aspect ratio and leaving authored JPEGs untouched. Start with a maximum width of **576px** (the current 192 CSS px card width at DPR 3), without upscaling smaller sources. Explicitly set Godot's texture import to **Lossy, quality 0.8, mipmaps disabled** for the initial 2D trial. Pin the image-processing tool/version, dimensions, import options, and source/derivative hashes in the manifest and build cache key. Inspect actual imported resources so a clean import cannot silently revert to defaults. These are starting settings to validate at the target DPR/zoom/crop, not a claim that the result meets quality or size requirements.

Phase 1 must import and package **all 44 optimized card textures**, verify that the complete deck is present in the export, and measure loader/WASM/PCK/support-file bytes and startup on the named devices before Phase 2. Four visible sprites are sufficient for the scene demo, but a four-texture pack is not sufficient for the feasibility report.. Break the report into engine/support and full-deck texture costs and compare it against the 5 MiB compressed budget without exempting assets. Known context for that report: published upstream figures for a stock Godot 4.3+ web build put the `.wasm` alone near ~5 MB compressed with Brotli — before loader, PCK, or textures (upstream figure; confirm it when the toolchain is pinned). A stock export is therefore expected to miss the 5 MiB budget once textures are added, and the known remedy is a stripped custom export template (disable 3D and unneeded modules); Phase 0 decides whether that template spike runs inside Phase 1, and its maintenance cost stays excluded from the baseline estimate. Phase 1 therefore **measures and reports** payload, startup, and quality against the budget as a decision input; the hard 5 MiB compressed total is enforced at the Phase 4 pre-rollout gate. If quality passes but size fails, compare explicit resolution/quality variants and rerun the complete export measurement; if no acceptable variant passes even with the stripped template, stop or document an explicit revised product tradeoff before app integration. Do not infer delivered size from source gzip figures.

The DOM continues using Vite's hashed `cardImageUrl` mapping. This deliberately duplicates delivered representations; report total cold-page artwork transfer as well as Godot-only payload, imported-texture/GPU memory, and startup peak memory. Optimizing DOM artwork is separate work and cannot be credited as a saving from this renderer change.

Do not rely on filesystem symlinks across Windows/Linux or manually maintain two sets of card artwork. Verify crop/aspect/color/filtering on HiDPI and mobile; exclude unused textures/resources from export. If a required canvas texture fails, keep/revert to the readable DOM card fallback and avoid promoting an incomplete board. Runtime fetching of Vite images is an alternative only if measured duplication is a blocker, because it adds loading and texture-conversion paths.

### Scene and effects

Use a single 2D board scene with keyed card nodes, a bounded pool of transient ghosts, and an effects director. No physics or gameplay processing. Use explicit rectangle sizing and pivots, then map existing deal/flip/resolve/sweep/undo timings and easing to Godot tweens. Recreate glow, hit sparks, heal pulse, vignette, and terminal celebration with Compatibility-tested 2D materials/particles; Phaser FX cannot be copied directly. Plan around the Compatibility renderer's documented gaps — no particle trails and no `emit_particle` support — by using CPUParticles2D or material-only equivalents for sparks and celebration; vignette via screen-reading shaders is supported.

Preserve room-only motion ownership: DOM still animates weapon stack/HUD/chrome, while Godot owns room pixels only after readiness. Fly-to-weapon animations hand off at the room boundary rather than duplicating the weapon stack. Selection/focus outlines and carried text remain DOM. The terminal scorecard keeps its current timing; cosmetic celebration cannot postpone it.

Effective reduced motion is stored preference OR `prefers-reduced-motion`; transmit it and update on changes. Reduced motion disables flips/travel/shake/ambient particles and uses static reconciliation or a quiet fade of at most 120ms. On policy changes cancel running tweens/particles immediately. Hidden tabs suspend ambience; return to the latest state without catch-up effects. Cap particles/ghosts and investigate redraw-on-demand or low-processor behavior when idle; do not assume an empty scene has zero frame-loop cost.

## Accessibility, localization, and compatibility

The existing DOM is the accessibility contract. Keep card buttons, `aria-label`/`aria-pressed`, carried badge, selected ring, tooltips, HP meter, action confirmations, LiveAnnouncer, and terminal dialog. Godot draws no localized text; printed ranks/suits already present in artwork remain image content. New fallback/loading messages, if needed, use MessageKeys in both dictionaries and manually maintained generated i18n types.

Test with keyboard-only input, NVDA plus a desktop browser, and VoiceOver plus Safari where available, alongside axe. Confirm no frame/canvas focus trap, duplicated announcements, or hidden interactive controls. If export is slow or fails, the game is still immediately usable through DOM. Graphics support cannot be a prerequisite for playing.

Web adoption preserves all schema version 1 data. It neither converts saves nor changes `SCHEMA_VERSION`; renderer state is transient. Replay tokens remain `free-run`, `free-potions`, and `no-degradation`, with the same hash routes and seed normalization. Test settings/stats/run fixtures from the current build, mid-room undo snapshot, terminal reload, once-only stats, explicit seeded URL precedence, and storage-unavailable behavior through both renderers. Do not claim this improves existing persistence crash atomicity or validation.

## Build, CI, and Vercel

### Reproducible export

Keep ordinary React development usable without Godot installed. Add explicit future scripts such as `godot:assets`, `godot:import`, `godot:export`, `build:godot`, and `check:godot`; do not turn every `pnpm dev` invocation into an export. The Godot development mode needs a prebuilt export and an explicit rebuild step; changing `.gd`/`.tscn` triggers a frame reload, not Vite HMR inside the runtime. Document the pinned editor path on Windows and Linux.

The future export wrapper creates output directories, prepares assets, imports resources, then exports release artifacts with matching templates. Example commands below are illustrative and require those proposed files/tools; they have not been run:

```sh
godot --headless --path godot --import
godot --headless --path godot --export-release Web ../public/godot/<build-id>/board.html
```

Check import/export exit status and logs, expected files, protocol/config manifest, source hashes, and no missing-texture/script errors. Use a real release export for browser validation; headless checks cannot prove WebGL behavior. [Godot command-line import/export](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html).

### Static artifact integration

Serve the generated HTML, loader JS, WASM, PCK, and any generated support files together under `public/godot/<build-id>/`. Vite copies them into `dist/godot/<build-id>/`. Address the host HTML using `import.meta.env.BASE_URL`; inside the frame use relative URLs. The default React entry/hash router remains the main site entry. Do not serve a second full-page game at the root or let SPA rewrites return HTML for missing WASM/PCK.

Generate the export configuration from the custom shell placeholders and verify all referenced filenames; do not hardcode an assumed list across Godot upgrades. Content-version the complete export directory and manifest so a cached loader cannot pair with a different PCK/WASM. Keep artifacts same-origin; avoid CDN-dependent runtime loading. Disable the export PWA/service worker initially to avoid a second cache controller. Web canvas transparency is not officially documented for Godot web exports (long-standing upstream request), so treat an opaque viewport as the baseline: the Godot scene must draw the room background itself so the room box looks unchanged, and treat actual transparency as a bonus to confirm in the spike.

Vercel configuration work must verify correct MIME types, compression, cache policy, frame policy, and deployed root/subpath behavior. Use `application/wasm` for WASM and binary delivery for PCK; check actual response headers and content, not just a successful build. Single-threaded baseline avoids COOP/COEP. Phase 1 must verify the edge actually compresses `.wasm`/`.pck`; uncompressed transit counts against the Payload gate (see risks). Test a future `BASE_URL=/scoundrel/` build and Vercel preview directly, including copy-link and reload. [Web artifact serving guidance](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html#serving-the-files).

### CI and deployment ownership

The existing CI uses Node 22 and runs lint, tests, typecheck/build, JS budgets, then Chromium e2e. Extend it with pinned Godot editor/templates, a clean import/export, artifact validation, and a Godot browser job. Cache tools/templates/imports by version and source hash, but also prove a cache-empty build. Keep existing tests green and jsdom isolated from the loader/frame runtime.

Vercel must receive the same tested export as CI. Prefer a verified build wrapper that downloads/checks the pinned toolchain and exports before Vite, subject to a Vercel preview spike. If its build environment cannot support the toolchain/time budget, gate production adoption on an alternative that deploys a complete CI-built `dist` through the established Vercel project; record credentials, preview behavior, and artifact provenance before switching deployment ownership. Do not assume CI-generated ignored files appear in an independent Vercel Git build.

`check-bundle-size.mjs` currently measures only `dist/assets/*.js` (420 KiB per chunk, 550 KiB total gzip). Godot's loader and binaries outside that directory could escape the existing budget. Preserve the JS gate and add a manifest-based export gate covering raw/gzip/Brotli size, all support scripts/binaries/textures, and actual cold/warm network transfer. Measure download, compile, initialization, and first applied frame separately.

Include required Godot and bundled third-party notices in distributed artifacts and credits/About; audit existing card-art attribution separately. [Godot license compliance](https://docs.godotengine.org/en/stable/about/complying_with_licenses.html).

## Acceptance gates and measurements

The numbers below are proposed adoption thresholds, not measured results. Freeze the named devices/browser versions and the measurement script in Phase 0 before implementation. If the spike fails a threshold, either stop or explicitly revise the product tradeoff; do not redefine passing after seeing results.

| Gate            | Proposed criterion                                                                                                                                                                                                                                                                                                      | Evidence                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Rules/data      | Identical TypeScript state/saves/stats for the same trace across renderer choices, enforced by an adapter-fence test: no transport message or GDScript path reaches the engine or store; renderers never send gameplay actions                                                                                          | Existing tests plus deterministic browser traces                |
| Accessibility   | No new serious/critical axe findings; all current keyboard/screen-reader flows remain usable                                                                                                                                                                                                                            | Axe and manual NVDA/VoiceOver record                            |
| Geometry        | Actual rendered sprite and DOM bounds differ by at most 1 CSS px at rest                                                                                                                                                                                                                                                | Frame diagnostics plus browser measurements                     |
| Loading         | DOM gameplay usable throughout; no Godot request on menu-only sessions                                                                                                                                                                                                                                                  | Throttled/failed-load traces and route network tests            |
| Payload         | Compressed Godot-only cold payload <= 5 MiB, including loader/WASM/PCK/support files and all 44 optimized card textures; Phase 1 measures and reports it as a decision input; the hard numeric stop is enforced at the Phase 4 pre-rollout gate; existing JS budgets still pass                                         | Complete-deck artifact report and deployed transfer measurement |
| Readiness       | Cold canvas ready <= 5s on named midrange desktop and <= 8s on named lower-end phone, 10 Mbps/100ms test profile; warm cache <= 2s. Phase 0 derives this row jointly with Payload: payload × bandwidth + measured wasm compile + boot must fit the budget; if not, lower the payload target rather than relax readiness | Median and p95 over at least 10 runs; gate on p95               |
| Responsiveness  | Confirm input to updated DOM state p95 <= 100ms after boot; separately report blocking during boot                                                                                                                                                                                                                      | Input/long-task trace                                           |
| Animation       | >= 55fps over active board beats on named 60 Hz devices, with p95 frame interval <= 25ms; no unbounded transient growth                                                                                                                                                                                                 | Real-device profiling, Phaser comparison                        |
| Lifecycle       | 20 rapid route transitions and StrictMode replay leave one active board at most; after warm-up, 50 mount/dispose cycles show no continuing retained-runtime/context growth                                                                                                                                              | Browser counters, heap/context snapshots, visual check          |
| Failure         | Blocked WASM/PCK, WebGL 2 missing, timeout, incompatible protocol, missing texture, and controlled runtime error restore working DOM without modifying the run                                                                                                                                                          | Browser fault-injection matrix                                  |
| Authoring value | A named representative effect can be edited/reviewed in Godot and improves the approved visual outcome versus current Phaser, judged by a named approver against comparison criteria frozen in Phase 0                                                                                                                  | Side-by-side capture and documented editor workflow             |
| Delivery        | Cache-empty CI export and real Vercel preview both pass, including subpath and older save fixtures                                                                                                                                                                                                                      | CI logs and deployed browser/header checks                      |

Measure Phaser and Godot using the same seeds, art, motion settings, devices, and scene workload. Report total page transfer including duplicated DOM artwork, incremental Godot transfer, startup peak memory, idle CPU, active animation cost, and teardown separately. The historical Phaser plan's bundle measurements and outstanding real-device performance check are context, not a substitute for a new baseline. Select real desktop/Android/iPhone hardware in Phase 0; Chromium mobile emulation or WebKit automation cannot replace Safari on iOS or a lower-end Android GPU.

## Delivery phases

Estimates assume one engineer comfortable with TypeScript and learning/using Godot. They are working-day ranges and exclude waiting for unavailable devices or deployment access; they also assume the Godot learning curve fits inside the bands, and real-device access (iOS in particular) is the likely calendar critical path. Treat the top of each band as the planning number. Each phase produces a reviewable deliverable and can end the effort without compromising the current game.

| Phase                           | Work                                                                                                                                                                                                                                       | Deliverable and exit gate                                                                                                                                                            | Estimate                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| 0 — Baseline and decisions      | Choose devices, freeze budgets, record current Phaser behavior/size/perf, pin toolchain, decide the stripped-export-template scope question, jointly derive the Payload and Readiness budgets, define comparison effect and test scenarios | Baseline report and fixture/protocol design                                                                                                                                          | 1–2 days                         |
| 1 — Web feasibility spike       | Full 44-card optimized texture pack with four visible sprites, explicit import settings, custom frame shell, transparent composition, callback handshake, parent input isolation, resize/DPR, repeated teardown, static Vercel preview     | Complete-deck payload/quality/startup measured against budgets as the Phase 1 decision input; the hard 5 MiB stop is the Phase 4 gate; stop if embedding or download is unacceptable | 5–8 days                         |
| 2 — App synchronization         | Host/transport/projection, latest-state boot, state/run/action revision handling, DOM promotion/fallback, authoritative layout, silent resume                                                                                              | Full gameplay uses unchanged engine/store; real sprite parity and failure tests pass                                                                                                 | 3–5 days                         |
| 3 — Motion and effects          | Existing animation beats, selection/hover, reduced motion, terminal effects, resize/undo/visibility/rapid-action cancellation                                                                                                              | Side-by-side Phaser/Godot demo with no duplicated room animation; visual benefit and perf gate pass                                                                                  | 5–8 days                         |
| 4 — Build and release hardening | Clean asset import/export, notices, CI, artifact budgets, deployed MIME/cache/base verification, browser/device/a11y matrix                                                                                                                | All acceptance gates pass on actual production-like export and Vercel preview                                                                                                        | 3–5 days                         |
| 5 — Controlled adoption         | Enable Godot in a reviewable release, retain prior deployment/build switch, observe errors/fallback rate and data behavior                                                                                                                 | Observation report; remove Phaser only after release acceptance                                                                                                                      | 1–2 days plus observation period |

Expected total for a production-quality web renderer evaluation/adoption: **18–30 engineering days**, with the top of each band as the planning number. Initial go/no-go evidence should arrive after Phases 0–1, approximately 6–10 days. No implementation phase is authorized or started by this document.

Suggested future slices: toolchain/static demo; host/protocol; static state/layout parity; lifecycle/fallback; action choreography; effects/motion policy; CI/hosting/browser gates; rollout/removal. Keep each slice small and keep Phaser the production default until Phase 5. These are planning slices, not created issues.

## Test plan

1. **Keep existing coverage:** engine/store/RTL/i18n/motion/bridge/layout and gameplay/accessibility e2e must pass. No Godot runtime in Node/jsdom. Mock transport/loader for wrapper tests and validate async cleanup, old-session rejection, ready revision matching, timeouts, and fallback ownership.
2. **Protocol tests:** malformed messages, unknown cards, version mismatch, stale session/revision, selection-only updates, repeated invalid action FX, identical-seed run replacement, skipped frames, late readiness, dispose idempotency. Explicitly exercise the stale-ack regression sequence specified in [Transport contract and synchronization](#transport-contract-and-synchronization) — revision 1 superseded by revision 2 before promotion, multiple superseding updates, unmount before acknowledgement — rather than restating it here. Assert that transport proceeds while synchronizing and stale messages neither reset the timeout nor revive disposed sessions. Test actual sequencing properties rather than mirroring DTO fields in assertions.
3. **Godot headless tests:** JSON projection parsing, sprite mapping, generation-safe cancellation, final static transforms, motion-policy suppression, bounded transients, and invalid-message handling. Use a small headless test runner unless a maintained third-party framework is deliberately selected. Exported browser tests remain mandatory for shaders, input, and JS callbacks.
4. **Browser integration traces:** seed `s20` deals diamond-5, heart-9, spade-8, diamond-9; exercise equip/potion/fight, carryover, next room, undo, blocked and successful flee, overlapping flee/redeal, weapon swap/kill stack, all eight config combinations, final 1–4-card rooms, both terminal outcomes, abandon/restart, hydration, and terminal reload. Reuse engine-generated fixtures for uncommon states instead of hand-authoring inconsistent saves.
5. **Renderer parity:** create a fresh browser context for each renderer and preload the same versioned settings/stats/run fixtures before app initialization, or start all three with identically empty storage. Set the same explicit seed/config and fixed wall-clock time before navigation using `page.clock.setFixedTime(new Date('2026-09-30T12:00:00Z'))`. The store obtains `startedAt` and terminal stats dates from `Date.now()`, so a seeded URL alone does not make complete saved records identical. Fix only wall-clock reads. Playwright documents fixed `Date.now` with timers flowing, but its clock also manages `requestAnimationFrame` and `performance`; verify in an early trace that rAF-driven animation and `performance.now` behave naturally under `setFixedTime`, and pin the Playwright version's behavior before relying on it for Godot boot and animation timing. Then run the same action trace through DOM, Phaser, and Godot and compare complete engine/save/stat records and current DOM roles, including timestamps. Keep cold/warm performance benchmarks separate and use real clocks there. [Playwright fixed time with live timers](https://playwright.dev/docs/clock#test-with-predefined-time).

   Add actual sprite-bound diagnostics and seeded screenshots at settled milestones. Deterministic cosmetic particles or disabled random ambience make screenshot comparison repeatable. Await current-session/revision `applied` and test-only `settled` acknowledgements rather than fixed sleep durations; DOM/Phaser comparison paths need equivalent settled checks. Compare parsed JSON values, not object-key serialization order, and do not omit timestamps or stats idempotency fields to mask differences.

6. **Faults and lifecycle:** slow/failed fetch, corrupted/incompatible artifact, unavailable graphics, asset failure, early navigation, StrictMode, hidden tab, resize during animation, policy change, rapid confirm/undo/flee, and readiness after unmount. Verify fallback preserves selection, correct labels, and current game truth.
7. **Cross-browser/device release evidence:** Chromium/Firefox/WebKit automation plus real Chrome Android and Safari iOS, desktop zoom/DPR, manual screen readers, cold/warm caches, root/subpath deployment. Existing CI covers Chromium only; expanding it is future work and mobile reliability is unverified today.

## Rollout, rollback, and risks

Roll out through a development comparison build and Vercel preview first. Publish no save migration with the renderer change. Keep a prior deploy and build switch capable of restoring Phaser immediately; DOM handles per-session failures without reload or run replacement. Avoid auto-retrying a failing Godot boot in a loop. Keep user-visible failure explanations localized and restrained, and expose diagnostics to developers.

Before default adoption, record all gates, exact toolchain/export hashes, known device limitations, and visual sign-off. Observe at least one release interval for boot errors, fallback frequency, user input problems, and stats/save regressions; collect only renderer diagnostics needed for that review. Phaser removal then deletes its dependency and presentation files while retaining shared layout/bridge concepts that remain useful. Update README/AGENTS and historical plan status in that future implementation change.

| Risk                                                                                | Mitigation and stop condition                                                                                                                                               |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WASM/PCK dwarf current renderer payload                                             | Measure before app integration; cap transfer and startup; stop if matching ordinary browser expectations needs an unacceptable download                                     |
| Godot editor/runtime adds no useful authoring benefit                               | Require a representative edit/effect comparison; keeping Phaser is an acceptable outcome                                                                                    |
| Frame transparency/input/viewport behavior fails                                    | Isolate in Phase 1; test direct-canvas alternative once if justified; stop if DOM semantics or alignment cannot be preserved                                                |
| Repeated boot/teardown leaks contexts or memory                                     | Session isolation, cancellation, bounded quit, frame removal, measured cycles; block default adoption on unresolved growth                                                  |
| Main-thread boot harms React responsiveness                                         | Keep DOM playable, profile tasks; frame isolation does not solve blocking; reject unacceptable stalls                                                                       |
| Duplicate animation or stale terminal scene                                         | Single pixel owner, state diffs, revisions/generations, current-truth snapping; never gate gameplay on completion                                                           |
| WebGPU/Vulkan-oriented effects fail on web                                          | Compatibility-only shader/particle trial on real devices; simplify effects before considering custom engine builds                                                          |
| CI export succeeds but Vercel lacks artifacts                                       | Verify toolchain/build provenance and a real preview in Phase 1; block production until reproducible delivery is proven                                                     |
| Scope expands into a rules rewrite                                                  | Keep standalone work a separate program with explicit parity and product gates                                                                                              |
| iOS Safari web limits (wasm memory ceiling, WKWebView WebGL eviction inside frames) | Named-device iOS gates in Phases 1 and 4; measure memory and context loss on real Safari; block default adoption until iOS passes                                           |
| bfcache restores a quit or suspended frame/runtime                                  | pageshow(persisted) handler tears down or re-syncs on restore; navigation away/back in fault tests; treat resurrected old-session messages as disposed                      |
| Edge/CDN does not compress .wasm/.pck                                               | Phase 1 verifies deployed response headers and actual transfer bytes; uncompressed transit counts against the Payload gate; delivery stop condition unless serving is fixed |

Stop after any failed core accessibility/data/lifecycle gate, an unexplained visual ownership bug, or unacceptable payload/startup/device support. Preserve findings and leave the current app as the shipped version. A custom stripped export-template build is the known route to a passable payload budget; whether its spike sits inside Phase 1 is decided in Phase 0 (see [Asset pipeline](#asset-pipeline)), and its maintenance cost is not assumed in the baseline estimate.

## Standalone Godot edition: optional second program

This path applies if the desired product is a full Godot game, especially for native desktop/mobile distribution. It can reuse scene/asset/effects work from the trial, but the trial's renderer is not a ready-to-ship native game. Reopen the product requirement before starting: which platforms, whether the existing web app remains supported, and whether native/web users must exchange saves as well as seeds.

### Rules and determinism

Prefer a pure GDScript domain module — no scene tree, UI nodes, filesystem, clocks, or Godot RNG — mirroring `(state, action) -> {state, result}` with serializable value objects/deep copies (mutable Arrays/Dictionaries must not corrupt snapshots) and explicit time inputs. Keep selection out of engine state. Do not bundle a JavaScript VM or unofficial TypeScript runtime to avoid the port unless separately evaluated.

Build a shared golden corpus from the TypeScript engine first: normalized seed/config, fixed `startedAt`, initial dungeon, action trace, every state/result, derived queries, final score, and save/replay encoding — legal and illegal actions, all toggles, terminal overrides, repeated undo, carried potions, final rooms, failure scoring. Run both implementations headless against it and broaden with deterministic generated traces; compare structural values after numeric normalization, not dictionary property order.

Preserve these exact rules/compatibility details:

- Deck order before shuffling: clubs, spades (2–10/j/q/k/a), then diamonds, hearts (2–10).
- Seed trimming/lowercasing, 1–9-character base36 parsing with uint32 truncation, and FNV-1a fallback over JavaScript UTF-16 code units. GDScript Unicode iteration is not automatically equivalent; include non-ASCII seeds and explicit code-unit handling.
- mulberry32 arithmetic: JavaScript signed/unsigned 32-bit coercions, logical right shifts, `Math.imul` overflow, division by 2^32, and descending Fisher–Yates indexing. Godot's seeded RNG does not produce equivalent decks.
- Strictly lower monster values after a weapon kill, non-negative damage, optional barehanded attacks, weapon swap discarding its entire kill stack, potion waste/count/reset, untouched-room flee restrictions including final-room blocking, ordered bottom-of-deck return, and explicit next-room carryover.
- Single-room undo restores all engine truth and does not cross rooms; terminal states reject further actions. Loss scoring uses remaining dungeon monsters in the current implementation, not unresolved room monsters or negative HP. If rules/spec interpretation needs revision, resolve it separately from the port rather than silently changing behavior.

### Services and complete UI

Build a domain-independent application service coordinating engine, selection, persistence, stats, replay, and announcements; Godot scenes emit intents and consume state. Recreate every screen (Title, Play, Stats, Settings, About), previews/confirmations, tooltips, terminal modal, and weapon/kill stack with Control layouts. Test focus, scaling, touch, localization, and screen-reader support per platform — native accessibility does not automatically match the browser DOM, and a full web Godot edition needs an accessible web strategy demonstrated against the current standard before replacing the React product.

Pick one localization source of truth and generate Godot translation resources from the existing dictionaries/keys, preserving interpolation semantics and English/Chinese wording, and bundle/test suitable CJK fonts — additional work absent from the text-free renderer trial.

Keep browser services in the React app during transition. Native saves need a versioned platform adapter (e.g. files under `user://`) with atomic replacement/backup, validation, and migration — they cannot read an existing origin's localStorage, and browser-origin changes cannot silently carry storage between deployments. JSON export/import only if cross-platform saves are a product requirement; preserve schema wrappers and the `RunSave {state, statsWritten}` contract where compatible, and migrate before changing shape.

Keep seed/config links byte-compatible for the web edition; native deep-link registration/copying is separate OS integration. A share URL reproduces the initial dungeon/configuration, not action history. Preserve idempotent run aggregation and bounded history; define stronger cross-file crash recovery if native persistence requires it.

### Standalone milestones and gate

| Milestone                      | Deliverable                                                                                        | Indicative effort |
| ------------------------------ | -------------------------------------------------------------------------------------------------- | ----------------- |
| N0 — Product/platform decision | Target platforms, coexistence/retirement policy, accessibility and save compatibility requirements | 1–2 days          |
| N1 — Portable rules            | Pure GDScript engine and TypeScript/Godot golden-corpus parity                                     | 5–8 days          |
| N2 — Application services      | Versioned saves/stats/settings, replay parser, platform services                                   | 4–7 days          |
| N3 — Complete UI               | All screens/interactions, translations/fonts, input/focus/a11y verification                        | 8–12 days         |
| N4 — Distribution              | Native/browser export matrix, real-device QA, packaging/signing/update policy                      | 5–10 days         |

Approximately **23–39 additional engineering days** before any platform-specific store review or credential wait, depending on targets and accessibility requirements. Native distribution cannot use Vercel as its binary installation/update mechanism; retain Vercel for the supported web edition and choose desktop/mobile release channels separately. Mobile signing/store work is outside the web trial. Retire React only after complete feature/rule/save/replay/accessibility parity and an explicit product decision; supporting both engines indefinitely adds ongoing conformance maintenance.

## Decisions to carry into implementation

Recommended defaults are web-first room-only replacement, Godot 4.7.2 standard/GDScript/Compatibility/single-threaded export, same-origin frame isolation, TypeScript-authoritative geometry/rules/services, generated card asset staging, and Phaser retained until measured release acceptance. These let Phase 1 start without a rules rewrite.

Still to resolve in Phase 0: the specific authoring/visual benefit being sought, named real-device matrix, acceptance-budget sign-off, actual Vercel toolchain feasibility, and whether a future native product is wanted. None blocks this planning deliverable. The first implementation decision should follow the measured spike, not the existence of this proposal.
