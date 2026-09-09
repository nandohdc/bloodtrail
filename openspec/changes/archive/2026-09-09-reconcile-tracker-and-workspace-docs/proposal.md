# Proposal — reconcile-tracker-and-workspace-docs

Reconcile the agent-facing tracker documentation and the repository's own workspace command surface
to what is measurably true, and add the gate that keeps the second from drifting again.

This is the **dedicated batched documentation change** that `change-governance`'s _Routine
governance-core documentation edits are decoupled and batched_ requirement provides for. It touches
`CLAUDE.md` and `AGENTS.md` deliberately, as the substance of the change rather than incidentally.

## Why

Three agent-facing statements are false, and each was checked rather than assumed.

**1. The named tracker recorded almost none of the delivery (#308).** Between `2026-09-04` and
`2026-09-09`: **114 pull requests merged**, **36 issues closed**, **1** merged pull request carried a
`Hermes-Task:` trailer, and the board moved by **one card**. Its `todo` column still holds cards for
issues that are closed. #308 asked which of three readings was intended when the gap was one working
day; five days on it is not outage-shaped.

**2. The triage mapping forbids labels that already exist.** `docs/agents/triage-labels.md` states
that "of the five role names, only `wontfix` exists in this repository's GitHub label set" and
instructs agents not to create the other four. All five exist and carry **82 applications**:
`needs-triage` 41, `wontfix` 18, `ready-for-agent` 16, `ready-for-human` 5, `needs-info` 2. An agent
following the old instruction would set state on a board nobody reads while leaving the labels that
are actually filtered on untouched.

**3. `make` skips a whole package while reporting success (#412).** There are five workspaces;
`runtime-gates` and `governance-gates` each run four, omitting
`packages/security-audit-collector` — then print `passed across all four workspaces`. The count was a
hand-maintained literal consistent with the recipe and inconsistent with the repository, so nothing
in the output suggested a package had been skipped. CI covers the collector fully, so the gap was
entirely local: a green `make`, then a surprise in CI. `CLAUDE.md` and `AGENTS.md` compounded it by
saying **three** workspaces — a third number agreeing with neither.

The first two mislead an agent. The third lets a local loop certify code it never ran.

## What Changes

**Tracker.** GitHub Issues is stated as the execution tracker. Hermes Kanban is retained for fleet
runs and explicitly **not** authoritative for execution state — an agent may not infer completion
from a card. The `kanban_*` tool rule for fleet workers is kept. Both documents record the
measurements that withdrew the previous statement and the exact reversal path, so restoring the old
arrangement is an edit rather than a rediscovery.

**Triage.** The five canonical roles map to GitHub labels of the same name. `needs-info` and
`ready-for-human` stay distinguishable — as separate labels they cannot collapse the way a shared
`blocked` status could. Closure is carried by issue state, so a `wontfix` label on an open issue is
an unfinished triage rather than a decision. The Kanban block kinds are kept where they still apply,
inside a fleet run.

**Workspaces.** `make` runs all five. The success messages stop naming a count that can disagree with
the recipe. `.github/scripts/check-package-discovery.mjs` — which already asserts the declared
package list matches what is on disk — gains `assertMakefileCoverage`, asserting every covering
target actually invokes each declared package, with a named failure for an uncovered package and for
an absent target.

**The gate has failing arms.** Five new tests in `check-package-discovery.test.mjs`, including one
reproducing the exact #412 defect (collector declared, `runtime-gates` not running it) and one
proving "add a package, forget the Makefile" fails. Each failing arm is paired with the healthy input
that must still pass. This follows the requirement that a repository-state claim with no enforcing
gate gets a gate rather than a prose assertion.

## Decision provenance

`decision_source = "delegated to Claude by the owner, 2026-09-09; not a human owner decision"`,
recorded in both documents.

Two of the three corrections are factual — the label set and the workspace count are counted, not
judged. The tracker statement is an operational decision, taken under delegation because #308 had
been open since 2026-09-04 blocking on input while every agent reading `CLAUDE.md` was pointed at a
stale board. It affects no third party, reverses no recorded owner outcome, and the reversal path is
written into the file it changes.

## Capabilities

- `change-governance`: workspace coverage asserted by a gate rather than narrated; agent-facing
  documentation naming the tracker that carries execution state, with retained-but-not-authoritative
  trackers marked as such; and a triage vocabulary that resolves against the tracker in use.

## Impact

- `Makefile`, `.github/scripts/check-package-discovery.mjs`, `.github/scripts/check-package-discovery.test.mjs`,
  `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`, `CLAUDE.md`, `AGENTS.md`.
- No `contracts/` path, no `packages/` path, no generated artifact, no CI workflow. The new gate runs
  inside the existing `design-pattern-governance` job, which already executes
  `check-package-discovery.mjs` and `node --test .github/scripts/*.test.mjs`.
- `make` gets slower — roughly 26s to 34s — because it now runs a package it previously skipped. That
  is the cost of the loop being honest.
- Closes #412. Closes #308's documentary criteria; the tracker decision it asked for is recorded here
  as delegated rather than as an owner decision, and the issue says so.
- Out of scope: changing CI (which already covers the collector), changing any package's own scripts,
  and reconciling the Kanban board itself — if Hermes is meant to be canonical the repair is
  operational, and the reversal path in `docs/agents/issue-tracker.md` names it.
