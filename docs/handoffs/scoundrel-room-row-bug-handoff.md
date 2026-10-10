# Handoff — Scoundrel "room row deal-flip reset" bug (phase 5 Godot deployment)

Written 2026-10-10. Aimed at a fresh agent continuing the room-row bug work: confirm the root cause with quantitative evidence, then (only on explicit user authorization) propose/implement a fix.

## 1. Mission

- User reported: on the phase-5 Vercel deployment of Scoundrel, after clicking **New run** on the title screen, cards deal into the room row and the card **flip animation resets mid-play**; the deal motion is **not smooth**.
- Original instruction was **explore/analyze only — no code changes**. That mandate still stands for the source tree. Any fix must be re-authorized and would be a new task.
- Next session should: (a) finish the quantitative verification that was interrupted, (b) hand the user a confirmed root-cause write-up, (c) only after authorization, shape a fix and regression test.

## 2. Context and code state

- Repo: `C:\Users\David\dev\scoundrel`, branch `feat/godot-zai-glm` at `018150f` — same code as the deployment (build id `bf22256d34574`, commit `e0378d7`).
- Phase 5 = controlled adoption of the Godot board renderer (production default still `phaser` in `src/game/renderer-selection.ts:50`; the deployment forces `godot` via build env `VITE_RENDERER`). Plan and rollout notes live in `docs/plans/godot-plan.md` and the Phase-5 section of `docs/plans/godot-phase0-baseline.md` — do not re-derive them, read them.
- User-provided deployed URL for observation: `https://scoundrel-gwtuj8yyr-wdavidcai-4263s-projects.vercel.app/` — **behind Vercel SSO deployment protection**; unauthenticated browser sessions get redirected to Vercel login. Local preview reproduction is the working alternative (see §5). No credentials/tokens are available or needed in this doc — nothing sensitive found.

## 3. Findings (root-cause analysis, static)

### Primary cause — the room deal plays twice, then the flip visibly "resets"

Timeline for the user's exact flow (title → New run):

1. `startRun` runs, then `navigate('#/play')`; PlayScreen mounts with the room already in state (`src/ui/screens` path is `src/ui/screens/TitleScreen.tsx` for the button, `src/ui/PlayScreen.tsx` for the screen).
2. PlayScreen's motion director immediately executes a **DOM mount deal**: ghost clones in a fixed `.fx-layer` overlay on `document.body` fly in from the deck edge, each with a WAAPI `rotateY` flip (slide 300 ms, flip 250 ms, 70 ms stagger ⇒ ~510 ms total). Path: `src/ui/use-motion-director.ts` (`onMounted`/`onCommit`) → `src/ui/motion.ts` `MotionDirector.planChoreography` (`pushDealStep` at motion.ts:924) → `spawnDealGhost` (motion.ts:223).
3. It runs despite the canvas being configured because the canvas-ownership check reads the `.canvas-live` marker **at plan time** — `motion.ts:555-556`. The Godot iframe is still booting (wasm+pck ≈ 0.9–1.1 s warm after DOMContentLoaded, measured 905/1011/1123 ms in `docs/plans/godot-phase0-baseline.md:130`), so the marker does not exist yet and DOM room beats are not dropped.
4. The frame boots, applies the first sync, and runs **its own** mount deal: staggered deal-in + two-phase scaleX flip reveal ≈ 850 ms — `godot/scripts/board.gd:175-181` → `godot/scripts/fx-director.gd:100-124` (`deal_in`) and `godot/scripts/card-sprite.gd:115-124` (`play_flip_reveal`).
5. The frame acks `applied` one rendered frame in (`board.gd:148-151`); `canvasLive` promotion follows (`src/ui/GodotBoard.tsx:193-211`), DOM card artwork goes `visibility:hidden` (`src/styles.css:516-519`), canvas promoted (`styles.css:474-476`).
6. **Nothing cancels the in-flight DOM deal at promotion.** `onApplied` only calls `notifyLive(true)`; the comment at `GodotBoard.tsx:207-209` claims ghosts are cancelled "in the same commit", but the code doesn't. `cancelAll` (`motion.ts:103-130`) only runs on store changes/unmount; `GhostFX` ghosts self-remove only when their animations finish.

Effect: on a warm boot the canvas promotion lands while the DOM flip is still playing (or just finished) — the observed flip vanishes and the Godot deal-in replays the same choreography from zero. This matches the user's "brief moment where the card flipping animation resets in the middle of the animation play". On cold boots the DOM deal finishes first and what registers instead is deal → static → second deal.

### Smoothness (stutter) contributors in the same window

- Two renderers animating simultaneously during the overlap window (canvas + `.fx-layer` ghosts over it).
- Up to 4 **synchronous** `load()` PNG decodes from the PCK in the frame's first reconcile (`card-sprite.gd:150-162`) immediately before the deal tweens start.
- The promotion commit restyles `.room`: inline height + 4 `.tooltip-wrap` hit-layer buttons and tooltips move from flex flow to `position:absolute` (`styles.css:492-495`, `PlayScreen.tsx:202-249`) — layout/paint right as the canvas starts rendering.
- Engine boot/ramp-up cost sharing the same ~1 s window.

### Secondary hazards verified in code (not required for the title flow)

- **Mid-deal re-deal fallback**: a hint-less sync whose room **rect values changed** triggers `board.gd:185-191` full swap: `snap_to` kills running flip tweens (`card-sprite.gd:80-84`, `_kill_tweens`) and `deal_in` re-runs `show_back()` + `play_flip_reveal` for every card — literal reset. Geometry analysis says the promotion is rect-neutral (`.room` min-height `card-h+36px` matches the canvas-live inline height; `--card-w` is a vw-based `@property`, stable — `src/game/board-metrics.ts:19`, `src/game/board-layout.ts`), so the title flow likely never hits it; still a structural footgun for any layout change mid-deal. Also `card-sprite.gd:142-144` snaps `_face.scale` without killing the flip tween (`set_rect` on a non-selection-only sync).
- **Seeded-URL + Play again double-`startRun`** (H1 of the prior session's harness): `src/ui/PlayScreen.tsx:50-61` re-fires `startRun` one frame after `GameOverScreen.playAgain`'s random `startRun` when the leftover `?seed&config=` URL no longer matches ⇒ `runGeneration` bumps twice ⇒ `board.gd:137-138` `_clear_all_sprites()` mid-deal ⇒ re-deal. Only affects runs reached via `#/play?seed=...` — `src/ui/GameOverScreen.tsx:45-49` navigates to `#/play` without a seed, so the title flow is unaffected.

## 4. Verification status

- Verified: the full static causal chain on the exact deployed code; local production build with `VITE_RENDERER=godot`; the Godot frame boots and promotes (`iframe[data-canvas-ready="true"]`) in a headed browser; artifacts exist (§5).
- Pending: the **quantitative pass** — message-log both directions plus timing/rAF evidence that pins promotion time vs. DOM-deal end, and rAF delta spikes in the frame. An instrumented headed-Playwright one-shot script timed out waiting for promotion in one CLI launch; needs one more debug iteration (dump the frame's `scoundrelConsoleLog()` to see why that boot stalled, or use the repo's `GODOT_E2E=1 pnpm e2e` path which is how CI verifies boots).
- Do not conflate symptoms: headless `chromium.launch()` fails to boot the Godot frame on this Windows host (fell back after the 45 s `BOOT_TIMEOUT_MS`, GodotBoard.tsx:43-45). Headed boots fine (verified interactively). Windows-CLI headed launch failing was the last observed anomaly — suspect bootstrap/GPU-quirk, not the app.

## 5. Artifacts, environment, commands

- Prior session's throwaway harness (untracked, read-only reproduction of H1/H2 with postMessage hooks + video + rAF sampling): `e2e/_debug-deal-repro.mjs`. It drives a full seeded run to terminal and then tests Play-again and title→New-run cases; dumps JSON to `repo/.tmp-debug/`. Never completed — no artifacts were left in `.tmp-debug/`.
- My one-shot instrumented script (throwaway, outside the repo): `C:\Users\David\AppData\Local\Temp\kilo\deal-loop.mjs`. Headed chromium, hooks both message directions, records `.fx-layer` ghost in/out, `.room` box+class timeline via MutationObserver/ResizeObserver, frame rAF deltas, dumps to `repo/.tmp-debug/live-run.json` and prints vs-t0 summaries. If recreated, the hooking approach (addInitScript on context → poll `page.frames()` for the child → inject FRAME_HOOK) is documented in that file.
- Build/place-specifics that cost time — reuse them:
  - Windows esbuild temp race ("remove …\esbuild-<hash>: Access is denied"): redirect TEMP for the build only — `New-Item -ItemType Directory -Path .tmp-build -Force; $env:TMP="$PWD\.tmp-build"; $env:TEMP="$PWD\.tmp-build"`. This is the repo's known workaround (see `.gitignore` entry comment for `.tmp-build`).
  - Build: `$env:VITE_RENDERER='godot'; pnpm build` (with the TEMP redirect). Write permission was required — run it via the normally-approved shell path.
  - Serve: `pnpm exec vite preview --port 4173 --host 127.0.0.1` (plain `pnpm preview` bound to a host the MCP browser refused to connect to).
  - The exported frame is at `public/godot/bf22256d34574/` — GENERATED staging, never hand-edit (`pnpm godot:export` regenerates; see AGENTS.md).
- Local `dist/` was built with the Godot renderer and a preview server verified working; the build output should still be usable or cheaply rebuilt.

## 6. Next steps (recommended order)

1. **Complete the measurement.** Re-run the instrumented headed repro (or fix `deal-loop.mjs`'s CLI launch issue by dumping `frame scoundrelConsoleLog()` first). Concrete numbers wanted:
   - t(click)→first `sync`→`applied`/promotion delta; DOM-deal ghost spawn→last ghost removal; whether promotion lands before the last ghost is removed (the overlap);
   - parent + frame rAF worst/p95 deltas in the 0–3 s window, correlated with each sync apply (texture decode hitch) and the promotion commit;
   - confirm no value-changing re-sync fires from the title flow (harness prints sync room rects — expect identical values across revisions; already in the log payload).
2. **Optionally confirm on the deployment**: ask the user to open Vercel deployment protection (or supply an authenticated context); then run the same passive instrumentation against the URL in §2 and compare timings.
3. **Write-up**: consolidate confirmed numbers into a short root-cause statement for the user (static chain in §3 + measured overlap).
4. Only if the user authorizes a fix, propose the fix shapes (all verified against code):
   - Drop DOM room beats at plan level when the renderer is canvas-configured — pass `boardRenderer` intent into `planChoreography` (`motion.ts:551-556`), instead of keying solely off the `.canvas-live` marker that only exists after promotion;
   - Or cancel in-flight DOM room ghosts/`liveAnims` in the same commit as `canvasLive` promotion (honoring the aspiration at `GodotBoard.tsx:207-209` — needs a director API like `cancelRoomBeats(root)`);
   - Smoothness follow-ups: pre-decode the 4 card faces before starting deal tweens (`card-sprite.gd:150-162`), and consider batching the promotion commit's restyle/height change;
   - Optional unrelated hardening for later: seeded-URL + Play-again double-`startRun` (§3 last bullet).
5. If a fix lands later, regression-test at the seam: store subscription → postMessage classification (hint-less re-sync behavior belongs in frame-side tests; director plan-time renderer intent belongs in `tests/` unit tests). Re-check the CI bundle gate (`scripts/check-bundle-size.mjs`) — play-screen bundle changes must respect it.

## 7. Suggested skills

- `diagnose` (`C:\Users\David\.agents\skills\diagnose\SKILL.md`) — the work is mid-Phase 4 (Instrument). Re-attach there: finish the feedback loop (headed instrumented run), Phase 2-style capture of exact timings, then Phase 3 hypothesis confirmation. Don't restart from scratch; §4 lists what's already proven.
- `tdd` (`C:\Users\David\.agents\skills\tdd\SKILL.md`) — only once the user authorizes a code change: red-green a regression test for the confirmed mechanism before touching `motion.ts`/`GodotBoard.tsx`.
- `adversarial-reviewer` (`C:\Users\David\.agents\skills\adversarial-reviewer\SKILL.md`) — if/when a fix is authored, adversarial-review the proposal before implementation, especially around the motion-director ownership rules (AGENTS.md Phase-2 canvas contract) and the bundle gate.

## 8. Pitfalls and constraints

- **No code changes** until the user re-authorizes. Debug tooling must stay outside tracked source (`%TEMP%\kilo` scripts, `repo/.tmp-debug/` JSON dumps).
- Headless chromium on this host fails to boot the Godot frame — use headed for boots; CI's Godot e2e job proves headless is possible on Linux, it's a local-boot quirk.
- The MCP/interactive browser needs explicit `127.0.0.1` preview binding (see §5).
- The room rect contract lives in `src/game/board-protocol.ts`; keep it Godot/store-free and don't rebuild it during debugging-only edits.
- The requested mandate for this bug is analysis; do not "experimentally fix" and revert without authorization — commits on this branch are all user-known (`git log`: see `bbf8267`'s Phase-5 rollout notes for exit criteria).
- No secrets, API keys, tokens, or PII appear in this document. The Vercel preview URL in §2 is a non-secret deployment identifier supplied by the user and is needed for testing.
