# Tasks: Correct transaction-critical delivery claims for partial and compensated occurrences (#869)

## 1. Proposal and Planning

- [x] 1.1 Author change artifacts: proposal, delta spec (`security-audit-sdk-node`), design, and tasks for #869.
- [x] 1.2 Verify change structure with `openspec status --change correct-transaction-critical-partial-and-compensated-claims --json`.

## 2. Tests (TDD)

- [x] 2.1 Add tests in `packages/security-audit-sdk-node/tests/transaction-critical-claims.test.ts`:
  - `partially_committed` occurrence runs commit gate and returns `partially_committed_and_durable` upon successful commit and durability;
  - `compensated` occurrence runs commit gate and returns `compensated_and_durable` upon successful commit and durability;
  - deduplication records both `partially_committed_and_durable` and `compensated_and_durable` as settled successes;
  - verify failure outcomes (`business_commit_declined`, `business_commit_unconfirmed`, `audit_durability_failed_after_commit`) remain intact for partial and compensated occurrences.
- [x] 2.2 Verify new test assertions fail or typecheck fails against unpatched implementation.

## 3. Runtime Implementation

- [x] 3.1 In `packages/security-audit-sdk-node/src/delivery-classes.ts`:
  - Widen `TransactionCriticalDeliveryResult` with `partially_committed_and_durable` and `compensated_and_durable`.
  - In `deliverWithCommit`, branch on `input.event.event.commit_state` to return the matching qualified durable status.
  - In `reachedDurability`, recognize both new statuses so settled keys are recorded for deduplication.
  - Update doc comments and verify no new exports are added.
- [x] 3.2 Verify focused tests pass with `npm test --prefix packages/security-audit-sdk-node`.

## 4. Verification and Gates

- [x] 4.1 Run `npm run validate --prefix packages/security-audit-sdk-node` (typecheck, build, tests, scope, frozen exports, dependencies, evaluation kit controls).
- [x] 4.2 Run `make test` across workspaces.
- [x] 4.3 Run `git diff --check` to ensure no whitespace or formatting errors.

## 5. Merge, fold and archive

- [x] 5.1 Obtain every required CI context plus DeepScan green on PR #896 head (`ce4a1b2d3b74f928169a5393b2fed19b1225bc5e`).
- [x] 5.2 Merge PR #896 as a merge commit after checks pass. Evidence: PR #896 merged into `main` as merge commit `7f37d50278a7024f8ffdf85954a2948e4d14a325`.
- [x] 5.3 Fold the MODIFIED requirement into the canonical spec (`openspec/specs/security-audit-sdk-node/spec.md`) in a separate dedicated fold PR, while the change is active (ADR 0001).
- [ ] 5.4 Archive the change in a separate dedicated archive PR after the fold lands.
