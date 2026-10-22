# Tasks: transaction-critical delivery claims only what it checks (#859, #860)

Groups complete in order. Merge, fold and archive stay unchecked while the change is active.

## 1. Proposal

- [x] 1.1 Author the change artifacts: proposal, design, full assessment with exact ownership, tasks, and the two
  MODIFIED spec deltas (`security-audit-sdk-node`, `fraud-evidence-profile`).
- [x] 1.2 Run assessment-phase governance and strict OpenSpec validation before the proposal-only commit.

## 2. Runtime

- [x] 2.1 In `packages/security-audit-sdk-node/src/delivery-classes.ts`:
  - read the probe and gate results as `unknown`, and continue only on exactly `true` and `"committed"`;
  - add `business_commit_unconfirmed` and `audit_durability_failed_after_commit`;
  - deliver a `not_committed` occurrence without running the gate, as `durable_without_commit`;
  - narrow the doc comments.

  Add no export.
- [x] 2.2 Run typecheck, build and the existing Node runtime tests before the runtime-only commit.

## 3. Tests

- [x] 3.1 Add the top-level `packages/security-audit-sdk-node/tests/transaction-critical-claims.test.ts`:
  - every P-E-x2 probe and gate value;
  - P-E-3a, P-E-6c, P-E-7 and P-E-8;
  - the unchanged committed, declined and duplicate controls.

  Show that the new tests fail against `main`'s `delivery-classes.ts`.

## 4. Documentation

- [x] 4.1 Add:
  - the README "Transaction-critical delivery" section with its migration note;
  - the "Commit claim" glossary term;
  - ADR-NODE-005;
  - the `compatibility.json` `freezeRecord` amendment (counts unchanged).

  Also rewrite the consumer integration profile's "Commit evidence" paragraph.

## 5. Verification

- [x] 5.1 Run the verification chain on the candidate and record each exit status:
  - strict validation;
  - assessment- and final-phase governance;
  - the dual check;
  - contract reuse;
  - Git state;
  - generated and changed-path gates;
  - coherence;
  - contract-version currency;
  - `npm run validate` for `sdk-node`;
  - `make test`;
  - the CodeScene delta.

## 6. Merge, fold and archive

- [x] 6.1 Obtain every required CI context plus DeepScan green, and the AGY and `/code-review high` reviews, on the
  pull request head. Evidence: on head `c90f34cf874a28b04e32f626ffdbcc3be3a5c5d2` in PR #871, all ten required contexts plus
  DeepScan, the CodeScene review and codecov reported SUCCESS; AGY accepted, and `/code-review high` findings were resolved
  or filed as #869 and #870 (`design.md`, "Review-driven refinements").
- [x] 6.2 Merge as a merge commit after the checks pass. Evidence: PR #871 was merged into `main` as merge commit
  `7fbddd565629f2cff69045f8487d5ee50484501c` by the orchestrator under the owner's delegation (G45).
- [x] 6.3 Fold the MODIFIED requirements into the canonical specs in a separate PR. Evidence: the three MODIFIED blocks replace their canonical
  blocks in `openspec/specs/security-audit-sdk-node/spec.md` and `openspec/specs/fraud-evidence-profile/spec.md`
  in this dedicated fold PR, while the change is active (ADR 0001).
- [x] 6.4 Archive the change in a separate PR, after the fold lands. Evidence: relocated to
  `openspec/changes/archive/2026-10-22-correct-transaction-critical-delivery-claims/` in this dedicated archive PR,
  after fold PR #872 merged as `fbb4189e14b0a696d7b88edf40ce8ddeb69b838b`.

## Evidence

Observed on 2026-10-22 on the macOS (Apple Silicon) workstation with Node v26.12.1. The base is `main` at
`79fa1270318513f5d17d06ea0508c8ef327f6b32`. Local results do not imply remote CI, review or approval.

- **1.2.** Before the proposal commit:
  - `check-design-pattern-governance.mjs --phase assessment` printed "design-pattern governance passed in
    assessment phase: enforcement active";
  - `openspec validate --strict` printed "Change 'correct-transaction-critical-delivery-claims' is valid";
  - contract reuse was an approved skip.
- **2.2.** Before the runtime commit, typecheck and build exited 0, and the existing Node runtime tests passed
  162 of 162.
- **3.1.** `tests/transaction-critical-claims.test.ts` passes 29 of 29. The differential against `main`'s
  `delivery-classes.ts` (same tests, rebuilt) gives 29 tests, 11 pass and 18 fail.
  - **The 18 that fail** are every corrected behaviour:
    - truthy out-of-type probes;
    - out-of-type and rejecting gates;
    - the unconfirmed pair staying deliverable;
    - `durable_without_commit`;
    - P-E-6c;
    - the four handoff-failure cases;
    - frozen results;
    - the rejection cases.
  - **The 11 that pass** are controls (committed, declined, falsy probes, deduplication repeat, the
    unreachable-before-commit case, the declaration) and P-E-7, which this change documents but does not alter.
- **4.1.** `npm run test:kit` exited 0 after the README section was worded for the kit's planned-feature rule.
  `test:exports` reports 19 value and 44 type-only exports, unchanged.
- **5.1.** The full chain ran on the candidate whose runtime, documentation and change artifacts are identical to
  this head's. It differs only in one test assertion, which was tightened afterwards and then re-run at 29 of 29.
  Every step exited 0:
  - `openspec validate --strict` and `generate-assessment.mjs --check` (no source file);
  - assessment-phase governance;
  - contract reuse for all three active changes (approved skip);
  - final-phase governance ("inspected 4 commit(s) and 14 path(s)");
  - the dual check, where candidate and baseline both passed;
  - `check-git-state.mjs`, `check:generated` and `test:changed-paths` (archived mode);
  - `make test`:
    - sdk-core runtime 685 of 685;
    - sdk-node runtime 191 of 191;
    - exports 19/44;
    - scope, compatibility, dependencies and package;
    - the evaluation kit, and kit controls 81 of 81;
  - `test:coherence` and contract-version currency;
  - CodeScene CLI 1.0.53 `cs delta`, with no findings;
  - `check-git-state.mjs` again, with an empty working tree afterwards.
- **Review.** `/code-review high` and AGY reviewed the change, and the review-driven refinements are recorded in
  `design.md`. AGY's final round accepted, with HEAD and the tree unchanged after each read-only review.
  - Two of its low findings were taken: a tightened assertion and a reworded commit message.
  - One was declined: the `fraud-evidence-profile` scenario changes in place by decision Q5.
