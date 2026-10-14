# Tasks — #812

Decision source: owner decision, 2026-10-13, via plan-mode questions, grilling and triage in local Claude Code session 2db6f6fa-b531-4e63-8651-4ea851fd76be

## 1. Proposal

- [ ] 1.1 Author the six change artifacts with full assessment, exact ownership, decided scope and `ADDED`-only requirement.
- [ ] 1.2 Execute assessment governance and strict validation before the proposal-only commit.

## 2. Runtime

- [ ] 2.1 Implement success inside first-position `validateCommit` and denial last after provenance, with module-scope tables and unchanged public surface.
- [ ] 2.2 Execute build/typecheck and existing runtime regressions before the runtime-only commit.

## 3. Tests

- [ ] 3.1 Add the catalog-derived 15-event, 141-row matrix with exact 24/21/96 totals, safe results, sink counts and preserved explicit values.
- [ ] 3.2 Add all complete-event mutations, issue/default/unjudged/unaffected/handle/precedence/approved-fixture controls; execute focused compilation/tests and existing runtime regressions.

## 4. Documentation

- [ ] 4.1 Append API/migration/security/glossary guidance, add `ADR-SDK-016`, advance only ADR inventory pins, and widen the Node error catalog.

## 5. Verification and evidence

- [x] 5.1 Execute the supplied eight-command `TEST_CMD` in order; record each exit status, matrix totals, full unchanged `test:verification` totals and CodeScene delta observations by gate name.
- [x] 5.2 Audit exact commit subjects/path groups/ownership, preserved forbidden artifacts and empty index; execute lightweight generated/changed-path/strict/final-governance/git/whitespace evidence-edit checks before staging. Commit evidence and report actual committed-head rechecks externally; this tick records only completed pre-commit work.

## 6. Maintainer follow-up

- [ ] 6.1 Obtain all ten required PR CI contexts and independent review; no local approval claim.
- [ ] 6.2 Merge after review and required checks.
- [ ] 6.3 Fold the added requirement in a separate governed change.
- [ ] 6.4 Archive only after fold lands.

## Evidence policy

Record only executed results, verbatim, by gate name without machine-local log paths. Full-chain observations refer to the pre-evidence tree; subsequent lightweight observations are separate. The provisioned branch is pinned to the supplied merged `main` baseline; do not move it or rewrite existing commits. No push, PR, GitHub comment, merge, fold, archive or secret access.

## Task `5.1` — run #135, fresh full-chain pre-evidence observations

Executed the exact supplied `TEST_CMD` through `tamandua-test`, without a cache replay,
with an empty index on provisioned head `75a01dd`. The eight commands ran in order;
the successful complete `&&` chain proves each exit status below. Full output and
status records are retained externally. No run #134 observations substitute for
this execution. Tasks `1`–`4` remain unchecked: this run does not retrospectively
claim their original pre-commit checks. Local results do not assert remote CI or
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
| 8 | CodeScene delta, `cs53-check` with `tamandua-base-812` | `0` |

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
