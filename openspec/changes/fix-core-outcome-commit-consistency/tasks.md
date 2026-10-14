# Tasks — #812

Decision source: owner decision, 2026-10-13, via plan-mode questions, grilling and triage in local Claude Code session 2db6f6fa-b531-4e63-8651-4ea851fd76be

## 1. Proposal

- [x] 1.1 Author the six change artifacts with full assessment, exact ownership, decided scope and `ADDED`-only requirement.
- [x] 1.2 Execute assessment governance and strict validation before the proposal-only commit.

## 2. Runtime

- [x] 2.1 Implement success inside first-position `validateCommit` and denial last after provenance, with module-scope tables and unchanged public surface.
- [x] 2.2 Execute build/typecheck and existing runtime regressions before the runtime-only commit.

## 3. Tests

- [x] 3.1 Add the catalog-derived 15-event, 141-row matrix with exact 24/21/96 totals, safe results, sink counts and preserved explicit values.
- [x] 3.2 Add all complete-event mutations, issue/default/unjudged/unaffected/handle/precedence/approved-fixture controls; execute focused compilation/tests and existing runtime regressions.

## 4. Documentation

- [x] 4.1 Append API/migration/security/glossary guidance, add `ADR-SDK-016`, advance only ADR inventory pins, and widen the Node error catalog.

## 5. Verification and evidence

- [x] 5.1 Execute the supplied eight-command `TEST_CMD` in order; record each exit status, matrix totals, full unchanged `test:verification` totals and CodeScene delta observations by gate name.
- [x] 5.2 Audit exact commit subjects/path groups/ownership, preserved forbidden artifacts and empty index; execute lightweight generated/changed-path/strict/final-governance/git/whitespace evidence-edit checks before staging. Commit evidence and report actual committed-head rechecks externally; this tick records only completed pre-commit work.

- [x] 5.3 Polish the rule-table comments, glossary and Node catalog; restore provenance-correct task evidence and execute the pinned eight-command supplied `TEST_CMD` before recording this run's evidence.

## 6. Maintainer follow-up

- [ ] 6.1 Obtain all ten required PR CI contexts and independent review; no local approval claim.
- [ ] 6.2 Merge after review and required checks.
- [ ] 6.3 Fold the added requirement in a separate governed change.
- [ ] 6.4 Archive only after fold lands.

## Evidence policy

Record only executed results, verbatim, by gate name without machine-local log paths. Full-chain observations refer to the pre-evidence tree; subsequent lightweight observations are separate. The provisioned branch is pinned to the supplied merged `main` baseline; do not move it or rewrite existing commits. No push, PR, GitHub comment, merge, fold, archive or secret access.

## Tasks `1.1`–`4.1` — run #134, recorded before its evidence commit

The preserved read-only record supplies the original pre-commit observations below verbatim.
These observations justify the restored task ticks; they are historical, not checks rerun by
run #135 or this polish. Run #134 did not complete its blocked evidence commit. Its later
closure attempt exited `1` after the shared `origin/main` advanced to
`798e88dd5a58ed6b7f094c440f41b5b977ffbc32`, with this diagnostic:

```text
design-pattern governance failed in final phase:
  [openspec-association-unrelated] openspec/changes/verify-fraud-evidence-sufficiency/assessment.source.json: no OpenSpec change in this range owns or describes this governed implementation path
```

### Proposal and runtime (`1.1`–`2.2`)

Before the proposal-only commit, both commands exited 0:

- `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change fix-core-outcome-commit-consistency`: `design-pattern governance passed in assessment phase: enforcement active`.
- `openspec validate fix-core-outcome-commit-consistency --strict`: `Change 'fix-core-outcome-commit-consistency' is valid`.

Before the runtime-only commit, `npm run build --prefix packages/security-audit-sdk-core` exited 0 (`generated SDK contract artifacts written`); `npm run typecheck --prefix packages/security-audit-sdk-core` exited 0 (`tsc -p tsconfig.json --noEmit`); existing `npm run test:runtime --prefix packages/security-audit-sdk-core` exited 0: `ℹ tests 409`, `ℹ pass 409`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 0`, `ℹ todo 0`. Tracked generated artifacts remained unchanged.

### Focused tests and documentation (`3.1`–`4.1`)

Before the test-only commit, from Core, `./node_modules/.bin/tsc -p tsconfig.test.json && node --test dist-tests/outcome-commit-consistency.test.js` exited 0: `ℹ tests 265`, `ℹ pass 265`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 0`, `ℹ todo 0`. The matrix guard passed exactly 15 events and 141 unique rows = 24 success refusals + 21 denial refusals + 96 accepted. Thirty fixture mutations each exercise all three complete-event paths (90 path assertions), including historical redelivery refusal. Fifty-one default rows cover every catalog-permitted terminal transition, including cancellation and its failure fallback. All issue, unjudged, handle, unaffected-state/phase, precedence and approved-fixture controls passed.

The existing runtime suite then exited 0: `ℹ tests 674`, `ℹ pass 674`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 0`, `ℹ todo 0`. Draft compilation initially rejected readonly assignments/deletion; construction was changed to immutable copies and deletion on the newly constructed input record. Draft default expectations initially omitted cancellation's failure fallback and overcounted defaults; those test-only draft defects were corrected before committing. No made commit was amended or rewritten, and no mutant was committed.

Before the documentation-only commit, `npm run test:kit --prefix packages/security-audit-sdk-node` exited 0: `evaluation kit verification passed:`; `every callee and identifier-shaped inline code span in the kit documents resolved against installed package type declarations, except 33 reviewed exceptions`. The first draft had failed `synthetic-values` because a GitHub link's host was not synthetic; the catalog uses issue #817 without a URL, while the required link remains in `ADR-SDK-016`. This was corrected in the uncommitted documentation draft, not by changing a gate. `npm run test:coherence --prefix packages/security-audit-sdk-core` exited 0: `cross-artifact coherence passed in archived mode for remediate-security-audit-sdk-adversarial-review: contract 2.1.0, 24 catalog events/24 named APIs, 0 runtime dependencies, 91/91 current-change tasks complete`. Strict validation and `git diff --check` also exited 0. CodeScene CLI `1.0.53` review of the new test file reported `file score 10.0`; the required delta result is below.

The preceding last sentence is retained verbatim from run #134's record. The delta
observation below belongs to run #135, not a substituted run #134 execution.
Run #135's following evidence likewise retains its original baseline and commit identifiers.
Those are historical rebased observations: the five #812 patches were subsequently rebased
unchanged onto `958e7ebb4b162d1a1423140b510bf1037cb6e1df`, yielding `a75771c`, `164ad69`,
`3a102cd`, `ed3faf4` and `41be046` in order. This polish preserves those ancestors unchanged.

## Task `5.1` — run #135, fresh full-chain pre-evidence observations

Executed the supplied `TEST_CMD`, without a cache replay,
with an empty index on provisioned head `75a01dd`. The eight commands ran in order;
the successful complete `&&` chain proves each exit status below. Full output and
status records are retained externally. No run #134 observations substitute for
this execution. Run #135 originally left tasks `1`–`4` unchecked rather than retrospectively
claim their original pre-commit checks; this polish restores them from the labelled run #134
record above. Local results do not assert remote CI or
independent mutation-review approval.

| Order | Gate | Exit status |
|---|---|---|
| 1 | `check:generated` | `0` |
| 2 | `test:changed-paths` | `0` |
| 3 | `openspec validate fix-core-outcome-commit-consistency --strict` | `0` |
| 4 | `check-design-pattern-governance --phase final --base 2660984bbf1a956b8246c4d2cd874f53c0c31a43` | `0` |
| 5 | `check-git-state` | `0` |
| 6 | `make test` | `0` |
| 7 | `make governance-gates` | `0` |
| 8 | CodeScene CLI 1.0.53 delta, the gate CI's `codescene delta` job runs | `0` |

Verbatim gate observations:

```text
check:generated:
generated SDK contract artifacts are current

test:changed-paths:
archive movement baseline: re-derived from attested revision f03d98bb7b18edab0a941cdf1c8014a185618865
changed-path policy passed in archived mode for remediate-security-audit-sdk-adversarial-review: 1516 visible records; {"unrelated-history-or-worktree":1300,"local-instruction-unrelated":1,"event-contract":85,"archived-remediation":8,"active-remediation":6,"sdk-capability":1,"sdk-package":117,"unrelated-deletion":1}; ignored files excluded by standard Git semantics

strict OpenSpec:
Change 'fix-core-outcome-commit-consistency' is valid

pinned final design-pattern governance:
design-pattern governance passed in final phase: enforcement active; inspected 4 commit(s) and 15 path(s) from 2660984bbf1a

check-git-state:
Git whitespace/final-newline checks passed and index is empty

make test:
Product test loop passed across every declared workspace (~45s local, 2026-09-10).

make governance-gates:
Full governance-gate chains passed across every declared workspace (~13-20min local, 2026-09-10).

CodeScene delta:
no findings
cs delta exit=0

TEST_CMD:
TEST_CMD exit=0
```

### Catalog matrix and named regressions

Both `make test` / `test:matrix` and `make governance-gates` / `test:runtime`
executed the existing top-level `outcome-commit-consistency.test.ts`.
The matrix is exactly `141 = 24 PREMATURE_SUCCESS + 21 SDK_SEMANTIC_VALIDATION_FAILED + 96 accepted`
across `15` transaction-bound events. Every matrix and complete-event refusal
checks the exact error and zero sink calls; accepted named rows check one sink
call and the caller's outcome / handle's commit state. All complete-event
mutations, issue controls, unjudged outcomes, defaults, unaffected states,
handle refusals and approved fixtures passed. No new tests were added for this
evidence-only story.

Verbatim selected `make governance-gates` / `test:runtime` observations:

```text
✔ catalog-derived matrix: 15 events, 141 unique rows = 24 success refusals + 21 denial refusals + 96 accepted (2.60225ms)
✔ terminal default controls span every sanctioned transition including cancellation (0.271708ms)
✔ absent handle success retains /operation/state (0.982375ms)
✔ pending handle success retains /operation/state (0.669333ms)
✔ completed not_applicable and unrestricted attempted success stay accepted (5.908834ms)
✔ compensating compensated success remains accepted (2.158709ms)
✔ approved authorization-outcome-conflation keeps its exact contract diagnostic before denial (1.523958ms)
✔ deny + success + not_committed returns PREMATURE_SUCCESS before authorization on all paths (3.381542ms)
✔ derived-field provenance beats SDK-only denial after otherwise valid authorization (2.068875ms)
✔ every approved positive validates and every approved negative retains its original first code (38.923625ms)
ℹ tests 674
ℹ suites 0
ℹ pass 674
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

The product-loop `test:runtime` printed the same totals: `674` tests, `0`
suites, `674` pass, `0` fail, `0` cancelled, `0` skipped, `0` todo.
`typecheck`, build, `test:types`, `test:coherence`, frozen exports and contract
immutability all passed in the full chain, as did every declared workspace's
validation. Verbatim full unchanged `make governance-gates` / `test:verification`
summary (not a partial mutation run):

```text
ℹ tests 301
ℹ suites 5
ℹ pass 301
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1059078.805208
```

## Task `5.2` — run #135, evidence-edit pre-commit observations

The original four commits retain their exact subjects, `Refs #812` bodies,
co-author footers, parent order and owned path groups on baseline
`2660984bbf1a956b8246c4d2cd874f53c0c31a43`:

| Commit | Exact subject | Owned group |
|---|---|---|
| `fd6d1a4` | `docs(openspec): propose outcome and commit-state agreement (#812)` | Six change artifacts |
| `a69f7b7` | `fix(sdk-core): refuse outcomes that contradict commit evidence (#812)` | Only `src/validation/semantic.ts` |
| `43bf9ed` | `test(sdk-core): prove outcome and commit-state agreement on every path (#812)` | Only `tests/outcome-commit-consistency.test.ts` |
| `75a01dd` | `docs(sdk-core): document outcome and commit-state agreement (#812)` | Seven enumerated docs/coherence paths |

The cumulative inventory is the exact `15` paths in `owned_paths`. Comparing
baseline and head Git tree objects proves byte-identical content and modes for
all unowned baseline paths, including #811's dedicated change/source/test/ADR
artifacts, the three preserved canonical requirements, frozen `contracts/`,
`src/generated/`, generator, public types/exports/error codes, manifests,
verification lifecycle/tests, `openspec/specs/`, governance-core, `.github/`,
`.codescene/`, collector, `ADR-SDK-007` and `ADR-SDK-014`. Only the enumerated
shared documentation changes already in the four original commits are permitted;
this evidence draft changes only `tasks.md` and `assessment.json`.

The first evidence-edit lightweight attempt passed generated, changed-path,
strict and pinned final governance checks (`0` each), then `check-git-state`
exited `1` on a draft-only extra blank line at EOF. Verbatim diagnostic:

```text
openspec/changes/fix-core-outcome-commit-consistency/tasks.md:145: new blank line at EOF.
```

Removed that extra blank line without changing implementation or tests, then
reran all six lightweight gates and the ownership/format audit successfully
before staging. This is a corrected evidence draft, not a corrective
implementation commit or a bypass. The `5.2` tick records these observed
pre-commit checks, not any future committed-head execution.

| Evidence-edit gate | Exit status |
|---|---|
| `check:generated` | `0` |
| `test:changed-paths` | `0` |
| `openspec validate fix-core-outcome-commit-consistency --strict` | `0` |
| `check-design-pattern-governance --phase final --base 2660984bbf1a956b8246c4d2cd874f53c0c31a43` | `0` |
| `check-git-state` | `0` |
| `git diff --check` | `0` (no output) |
| Exact ownership / LF / final-newline / empty-index audit | `0` |

Verbatim evidence-edit gate observations:

```text
check:generated:
generated SDK contract artifacts are current

test:changed-paths:
archive movement baseline: re-derived from attested revision f03d98bb7b18edab0a941cdf1c8014a185618865
changed-path policy passed in archived mode for remediate-security-audit-sdk-adversarial-review: 1516 visible records; {"unrelated-history-or-worktree":1300,"local-instruction-unrelated":1,"event-contract":85,"archived-remediation":8,"active-remediation":6,"sdk-capability":1,"sdk-package":117,"unrelated-deletion":1}; ignored files excluded by standard Git semantics

strict OpenSpec:
Change 'fix-core-outcome-commit-consistency' is valid

pinned final design-pattern governance:
design-pattern governance passed in final phase: enforcement active; inspected 4 commit(s) and 15 path(s) from 2660984bbf1a

check-git-state:
Git whitespace/final-newline checks passed and index is empty

ownership/format audit:
fd6d1a4: subject, Refs #812, exact owned path group (6 paths): PASS
a69f7b7: subject, Refs #812, exact owned path group (1 paths): PASS
43bf9ed: subject, Refs #812, exact owned path group (1 paths): PASS
75a01dd: subject, Refs #812, exact owned path group (7 paths): PASS
15-path cumulative inventory equals exact owned_paths: PASS
Baseline ancestor and four original parent-linked commits unchanged and ordered: PASS
All baseline-tracked paths outside the owned inventory byte-identical (Git tree objects): PASS
Only tasks.md and assessment.json differ from provisioned head: PASS
Both evidence files use LF, final newlines and no trailing whitespace: PASS
Empty index: PASS
```

Any subsequent evidence edits require another lightweight pass before staging.
The evidence-only commit and actual committed-head rechecks will be reported
externally, never retroactively added to the commit they check. Maintainer
follow-up `6.1`–`6.4` remains unchecked; no remote CI, review, merge, fold or
archive approval is claimed.

## Task `5.3` — run #136, documentation polish and pre-evidence observations

Decision source for this polish: owner decision, 2026-10-14, via code-review follow-up in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E

Only pointer comments were added above the two policy tables in `semantic.ts`; no code token
changed. The glossary lost only its separating blank line. The Node catalog's
`PREMATURE_SUCCESS` entry now names every validation path in Meaning and integrates its
existing compatibility, precedence and decision-source facts into its own structure.
No behavior, test, public API, error code, contract, gate or exception changed.

Before the Node documentation commit, `npm run test:kit --prefix packages/security-audit-sdk-node`
exited `0`, including this verbatim observation:

```text
every callee and identifier-shaped inline code span in the kit documents resolved against installed package type declarations, except 33 reviewed exceptions
```

The separate Core build and typecheck commands both exited `0` before the full chain.
With an empty index and no evidence edits, the supplied `TEST_CMD` ran uncached from
`2026-10-14T20:38:24Z` to `2026-10-14T21:00:38Z` on content tree
`9995bac34cbb887ad0e84e3e24452a0c4cc80434`. Its complete `&&` chain exited `0`, proving
all eight commands ran in order and each exited `0`. Bases were pinned to stable upstream
`958e7ebb4b162d1a1423140b510bf1037cb6e1df`; no shared reference was moved. Full output
and status records remain external. These full-chain observations precede evidence edits,
not a claim about the eventual evidence commit or remote CI.

| Order | Gate | Exit status |
|---|---|---|
| 1 | `check:generated` | `0` |
| 2 | `test:changed-paths` | `0` |
| 3 | `openspec validate fix-core-outcome-commit-consistency --strict` | `0` |
| 4 | `check-design-pattern-governance --phase final --base 958e7ebb4b162d1a1423140b510bf1037cb6e1df` | `0` |
| 5 | `check-git-state` | `0` |
| 6 | `make test` | `0` |
| 7 | `make governance-gates` | `0` |
| 8 | CodeScene CLI 1.0.53 delta, the gate CI's `codescene delta` job runs | `0` |

Verbatim gate observations:

```text
check:generated:
generated SDK contract artifacts are current

test:changed-paths:
archive movement baseline: re-derived from attested revision f03d98bb7b18edab0a941cdf1c8014a185618865
changed-path policy passed in archived mode for remediate-security-audit-sdk-adversarial-review: 1529 visible records; {"unrelated-history-or-worktree":1313,"local-instruction-unrelated":1,"event-contract":85,"archived-remediation":8,"active-remediation":6,"sdk-capability":1,"sdk-package":117,"unrelated-deletion":1}; ignored files excluded by standard Git semantics

strict OpenSpec:
Change 'fix-core-outcome-commit-consistency' is valid

pinned final design-pattern governance:
design-pattern governance passed in final phase: enforcement active; inspected 7 commit(s) and 15 path(s) from 958e7ebb4b16

check-git-state:
Git whitespace/final-newline checks passed and index is empty

make test:
Product test loop passed across every declared workspace (~45s local, 2026-09-10).

make governance-gates:
Full governance-gate chains passed across every declared workspace (~13-20min local, 2026-09-10).

CodeScene CLI 1.0.53 delta, the gate CI's codescene delta job runs:
no findings
cs delta exit=0

TEST_CMD:
TEST_CMD exit=0
```

The loop banners' measurements remain historical measurements, not this run's timings.
Both loops passed Core `674`, Node `162`, browser `71`, collector `92`, contract `17`,
envelope `18` and research `11` tests, all with zero failures/cancelled/skipped/todo.
Both Node kit-control executions observed `90 measured plants across 81 of 81 controls`,
each failing closed as intended; no negative-control failure was ignored.

Both Core runtime executions passed the existing outcome/commit regressions. Verbatim selected
full-governance runtime observations:

```text
✔ catalog-derived matrix: 15 events, 141 unique rows = 24 success refusals + 21 denial refusals + 96 accepted (3.527542ms)
✔ terminal default controls span every sanctioned transition including cancellation (0.128916ms)
✔ absent handle success retains /operation/state (0.991042ms)
✔ pending handle success retains /operation/state (0.720667ms)
✔ completed not_applicable and unrestricted attempted success stay accepted (5.337042ms)
✔ compensating compensated success remains accepted (2.443417ms)
✔ approved authorization-outcome-conflation keeps its exact contract diagnostic before denial (1.009625ms)
✔ deny + success + not_committed returns PREMATURE_SUCCESS before authorization on all paths (1.766959ms)
✔ derived-field provenance beats SDK-only denial after otherwise valid authorization (1.162208ms)
✔ every approved positive validates and every approved negative retains its original first code (24.038ms)
ℹ tests 674
ℹ suites 0
ℹ pass 674
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Verbatim full unchanged `make governance-gates` / `test:verification` summary, not a partial
or cached mutation run:

```text
ℹ tests 301
ℹ suites 5
ℹ pass 301
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 406075.529541
```

Run #134's historical observations and run #135's evidence are preserved separately above.
The restored task ticks do not assert run #134 completed evidence closure. Task `5.3`
records this executed polish and pre-evidence chain only; follow-ups `6.1`–`6.4` stay pending.

### Evidence-edit lightweight observations — run #136, before staging

After importing the historical observations and drafting both evidence files, the following
checks each exited `0`, with the index empty:

| Evidence-edit gate | Exit status |
|---|---|
| `check:generated` | `0` |
| `test:changed-paths` | `0` |
| `openspec validate fix-core-outcome-commit-consistency --strict` | `0` |
| `check-design-pattern-governance --phase final --base 958e7ebb4b162d1a1423140b510bf1037cb6e1df` | `0` |
| `check-git-state` | `0` |
| `git diff --check` | `0` (no output) |
| Exact history / paths / comment-only / provenance / format audit | `0` |

The first five gates repeated this run's verbatim observations above. The audit verified
both new documentation commits' exact subjects, prescribed path groups, `Refs #812` bodies
and co-author footers; all five original commits remain identical ordered ancestors.
The complete polish is limited to the five allowed paths, with LF, final newlines and no
trailing whitespace or untracked additions. Its other verbatim observations included:

```text
semantic.ts: ONLY three added comment lines immediately above the tables; no code token change: PASS
CONTEXT.md: only the glossary blank line removed: PASS
Node catalog: only PREMATURE_SUCCESS changed; paths and verbatim source integrated; prose about 100 columns except verbatim source: PASS
Historical observations verbatim; completed-task reconciliation; run #135 associations retained; other assessment fields unchanged; all 6.x pending: PASS
```

These are completed pre-commit draft checks. Recording them is a further evidence edit,
so another complete lightweight pass is required before staging. That pass and any actual
committed-head checks are reported externally, not retrospectively claimed in this commit.
