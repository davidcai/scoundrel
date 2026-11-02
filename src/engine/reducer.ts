/**
 * The Scoundrel rules reducer.
 *
 * `applyAction` and `previewAction` are thin wrappers over the shared planners
 * in decisions.ts. Both use the same rule decisions, so a preview and its
 * confirmed outcome cannot disagree (REQ-005, implementation plan phase 2).
 */

import { planAction } from './decisions';
import type { ActionPreview, ActionResult, GameAction, GameState } from './types';

/** Apply an action. A rejected action returns the untouched input state. */
export function applyAction(state: GameState, action: GameAction): ActionResult {
  const plan = planAction(state, action);
  if (!plan.ok) return { ok: false, state, reason: plan.reason };
  return { ok: true, state: plan.state, event: plan.event };
}

/** Preview an action's event or the reason it is unavailable, without committing it. */
export function previewAction(state: GameState, action: GameAction): ActionPreview {
  const plan = planAction(state, action);
  return plan.ok ? { ok: true, event: plan.event } : { ok: false, reason: plan.reason };
}
