---
name: to-beads
description: 'Convert a plan, spec, or the current conversation into a structured set of Beads issues — one epic plus tracer-bullet children with native blocking edges. Use when the user wants to break work into tickets, turn a spec/plan into issues, or "create beads from this". Trigger phrases: "to beads", "break this into tickets", "turn this spec into issues", "create beads from this plan/conversation".'
---

# to-beads

Break a plan, spec, or the current conversation into a set of **tracer-bullet** Beads issues, each declaring its blocking edges, published to Beads via native dependency links.

Beads track *what to do* and *dependencies*. Docs capture *how to do it* and *why*. This skill keeps that separation.

## Inputs

- **Source**: a plan, spec, or the current conversation. If the user passes a reference (spec path, issue number, URL), fetch and read its full body and comments.
- **Epic title** (optional): if the user provides one, use it verbatim. If not, **synthesize one of no more than 10 words** from the source material before drafting slices. Surface the synthesized title in the quiz step so the user can correct it.

## Process

### 1. Gather context

Work from whatever is already in conversation context. If the user passes a reference (spec path, issue number, URL), fetch it and read the full body and comments.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state. Ticket titles and descriptions should use the project's documents and domain vocabulary in the area you're touching. Respect any ADRs in that area.

### 3. Resolve the epic title

- If the user supplied an epic title, use it verbatim.
- Otherwise synthesize one — **no more than 10 words** — grounded in the source. Treat it as a draft to confirm in the quiz step, not a final answer.

### 4. Draft vertical slices

Break the work into **tracer bullet** tickets under the epic.

<vertical-slice-rules>

- Each slice cuts a narrow but COMPLETE path through every layer of the system (e.g. schema, API, UI, tests — whatever layers this project actually has) — vertical, NOT a horizontal slice of one layer.
- A completed slice is demoable or verifiable on its own.
- Each slice is sized to fit in a single fresh context window.
- Any pre-factoring should be done first, as its own ticket blocked by nothing (or only by the epic).

</vertical-slice-rules>

Give each ticket its **blocking edges** — the other tickets that must complete before it can start. A ticket with no blockers can start immediately. Express edges as **native Beads dependencies**, never as text in a description.

**Wide refactors are the exception to vertical slicing.** A **wide refactor** is one mechanical change — rename a column, retype a shared symbol — whose **blast radius** fans across the whole codebase, so a single edit breaks thousands of call sites at once and no vertical slice can land green. Don't force it into a tracer bullet; sequence it as **expand–contract**:

1. **Expand**: add the new form beside the old so nothing breaks. (own ticket)
2. **Migrate** the call sites in batches sized by blast radius (per package, per directory). Each batch is its own ticket blocked by the expand. CI stays green batch to batch because the old form still exists.
3. **Contract**: delete the old form once no caller remains, in a ticket blocked by every migrate batch.

When even the batches can't stay green alone, keep the sequence but let the batches share a single integration lane (a beads fan-in: every batch ticket blocks one final integrate-and-verify ticket) — green is promised only at that final ticket, not per batch. (If you also use a shared git branch for the lane, that's incidental; the beads graph is the source of truth for the gating.)

### 5. Quiz the user (mandatory gate)

Present the proposed breakdown as a numbered list. For the epic, show the title (especially flagging any synthesized title for confirmation). For each ticket, show:

- **Title**: short descriptive name
- **Type**: feature / task / bug / chore / decision (epic for the parent)
- **Blocked by**: which other tickets (if any) must complete first
- **What it delivers**: the end-to-end behaviour this ticket makes work

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the blocking edges correct — does each ticket only depend on tickets that genuinely gate it?
- Should any tickets be merged or split further?
- Is the epic title right (if synthesized)?

**Iterate until the user approves the breakdown. Do not publish before approval.**

Prefer the host's structured-approval tool (e.g. opencode's `question`) for the gate so approval is explicit and fast — offer bounded options (e.g. *Approve as-is* / *Merge tickets* / *Split further* / *Adjust blocking edges* / *Change epic title*) plus custom input, rather than a free-form prompt.

### 6. Publish to Beads

Publish the approved breakdown. Prefer **atomic graph creation** so the epic, children, parent links, and blocking edges all land in one call.

#### Preferred: `bd create --graph` (atomic)

Write a JSON plan and create everything at once. Verified schema (bd 1.1.2):

**Version guard:** run `bd --version` first. The `--graph` flag and edge semantics below are pinned to bd ≥ 1.1.2; if the version is older or `--graph` is absent, use the fallback below regardless of graph size.

```json
{
  "nodes": [
    {"title": "Auth system redesign", "type": "epic", "key": "epic"},
    {"title": "Add OAuth provider", "type": "feature", "key": "oauth", "parent_key": "epic", "priority": 1, "description": "See docs/spec.md#oauth"},
    {"title": "Implement token refresh", "type": "feature", "key": "refresh", "parent_key": "epic", "priority": 2, "description": "See docs/spec.md#refresh"}
  ],
  "edges": [
    {"from_key": "refresh", "to_key": "oauth", "type": "blocks"}
  ]
}
```

Field rules:
- `key` — local identifier used by `parent_key` and edge endpoints. Required.
- `parent_key` — sets the hierarchical parent (the epic). Use this for epic→child links.
- `priority` — **integer** 0–4 (0 = highest) in the graph JSON. A node omitting `priority` defaults to 2 (medium). (The CLI `--priority` flag is a string accepting `0`–`4` or `P0`–`P4`.)
- `edges` — top-level array. **Direction rule:** `{"from_key": "X", "to_key": "Y", "type": "blocks"}` means **X is blocked by Y** (X depends on Y; Y is the blocker). Worked example: if B should wait on A, write `{"from_key": "b", "to_key": "a", "type": "blocks"}`. After the live create, `bd ready --json` lists A but NOT B, and `bd show <B> --json` shows a `dependency_type: "blocks"` entry pointing at A. If B appears ready instead, the edge is reversed — flip `from_key`/`to_key`. (The dry-run does NOT validate edge direction — see step 7.)
- `description` — keep it short; link to the detailed plan doc (see below).

Always dry-run first:

```bash
bd create --graph plan.json --dry-run
```

The dry-run validates graph **structure** only — it reports issue/edge/parent-child counts but never enumerates which ticket blocks which, and it does NOT validate edge direction. It can also pass while a live create is later rejected: bd 1.1.2 prints *"dry-run validates the graph structure only; live create may still reject parent-child blocking paths after resolving stored dependencies"* — i.e. a parent-child link that also implies a blocking path can be rejected at create time even though the dry-run succeeded. So a green dry-run is necessary but not sufficient.

Then publish:

```bash
bd create --graph plan.json --json
```

#### Fallback: epic + children with `--parent` and `--deps`

Use this when `--graph` is unavailable (older bd) OR the graph JSON is unwieldy. Create the epic first, then each child referencing the epic and its blockers:

```bash
bd create "Auth system redesign" --type epic --json
# use the returned id, e.g. bd-10
bd create "Add OAuth provider" --type feature --parent bd-10 --priority 1 --description "See docs/spec.md#oauth" --json
bd create "Implement token refresh" --type feature --parent bd-10 --priority 2 --deps bd-11 --description "See docs/spec.md#refresh" --json
```

`--deps` accepts native dependency links: `bd-11` (bare) or typed `blocks:bd-11,discovered-from:bd-20`. Direction follows the same rule as graph edges (X depends on Y), with one trap: **`blocks:bd-11` is active voice** — it means *this* issue **blocks** `bd-11` (i.e. `bd-11` is blocked by this issue), the **opposite** direction from the bare form. It is the `--deps` spelling of `bd dep <this-id> --blocks bd-11`. When the new issue is the one being blocked, use the bare form: `--deps <blocker-id>`.

#### Pre-publish sanity check

Before creating, confirm you're writing to the intended tracker — especially in nested-repo or worktree setups where a sibling repo's DB may be picked up. The check must distinguish two cases that look identical to a naive comparison:

- **Same-repo worktree** — the DB lives under the *main* repo root (not the current worktree root) because `bd` resolves to the main repo's `.beads`. This is intended; the worktree shares the main repo's tracker. Do NOT stop.
- **Sibling-repo leakage** — the DB belongs to an *unrelated* repo. Stop; every create will land in the wrong tracker.

Comparing the DB path to `git rev-parse --show-toplevel` is **wrong in a worktree**: `--show-toplevel` returns the *worktree* root while `bd` resolves to the *main* repo's `.beads`, so a correct same-repo setup would be falsely flagged. Use the common git dir to find the main repo root instead:

```bash
bd info                                                        # "Database:" path to check
MAIN_ROOT=$(dirname "$(git rev-parse --git-common-dir)")       # main repo root (correct in worktrees)
```

If the `Database:` path is under `MAIN_ROOT`, you're in the same repo — proceed. If it is NOT under `MAIN_ROOT`, stop — `bd` is resolving to a different project and every create will land in the wrong tracker. This happens silently when a sibling repo shares a parent directory.

#### Republishing / delete + recreate

`bd create` does **not** auto-import the export file (`import.auto` only affects `bd import`, not `bd create`), so delete + recreate via `bd create` is safe — deleted issues stay deleted (bd 1.1.2). The resurrection risk is **`bd import`** (explicit or via sync), which upserts the JSONL back into the DB. Because `import.auto` **defaults to `true`** (check with `bd config show`; `bd config get import.auto` returns `(not set)` even when the default is active), treat the JSONL-aside step as the **default** before recreating — only skip it when `bd config show` explicitly reports `import.auto = false`:

- Move the stale JSONL aside, or regenerate it fresh with `bd export -o .beads/issues.jsonl` (bare `bd export` writes to stdout, not the file).
- Watch for `auto-imported N issues from .../issues.jsonl` in `bd` output — that line is the signal of a stale-export collision.

### 7. Verify after publish

The dry-run validates graph **structure** only — not **edge direction** (it reports parent-child and blocks-edge counts but never which ticket blocks which), and a green dry-run does not guarantee the live create will succeed (bd may reject parent-child blocking paths at create time — see Publish above). So verify direction after the live create:

1. **Ready set**: `bd ready --json` must list exactly the tickets with no blockers (plus the epic). If a ticket that should be blocked appears ready, an edge is missing or reversed.
2. **Spot-check a blocked ticket**: `bd show <id> --json` and confirm each `dependency_type: "blocks"` entry points at the correct blocker id (not back at the blocked ticket).
3. If direction is wrong, delete the issues, flip the edges, and recreate (see the edge direction rule above). Delete with `bd delete <id> --force` (destructive; removes both-direction dependency links and cannot be undone — batch with `bd delete bd-1 bd-2 --force`). Move the stale JSONL aside before recreating, since `import.auto` defaults to `true` (see Republishing above).

### 8. Keep detailed plans in a doc; link from beads

Beads are intentionally lightweight for tracking execution, not storing full specifications.

1. Keep the detailed plan/spec in a doc (e.g. `docs/spec.md`).
2. Reference it from each bead via the `description` field (e.g. `"See docs/spec.md#oauth"`) and/or `--spec-id` when a spec doc ID exists.
3. The epic groups the work; children carry the blocking edges.

The philosophy: beads track *what to do* and *dependencies*, while docs capture *how to do it* and *why*. This separation keeps the issue tracker fast and scannable while preserving rich context elsewhere.

## Rules

- **Always use native Beads dependencies** (`--deps` or graph `edges`) for blocking links. Never express edges as text in a description.
- **Never create markdown TODO files** as the source of truth when Beads is available.
- **Dry-run before publishing**: `bd create --graph plan.json --dry-run` (or `--dry-run` on individual `bd create`).
- **Do not publish before the user approves the breakdown.** The quiz gate is mandatory.
- **Do not auto-close or mutate tasks** unless the work is actually complete.
- Prefer `--json` when parsing `bd` output programmatically; `--silent` returns only the issue ID for scripting.
- Do not use `bd edit`; it opens an interactive editor. Use `bd update` flags instead.
- If hooks are installed, `bd prime` may already be injected; run it manually when context is missing.
