/**
 * Content id of the exported Godot frame under `public/godot/<build-id>/`
 * (copied verbatim into `dist/godot/<build-id>/` by Vite).
 *
 * Phase 1 spike uses a single static id; Phase 4 content-versions the whole
 * directory + manifest so a cached loader can never pair with a different
 * PCK/WASM (godot-plan.md, "Static artifact integration"). When that lands,
 * this constant is produced by the export script and consumed via an import
 * map or a generated module — scripts/export-godot.mjs and
 * scripts/check-godot-artifacts.mjs must agree with it (they default to the
 * same value).
 */
export const GODOT_BUILD_ID = 'spike';
