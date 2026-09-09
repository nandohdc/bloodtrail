# Design — reconcile-tracker-and-workspace-docs

## Context

Three agent-facing claims were checked against the repository. All three are false, and they fail in
two different ways: two mislead a reader, one lets a local gate certify code it never ran.

### The tracker

`docs/agents/issue-tracker.md` opens with *"The canonical engineering issue tracker for this
repository is Hermes Kanban"* and *"GitHub Issues are not the canonical execution tracker."*
`CLAUDE.md` and `AGENTS.md` both repeat it.

#308 recorded a single working day — 2026-09-04, 13 pull requests merged, 7 issues closed, the board
byte-identical — and asked which of three readings was intended. Measured again on 2026-09-09 over
the five days since:

| Measure | Count |
| --- | --- |
| Pull requests merged | 114 |
| Issues closed | 36 |
| Merged pull requests carrying `Hermes-Task:` | 1 |
| Net board movement | 1 card |

The board's `todo` column still holds cards for issues that are closed — `#83 spec — archive
materialize-repository-topology` sits in `todo` while #83 itself is closed and its change is archived.

One merge in 114 is not an outage. The work is on GitHub, and the documentation was pointing every
agent that read it somewhere else.

### The triage mapping

`docs/agents/triage-labels.md` justifies mapping roles onto Kanban states with a factual claim:
*"of the five role names, only `wontfix` exists in this repository's GitHub label set"*, and
instructs: *"Do not create `needs-triage`, `needs-info`, `ready-for-agent`, or `ready-for-human` as
GitHub labels."*

All five exist. Counted on 2026-09-09: `needs-triage` 41, `wontfix` 18, `ready-for-agent` 16,
`ready-for-human` 5, `needs-info` 2 — 82 applications across four labels the file says not to create.

### The workspace loop

Five packages are tracked. `make runtime-gates` and `make governance-gates` each run four, omitting
`packages/security-audit-collector`, and each then prints `passed across all four workspaces`.

The count is what makes this a trap rather than an oversight. It is a hand-maintained literal that
agrees with the *recipe*, so the output is internally consistent and gives no hint that a package was
skipped. CI runs the collector thoroughly — validate on Node 26.5.0, audit, `ci / test` on Node
24.2.0, coverage under the `collector` flag — so the local loop is the only place the gap exists, and
it is exactly the place a developer trusts before pushing.

`CLAUDE.md:26` and `AGENTS.md:15` said **three** workspaces, a third number agreeing with neither the
Makefile nor the repository.

## Decision

### 1. GitHub Issues is the execution tracker; Hermes Kanban is retained, not authoritative

Not "Hermes is canonical and the board is broken" — that reading is available (#308's option 1) and
would make this a documentation no-op plus an operational repair. It was rejected on the ratio: one
`Hermes-Task:` trailer in 114 merges is not a board that fell behind, it is a workflow that is not in
use. Repairing the board would not change where the work is.

Not a silent rewrite either. Both files record the measurements that withdrew the previous statement
and the exact reversal path — reconcile the board with
`~/.hermes/scripts/bloodtrail-kanban-sync.py`, then restore the statement in the four files that
carry it. Restoring the old arrangement is an edit, not a rediscovery.

The `kanban_*` tool rule is kept verbatim for fleet workers, because it is still correct inside a
fleet run and nothing here changes that.

The single load-bearing sentence is the prohibition: **do not infer completion from a card.** A
retained tracker that is silently non-authoritative is worse than one that is either canonical or
gone, and that sentence is what prevents the middle state.

### 2. The five roles are GitHub labels of the same name

The old mapping's *reason* — no such labels exist — is what expired, so the mapping goes with it.

The property worth preserving is that `needs-info` and `ready-for-human` stay distinguishable. On the
board they shared status `blocked` and were separated only by a typed block kind; the old file argued
at length that omitting the kind would collapse two roles into one. As separate labels they cannot
collapse at all, which is strictly simpler.

Closure moves to issue state rather than a label: `wontfix` plus `state_reason: not_planned`. So a
`wontfix` label on an *open* issue reads as an unfinished triage rather than a decision — a
distinction the archived-status mapping could not make.

The Kanban block kinds are kept in a closing section, scoped to fleet runs, because `dependency` and
`transient` are not triage roles and have no label equivalent.

### 3. `make` runs every workspace, and a gate says so

Adding the collector to both targets is the fix. Deleting the hand-maintained count from the success
messages is what stops it recurring in the same shape.

Neither is sufficient, because the next package will be added by someone who does not know this
happened. So the assertion goes where the declared list already lives:
`.github/scripts/check-package-discovery.mjs` already holds `DECLARED_PACKAGES` and already asserts
it matches `git ls-files` in both directions. It gains `assertMakefileCoverage`, which reads each
covering target's recipe and fails when a declared workspace is not invoked:

```
[makefile-workspace-uncovered] 'runtime-gates' does not run: packages/security-audit-collector
[makefile-target-missing]      Makefile declares no 'governance-gates' target
```

The second arm matters as much as the first: a gate that iterates over targets it cannot find would
otherwise pass vacuously — the exact failure mode this repository already recorded when `cs delta`
exited 0 for its entire life.

This is the same completeness-assertion argument the repository reached once before: an explicit list
needs a check that it is complete, because "add a thing, forget to list it" fails silently. It is
also what `change-governance`'s _Repository-state claims are gate-enforced rather than narrated_
requires — a claim with no enforcing gate gets a gate, not a prose assertion.

**Recipe parsing is deliberately shallow.** `makeRecipeFor` takes the lines after `target:` that begin
with a tab, stopping at the first non-indented non-blank line. It does not expand variables, follow
prerequisites, or shell out to `make`. A recipe that invoked a workspace through a variable would
therefore read as uncovered — a false failure, not a false pass, which is the right direction for a
gate to be wrong in.

### 4. Five failing arms, each paired with its healthy input

`check-package-discovery.test.mjs` gains tests for: recipe extraction stopping at the next block;
the real Makefile covering every declared workspace; an uncovered workspace failing (reproducing
#412's exact shape — collector declared, `runtime-gates` not running it); an absent covering target
failing; and a newly declared package failing until the recipe runs it, with the same Makefile still
passing against the real list.

The last one is the one that would have caught #412 prospectively, and it asserts both directions in
one test so a mutation that made the gate always-throw is caught too.

## Rejected alternatives

**Repair the board and keep the documentation.** #308's option 1. Rejected in §1 on the 1-in-114
ratio: this is not a board that fell behind.

**Record a qualification without changing the canon** (#308's option 3). Tempting under delegation,
since it decides less. Rejected because the operative instruction — *read the board to know what is
done* — would survive the qualification, and that instruction is the harmful part.

**Fix the Makefile without adding a gate.** Smallest diff. Rejected: it fixes this instance and
leaves the next one, and the governance spec requires a gate rather than a prose claim.

**Run `make -n` and parse the expanded output instead of reading recipes.** More faithful to what
`make` would do. Rejected: it requires `make` on the checker's path, makes the gate depend on the
recipes actually being runnable, and buys accuracy the declared-workspace check does not need — the
shallow parse errs toward false failure, which is safe.

**Derive the workspace count in the success message from the recipe.** Would keep a count without the
drift. Rejected as unnecessary once the gate exists: the message says "every declared workspace" and
the gate is what makes that true, so a number would add a second thing to keep correct.

## What this does not establish

That the tracker decision is the owner's. It is recorded as delegated, in both files, and #308's
first acceptance criterion — *the intended tracker is stated* — is satisfied by a delegated statement
that says so in its own text rather than by an owner decision.

That the board is wrong to exist. It says the board is not evidence of execution state, which is a
claim about what may be read from it, not about whether it should be used.

That `make` is now complete in any deeper sense. It runs every workspace that has a `package.json`;
whether each workspace's own `validate` is adequate is that workspace's concern.

## Revisit conditions

- Hermes Kanban is reconciled and put back in use — the reversal path in
  `docs/agents/issue-tracker.md` is the whole change.
- A sixth workspace is added — the gate fails until a covering target runs it, which is the intended
  behaviour.
- A covering target starts invoking a workspace through a variable — the shallow parse will report it
  uncovered, and the fix is to teach the parser or to name the workspace literally.
- The GitHub label set changes — `docs/agents/triage-labels.md`'s table is the thing to check.
