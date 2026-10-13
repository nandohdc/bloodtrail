# Tasks — issue #796

Issue: https://github.com/nandohdc/bloodtrail/issues/796

Only check tasks after their evidence is executed. Preserve the original assessment and its
planning-only commit before all governed implementation commits. No protected-path edits,
canonical spec folding, archival, release, or signing are included.

## 1. Prospective assessment (US-001)

- [x] 1.1 Author the six OpenSpec artifacts plus planning-only assessment.test.mjs; run its positive and negative relation controls and verify the actual pre-proposal baseline and exact owned paths.
- [x] 1.2 Run assessment governance and strict OpenSpec validation; record exact results before committing only this change's planning artifacts.
- [x] 1.3 Run Core typecheck/build and the supplied root product-loop command; run empty-index Git checks and verify no governance_core or contracts/security-audit/ changes against the baseline.

## 2. Cryptographic defaults and provider boundary (US-002)

- [x] 2.1 Remove static seed and Mulberry32; lazily delegate all seven methods to host crypto.randomUUID with correct receiver. Fail closed on implicit/explicit system defaults only; preserve custom-provider identity, receiver and host independence without construction-time invocation.
- [x] 2.2 Add tests/cross-process-identifiers.test.ts method/receiver/v4 controls, public constructor matrix for absent crypto, missing randomUUID and non-function randomUUID with both default modes, and deterministic custom initialization/use with no crypto and no sink emission on failure. Run Core runtime, typecheck/build and exports gates.
- [x] 2.3 Add a providers-only crypto coupling role without widening LANGUAGE_GLOBALS, authored globals or globalThis. Wire inventory/reporting, recalculate BASELINE_INVENTORY, and extend platform-coupling mutations with local positive and other-artifact/node:crypto negative controls. Run test:scope, coupling mutations and test:dependencies.

## 3. Fresh-process empirical regression (US-003)

- [x] 3.1 Extend tests/cross-process-identifiers.test.ts with at least four concurrent fresh process.execPath children using Core defaults, at least 128 event and 128 operation IDs per child, exact counts, lowercase v4 version/variant, normal exits and zero collisions over the full union. Bound deadlines/stderr, terminate overdue children and clean timers/listeners on every outcome.
- [x] 3.2 Run three consecutive focused regressions after build/test compilation, plus the full Core runtime suite and typecheck. Restore the old fixed-seed generator only in a disposable copy and prove the cross-process uniqueness assertion fails; discard all temporary artifacts.

## 4. Documentation, coherence and closure (US-004)

- [x] 4.1 Add ADR-SDK-013 accepted for SDK-core implementation; update both coherence count and sequence (001..013). Update API.md for all seven cryptographic UUID v4 defaults, host requirements, fail-closed /identifiers error, custom exemption and probabilistic collision resistance versus bounded reuse detection. Run test:coherence.
- [x] 4.2 Run full Core validate, the supplied root product loop, final design-pattern-governance and strict OpenSpec validation; record exact executed results and close invariant/evidence mappings without fabricating review or authorization.
- [x] 4.3 Run empty-index check-git-state and git diff --check before staging. Inspect diff against proposal baseline for protected paths, generated source and frozen exports; confirm package.json runtime dependencies remain empty. Preserve the separate assessment-before-implementation history.

## 5. Prospective code-health follow-up (#796)

These follow-up tasks are recorded before refactoring; prior executed evidence below remains
historical evidence, not verification of this remediation run. The full security-sensitive
assessment and proposal baseline `5d931ad695fb10db3fe51e6b151352447e21d822` remain unchanged.

- [x] 5.1 Extract candidate, alternative-rejection, ownership, invariant/task and scenario assertions into five module-level helpers; retain every planning control and add table-driven negative mutations for each group. Run the planning regression, assessment governance, strict OpenSpec validation and Core typecheck/build.
- [ ] 5.2 Extract the private cryptographic UUID capability predicate and add null-host default-construction controls; preserve fail-closed/custom-provider behavior and the exact provider-local coupling inventory. Run runtime, coupling, scope, exports, dependencies and typecheck controls.
- [ ] 5.3 Extract child-result validation and the child program from the concurrent uniqueness test; preserve bounded concurrent sampling, reaping and the complete collision union. Add synthetic validation controls, run three focused repetitions and prove the collision negative control in a disposable external copy.
- [ ] 5.4 Reword inherited work-item-prefixed commit subjects without changing trees or ordering; validate every actual subject and the intended PR title with the unmodified Conventional Commits checker, and run its regression suite.
- [ ] 5.5 Run `npm run test:matrix --prefix packages/security-audit-sdk-core`, `npm run check:generated --prefix packages/security-audit-sdk-core`, `npm run test:coherence --prefix packages/security-audit-sdk-core`, `npm run validate --prefix packages/security-audit-sdk-core`, the current run's exact `tamandua-test` wrapper for `make test`, `node openspec/scripts/check-design-pattern-governance.mjs --phase final`, strict OpenSpec validation, empty-index `node packages/security-audit-sdk-core/scripts/check-git-state.mjs` and `git diff --check`; record exact results and measured source-structure targets without claiming an unexecuted CodeScene result.

## Verification Commands

- Planning regression: `node --test openspec/changes/fix-core-default-identifiers-uniqueness/assessment.test.mjs`
- Assessment: `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change fix-core-default-identifiers-uniqueness`
- OpenSpec: `npx --yes @fission-ai/openspec@latest validate fix-core-default-identifiers-uniqueness --strict`
- Typecheck: `npm run typecheck --prefix packages/security-audit-sdk-core`
- Build: `npm run build --prefix packages/security-audit-sdk-core`
- Root product loop (exact workflow command): `tamandua-test --repo '/Users/fernando.costa/.tamandua/worktrees/bloodtrail-5311402e/117-0d4a705f' --run '0d4a705f-c56f-4bd8-8923-a5feee1e74ad' --step 'implement' -- 'make test'`
- Runtime: `npm test --prefix packages/security-audit-sdk-core`
- Coupling mutations: from Core workspace, `node --test tests/verification/platform-coupling-mutations.test.mjs`
- Scope/exports/dependencies/coherence: the corresponding Core `npm run test:scope`, `test:exports`, `test:dependencies`, `test:coherence` scripts, using `--prefix packages/security-audit-sdk-core`
- Full Core chain: `npm run validate --prefix packages/security-audit-sdk-core`
- Final governance: `node openspec/scripts/check-design-pattern-governance.mjs --phase final`
- Git: `node packages/security-audit-sdk-core/scripts/check-git-state.mjs` and `git diff --check`, with empty index before staging

## Executed Evidence

### US-001 — 2026-10-13, Node v26.11.1

- `node --test openspec/changes/fix-core-default-identifiers-uniqueness/assessment.test.mjs`: exit 0, 3 tests passed, including negative controls for classification, ownership, baseline, evidence, tasks and scenarios.
- `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change fix-core-default-identifiers-uniqueness`: exit 0, enforcement active.
- `npx --yes @fission-ai/openspec@latest validate fix-core-default-identifiers-uniqueness --strict`: exit 0, change valid. An initial long-requirement warning was corrected before the passing run.
- `npm run typecheck --prefix packages/security-audit-sdk-core`: exit 0.
- `npm run build --prefix packages/security-audit-sdk-core`: exit 0; generation left tracked generated source unchanged.
- Exact root product-loop command listed above: exit 0 (executed, not cached). Core 166/166, Node 162/162, browser 71/71, collector 92/92, contract 17/17, envelope 18/18, research 11/11 passed; workspace gates also passed. Expected failing kit mutation controls did not fail the suite.
- `node packages/security-audit-sdk-core/scripts/check-git-state.mjs`: exit 0, whitespace/final-newline checks passed and index empty before staging.
- `git diff --check`: exit 0. Baseline is the actual pre-proposal HEAD after fetching/rebasing origin/main; working tree contains only this change's planning artifacts, with no SDK, governance_core, frozen contract or generated-source edits.
- Pre-implementation `node openspec/scripts/check-design-pattern-governance.mjs --phase final`: exit 0, enforcement active, 0 commits and 0 paths inspected before the planning commit. This is not evidence for the future implementation.

### US-002 and US-003 — executed earlier in this run, 2026-10-13, Node v26.11.1

The following results are preserved from the completed stories' progress records, not claimed as
new executions by US-004. The current full Core chain below independently rechecks their runtime
and coupling controls.

- US-002: `npm run typecheck --prefix packages/security-audit-sdk-core` and `npm run build --prefix packages/security-audit-sdk-core`: exit 0. `npm test --prefix packages/security-audit-sdk-core`: exit 0, 177/177 tests. From Core, `node --test tests/verification/platform-coupling-mutations.test.mjs`: exit 0, 23/23 tests. `npm run test:scope --prefix packages/security-audit-sdk-core`, `npm run test:exports --prefix packages/security-audit-sdk-core` and `npm run test:dependencies --prefix packages/security-audit-sdk-core`: exit 0. Scope inventory matches BASELINE_INVENTORY; frozen exports 61 values/92 types; runtime dependencies 0.
- US-003: `npm run typecheck --prefix packages/security-audit-sdk-core` and `npm run build --prefix packages/security-audit-sdk-core`: exit 0. From Core, `npx tsc -p tsconfig.test.json`, then three consecutive `node --test dist-tests/cross-process-identifiers.test.js` executions: exit 0, 14/14 each. `npm test --prefix packages/security-audit-sdk-core`: exit 0, 180/180 tests.
- US-003 old-seed negative control: built dist/dist-tests were copied outside the repository and only copied dist/providers.js was replaced with the original fixed-seed/Mulberry32 generator from stable upstream baseline `5d931ad695fb10db3fe51e6b151352447e21d822`. From that disposable Core copy, `node --test --test-name-pattern='default SDK event and operation identifiers are unique' dist-tests/cross-process-identifiers.test.js` failed at the intended collision assertion: 256 unique IDs versus 1024 required, after all four children exited successfully. The disposable directory was removed in finally; no mutation remains.
- Both stories executed the exact root product-loop wrapper listed above after their clean commits: exit 0, not cached. Their final governance and empty-index Git checks passed. The initial US-002 dirty-tree wrapper invocation was refused with exit 88 and supplied no test evidence.

### US-004 — executed 2026-10-13, Node v26.11.1

- `node --test openspec/changes/fix-core-default-identifiers-uniqueness/assessment.test.mjs`: exit 0, 5/5 tests. Includes new controls executing the actual ADR count/sequence rules against valid, missing, duplicate and extra inventories; checks API/accepted ADR guarantees and rejects missing fail-closed, explicit-default, custom-provider and probabilistic-uniqueness statements. Existing prospective assessment relation controls still pass.
- `npm run test:coherence --prefix packages/security-audit-sdk-core`: exit 0. Exactly 13 consecutive ADRs through ADR-SDK-013; archived remediation remains 91/91 tasks complete, contract 2.1.0 and 24 named APIs unchanged. This does not archive or fold the current issue's delta.
- `npm run typecheck --prefix packages/security-audit-sdk-core`: exit 0.
- `npm run build --prefix packages/security-audit-sdk-core`: exit 0; tracked generated source remained byte-identical.
- `npm run validate --prefix packages/security-audit-sdk-core`: exit 0, complete chain executed without interruption. Runtime 180/180; verification 301/301 across 5 suites, zero failed/skipped/cancelled tests. Type tests, 15 compilable documentation scenarios, generation drift, compatibility, contract immutability, publication exclusion, changed-path policy, governance history, archive attestations and final empty-index Git gate all passed. Frozen exports: 61 values/92 types; dependencies: 0 runtime; packed contents: 84 intentional files and 2 imported entry points. Provider-local crypto declaration and negative mutations passed; no other host exception was widened.
- Exact root command: `tamandua-test --repo '/Users/fernando.costa/.tamandua/worktrees/bloodtrail-5311402e/117-0d4a705f' --run '0d4a705f-c56f-4bd8-8923-a5feee1e74ad' --step 'implement' -- 'make test'`: exit 0, executed (not cached) after the documentation implementation commit. Core 180, Node 162, browser 71, collector 92, security-audit contract 17, client-evidence envelope 18 and research 11 tests passed, with every declared workspace's gates. Evaluation-kit deliberate failing plants ended in the passing negative-control summary; their printed failures are not suite failures. This is the product loop, not a claim that root `make governance-gates` ran.
- `node openspec/scripts/check-design-pattern-governance.mjs --phase final`: exit 0, enforcement active; inspected 5 commits and 15 owned paths from the preserved proposal baseline.
- `npx --yes @fission-ai/openspec@latest validate fix-core-default-identifiers-uniqueness --strict`: exit 0, change valid.
- `node packages/security-audit-sdk-core/scripts/check-git-state.mjs` and `git diff --check`: exit 0, run with an empty index before staging the documentation implementation, and again after product verification before this evidence update. Baseline diff inspection: no governance_core, contracts/, generated source, src/index.ts or package.json edits; package.json dependencies remain empty. Original assessment unchanged from its latest prospective ownership declaration; planning-only commits still precede all runtime implementation.

### Code-health follow-up — planning assertions, 2026-10-13, run 118

- Follow-up tasks 5.1–5.5 were recorded unchecked before refactoring. Only 5.1 is complete;
  provider extraction, child validation, inherited subject normalization and final verification
  remain prospective. Prior evidence above is preserved, not re-attributed to this run.
- `node --test openspec/changes/fix-core-default-identifiers-uniqueness/assessment.test.mjs`:
  exit 0, 55/55 tests. Five extracted groups retain the original assertions; table-driven controls
  reject unknown forces, invalid alternatives/rejection evidence, every missing required SDK
  path, out-of-scope ownership, missing invariant/task/evidence relations, all seven missing
  identifier methods and all eight missing required scenarios.
- `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change fix-core-default-identifiers-uniqueness`:
  exit 0, enforcement active.
- `npx --yes @fission-ai/openspec@latest validate fix-core-default-identifiers-uniqueness --strict`:
  exit 0, change valid.
- `npm run typecheck --prefix packages/security-audit-sdk-core` and
  `npm run build --prefix packages/security-audit-sdk-core`: exit 0; no tracked generated changes.
- TypeScript AST inspection of `assertPlanningContract` confirms five straight-line calls to
  module-level helpers, zero branch/loop/ternary/logical-condition nodes, cyclomatic complexity
  1 and zero nested conditional bumps. This is source-structure verification, not a CodeScene run.
- `node .github/scripts/check-conventional-commits.mjs --title 'refactor(openspec): simplify identifier planning assertions (#796)'`:
  exit 0. Inherited invalid subjects remain for task 5.4; this does not claim all-history compliance.
- Empty-index `node packages/security-audit-sdk-core/scripts/check-git-state.mjs` and
  `git diff --check`: exit 0 before staging. Diff contains only `assessment.test.mjs` and
  `tasks.md`; the full assessment, original proposal baseline, canonical specs, protected paths,
  generated source, exports and dependency manifests are unchanged.

### Completed invariant/evidence mapping

- `implementation-host-uuid-generation` (2.1, 2.2, 3.1, 3.2): all seven method/receiver/v4 controls and concurrent-process union regression pass in the 180-test runtime suite. Four fresh concurrent children sample 128 event and 128 operation IDs each, 1024 total, with zero collisions; old-seed disposable negative control fails precisely on collisions.
- `implementation-default-fail-closed` (2.1, 2.2): six implicit/explicit public-construction cases reject absent crypto, missing randomUUID and non-function randomUUID with SDK_INVALID_CONFIGURATION/configuration/identifiers diagnostics and no sink calls; construction generates no IDs.
- `implementation-custom-provider-independence` (2.1, 2.2): import and custom construction/use work with absent or unreadable host crypto; exact object identity and receiver preserved; no methods invoked during construction.
- `implementation-provider-local-coupling` (2.3): scope inventory and verification mutation controls accept crypto only in src/providers.ts and reject other-artifact crypto and node:crypto imports.
- `implementation-preserved-boundaries` (4.1, 4.2, 4.3): accepted ADR/API controls, count and sequence coherence, full Core chain, exact root loop, final governance, strict OpenSpec and empty-index baseline checks pass. Assessment ordering, frozen exports/contracts/generated artifacts and zero runtime dependencies remain intact.

All task checks above reflect executed evidence. No review approval, signing, package publication,
production authorization, canonical spec synchronization or archive completion is claimed by this
bounded implementation change.
