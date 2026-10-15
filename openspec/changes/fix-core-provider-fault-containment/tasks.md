# Tasks — #811

Decision source: owner decision, 2026-10-13, via grilling and triage in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E

## 1. Planning

- [x] 1.1 Author six planning artifacts, Q1–Q12, ADDED-only requirement and full security assessment with exact ownership.
- [x] 1.2 Run assessment governance and strict validation before the planning-only commit.

## 2. Runtime

- [x] 2.1 Contain identifiers, clock, context and schema faults with exact provider attribution and sanitizer.
- [x] 2.2 Contain arming/unref/cancellation faults with terminal shutdown and earlier-failure precedence.
- [x] 2.3 Count every exact mutation anchor once externally and run unchanged F08/F10/F11 suites before runtime commit.

## 3. Tests

- [x] 3.1 Add explicit site matrix with spies, exact count and no throw/rejection/leak/emission assertions.
- [x] 3.2 Add shutdown, sanitizer and legacy/healthy controls; run build, typecheck and focused tests.

## 4. Documentation

- [x] 4.1 Add API, migration, glossary, ADR-SDK-015 and Node diagnostic explanations; update only two ADR coherence rules.

## 5. Verification and evidence

- [x] 5.1 Execute the exact supplied TEST_CMD, including CodeScene delta; record observed commands/results in tasks and invariant evidence.
- [x] 5.2 Run strict validation, whitespace, exact ownership/subjects and index checks before evidence commit; report committed-head results externally.

## 6. Review follow-up (#811)

- [x] 6.1 G1: restore four exact F07 anchors and prove unchanged mutant kills; required-gate repair, not an owner decision.
- [x] 6.2 R-Q9: restrict schema diagnostics to contract/verdict codes and validation/privacy categories with typed guards.
- [x] 6.3 R-T: extend the fault matrix to 33 rows, sanitizer table to eight rows and add throwing-unref precedence controls.
- [x] 6.4 R-C: clarify unref outcome, terminal assignments, context helper and F11 rationale without new exports.
- [x] 6.5 R-D: align documentation, delta requirement and planning provenance; remove machine-local gate paths.
- [x] 6.6 Execute anchor audit, complete mutation verification, builds/typecheck, focused tests and all eight supplied gates; record observed evidence only.
- [x] 6.7 Correct kit document-references wording and parameterize duplicated precedence/correlation tests; preserve every case and assertion, add exact-count guards and pass kit verification and CodeScene delta.
- [x] 6.8 Close the six review-polish findings: isolate invalid-category rejection, remove the dead precedence assertion and redundant F11 comment, describe bounded rebuilding without internal names, reconcile the superseded schema rule and 33-row plan, and record all eight gates and evidence-edit closure without changing behavior.

Follow-up decision source: owner decision, 2026-10-14, via code-review follow-up in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E

## 7. Merge, fold and archive

- [x] 7.1 Merge after independent review and required checks. Evidence: PR #818 was merged into `main` by the maintainer as merge commit `2660984bbf1a956b8246c4d2cd874f53c0c31a43`.
- [x] 7.2 Fold the added requirement in a separate governed change. Evidence: folded into `openspec/specs/security-audit-sdk-core/spec.md` while the change is active, in this dedicated fold PR (ADR 0001).
- [ ] 7.3 Archive only after fold lands.

## Observed evidence — 2026-10-14, Node v26.11.1

These are pre-fifth-commit observations, not claims about the future evidence commit. The fixed baseline is `6ee6f57037466ac80fd0b9b181f6e881cde62520`. The provisioned feature branch has no upstream, so no pull or baseline move was performed. No approval, independent old-code sensitivity, remote CI, release, production authorization or merge claim is made. Logs and transport/audit scripts stayed outside the worktree.

### Planning (1.2)

Both executed before the planning-only commit, exit 0:
- `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change fix-core-provider-fault-containment`: `design-pattern governance passed in assessment phase: enforcement active`.
- `openspec validate fix-core-provider-fault-containment --strict`: `Change 'fix-core-provider-fault-containment' is valid`.

### Runtime and focused verification (2.1–3.2)

- `npm run build --prefix packages/security-audit-sdk-core`: exit 0; `generated SDK contract artifacts written`; tracked generated artifacts remained unchanged.
- `npm run typecheck --prefix packages/security-audit-sdk-core`: exit 0 (`tsc -p tsconfig.json --noEmit`).
- From Core: `./node_modules/.bin/tsc -p tsconfig.test.json && node --test dist-tests/provider-fault-containment.test.js`: exit 0; `ℹ tests 52`, `ℹ pass 52`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 0`. Includes 25 exact matrix rows and 27 count/sanitizer/shutdown/legacy/healthy controls. Initial focused compilation needed the required empty correlation context; initial sanitizer assertion used the wrong bound, corrected to the existing 160-character bound before this passing run.
- External exact-occurrence script counted all 13 distinct F08/F11 oldText anchors plus the F10 runtime guard (14 total after deduplication), including complete named-redelivery/SDK redeliver blocks, with count 1 each: `all exact anchors occur once`. Executed before runtime commit and rechecked before evidence. No verification test or mutant was committed.
- `bash -c 'cd packages/security-audit-sdk-core && node --test tests/verification/f08-mutations.test.mjs tests/verification/f10-mutations.test.mjs tests/verification/f11-mutations.test.mjs'`: exit 0 before runtime commit; `ℹ tests 21`, `ℹ pass 21`, `ℹ fail 0`; compile-valid mutants rejected by their existing guards.
- The external source comparison confirms the default cjsSchemaRuntime body is byte-identical to baseline; the new default invalid-event control asserts the baseline `{ ok: false, error: { code: "SDK_MISSING_EVENT_FIELD", category: "validation", path: "/event" } }`.
- CodeScene CLI 1.0.53 review of `packages/security-audit-sdk-core/tests/provider-fault-containment.test.ts`: exit 0; `file score 10.0` on the final test file.

### Full supplied TEST_CMD (5.1)

Executed verbatim on the clean four-commit tree before evidence edits, exit 0; not cached. The wrapper ran every conjunct; the final output was `no findings` and `cs delta exit=0`.

Historical supplied test wrapper executed the repository-relative commands listed below, followed by CodeScene CLI 1.0.53 delta, the same gate CI's `codescene delta` job runs. This historical chain did not include `make governance-gates`.

Each command below exited 0 in that run:

- `npm run check:generated --prefix packages/security-audit-sdk-core`: `generated SDK contract artifacts are current`.
- `npm run test:matrix --prefix packages/security-audit-sdk-core`: `ℹ tests 390`, `ℹ pass 390`, `ℹ fail 0`; build/typecheck, type tests, documentation examples, compatibility, scope and dependencies passed. `package exports verified: 61 value exports, 92 type-only exports, frozen surface matches exactly`.
- `npm run test:coherence --prefix packages/security-audit-sdk-core`: `cross-artifact coherence passed in archived mode for remediate-security-audit-sdk-adversarial-review: contract 2.1.0, 24 catalog events/24 named APIs, 0 runtime dependencies, 91/91 current-change tasks complete`. The archived mode refers to the historical remediation, not this active change; the ADR rules now require 001..015.
- `npm run test:changed-paths --prefix packages/security-audit-sdk-core`: `changed-path policy passed in archived mode for remediate-security-audit-sdk-adversarial-review: 1508 visible records; {"unrelated-history-or-worktree":1294,"local-instruction-unrelated":1,"event-contract":85,"archived-remediation":8,"active-remediation":6,"sdk-capability":1,"sdk-package":115,"unrelated-deletion":1}; ignored files excluded by standard Git semantics`.
- `npm run validate --prefix contracts/security-audit`: `ℹ tests 17`, `ℹ pass 17`, `ℹ fail 0` and deterministic generated artifacts passed.
- `npm run validate --prefix packages/security-audit-sdk-node`: `ℹ tests 162`, `ℹ pass 162`, `ℹ fail 0`; typecheck/build, frozen exports, scope, compatibility, dependency/package and evaluation-kit checks passed. Deliberate failing plants ended in the passing negative-control summary.
- `bash -c 'cd packages/security-audit-sdk-core && node --test tests/verification/f08-mutations.test.mjs tests/verification/f10-mutations.test.mjs tests/verification/f11-mutations.test.mjs'`: `ℹ tests 21`, `ℹ pass 21`, `ℹ fail 0`.
- `node openspec/scripts/check-design-pattern-governance.mjs --phase final --base origin/main`: `design-pattern governance passed in final phase: enforcement active; inspected 4 commit(s) and 17 path(s) from origin/main`.
- `node packages/security-audit-sdk-core/scripts/check-git-state.mjs`: `Git whitespace/final-newline checks passed and index is empty`.
- `make test`: Core 390, Node 162, browser 71, collector 92, contract 17, envelope 18 and research 11 tests passed. `Product test loop passed across every declared workspace (~45s local, 2026-09-10).` Its notice explicitly says full governance-gate chains were NOT run; no complete Core validate or make governance-gates claim is made.
- CodeScene CLI 1.0.53 delta, the same gate CI's `codescene delta` job runs: `no findings`, `cs delta exit=0`.

### Pre-evidence closure (5.2)

Build/typecheck, strict validation, final governance, Git-state and `git diff --check` reran successfully after the full sequence. Strict validation printed `Change 'fix-core-provider-fault-containment' is valid`; final governance inspected four commits and 17 paths, and Git-state again reported an empty index.

External structural audit, exit 0: `ownership/subjects/path-groups/Refs/co-author/whitespace/index passed: 4 commits, 17 exact paths; default runtime body unchanged`. This checked the four executed exact subjects and their exclusive path groups, standalone Refs #811 and co-author footers, exact assessment ownership equality with the complete diff, LF/final newlines/no trailing whitespace, empty index and unchanged default-runtime implementation. Only this tasks file and assessment.json are updated for the fifth evidence commit. Committed-head checks will be executed and reported externally, not retroactively recorded as pre-commit evidence.

## Observed review follow-up closure — 2026-10-14, run #130, Node v26.11.1

The preceding observations are historical run #127 evidence. This section is fresh executed evidence for the inherited run #128 follow-up and the two run #130 corrections. Decisions remain exactly as cited above; no decisions were reopened. No source, verification test, checker, suppression or generated artifact was changed in run #130. The baseline is the supplied upstream `dd7ffe70ce519a2bd0e3e7b098878e46052c9107`, with its nine commits above `6ee6f57037466ac80fd0b9b181f6e881cde62520` retained. The provisioned branch has no upstream; no pull or baseline move occurred.

### Corrective work and focused evidence (6.1–6.5, 6.7)

- Audited the inherited R-Q9 typed code/category guards, `unrefResult`, the arming/normal terminal assignments, `invalidContextProvider()` and exact F11 rationale. Reviewed the inherited R-D documentation/provenance changes. These are inherited repairs, not new runtime work. Current matrix/sanitizer controls, typecheck and complete mutation verification below validate them.
- Grepped all Node kit docs and README for backticked call-shaped references, then checked the installed-package document-references gate. Only `packages/security-audit-sdk-node/docs/error-catalog.md` needed changing: the schema failure is "rebuilt as a bounded SDK error carrying only its code, category and a bounded path". Allowed verdict codes/categories, string-only bounded path, dropped extra fields, `/schemaRuntime` fallback, default results and runtime selection remain unchanged. No ownership additions were necessary.
- `npm run test:kit --prefix packages/security-audit-sdk-node`: exit 0 before the kit-doc commit. Observed excerpts: `evaluation kit verification passed:`; `every callee and identifier-shaped inline code span in the kit documents resolved against installed package type declarations, except 33 reviewed exceptions`.
- `npm run build --prefix packages/security-audit-sdk-core` and `npm run typecheck --prefix packages/security-audit-sdk-core`: both exit 0 before the test commit; `generated SDK contract artifacts written` and `tsc -p tsconfig.json --noEmit`. Tracked generated artifacts remained unchanged. The supplied build chain for Core, Node, browser and collector also exited 0.
- From Core, `./node_modules/.bin/tsc -p tsconfig.test.json && node --test dist-tests/provider-fault-containment.test.js`: before parameterization, exit 0 with `ℹ tests 69`, `ℹ pass 69`, `ℹ fail 0`; after parameterization, exit 0 with `ℹ tests 71`, `ℹ pass 71`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 0`. All six former precedence/fallback cases still run individually. The only count increase is two new exact-count guard tests.
- Exact row totals: fault matrix 33, unique 33; sanitizer 8; precedence 4, unique 4 (`clearTimeout`/`unref` × sink failure/stalled-emission timeout); named correlation fallback 2, unique 2 (supplied correlation/operation handle); timestamp 3, legacy 3, valid timer handle 3. Tables are module-scoped. Precedence retains exact errors, no throw/rejection/sentinel, terminal/repeated shutdown, spies, lifecycle counts and pending-emission release/await. Correlation retains supplied IDs, nontransactional handle construction, zero unused-provider calls and exactly one emission. All other controls are unchanged.
- CodeScene CLI 1.0.53 delta, the same gate CI's `codescene delta` job runs: exit 0 before the test commit; `no findings`, `cs delta exit=0`.
- External exact-anchor audit on the unchanged inherited source: every F07/F08/F10/F11 mutation anchor occurs once, including both uses of the shared redelivery anchor and F10 guard variants. Observed: `all exact anchors occur once: 25 mutation rows, 23 unique file/anchor pairs`. Each of the 25 row counts was 1; full mutant execution below proves unchanged kills.

### Complete supplied TEST_CMD (6.6)

Executed verbatim through the supplied test wrapper, not cached, from `2026-10-14T05:12:37Z` to `2026-10-14T05:33:41Z`, exit 0. It ran on the clean two-correction-commit **pre-evidence tree**, Git tree content hash `4e4f97c602e462284cab6f2930cdc07eb28fd1db`. This content hash identifies the tested tree without pinning a transient story commit. These full-chain results do not claim to validate the subsequent evidence edits or future evidence commit. All eight conjuncts executed and exited 0:

1. `npm run check:generated --prefix packages/security-audit-sdk-core`: `generated SDK contract artifacts are current`.
2. `npm run test:changed-paths --prefix packages/security-audit-sdk-core`: `changed-path policy passed in archived mode for remediate-security-audit-sdk-adversarial-review: 1508 visible records; {"unrelated-history-or-worktree":1294,"local-instruction-unrelated":1,"event-contract":85,"archived-remediation":8,"active-remediation":6,"sdk-capability":1,"sdk-package":115,"unrelated-deletion":1}; ignored files excluded by standard Git semantics`.
3. `openspec validate fix-core-provider-fault-containment --strict`: `Change 'fix-core-provider-fault-containment' is valid`.
4. `node openspec/scripts/check-design-pattern-governance.mjs --phase final --base origin/main`: `design-pattern governance passed in final phase: enforcement active; inspected 11 commit(s) and 17 path(s) from origin/main`.
5. `node packages/security-audit-sdk-core/scripts/check-git-state.mjs`: `Git whitespace/final-newline checks passed and index is empty`.
6. `make test`: `Product test loop passed across every declared workspace (~45s local, 2026-09-10).` Core 409, Node 162, browser 71, collector 92, contract 17, envelope 18 and research 11 tests passed, each with zero failures. This product-loop banner is historical measurement wording, not this run's elapsed time.
7. `make governance-gates`: `Full governance-gate chains passed across every declared workspace (~13-20min local, 2026-09-10).` Core `test:verification`: `ℹ tests 301`, `ℹ pass 301`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 0`, `ℹ todo 0`. Node `test:kit`: `evaluation kit verification passed:` with the installed-declaration excerpt above. Node `test:kit-controls`: `evaluation kit negative controls passed: 89 measured plants across 80 of 80 controls, and each failed closed at its declared identity:`. Both Node gates passed in the product loop and again in the full governance chain; intentional plant diagnostics were not ignored or bypassed. The full-chain banner is historical measurement wording, not this run's elapsed time.
8. CodeScene CLI 1.0.53 delta, the same gate CI's `codescene delta` job runs: `no findings`, `cs delta exit=0`.

### Evidence-edit closure checks

After the evidence edits, the following rechecks completed by `2026-10-14T05:38:36Z`, each exit 0, with the index empty: `check:generated`, `test:changed-paths`, strict OpenSpec, final design-pattern governance, Git-state and `git diff --check`. Observed summaries remained `generated SDK contract artifacts are current`, `Change 'fix-core-provider-fault-containment' is valid`, `design-pattern governance passed in final phase: enforcement active; inspected 11 commit(s) and 17 path(s) from origin/main` and `Git whitespace/final-newline checks passed and index is empty`; changed-paths repeated the exact summary above.

External structural audit, exit 0: `pre-evidence commit audit passed: nine inherited commits unchanged; two appended subjects/path groups/Refs/co-author verified; four permitted corrective paths; 17 owned paths; 6.7 mapped; merge/fold/archive unchecked; LF/whitespace/final-newlines/empty index passed`. This audits the two existing corrective commits and pending two-file evidence diff, not a future third commit. No source, generated, verification-test or governance-core paths changed in this run.

Merge, fold and archive remain unchecked. No push, PR, GitHub comment, approval or remote-CI claim is made. Post-commit checks belong only in the external completion report.

## Observed review polish — 2026-10-14, run #132, Node v26.11.1 (6.8)

The preceding observations remain historical, including the original eleven-command chain's omission of `make governance-gates`. This run preserves the twelve inherited commits above the supplied main baseline without moving, rewriting or pulling the baseline. The original and follow-up decision-source lines above remain verbatim; no decision is reopened. Logs, audit scripts and transports remain external. The only source edit is one deleted comment; no runtime behavior changes.

### Six findings and focused checks

1. Deleted only the redundant F11 paraphrase comment in `src/events.ts`, placing the restored verbatim two-line rationale directly above `readEventId`. The eventId allocation statement and every other source byte are unchanged.
2. Replaced the remaining agent-tool reference in assessment evidence with the historical eleven-command TEST_CMD's repository-relative commands and CodeScene gate name. Historical provenance and the omitted full governance gate remain explicit; tasks and assessment contain no agent-tool command references.
3. Marked the broad schema code/category sentence superseded in place by the review follow-up verdict-only rule, retaining original decisions; the verification plan now states the explicit 33-row matrix, including eight configured/global bad-return rows.
4. The `emit/schema/invalidCategory` row now returns `SDK_SCHEMA_VALIDATION_FAILED` with category `nonsense`, isolating category rejection while retaining its name and `SDK_INVALID_CONFIGURATION` / `configuration` / `/schemaRuntime` expectation.
5. Removed only the precedence loop's always-zero `sink.calls.shutdown` assertion. Retained `shutdown.mock.callCount() === (stalled ? 0 : 1)` and every other assertion's meaning.
6. API, migration, ADR-015 and delta spec now describe failures as "rebuilt as a bounded SDK error carrying only its code, category and a bounded path", without the internal helper name. Removed the redundant API fallback sentence and the Node catalog's list-splitting blank line. ADR-015 states the rule without the change-local label and keeps the follow-up source verbatim. Requirement/scenario names and ADDED-only structure are unchanged. Plain prose for the result-rules heading was tried: strict OpenSpec exited 1 with `Requirement text is very long (>500 characters). Move examples and edge cases into scenarios, or split it into separate requirements that each state one behavior.` Restoring the heading, as permitted by the task's strict-validation exception, made validation exit 0; no gate was bypassed.

Before the test commit, Core build and typecheck both exited 0: `generated SDK contract artifacts written`; `tsc -p tsconfig.json --noEmit`. From Core, `./node_modules/.bin/tsc -p tsconfig.test.json && node --test dist-tests/provider-fault-containment.test.js` exited 0: `ℹ tests 71`, `ℹ pass 71`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 0`, `ℹ todo 0`. No cases were added or removed. Passing exact-count guards establish fault matrix 33/unique 33, sanitizer 8, precedence 4/unique 4 and correlation 2/unique 2. All four precedence cases retain terminal/repeated shutdown and meaningful mock counts.

Before the documentation commit, strict OpenSpec exited 0: `Change 'fix-core-provider-fault-containment' is valid`. `npm run test:kit --prefix packages/security-audit-sdk-node` exited 0: `evaluation kit verification passed:`; `every callee and identifier-shaped inline code span in the kit documents resolved against installed package type declarations, except 33 reviewed exceptions`. The supplied Core, Node, browser and collector build chain also exited 0; tracked generated artifacts remained unchanged.

### Full supplied TEST_CMD — pre-evidence observations

Executed verbatim through the supplied TEST_CMD, not cached, from `2026-10-14T08:03:38Z` to `2026-10-14T08:23:59Z`, exit 0. All eight commands ran in order on the clean two-polish-commit pre-evidence tree, Git tree content hash `9e659f0b7c06aa9573864f12727aeef9036e4da0`, with an empty index. Each conjunct's exit status is 0 (the complete conjunctive chain returned `TEST_CMD exit=0`). These results precede the evidence edits, not a claim about the future evidence commit:

1. `npm run check:generated --prefix packages/security-audit-sdk-core`: exit 0; `generated SDK contract artifacts are current`.
2. `npm run test:changed-paths --prefix packages/security-audit-sdk-core`: exit 0; `changed-path policy passed in archived mode for remediate-security-audit-sdk-adversarial-review: 1508 visible records; {"unrelated-history-or-worktree":1294,"local-instruction-unrelated":1,"event-contract":85,"archived-remediation":8,"active-remediation":6,"sdk-capability":1,"sdk-package":115,"unrelated-deletion":1}; ignored files excluded by standard Git semantics`.
3. `openspec validate fix-core-provider-fault-containment --strict`: exit 0; `Change 'fix-core-provider-fault-containment' is valid`.
4. `node openspec/scripts/check-design-pattern-governance.mjs --phase final --base origin/main`: exit 0; `design-pattern governance passed in final phase: enforcement active; inspected 14 commit(s) and 17 path(s) from origin/main`.
5. `node packages/security-audit-sdk-core/scripts/check-git-state.mjs`: exit 0; `Git whitespace/final-newline checks passed and index is empty`.
6. `make test`: exit 0; `Product test loop passed across every declared workspace (~45s local, 2026-09-10).` Core 409, Node 162, browser 71, collector 92, contract 17, envelope 18 and research 11 tests passed, each with zero failures. The banner's measurement is historical, not this run's elapsed time.
7. `make governance-gates`: exit 0; `Full governance-gate chains passed across every declared workspace (~13-20min local, 2026-09-10).` Core `test:verification` ran unchanged and completely: `ℹ tests 301`, `ℹ pass 301`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 0`, `ℹ todo 0`. Node kit verification and negative controls passed in both chains; `evaluation kit negative controls passed: 89 measured plants across 80 of 80 controls, and each failed closed at its declared identity:`. Intentional plant diagnostics were checked, not bypassed. The banner's measurement is historical, not this run's elapsed time.
8. CodeScene CLI 1.0.53 delta, the same gate CI's `codescene delta` job runs: exit 0; `no findings`, `cs delta exit=0`. No suppression or reconfiguration.

### Evidence-edit closure observations

After the evidence edits, by `2026-10-14T08:29:12Z`, `check:generated`, `test:changed-paths`, strict OpenSpec, final design-pattern governance against `origin/main`, Git-state and `git diff --check` each exited 0 with an empty index. Observed summaries: `generated SDK contract artifacts are current`; changed-paths repeated the exact 1508-record summary above; `Change 'fix-core-provider-fault-containment' is valid`; `design-pattern governance passed in final phase: enforcement active; inspected 14 commit(s) and 17 path(s) from origin/main`; `Git whitespace/final-newline checks passed and index is empty`.

External structural audit, exit 0: `pre-evidence audit passed: twelve inherited commits unchanged; 2 appended subjects/path groups/Refs/co-author verified; ten explicitly listed polish paths; 17 owned paths unchanged in order; 6.8 mapped; merge/fold/archive unchecked; exact test delta; sole source delta is one comment deletion; requirement/scenario names unchanged; LF/whitespace/final-newlines/empty index passed`. The ten files are precisely the explicitly prescribed test, six documentation/comment and three evidence files. This audit covers the two existing commits and pending three-file evidence diff, not a future third commit. These closure observations are separate from the full-gate pre-evidence results above.

Merge, fold and archive remain unchecked. No push, PR, GitHub comment, approval or remote-CI claim is made. Post-commit checks belong only in the external completion report.

## Observed fold evidence — 2026-10-15, run #137, Node v26.11.1

Decision source: owner request, 2026-10-14, in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E: "Fold and archive #811, #798 and #812, each as its own PR."

This is the dedicated active-change fold candidate under ADR 0001, not an archive or a claim that this fold has merged. Initial HEAD was exactly `0936e745744c3a2d2b5204b98a7e2d9d7977b1a6`, with a clean worktree and the supplied branch; no pull, rebase or baseline move occurred. The implementation merge evidence in 7.1 claims only the maintainer's merge of PR #818, not independent review or approval. Earlier evidence and unchecked lifecycle statements remain historical; 7.3 is still unchecked. No remote action, additional approval, signing or release is claimed.

### Full supplied TEST_CMD — before fold evidence edits

The supplied wrapper command executed unchanged from `2026-10-15T00:36:55Z` to `2026-10-15T00:44:48Z`, exit 0, against the uncommitted canonical append and two group-7 task edits, before this section existed, with an empty index. The documented `TAMANDUA_TSTX=0` environment setting enabled full passthrough because these required precommit edits are tracked-dirty: all ten conjuncts ran, without caching or ledger attribution. The observed wrapper notice was `tamandua-test: passthrough mode — TAMANDUA_TSTX=0 kill switch active`. These are pre-evidence observations, not results for this future commit.

Every command ran in this order and exited 0 (the complete conjunctive chain returned `TEST_CMD exit=0`):

1. Generated artifacts — `npm run check:generated --prefix packages/security-audit-sdk-core`: `generated SDK contract artifacts are current`.
2. Core matrix — `npm run test:matrix --prefix packages/security-audit-sdk-core`: 674 tests, 674 pass, zero failures; generate/drift, typecheck, build, type tests, 15 compilable documentation scenarios, exports, compatibility, scope and dependencies passed. Frozen surface: 61 value exports and 92 type-only exports.
3. Coherence — `npm run test:coherence --prefix packages/security-audit-sdk-core`: `cross-artifact coherence passed in archived mode for remediate-security-audit-sdk-adversarial-review: contract 2.1.0, 24 catalog events/24 named APIs, 0 runtime dependencies, 91/91 current-change tasks complete`. Archived mode names the historical remediation, not archival of this active change; founding requirements remain preserved.
4. Changed paths — `npm run test:changed-paths --prefix packages/security-audit-sdk-core`: `changed-path policy passed in archived mode for remediate-security-audit-sdk-adversarial-review: 1529 visible records; {"unrelated-history-or-worktree":1313,"local-instruction-unrelated":1,"event-contract":85,"archived-remediation":8,"active-remediation":6,"sdk-capability":1,"sdk-package":117,"unrelated-deletion":1}; ignored files excluded by standard Git semantics`.
5. Contract — `npm run validate --prefix contracts/security-audit`: `Security audit contract validation passed.` Deterministic generated artifacts and 17/17 tests passed, zero failures.
6. Active change — `openspec validate fix-core-provider-fault-containment --strict`: `Change 'fix-core-provider-fault-containment' is valid`.
7. Canonical spec — `openspec validate security-audit-sdk-core --type spec`: `Specification 'security-audit-sdk-core' is valid`; zero ERROR-level issues, exactly 41 WARNINGs, all `Requirement text is very long (>500 characters)`. Separate baseline and post-fold JSON inspections (`openspec validate security-audit-sdk-core --type spec --json`, each exit 0) show identical ordered issue identities (level, requirement path and full message), with no new warnings or errors. Non-strict canonical validation is intentional; no normative text was rewritten to silence warnings.
8. Final governance — `node openspec/scripts/check-design-pattern-governance.mjs --phase final --base 0936e745744c3a2d2b5204b98a7e2d9d7977b1a6`: `design-pattern governance passed in final phase: enforcement active; inspected 0 commit(s) and 0 path(s) from 0936e745744c`. This precommit invocation does not claim inspection of the uncommitted two-file fold; the committed-head range will be checked and reported externally.
9. Git state — `node packages/security-audit-sdk-core/scripts/check-git-state.mjs`: `Git whitespace/final-newline checks passed and index is empty`.
10. Product loop — `make test`: all declared workspaces passed; Core 674, Node 162, browser 71, collector 92, contract 17, envelope 18 and research 11 tests passed, zero failures. Node kit verification and negative controls passed: 90 measured plants across 81/81 controls, each failed closed at its declared identity. Intentional plant failures ended in the passing negative-control summary. The product-loop banner's timing is a historical measurement, not this run's duration. Full governance-gate chains were NOT run; this is not a `make governance-gates` claim.

The separately supplied `npm run build --prefix packages/security-audit-sdk-core` also exited 0 before the full TEST_CMD; generated tracked artifacts remained unchanged. Typecheck passed within both Core matrix executions.

External structural assertion tests before this evidence section, exit 0: raw appended block equals the active delta from its `### Requirement:` line through EOF byte for byte; the entire baseline canonical file is an unchanged byte prefix followed only by a blank separator and that block; the requirement and each of its ten scenario headings occur exactly once; no ADDED/MODIFIED/REMOVED/RENAMED operation header enters the canonical file; a second in-memory fold makes no change; all 19 founding requirement blocks are byte-preserved. The canonical diff is +64/-0 and changes no other canonical spec. Exactly the two allowed paths differ; assessment/proposal/design/delta bytes remain unchanged. The tasks prefix has only the two specified group-7 line edits, all historical evidence is preserved, and archive task 7.3 remains exactly unchecked. LF, final newlines, no trailing whitespace and the empty index passed; `git diff --check` exited 0. Assertion scripts and logs are external, not committed repository tests.

### Initial evidence-edit closure — before the sole commit

After the full-gate evidence above was added, the following closure checks completed by `2026-10-15T00:46:24Z`, each exit 0 with the index empty:

- `npm run check:generated --prefix packages/security-audit-sdk-core`: generated SDK contract artifacts are current.
- `npm run test:changed-paths --prefix packages/security-audit-sdk-core`: the same 1529-record policy summary reported above.
- `openspec validate fix-core-provider-fault-containment --strict`: active change valid.
- `openspec validate security-audit-sdk-core --type spec --json`: valid; external JSON assertions confirmed zero errors and the identical 41 baseline warnings.
- `node openspec/scripts/check-design-pattern-governance.mjs --phase final --base 0936e745744c3a2d2b5204b98a7e2d9d7977b1a6`: enforcement active, inspected 0 commits and 0 paths at the unchanged baseline HEAD; committed-range inspection is not claimed yet.
- `node packages/security-audit-sdk-core/scripts/check-git-state.mjs`: Git whitespace/final-newline checks passed and index is empty.
- `git diff --check` and the external structural assertion suite: passed, including the exact tasks prefix plus appended evidence and unchanged active-change artifacts.

An initial external JSON-audit script invocation failed because its temporary filename shadowed Python's standard `warnings` module. Only the external script was renamed; the complete closure sequence then reran and passed. No repository gate or normative text was altered. These closure observations precede this closure paragraph, not results for a future commit. Final pre-staging checks after this paragraph and committed-head governance/Git-state/whitespace results will be reported externally; this file will not be amended to record postcommit results.
