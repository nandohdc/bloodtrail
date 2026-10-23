# Tasks: align the SDK core with the catalog's tenant and failed-authentication rules (#861, #862)

Groups complete in order. Merge, fold and archive stay unchecked while the change is active.

## 1. Proposal

- [x] 1.1 Author the change artifacts: proposal, design, full assessment with exact ownership, tasks, and the
  ADDED `security-audit-sdk-core` delta.
- [x] 1.2 Run assessment-phase governance and strict OpenSpec validation before the proposal-only commit.

## 2. Claimed-tenant policy (#861)

- [x] 2.1 Add ADR-SDK-018 and the host guidance to sdk-core `SECURITY.md` and `API.md`, moving the coherence ADR
  pins to 018. Change no code; cite the existing `tests/pass2.test.ts` coverage.

## 3. Failed-authentication target rule (#862)

- [x] 3.1 Add the SDK-only rule to `src/validation/semantic.ts`, called last in `validateBaseSemantics`.
- [x] 3.2 Run typecheck, build and the existing runtime tests before the rule-only commit.

## 4. Tests (#862)

- [x] 4.1 Add the top-level `tests/failed-authentication-target.test.ts`:
  - every refused shape on named methods, `emit()`, `redeliver()` and free validation, with zero sink calls;
  - the approved example and the derived resource accepted;
  - precedence;
  - other events unaffected.

  Show that the tests fail against `main`'s `semantic.ts`.

## 5. Documentation (#862)

- [x] 5.1 Add:
  - ADR-SDK-019, moving the coherence pins to 019;
  - the MIGRATION entry;
  - API and SECURITY sections;
  - the "Target-bearing field" glossary term;
  - the Node error-catalog cause.

## 6. Verification

- [x] 6.1 Run the verification chain on the candidate and record each exit status:
  - strict validation;
  - assessment- and final-phase governance;
  - the dual check;
  - contract reuse;
  - Git state;
  - generated and changed-path gates;
  - coherence;
  - contract-version currency;
  - sdk-core `npm run validate`;
  - `make test`;
  - the CodeScene delta.

## 7. Merge, fold and archive

- [x] 7.1 Obtain every required CI context plus DeepScan green, and the AGY and `/code-review high` reviews, on the
  pull request head. Evidence: on head `a953448d0b18c7f6ecedcc972d2327728c1db885` in PR #874, all ten required
  contexts plus DeepScan, the CodeScene review and codecov reported SUCCESS; AGY's final round accepted, and three
  `/code-review high` rounds were resolved (`design.md`, "Review-driven refinements").
- [x] 7.2 Merge as a merge commit after the checks pass. Evidence: PR #874 was merged into `main` as merge commit
  `91afc83fbfe2e5524c36f107997d2beedbbf28e7` by the orchestrator under the owner's delegation (G45).
- [x] 7.3 Fold the ADDED requirement into the canonical spec in a separate PR. Evidence: the requirement is appended
  unchanged to `openspec/specs/security-audit-sdk-core/spec.md` in this dedicated fold PR, while the change is
  active (ADR 0001).
- [ ] 7.4 Archive the change in a separate PR, after the fold lands.

## Evidence

Observed on 2026-10-22 on the macOS (Apple Silicon) workstation with Node v26.12.1. The base is `main` at
`fbb4189e14b0a696d7b88edf40ce8ddeb69b838b`; the proposal was written against `7fbddd5` and rebased with no conflict.
After the chain, the branch was rebased onto `1550629` (the archive of `correct-transaction-critical-delivery-claims`,
which touches no path of this change); the range gates were rerun there.
Local results do not imply remote CI, review or approval.

- **1.2.** Before the proposal commit, assessment-phase governance passed, `openspec validate --strict` reported the
  change valid, and contract reuse was an approved skip.
- **2.1.** ADR-SDK-018 and the host guidance were added with no code change. The coherence ADR pins moved to 018 and
  `test:coherence` passed. The cited `tests/pass2.test.ts` tests pass unchanged.
- **3.2.** After the rule, typecheck and build exited 0, and the existing sdk-core runtime tests passed (685 of 685
  before the new file).
- **4.1.** `tests/failed-authentication-target.test.ts` passes 38 of 38. Against `main`'s `semantic.ts`, the same
  tests give 38 tests, 10 pass and 28 fail; every failure is a refusal or an inherited-target case.
  - **Six mutants** were run during verification only and not committed. Each fails at least one test:
    - parent checks removed (6 fail);
    - display-name check removed (4);
    - untyped `tenant_id` allowed (2);
    - authorization check removed (4);
    - the rule moved before the semantic checks (3);
    - the rule moved before derived-field provenance (1).
- **5.1.** ADR-SDK-019 was added, the coherence pins moved to 019, and the MIGRATION, API, SECURITY, glossary and
  Node error-catalog text was added. `test:coherence`, the Node `error-catalog` test and the kit gate passed.
- **6.1.** The full chain ran on the rebased candidate, and every step exited 0:
  - `openspec validate --strict`, assessment-phase governance, and contract reuse for every active change
    (approved skip);
  - final-phase governance ("inspected 5 commit(s) and 16 path(s)") and the dual check, where candidate and
    baseline both passed;
  - `check-git-state.mjs`, `check:generated` and `test:changed-paths`;
  - sdk-core `npm run validate`: runtime 723 of 723, `test:verification` 301 of 301, and exports 61/92 unchanged;
  - `make test`, `test:coherence` and contract-version currency;
  - CodeScene CLI 1.0.53 `cs delta`, with no findings. An earlier extra branch in `validateBaseSemantics` was moved
    into `validateSdkOnlyRules`.
  - `check-git-state.mjs` again, with an empty working tree afterwards.
- **Review.** Three `/code-review high` rounds and four AGY rounds; AGY's final round accepted, with HEAD and the
  tree unchanged. The review-driven refinements are recorded in `design.md`.
