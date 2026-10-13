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

- [ ] 2.1 Remove static seed and Mulberry32; lazily delegate all seven methods to host crypto.randomUUID with correct receiver. Fail closed on implicit/explicit system defaults only; preserve custom-provider identity, receiver and host independence without construction-time invocation.
- [ ] 2.2 Add tests/cross-process-identifiers.test.ts method/receiver/v4 controls, public constructor matrix for absent crypto, missing randomUUID and non-function randomUUID with both default modes, and deterministic custom initialization/use with no crypto and no sink emission on failure. Run Core runtime, typecheck/build and exports gates.
- [ ] 2.3 Add a providers-only crypto coupling role without widening LANGUAGE_GLOBALS, authored globals or globalThis. Wire inventory/reporting, recalculate BASELINE_INVENTORY, and extend platform-coupling mutations with local positive and other-artifact/node:crypto negative controls. Run test:scope, coupling mutations and test:dependencies.

## 3. Fresh-process empirical regression (US-003)

- [ ] 3.1 Extend tests/cross-process-identifiers.test.ts with at least four concurrent fresh process.execPath children using Core defaults, at least 128 event and 128 operation IDs per child, exact counts, lowercase v4 version/variant, normal exits and zero collisions over the full union. Bound deadlines/stderr, terminate overdue children and clean timers/listeners on every outcome.
- [ ] 3.2 Run three consecutive focused regressions after build/test compilation, plus the full Core runtime suite and typecheck. Restore the old fixed-seed generator only in a disposable copy and prove the cross-process uniqueness assertion fails; discard all temporary artifacts.

## 4. Documentation, coherence and closure (US-004)

- [ ] 4.1 Add ADR-SDK-013 accepted for SDK-core implementation; update both coherence count and sequence (001..013). Update API.md for all seven cryptographic UUID v4 defaults, host requirements, fail-closed /identifiers error, custom exemption and probabilistic collision resistance versus bounded reuse detection. Run test:coherence.
- [ ] 4.2 Run full Core validate, the supplied root product loop, final design-pattern-governance and strict OpenSpec validation; record exact executed results and close invariant/evidence mappings without fabricating review or authorization.
- [ ] 4.3 Run empty-index check-git-state and git diff --check before staging. Inspect diff against proposal baseline for protected paths, generated source and frozen exports; confirm package.json runtime dependencies remain empty. Preserve the separate assessment-before-implementation history.

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

The planning-only commit establishes prospective ordering; preserve it before US-002. No runtime
remediation is implemented or claimed verified yet. Tasks 2.1 through 4.3 and their full Core
validation/cryptographic regression evidence remain pending.
