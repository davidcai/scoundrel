/**
 * Development/build-time board-renderer selection (godot-plan.md, "Options and
 * decision"): an explicit switch selects `dom`, `phaser`, or `godot`.
 *
 * Load-bearing rules:
 * - Production defaults to `phaser` until the plan's Phase 4 exit gate passes;
 *   `godot` is a development comparison choice, never a silent default.
 * - The choice must NOT enter GameConfig, persisted settings, or replay URLs:
 *   the URL override below is read only in dev builds (`import.meta.env.DEV`),
 *   and the build-time override comes from the `VITE_RENDERER` env var —
 *   neither is persisted anywhere nor included in share links.
 * - `dom` is the explicit graphics-off escape hatch (also the automatic
 *   fallback when a renderer fails; that fallback lives in the board
 *   components, not here).
 *
 * Evaluated once at module load — renderer identity never changes mid-session.
 */

export type BoardRenderer = 'dom' | 'phaser' | 'godot';

const VALID: readonly BoardRenderer[] = ['dom', 'phaser', 'godot'];

function normalize(value: string | null | undefined): BoardRenderer | null {
  return value !== null && value !== undefined && (VALID as readonly string[]).includes(value)
    ? (value as BoardRenderer)
    : null;
}

/**
 * Dev-only URL override. Checks BOTH query locations: `?renderer=` in the
 * search string and inside the hash route (`#/play?...&renderer=godot`) —
 * the app is hash-routed, so the hash query is where a developer naturally
 * appends it. Never read in production builds, so it cannot enter a share
 * URL (nothing ever writes it outside dev).
 */
function devUrlOverride(): BoardRenderer | null {
  const fromSearch = normalize(new URLSearchParams(window.location.search).get('renderer'));
  if (fromSearch !== null) return fromSearch;
  const hashQuery = window.location.hash.split('?')[1] ?? '';
  return normalize(new URLSearchParams(hashQuery).get('renderer'));
}

export function resolveRenderer(): BoardRenderer {
  if (import.meta.env.DEV) {
    const fromUrl = devUrlOverride();
    if (fromUrl !== null) return fromUrl;
  }
  const fromBuild = normalize(import.meta.env.VITE_RENDERER as string | undefined);
  if (fromBuild !== null) return fromBuild;
  return 'phaser';
}

/** Resolved once per session by PlayScreen. */
export const boardRenderer: BoardRenderer = resolveRenderer();
