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

- [ ] 4.1 Add:
  - the README "Transaction-critical delivery" section with its migration note;
  - the "Commit claim" glossary term;
  - ADR-NODE-005;
  - the `compatibility.json` `freezeRecord` amendment (counts unchanged).

  Also rewrite the consumer integration profile's "Commit evidence" paragraph.

## 5. Verification

- [ ] 5.1 Run the verification chain on the candidate and record each exit status:
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

- [ ] 6.1 Obtain every required CI context plus DeepScan green, and the AGY and `/code-review high` reviews, on the
  pull request head.
- [ ] 6.2 Merge as a merge commit after the checks pass.
- [ ] 6.3 Fold the MODIFIED requirements into the canonical specs in a separate PR.
- [ ] 6.4 Archive the change in a separate PR, after the fold lands.
