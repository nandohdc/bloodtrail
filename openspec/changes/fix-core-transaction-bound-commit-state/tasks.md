# Tasks — issue #797

Issue: https://github.com/nandohdc/bloodtrail/issues/797

Check tasks only after execution. Preserve planning-before-implementation ordering and the proposal baseline. No approval, production authorization or remote CI result is claimed.

## 1. Planning

- [x] 1.1 Author the six planning artifacts, owner provenance, ADDED-only requirement and full security assessment with exact owned paths.
- [x] 1.2 Run assessment governance and strict OpenSpec validation before committing only this change's planning artifacts.

## 2. Runtime

- [x] 2.1 Replace the handle-less fallback with unconditional bounded refusal, retaining not_applicable, direct/operation branches and F10/F11 anchors.

## 3. Tests

- [x] 3.1 Add catalog partition, 35-case non-success refusal matrix, delivery-class non-vacuity and handle-less success control with exact diagnostic and zero emissions.
- [x] 3.2 Pair all 35 inputs with sanctioned method-bound handles and replay every not_applicable fixture; run build, typecheck and focused tests.

## 4. Documentation

- [x] 4.1 Document API rule, migration, exact glossary and accepted ADR-SDK-014 refining unchanged ADR-SDK-007.
- [x] 4.2 Update only ADR count/sequence and Node PREMATURE_SUCCESS explanation.

## 5. Verification and evidence

- [x] 5.1 Execute the complete supplied TEST_CMD including CodeScene delta; record gate names, repository-relative commands and observed results in tasks and invariant evidence.
- [x] 5.2 Run strict OpenSpec, git diff --check and inspect the three executed ordered subjects/path boundary before the original fourth evidence commit; record only those pre-commit observations without invented mutation or approval claims.

## 6. Review follow-up (#797)

Decision source: owner decision, 2026-10-13, via code-review follow-up in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E

Append exactly five commits to the existing four-commit fix; preserve the proposal baseline and runtime. The owner selected R1–R4 only, not additional implementation or approval.

- [x] 6.1 R1: derive the final and extra ADR numbers in the single #796 assessment regression; run the complete assessment test file.
- [x] 6.2 R3: name helpers by operation evidence, type non-success rows and configure denied authorization in the transition table; preserve all 74 test assertions and run focused compilation/tests.
- [x] 6.3 R4: unify the unchanged glossary bullets, align ADR-014 headings/boundary and neutral independent-verification wording; use gate names and repository-relative evidence citations.
- [x] 6.4 R2 plus verification: correct pre-commit task 5.2 and observed-evidence labeling; run the full supplied TEST_CMD, build/typecheck and pre-evidence closure gates before ticking; report post-commit checks externally only.

## 7. Merge and archive

- [ ] 7.1 Merge through the separately authorized repository process (not performed in this run).
- [ ] 7.2 Fold and archive after separately authorized merge (not performed in this run).

## Executed evidence

### Review follow-up planning — 2026-10-13, Node v26.11.1

- Started from clean `e7b9ddbde2c0887ca7770685fae8b60175eae30f` on `fix/797-transaction-bound-review-follow-up-123`. The provisioned branch has no upstream; no pull, baseline move or history rewrite was performed.
- `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change fix-core-transaction-bound-commit-state`: exit 0, `design-pattern governance passed in assessment phase: enforcement active`.
- `openspec validate fix-core-transaction-bound-commit-state --strict`: exit 0, `Change 'fix-core-transaction-bound-commit-state' is valid`.
- Both planning gates executed before the planning-only follow-up commit. Tasks 6.1–6.4 remain unchecked pending execution; prior evidence below belongs to the original fix.

### Planning — 2026-10-13, Node v26.11.1

- `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change fix-core-transaction-bound-commit-state`: exit 0, `design-pattern governance passed in assessment phase: enforcement active`.
- `openspec validate fix-core-transaction-bound-commit-state --strict`: exit 0, `Change 'fix-core-transaction-bound-commit-state' is valid`.
- Initial strict validation exited 1 with the >500-character requirement warning. Shortened the same single requirement without losing its rule, then both commands above passed before the planning commit.
- Clean initial HEAD and fetched origin/main both equal `02ce833c4e02f83441d086ed47aed1306d4217cc`; the provisioned branch has no upstream, so no unrelated pull or baseline move was performed.

### Runtime and documentation — 2026-10-13

- `npm run build --prefix packages/security-audit-sdk-core`: exit 0. Generated tracked source remained unchanged.
- `npm run typecheck --prefix packages/security-audit-sdk-core`: exit 0.
- From Core, `./node_modules/.bin/tsc -p tsconfig.test.json && node --test dist-tests/transaction-bound-commit-state.test.js`: exit 0, `ℹ tests 74`, `ℹ pass 74`, `ℹ fail 0`, no skipped/cancelled tests. Includes 35 refusal cases, 35 sanctioned controls, partition, exact count/delivery-class assertions, success refusal and all nine not_applicable fixtures.
- Initial focused run: exit 1, 67/74 passed; seven paired controls lacked fixture outcome_reason. Retained that fixture field in the compact converter and reran compilation/tests to the passing result above. The controls ensure otherwise valid input, not merely an early refusal.
- CodeScene CLI 1.0.53 file review, `packages/security-audit-sdk-core/tests/transaction-bound-commit-state.test.ts`: exit 0, `file score 10.0`.
- `npm run test:coherence --prefix packages/security-audit-sdk-core`: exit 0, `cross-artifact coherence passed in archived mode for remediate-security-audit-sdk-adversarial-review: contract 2.1.0, 24 catalog events/24 named APIs, 0 runtime dependencies, 91/91 current-change tasks complete`. This is the existing archived remediation, not archival of this change. New ADR count/sequence is 001..014.
- Initial coherence failed its production-authorized phrase matcher on a negated migration sentence; changed the prose to "does not authorize release or production use", without changing the checker, and reran successfully.
- Runtime diff is only the resolver comment and fallback. Inspected F10/F11 events.ts anchors: privacy guard, ID allocation and named-redelivery validation/return blocks remain unchanged. No mutation test was added or old-fallback mutation performed in this story.

### Full supplied TEST_CMD — executed, not cached, 2026-10-13

Historical gate sequence, executed through the supplied tamandua-test wrapper in original run #122 (machine-local transport paths omitted):

```bash
npm run check:generated --prefix packages/security-audit-sdk-core
npm run test:matrix --prefix packages/security-audit-sdk-core
npm run test:coherence --prefix packages/security-audit-sdk-core
npm run validate --prefix contracts/security-audit
npm run validate --prefix packages/security-audit-sdk-node
node openspec/scripts/check-design-pattern-governance.mjs --phase final --base origin/main
node packages/security-audit-sdk-core/scripts/check-git-state.mjs
make test
```

Final gate: CodeScene CLI 1.0.53 delta, the same gate CI's `codescene delta` job runs.

Observed exit 0 on the clean runtime/test/docs tree, with the index empty. All nine conjuncts completed:

- `npm run check:generated --prefix packages/security-audit-sdk-core`: exit 0, `generated SDK contract artifacts are current`.
- `npm run test:matrix --prefix packages/security-audit-sdk-core`: exit 0, `ℹ tests 338`, `ℹ pass 338`, `ℹ fail 0`. Typecheck, build, type tests, 15 documentation examples, compatibility, scope and dependencies passed. `package exports verified: 61 value exports, 92 type-only exports, frozen surface matches exactly`.
- `npm run test:coherence --prefix packages/security-audit-sdk-core`: exit 0, the exact archived-mode coherence result recorded above.
- `npm run validate --prefix contracts/security-audit`: exit 0, `ℹ tests 17`, `ℹ pass 17`, `ℹ fail 0` and generated contract validation passed.
- `npm run validate --prefix packages/security-audit-sdk-node`: exit 0, `ℹ tests 162`, `ℹ pass 162`, `ℹ fail 0`; typecheck/build, scope, frozen exports, compatibility, dependencies, package, evaluation kit and deliberate failing-plant controls passed. `package exports verified: 19 value exports, 44 type-only exports, frozen surface matches exactly, no collision with core's frozen surface`.
- `node openspec/scripts/check-design-pattern-governance.mjs --phase final --base origin/main`: exit 0, `design-pattern governance passed in final phase: enforcement active; inspected 3 commit(s) and 14 path(s) from origin/main`.
- `node packages/security-audit-sdk-core/scripts/check-git-state.mjs`: exit 0, `Git whitespace/final-newline checks passed and index is empty`.
- `make test`: exit 0. Core 338, Node 162, browser 71, collector 92, contract 17, envelope 18 and research 11 tests passed, along with every declared workspace's product gates. `Product test loop passed across every declared workspace (~45s local, 2026-09-10).` The notice explicitly states full governance-gate chains were NOT run; this story does not claim full Core validate or make governance-gates.
- CodeScene CLI 1.0.53 delta, the same gate CI's `codescene delta` job runs: exit 0, exact output `no findings` followed by `cs delta exit=0`.

### Pre-evidence closure checks

- `openspec validate fix-core-transaction-bound-commit-state --strict`: exit 0, `Change 'fix-core-transaction-bound-commit-state' is valid`.
- `git diff --check`: exit 0.
- `node packages/security-audit-sdk-core/scripts/check-git-state.mjs`: exit 0, `Git whitespace/final-newline checks passed and index is empty`.
- `git log --reverse --format='%h %s%n%b' origin/main..HEAD` showed the three executed commits with exact required subjects, standalone `Refs #797` and final Tamandua co-author footers. The first changed only the new planning directory; the next two contain only their declared runtime/test and documentation files. The fourth commit is this tasks/assessment evidence update, not claimed as already inspected here.
- External Python inspection of git history, baseline path union, edited bytes and assessment dimensions printed: `Pre-evidence inspection passed: 3 exact subjects/Refs/co-author footers; exact 14-path union; LF/final-newline/whitespace; 15 bounded security justifications.` Protected paths and out-of-scope source are untouched.

Final committed-head governance/Git/history rechecks belong only in external completion reports after actual execution. No old-code sensitivity result, remote CI, approval, release, push, PR, merge, folding or archival is claimed.

### Review follow-up execution — run #123, 2026-10-13

The following observations belong to this follow-up, not the historical run #122 evidence above. Tasks 6.1–6.4 were checked only after their work and checks executed, before this fifth evidence commit.

- R1: `node --test openspec/changes/fix-core-default-identifiers-uniqueness/assessment.test.mjs`: exit 0, `ℹ tests 308`, `ℹ pass 308`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 0`. Only the sequential ADR coherence test changed; isolated real-rule evaluation and missing/duplicate/extra assertions remain.
- R3: from Core, `./node_modules/.bin/tsc -p tsconfig.test.json && node --test dist-tests/transaction-bound-commit-state.test.js`: exit 0, `ℹ tests 74`, `ℹ pass 74`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 0`. The matrix retains 15 transaction-bound events, 35 refusal/control pairs, both delivery classes, exact refusal diagnostic with zero sink events, exact paired commit states, success refusal, all nine not_applicable fixtures and partition assertions. Authorization/authentication/session fixture context remains branded; the renamed input lacks operation evidence only.
- CodeScene CLI 1.0.53 file review, `packages/security-audit-sdk-core/tests/transaction-bound-commit-state.test.ts`: exit 0, `file score 10.0`.
- R4: `npm run test:coherence --prefix packages/security-audit-sdk-core`: exit 0, `cross-artifact coherence passed in archived mode for remediate-security-audit-sdk-adversarial-review: contract 2.1.0, 24 catalog events/24 named APIs, 0 runtime dependencies, 91/91 current-change tasks complete`. The original glossary bullet bytes and ADR header/decision-source bytes were compared against the original fix; the list is uninterrupted and the ADR has the five requested headings and unchanged boundary.
- R2: task 5.2 now covers only original pre-fourth-commit inspection; design labels observed evidence. Historical commands retain their observations/timing but use relative commands and gate names. Independent-verification wording preserves Q9's no-committed-mutation decision.
- `npm run build --prefix packages/security-audit-sdk-core` and `npm run typecheck --prefix packages/security-audit-sdk-core`: both exit 0; generated tracked source unchanged.

#### Supplied TEST_CMD — clean four-commit follow-up tree, before evidence recording

The initial exact shim invocation refused uncommitted planning evidence edits with exit 88, `FAILURE_CLASS: tree_dirty`; no tests ran in that invocation. Those edits were preserved externally and temporarily reversed, without changing any committed file or bypassing the shim. The complete eleven-gate sequence executed on the clean four-commit follow-up tree, exit 0. The exact supplied run-id invocation then returned exit 0 and `TAMANDUA-TEST CACHED: tree be3963a2866e passed`; the cache reports that same complete command's prior exit 0 on this exact tree. No runtime, test or SDK documentation change was made after that tree was tested. Evidence-only planning edits were restored, and affected closure gates rerun before recording/ticking here.

Ordered gates and observed outputs:

- `npm run check:generated --prefix packages/security-audit-sdk-core`: exit 0, `generated SDK contract artifacts are current`.
- `npm run test:matrix --prefix packages/security-audit-sdk-core`: exit 0, `ℹ tests 338`, `ℹ pass 338`, `ℹ fail 0`; `package exports verified: 61 value exports, 92 type-only exports, frozen surface matches exactly`.
- `npm run test:coherence --prefix packages/security-audit-sdk-core`: exit 0, the verbatim archived-mode result above.
- `npm run validate --prefix contracts/security-audit`: exit 0, `ℹ tests 17`, `ℹ pass 17`, `ℹ fail 0`.
- `npm run validate --prefix packages/security-audit-sdk-node`: exit 0, `ℹ tests 162`, `ℹ pass 162`, `ℹ fail 0`; `package exports verified: 19 value exports, 44 type-only exports, frozen surface matches exactly, no collision with core's frozen surface`. Evaluation-kit verification and its deliberate failing-plant controls passed.
- `node --test openspec/changes/fix-core-default-identifiers-uniqueness/assessment.test.mjs`: exit 0, `ℹ tests 308`, `ℹ pass 308`, `ℹ fail 0`.
- `openspec validate fix-core-transaction-bound-commit-state --strict`: exit 0, `Change 'fix-core-transaction-bound-commit-state' is valid`.
- `node openspec/scripts/check-design-pattern-governance.mjs --phase final --base origin/main`: exit 0, `design-pattern governance passed in final phase: enforcement active; inspected 8 commit(s) and 15 path(s) from origin/main`.
- `node packages/security-audit-sdk-core/scripts/check-git-state.mjs`: exit 0, `Git whitespace/final-newline checks passed and index is empty`.
- `make test`: exit 0; Core 338, Node 162, browser 71, collector 92, contract 17, envelope 18 and research 11 tests passed; `Product test loop passed across every declared workspace (~45s local, 2026-09-10).` This follow-up did not execute or claim `make governance-gates`.
- CodeScene CLI 1.0.53 delta, the same gate CI's `codescene delta` job runs: exit 0, `no findings`, `cs delta exit=0`.

#### Pre-fifth-commit closure — planning evidence edits restored

- Strict OpenSpec, final governance against origin/main, empty-index Git state, coherence and CodeScene delta reran with exit 0 and the same verbatim outputs above. `git diff --check`: exit 0.
- External inspection printed: `Pre-evidence inspection passed: 4 exact subjects/Refs/co-author footers and per-commit boundaries; original ownership/baseline retained; unchanged glossary/header bytes; sequential ADR headings; R1-only test boundary; portable citations.`
- Only the four executed follow-up commits were inspected here. This fifth commit and all committed-head rechecks remain external report obligations, not checked repository evidence. Merge/archive tasks 7.1/7.2 remain unchecked; no remote action, mutation sensitivity or additional approval is claimed.
