# Tasks

This change holds the HTTP-specific tickets of #575, in blocking order. Each PR ticks its own ticket's
task here, and its PR body closes that issue and says `Refs #575`.

A sink fix filed during the evaluation adds its own task just before 4.1, in the PR that lands it.

The fold task (4.1) and the archive task (5.1) stay unticked until their tickets. Those tickets also fold
and archive the umbrella, `deliver-sdk-evaluation-alpha`.

## 1. Proposal

- [x] 1.1 #578 Propose this change in the same PR as the umbrella, with the sink's requirements and exact
  owned paths. Verify:
  - `openspec validate add-sdk-node-http-audit-sink --strict` passes;
  - over the proposal range, the governance final phase, both dual-check arms, contract-reuse for every
    active change (approved skip) and normative precedence at the merge stage all pass.

  Approving this change is the owner's act, not a task: an approval comment that names both changes and
  the head SHA, then the owner's own merge.

## 2. Shared response classification

- [x] 2.1 #579 Extract the shared HTTP response classifier from the delivery handoff, with no behaviour
  change. Verify:
  - the handoff, retry and delivery-class tests pass unedited;
  - the export check passes with no edit to its frozen lists;
  - the scope-mutation source pins count the new file.

## 3. HTTP audit sink

- [x] 3.1 #589 HTTP sink v1: one byte-exact POST per event through the governed fetch adapter (A1,
  `createFetchHttpExchange`). Verify:
  - loopback tests prove byte-identical bodies, including a non-zero `correlation.retry_attempt`;
  - they prove one request per emit, and that a 3xx is not followed;
  - ADR-NODE-004, the frozen lists and a freeze-record amendment are in place.
- [x] 3.2 #590 Split rejected from failed, and add the `onOutcome` callback. The callback carries the event
  identifier and the classifier's code. Verify:
  - loopback tests cover every status class;
  - the sentinel-credential test passes;
  - a throwing callback changes nothing.
- [x] 3.3 #591 `flush` waits for in-flight sends, and SDK shutdown drains them within its bound. Verify the
  tests for:
  - held responses;
  - `SDK_SHUTDOWN_TIMEOUT`;
  - `SDK_SHUT_DOWN`;
  - N concurrent emits.
- [x] 3.4 #592 Run the sink mutation checks on disposable clones. Verify that every mutant is killed, and
  that the run asserts the number of mutants applied.

## 4. Fold

- [x] 4.1 #606 Fold this change's delta into `openspec/specs/security-audit-sdk-node/spec.md`, in the
  umbrella's fold PR, while both changes are still active. Verify:
  - each requirement and scenario heading appears exactly once;
  - no delta header survives;
  - a scratch-copy archive reports the spec as already in sync.

## 5. Archive

- [x] 5.1 #607 Archive this change in the umbrella's archive PR. That PR is cut from `main` after the fold
  merges, and is merged as a merge commit. Verify:
  - the local archive dry run passes;
  - both sides of the move are staged;
  - the PR carries no canonical write.
