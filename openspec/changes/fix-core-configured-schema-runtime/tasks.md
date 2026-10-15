# Tasks — #816

Decision source: owner decision, 2026-10-15, via grilling and triage in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E

## 1. Proposal

- [x] 1.1 Author six change artifacts, full assessment and exact ownership with the decided added/modified delta.
- [x] 1.2 Run assessment governance and strict validation before the proposal-only commit.

## 2. Runtime

- [x] 2.1 Use configured validation during named construction/redelivery and private already-validated delivery with preserved lifecycle gating.
- [x] 2.2 Run build/typecheck and relevant existing regressions before the runtime commit.

## 3. Tests

- [x] 3.1 Add the top-level six-entry counting matrix, refusing-global controls and omitted-runtime isolation.
- [x] 3.2 Rewrite only the three named/global fault rows and named-redelivery global test; preserve all other provider coverage.
- [x] 3.3 Re-anchor affected verification mutants without weakening; execute focused and full runtime tests.

## 4. Documentation

- [x] 4.1 Update the seven specified documentation/coherence paths and run Core coherence and Node kit.

## 5. Verification and evidence

- [x] 5.1 Execute the supplied eight-command chain in order and exact test wrapper; record every exit status, full mutation totals and CodeScene delta.
- [x] 5.2 Build examples and run the supplied repro; record observed call counts and exit status.
- [x] 5.3 Audit exact subjects/path groups/ownership, untouched boundaries and format; run lightweight evidence-edit checks before staging. Report committed-head checks externally, not as self-verification.

## 6. Maintainer follow-up

- [ ] 6.1 Obtain all ten required remote PR CI contexts; local results are not remote CI.
- [ ] 6.2 Obtain independent maintainer approval.
- [ ] 6.3 Merge after required checks and approval.
- [ ] 6.4 Fold the delta in a separate governed change.
- [ ] 6.5 Archive only after fold lands.

## Proposal observations — before the proposal-only commit

`check-design-pattern-governance --phase assessment --change fix-core-configured-schema-runtime` exited `0`: `design-pattern governance passed in assessment phase: enforcement active`.

`openspec validate fix-core-configured-schema-runtime --strict` exited `0`: `Change 'fix-core-configured-schema-runtime' is valid`.

## Executed implementation and documentation observations

Before the runtime-only commit, `build` and `typecheck` each exited `0`. Relevant existing `f11` delivery-intent and outcome/commit regressions exited `0`: `ℹ tests 279`, `ℹ pass 279`, `ℹ fail 0`, with zero cancelled/skipped/todo. The four global-dependent provider tests were deliberately rewritten in the next test-only commit, not skipped or removed from the final suite.

Before the test-only commit, `test:runtime` exited `0`: `ℹ tests 683`, `ℹ pass 683`, `ℹ fail 0`, with zero cancelled/skipped/todo. The new top-level file contributes nine tests: the six-entry identity guard, six independently measured entry points, refusing-global same-instance control and omitted-runtime control. Fixture preparation invokes neither counting runtime; every global override is restored in `finally`.

The existing provider matrix retains exactly `33` unique rows. Exactly three `named` / `globalSchema` row definitions now expect acceptance with zero faulty-global calls and one sink call. The named-redelivery faulty-global control also accepts with zero global calls and one sink call. All other row definitions and unrelated runtime/type/example/kit tests remain byte-identical. Configured faults retain exact provider diagnostics, no throw/rejection/leak and zero sink calls; existing sanitized-verdict, precedence, lifecycle, operation and outcome controls pass.

Before the documentation-only commit, `test:coherence` and Node `test:kit` each exited `0`. Verbatim observations:

```text
cross-artifact coherence passed in archived mode for remediate-security-audit-sdk-adversarial-review: contract 2.1.0, 24 catalog events/24 named APIs, 0 runtime dependencies, 91/91 current-change tasks complete
```

The Node `test:kit` output includes this verbatim clause:

```text
every callee and identifier-shaped inline code span in the kit documents resolved against installed package type declarations, except 33 reviewed exceptions
```

The Node catalog references the verbatim decision source in Core's `ADR-SDK-017`; it introduces no undeclared API or synthetic-value exception.

## Full-chain observations — before evidence edits

All eight supplied commands ran in order with an empty index against pinned baseline `01999a4b5a85f95e0e5db1e4a9eeeec788dc831a`. Each exited `0`; the complete chain exited `0`. These observations precede this evidence edit and do not claim verification of the eventual evidence commit or remote CI.

| Order | Gate | Exit status |
|---|---|---|
| 1 | `check:generated` | `0` |
| 2 | `test:changed-paths` | `0` |
| 3 | `openspec validate fix-core-configured-schema-runtime --strict` | `0` |
| 4 | `check-design-pattern-governance --phase final --base 01999a4b5a85f95e0e5db1e4a9eeeec788dc831a` | `0` |
| 5 | `check-git-state` | `0` |
| 6 | `make test` | `0` |
| 7 | `make governance-gates` | `0` |
| 8 | CodeScene CLI `1.0.53` delta | `0` |

Verbatim gate observations:

```text
check:generated:
generated SDK contract artifacts are current

test:changed-paths:
archive movement baseline: re-derived from attested revision f03d98bb7b18edab0a941cdf1c8014a185618865
changed-path policy passed in archived mode for remediate-security-audit-sdk-adversarial-review: 1537 visible records; {"unrelated-history-or-worktree":1319,"local-instruction-unrelated":1,"event-contract":85,"archived-remediation":8,"active-remediation":6,"sdk-capability":1,"sdk-package":119,"unrelated-deletion":1}; ignored files excluded by standard Git semantics

strict OpenSpec:
Change 'fix-core-configured-schema-runtime' is valid

pinned final design-pattern governance:
design-pattern governance passed in final phase: enforcement active; inspected 4 commit(s) and 18 path(s) from 01999a4b5a85

check-git-state:
Git whitespace/final-newline checks passed and index is empty

make test:
Product test loop passed across every declared workspace (~45s local, 2026-09-10).

make governance-gates:
Full governance-gate chains passed across every declared workspace (~13-20min local, 2026-09-10).

CodeScene delta:
no findings
cs delta exit=0
```

The banners' measurements are historical measurements, not this execution's timing. Both loops passed Core `683`, Node `162`, browser `71`, collector `92`, contract `17`, envelope `18` and research `11` tests with zero failures/cancelled/skipped/todo. Node kit negative controls passed `90 measured plants across 81 of 81 controls`, each failing closed at its declared identity; expected planted diagnostics are not ignored failures.

The exact supplied `TEST_CMD` wrapper then ran uncached and exited `0`, independently repeating `make test`. It printed the same product-loop success banner above. The full governance chain was executed separately, not inferred from that wrapper. `git diff --check` exited `0` with no output.

### Runtime selection and independent reproduction

The new counting tests passed this observed table; each row uses a fresh harness and independent counts:

| Entry point | Global calls | Configured/passed calls |
|---|---|---|
| Named execution | `0` | `1` |
| Named redelivery | `0` | `1` |
| `emit(event)` | `0` | `1` |
| `redeliver(event)` | `0` | `1` |
| Free default validation | `1` | `0` |
| Free explicit-runtime validation | `0` | `1` |

The refusing-global control accepts the named method and `emit()` on the same instance, with two sink events, zero global calls and two configured calls. Free default validation is refused with one global call; explicit-runtime validation succeeds without another global call. The omitted-runtime control accepts all four instance paths with zero global calls while free default validation remains refused.

`test:examples` exited `0` after the existing build supplied `dist/` and `dist-examples/`. The supplied orchestrator reproduction exited `0` and printed:

```text
named authorizationDenied()                  global=0 configured=1 result=ok
emit(complete event)                         global=0 configured=1 result=ok
redeliver(complete event)                    global=0 configured=1 result=ok
free validateSecurityAuditEvent(e)           global=1 configured=0 result=ok
free validateSecurityAuditEvent(e, runtime)  global=0 configured=1 result=ok
--- refusing global runtime installed via setSchemaRuntime()
named authorizationDenied()                  global=0 configured=1 result=ok
  sink events after named: 1
emit(same valid event)                       global=0 configured=1 result=ok
  sink events after emit: 2
```

That reproduction covers five entry rows; the named-redelivery row is independently measured in the new test file, not attributed to the reproduction.

### Full mutation verification

Verbatim complete `make governance-gates` / `test:verification` summary:

```text
ℹ tests 301
ℹ suites 5
ℹ pass 301
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 394148.371458
```

Only `M-F11-F consume terminal-completion path during redelivery` and `M-F11-G restore unchecked early return` were re-anchored. The former still disables the named-redelivery branch to consume terminal-completion handling; only the called private delivery seam changes in its old/new text. The latter still replaces validation/name/binding checks with unchecked early return; only its original validation-call anchor now includes `config.schemaRuntime`. All seven `F11` anchors occur exactly once; every other mutant is unchanged. Both re-anchored mutants were killed in the complete suite, without deletion, skipping or weakening.

### Ownership and history audit

The four primary commits have the exact prescribed proposal/runtime/tests/docs subjects, `Refs #816` bodies and co-author trailers, in order. Their path groups are exactly `6` / `2` / `3` / `7` files. No correction commit or rewritten history was needed. The cumulative `18`-path inventory equals `owned_paths`. Every unowned tracked artifact is byte-identical to the pinned baseline, including canonical specs, archives, contracts, generated artifacts, manifests, governance-core files, CI, CodeScene configuration, collector, old ADRs and unrelated tests. The copied modified requirement differs only in the specified scenario and retains all ten identical scenario names. All tracked changes use LF, final newlines and no trailing whitespace; the index is empty.

## Evidence-edit lightweight observations — before staging

After drafting both evidence files, `check:generated`, `test:changed-paths`, strict OpenSpec, pinned final design-pattern governance, `check-git-state` and `git diff --check` ran in that order and each exited `0`; the complete lightweight chain exited `0`. The first five repeated the verbatim observations above, including `4 commit(s) and 18 path(s)`; `git diff --check` printed nothing. These are actual precommit observations, not a claim that the evidence commit verified itself.

Task `5.3` records the completed ownership/history/format audit and these precommit checks only. The evidence commit will touch only `tasks.md` and `assessment.json`; recording this paragraph is a further evidence edit, so the same lightweight chain must pass again before staging. Actual committed-head rechecks will be reported externally after committing. No future or remote result is asserted here.

## Remote follow-up remains pending

No remote operation was performed. All ten required contexts remain unchecked/pending maintainer follow-up: `ci / lint`, `ci / test`, `ci / audit`, `sonar`, `sdk`, `contract`, `conventional-commits`, `codescene delta`, `design-pattern-governance` and `coverage`. Independent approval, merge, fold and archive remain unchecked. Local results and AI review are not approval.

## Evidence policy

Record executed observations verbatim by gate name, without machine-local paths or helper names. Distinguish pre-evidence full-chain results from evidence-edit checks and externally reported committed-head rechecks. No push, PR, remote comment, merge, fold, archive or secret access. Baseline remains `01999a4b5a85f95e0e5db1e4a9eeeec788dc831a`; never rewrite made commits.
