# Tasks

Every sub-issue of #575 appears here exactly once, in blocking order. Most have a task. Three have an
untracked note instead: #581, which was withdrawn, and #608 and #609, which write nothing to the
repository.

Each PR ticks its own ticket's task, and its PR body closes that issue and says `Refs #575`.

Tickets filed later — a conformance divergence, or an evaluation re-issue fix — add their own task in
the PR that lands them. The task goes just before the task it blocks: before 7.1 for a divergence,
before 8.1 for a re-issue fix.

The evaluation task (8.1) and the fold task (9.1) stay unticked until the fold PR, which ticks both. The
archive task (10.1) stays unticked until its own ticket.

## 1. Proposal and authorization

- [x] 1.1 #578 Propose this change and draft `evaluation-authorization.md`, leaving the evaluator
  handles as an owner placeholder. Verify:
  - `openspec validate deliver-sdk-evaluation-alpha --strict` passes;
  - over the proposal range, the governance final phase, both dual-check arms, contract-reuse for every
    active change (approved skip) and normative precedence at the merge stage all pass.

  Approving the authorization is the owner's act, not a task: an approval comment naming the head SHA,
  then the owner's own merge.

## 2. Prefactors, core type and error catalog

- [ ] 2.1 #579 Extract the shared HTTP response classifier from the delivery handoff, with no behaviour
  change. Verify:
  - the handoff, retry and delivery-class tests pass unedited;
  - the export check passes with no edit to its frozen lists;
  - the scope-mutation source pins count the new file.
- [ ] 2.2 #580 Extract the pack-and-install harness. Verify that the packed-install check's assertions and
  outcome are unchanged, and that nothing is written inside the repository tree, even when a step fails.

  #581 was withdrawn by deviation 6 and has no task. Sink failures keep F-11's diagnostics, and the event
  identifier reaches developers through the HTTP sink's outcome callback (4.2).

- [ ] 2.3 #582 Make `authoritativeTenant`'s input type a union that encodes its runtime rule. Verify:
  - positive and negative compile-only type assertions pass;
  - the runtime tests pass unedited;
  - exported type names and the core export checks are unchanged.
- [ ] 2.4 #583 Error catalog part 1: all 21 SDK codes and the 12 most-hit contract codes. Verify that the
  completeness test, with a pending list of exactly the other 19 contract codes, runs in the Node binding's
  validation chain.
- [ ] 2.5 #584 Error catalog part 2: the remaining 19 contract codes, and the pending list deleted. Verify
  that a catalog with one entry removed fails the completeness test.

## 3. Conformance suite

- [ ] 3.1 #585 Build the conformance harness, plus rows for the 10 account, authentication and session
  events. Verify that each row returns ok, passes `validateSecurityAuditEvent` and matches its catalog
  entry, and that at least one invalid row asserts its code and path.
- [ ] 3.2 #586 Add rows for the 7 authorization and administration events. Verify that each passes
  validation and matches its catalog entry.
- [ ] 3.3 #587 Add rows for the 7 data, configuration and tenant events. Verify that each passes, and that
  transaction-bound rows take their commit state from a real operation handle.
- [ ] 3.4 #588 Add invalid rows for every rule family, the contract's positive and negative examples, and
  size bounds. Verify:
  - each invalid row asserts its exact code and path;
  - a value at a bound passes, and one past it fails.

## 4. HTTP audit sink

- [ ] 4.1 #589 HTTP sink v1: one byte-exact POST per event through the governed fetch adapter (A1,
  `createFetchHttpExchange`). Verify:
  - loopback tests prove byte-identical bodies, including a non-zero `correlation.retry_attempt`, one
    request per emit, and an unfollowed 3xx;
  - the ADR-NODE-004 widening, the frozen lists and a `freezeRecord` amendment are in place.
- [ ] 4.2 #590 Split rejected from failed, and add the `onOutcome` callback carrying the event identifier
  and the classifier's code. Verify:
  - loopback tests cover every status class;
  - the sentinel-credential test passes;
  - a throwing callback changes nothing.
- [ ] 4.3 #591 `flush` waits for in-flight sends, and SDK shutdown drains within its bound. Verify the
  held-response, `SDK_SHUTDOWN_TIMEOUT`, `SDK_SHUT_DOWN` and N-concurrent-emit tests.
- [ ] 4.4 #592 Sink mutation checks on disposable clones. Verify that every mutant is killed and that the
  run asserts the applied mutant count.

## 5. Evaluation kit and example

- [ ] 5.1 #593 Kit v0: build it, install it with npm outside the repository, and emit one event. Verify:
  - the builder is deterministic for a commit;
  - the gate runs in `test` and `validate`;
  - a broken core dependency fails it.
- [ ] 5.2 #594 The first event goes over HTTP from the installed kit. Verify, at the example receiver, that
  the event is accepted, validated and byte-identical, and that the examples type-check with TypeScript
  5.9.2.
- [ ] 5.3 #595 Quickstart v1, with every documented TypeScript code block type-checked. Verify that a
  snippet using a renamed option fails the gate.
- [ ] 5.4 #596 Example: per-request context, authentication failure and authorization denial. Verify that
  both events arrive valid and byte-identical, and that the context survives an `await`.
- [ ] 5.5 #597 Example: sensitive-resource view and committed sensitive-resource modification. Verify that
  all five demonstrated events arrive valid and byte-identical, and that the modification's commit state
  comes from the operation handle.
- [ ] 5.6 #598 Kit failure paths, the wire-protocol page and the failure table. Verify that every status
  class maps to the documented SDK code and `onOutcome` code, and that the flush and shutdown behaviour
  matches the documents.
- [ ] 5.7 #599 pnpm support, and one core copy proven for every supported installer. Verify:
  - npm and pinned-pnpm installs both run the one-event script;
  - a planted second core copy fails the gate.
- [ ] 5.8 #600 Measured compatibility with TypeScript 6 and 7. Verify:
  - every example and doc block type-checks under 5.9.2, a pinned 6.0.x and a pinned 7.0.x;
  - a planted type error fails every leg;
  - the declared range is unchanged.

## 6. Documentation and evaluation materials

- [ ] 6.1 #601 Correct the Node binding, core and root READMEs. Verify:
  - every code block type-checks through the gate;
  - sdk-core's coherence and contract-version-currency checks stay green.
- [ ] 6.2 #602 Privacy guidance, the supported-versus-planned table and known issues. Verify that no
  planned item is described as implemented and that every code block type-checks.
- [ ] 6.3 #603 Evaluation guide, questionnaire and seeded invalid-call exercise. Verify that the five
  seeded calls return their expected code and path against the installed kit, and that the catalog
  documents each code.

## 7. Kit identity

- [ ] 7.1 #604 Kit identity and completeness. Verify:
  - the identity file reproduces from the kit's files;
  - the builder refuses a dirty tree;
  - removing any kit item fails the gate;
  - nothing is published, tagged or version-moved.

## 8. Evaluation

- [ ] 8.1 #605 The evaluation is closed. Before distribution, kit v1's identity and the evaluators' handles
  were recorded on #605 and matched the authorization. The window has ended or a stop condition applied,
  every re-issue fix has merged, and #605 is closed as completed. #605 writes nothing to the repository,
  so the fold PR (#606), whose start condition is #605's closure, ticks this task together with 9.1.

  The decision brief (#608) and the decision (#609) are recorded on the issues, write nothing to the
  repository, and run alongside groups 9 and 10. They have no task here.

## 9. Fold

- [ ] 9.1 #606 Fold the final deltas into `openspec/specs/security-audit-sdk-node/spec.md` and
  `openspec/specs/security-audit-sdk-core/spec.md`, in a PR of its own, while this change is still active.
  Verify:
  - each requirement and scenario heading appears exactly once;
  - no delta header survives;
  - a scratch-copy archive reports the specs already in sync.

## 10. Archive

- [ ] 10.1 #607 Archive this change in a PR of its own, cut from `main` after the fold merged, and merge it
  as a merge commit. Verify:
  - the local archive dry run passes;
  - both sides of the move are staged;
  - the PR carries no canonical write.
