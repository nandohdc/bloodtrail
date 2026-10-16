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
- [x] 5.4 Pin named execution and named redelivery lifecycle refusal under synchronous re-entrant shutdown, name explicit free-function runtime containment, consolidate duplicated regression setup, and rerun the supplied eight-gate chain before recording follow-up evidence.

## 6. Maintainer follow-up

Decision source: orchestrator follow-through, 2026-10-15, in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E: applies the owner's fold-then-archive practice for merged changes (owner request, 2026-10-14: "Fold and archive #811, #798 and #812, each as its own PR.") to #816 after the owner merged PR #828; not a separate owner instruction, and the owner may withdraw it.

- [x] 6.1 Obtain all ten required remote PR CI contexts; local results are not remote CI. Evidence: all ten required contexts passed on `ea599379621a3502a4246204a765e37efade0507` in PR #828: `ci / lint`, `ci / test`, `ci / audit`, `sonar`, `sdk`, `contract`, `conventional-commits`, `codescene delta`, `design-pattern-governance` and `coverage`.
- [x] 6.2 Obtain independent maintainer approval. Evidence: the maintainer merged PR #828; no separate approval artifact exists because the repository requires no reviews. AI review is not approval, and no review content is asserted.
- [x] 6.3 Merge after required checks and approval. Evidence: the maintainer merged PR #828 into `main` as merge commit `d9896d6645f8e10280f7dab9941734c12ab335e6` on 2026-10-15T20:50:11Z.
- [x] 6.4 Fold the delta in a separate governed change. Evidence: folded into `openspec/specs/security-audit-sdk-core/spec.md` while `fix-core-configured-schema-runtime` remains active, in this dedicated fold PR under ADR 0001; this does not claim that the fold PR has merged.
- [x] 6.5 Archive only after fold lands. Evidence: relocated to `openspec/changes/archive/2026-10-15-fix-core-configured-schema-runtime/` in this commit, after fold PR #829 merged as `8ce870ad58ca412d2e89c8bfc821fcc238e40247`.

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

## Follow-up 5.4 observations — before follow-up evidence edits

The earlier observations describe the original five-commit implementation and remain historical evidence. This follow-up changes no source, public API, verification mutant or other runtime test. It appends two public named-method regressions and extends only the containment scenario's `WHEN` to include free `validateSecurityAuditEvent(value, runtime)` with an explicitly passed runtime. The `ADDED` block and all ten `MODIFIED` scenario names remain unchanged.

`build`, `typecheck`, test compilation and the focused configured-runtime tests exited `0`. The focused file passed `11` tests with `0` failures/cancelled/skipped/todo. Named execution starts shutdown synchronously from the first clock call; named redelivery starts it from the configured runtime's first validation call, which delegates to `cjsSchemaRuntime`. Both hooks are untouched during configuration, are observed during the named call, and retain the first shutdown promise for awaited cleanup. Both results deep-equal `SDK_SHUTTING_DOWN` / `lifecycle` failures, with zero sink events. No global override is used by these regressions. The six existing selection rows and refusing-global controls still pass.

The first full follow-up chain passed gates 1–7 below, including `test:verification` (`301` tests, `5` suites, `301` pass, `0` fail/cancelled/skipped/todo), but CodeScene delta exited `1` with this diagnostic:

```text
Code Duplication introduced
```

An allowed corrective test-only commit consolidated the appended cases into a module-scope table and one shared test callback. No existing test content was changed. After that correction, the exact supplied `TEST_CMD` ran uncached; every command below ran in order and exited `0`, and the wrapper exited `0`. These observations precede the follow-up evidence edits, not the eventual evidence commit.

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

Strict OpenSpec validation also exited `0` before the spec-only commit. Final design-pattern governance inspected `8 commit(s) and 18 path(s)` from the pinned baseline. Both product and governance loops passed Core `685` tests; the two new lifecycle cases account for the increase from the historical `683`. No tests were skipped or weakened. CodeScene delta printed:

```text
no findings
cs delta exit=0
```

Verbatim corrected-chain `test:verification` summary:

```text
ℹ tests 301
ℹ suites 5
ℹ pass 301
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 405159.009959
```

The original five commits remain ancestral and unchanged. The follow-up preserves the prescribed test/spec/evidence order with the allowed corrective test commit before evidence. Only the four authorized follow-up paths differ from its starting point; tests are append-only relative to that point, and no source or verification file was changed. Merge, fold, archive and remote CI remain pending.

After drafting the follow-up evidence, `check:generated`, `test:changed-paths`, strict OpenSpec, pinned final design-pattern governance, `check-git-state` and `git diff --check` each exited `0` in that order, with an empty index. Final governance still inspected `8 commit(s) and 18 path(s)`. These are precommit checks only. Recording this observation is another evidence edit, so the same lightweight checks must pass again before staging. Any actual committed-head rechecks will be reported externally; no check after the evidence commit is recorded as completed here.

## Remote follow-up remains pending

No remote operation was performed. All ten required contexts remain unchecked/pending maintainer follow-up: `ci / lint`, `ci / test`, `ci / audit`, `sonar`, `sdk`, `contract`, `conventional-commits`, `codescene delta`, `design-pattern-governance` and `coverage`. Independent approval, merge, fold and archive remain unchecked. Local results and AI review are not approval.

## Evidence policy

Record executed observations verbatim by gate name, without machine-local paths or helper names. Distinguish pre-evidence full-chain results from evidence-edit checks and externally reported committed-head rechecks. No push, PR, remote comment, merge, fold, archive or secret access. Baseline remains `01999a4b5a85f95e0e5db1e4a9eeeec788dc831a`; never rewrite made commits. That policy bound the implementation runs; group 6 records the later merge and fold as they land, and the archive follows in a separate PR.

## Observed fold evidence — 2026-10-15, run #146, Node v26.11.1

The supplied TEST_CMD executed before this evidence edit and before the containing commit, with an empty index against pinned base `d9896d6645f8e10280f7dab9941734c12ab335e6`. The initial wrapper invocation refused the uncommitted tracked edits with `FAILURE_CLASS: tree_dirty`, exit `88`, before any gate ran. The same exact command then ran with the documented `TAMANDUA_TSTX=0` passthrough, without caching or ledger attribution, and exited `0`. All ten commands below executed in the supplied order and each exited `0`.

| Order | Gate command | Exit status | Observed result |
|---|---|---|---|
| 1 | `npm run check:generated --prefix packages/security-audit-sdk-core` | `0` | `generated SDK contract artifacts are current` |
| 2 | `npm run test:matrix --prefix packages/security-audit-sdk-core` | `0` | Typecheck, build, runtime tests (`685` tests, `685` pass, `0` fail/cancelled/skipped/todo), type tests, examples, exports, compatibility, scope and dependencies passed; `15 compilable SDK documentation scenarios passed`. |
| 3 | `npm run test:coherence --prefix packages/security-audit-sdk-core` | `0` | `cross-artifact coherence passed in archived mode for remediate-security-audit-sdk-adversarial-review: contract 2.1.0, 24 catalog events/24 named APIs, 0 runtime dependencies, 91/91 current-change tasks complete` |
| 4 | `npm run test:changed-paths --prefix packages/security-audit-sdk-core` | `0` | `changed-path policy passed in archived mode for remediate-security-audit-sdk-adversarial-review: 1537 visible records`; ignored files excluded by standard Git semantics. |
| 5 | `npm run validate --prefix contracts/security-audit` | `0` | `Security audit contract validation passed.`; `17` tests, `17` pass, `0` fail/cancelled/skipped/todo. |
| 6 | `openspec validate fix-core-configured-schema-runtime --strict` | `0` | `Change 'fix-core-configured-schema-runtime' is valid` |
| 7 | `openspec validate security-audit-sdk-core --type spec` | `0` | `Specification 'security-audit-sdk-core' is valid`; zero ERROR issues, exactly `41` WARNINGs, all `Requirement text is very long (>500 characters)`, unchanged from the baseline. |
| 8 | `node openspec/scripts/check-design-pattern-governance.mjs --phase final --base d9896d6645f8e10280f7dab9941734c12ab335e6` | `0` | `design-pattern governance passed in final phase: enforcement active; inspected 0 commit(s) and 0 path(s) from d9896d6645f8` |
| 9 | `node packages/security-audit-sdk-core/scripts/check-git-state.mjs` | `0` | `Git whitespace/final-newline checks passed and index is empty` |
| 10 | `make test` | `0` | `Product test loop passed across every declared workspace (~45s local, 2026-09-10).` |

The final-phase result above is vacuous by design: it inspected only the empty committed range before this fold commit, not the working-tree fold. The material committed-head result must be reported externally after execution, never backfilled into this commit. The coherence and changed-path gates' archived mode refers to the historical remediation, not archival of this active change.

`make test` passed Core `685`, Node `162`, browser `71`, collector `92`, contract `17`, envelope `18` and research `11` tests, each with zero failures/cancelled/skipped/todo. The evaluation kit reported `90 measured plants across 81 of 81 controls`, each failing closed at its declared identity. Expected planted diagnostics were followed by the passing negative-control summary. The banner's timing is a historical measurement, not this execution's duration. Full governance-gate chains were not run.

Before the ordered chain, `npm run build --prefix packages/security-audit-sdk-core` exited `0`, and eight external focused fold regression tests passed. They prove byte equality of both complete delta blocks, unique requirement headings and all `7` ADDED / `10` MODIFIED scenario headings, in-place replacement and append order, second-application byte identity, no operation headers, preservation of every untouched canonical byte and all `19` founding requirement blocks, and deletion positions confined to the superseded provider block. Exactly two canonical lines are deleted, both in `Provider containment schema non-result`; no other provider scenario changes. Only the two allowed paths differ, the delta is unchanged, and the change remains active. No repository test files were added or modified.

Additional pre-evidence `openspec validate security-audit-sdk-core --type spec --json` exited `0`; executable comparison with the baseline JSON confirmed identical `41` very-long-requirement WARNINGs and zero ERROR issues, with no new warning. `git diff --check` also exited `0` before the chain. Recording this section is an evidence edit: whitespace/Git checks must run again with an empty index before staging. No later check or committed-head result is asserted here. No remote mutation, fold merge, archive, signing, release or secret access was performed by this run.
