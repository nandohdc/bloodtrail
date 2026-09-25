# Tasks

Every sub-issue of #575 appears exactly once, in blocking order, either here or in the transport change
`add-sdk-node-http-audit-sink`.

- **Most tickets** have a task here.
- **The HTTP-specific tickets** (#579 and #589–#592) have their tasks in the transport change. Here they
  appear only as notes.
- **Three tickets** have a note instead of a task:
  - #581, which was withdrawn;
  - #608 and #609, which write nothing to the repository.

Each PR ticks its own ticket's task, and its PR body closes that issue and says `Refs #575`.

Tickets filed later, whether a conformance divergence or an evaluation re-issue fix, add their own task in
the PR that lands them. The task goes just before the one it blocks: before 6.1 for a divergence, and
before 7.2 for a re-issue fix. A fix to the sink goes in the transport change instead.

The evaluation task (7.2) and the fold task (8.1) stay unticked until the fold PR, which ticks both. The
archive task (9.1) stays unticked until its own ticket.

## 1. Proposal and authorization

- [x] 1.1 #578 Propose this change and the transport change, and draft `evaluation-authorization.md` with
  no evaluator authorized yet. Verify:
  - `openspec validate --strict` passes for both changes;
  - over the proposal range, the governance final phase, both dual-check arms, contract-reuse for every
    active change (approved skip) and normative precedence at the merge stage all pass.

  Approving the authorization is the owner's act, not a task. The owner posts an approval comment naming
  both changes and the head SHA, then merges personally.

## 2. Prefactor, core type and error catalog

  #579, the shared response classifier, is task 2.1 of `add-sdk-node-http-audit-sink`.

- [x] 2.1 #580 Extract the pack-and-install harness. Verify:
  - the packed-install check's assertions and outcome are unchanged;
  - nothing is written inside the repository tree, even when a step fails.

  #581 was withdrawn by deviation 6 and has no task. Sink failures keep F-11's diagnostics, and the
  event identifier reaches developers through the HTTP sink's outcome callback.

- [x] 2.2 #582 Make `authoritativeTenant`'s input type a union that encodes its runtime rule. Verify:
  - positive and negative compile-only type assertions pass;
  - the runtime tests pass unedited;
  - exported type names and the core export checks are unchanged.
- [x] 2.3 #583 Error catalog part 1: all 21 SDK codes and the 12 most-hit contract codes. Verify that the
  completeness test, with a pending list of exactly the other 19 contract codes, runs in the Node
  binding's validation chain.
- [x] 2.4 #584 Error catalog part 2: the remaining 19 contract codes, with the pending list deleted.
  Verify that a catalog with one entry removed fails the completeness test.

## 3. Conformance suite

- [x] 3.1 #585 The conformance harness, plus rows for the 10 account, authentication and session events.
  Verify that:
  - each row returns ok, passes `validateSecurityAuditEvent` and matches its catalog entry;
  - at least one invalid row asserts its code and path.
- [x] 3.2 #586 Rows for the 7 authorization and administration events. Verify that each row passes
  validation and matches its catalog entry.
- [x] 3.3 #587 Rows for the 7 data, configuration and tenant events. Verify that each row passes, and that
  transaction-bound rows take their commit state from a real operation handle.
- [x] 3.4 #588 Invalid rows for each rule family, the contract's positive and negative examples, and size
  bounds. Verify that:
  - each invalid row asserts its exact code and path;
  - a value at a bound passes, and one past it fails.

  #589–#592, the HTTP audit sink, are tasks 3.1–3.4 of `add-sdk-node-http-audit-sink`. The kit tasks that
  send events over HTTP wait for them: 4.2 waits for #589, 4.6 for #591, 5.1 for #590, and 6.1 for #592.

## 4. Evaluation kit and example

- [x] 4.1 #593 Kit v0: build it, install it with npm outside the repository, and emit one event. Verify
  that:
  - the builder is deterministic for a given commit;
  - the gate runs in both `test` and `validate`;
  - a broken core dependency fails the gate.
- [x] 4.2 #594 The first event goes over HTTP from the installed kit. Verify that:
  - at the example receiver, the event is accepted, passes validation and is byte-identical;
  - the examples type-check with TypeScript 5.9.2.
- [x] 4.3 #595 Quickstart v1, with every documented TypeScript code block type-checked. Verify that a
  snippet using a renamed option fails the gate.
- [ ] 4.4 #596 Example: per-request context, authentication failure and authorization denial. Verify that:
  - both events arrive valid and byte-identical;
  - the context survives an `await`.
- [ ] 4.5 #597 Example: sensitive-resource view and committed sensitive-resource modification. Verify
  that:
  - all five demonstrated events arrive valid and byte-identical;
  - the modification's commit state comes from the operation handle.
- [ ] 4.6 #598 Kit failure paths, the wire-protocol page and its failure table. Verify that:
  - every status class maps to the documented SDK code and `onOutcome` code;
  - the flush and shutdown behaviour matches the docs.
- [ ] 4.7 #599 pnpm support, and one core copy proven for every supported installer. Verify that:
  - the npm and pinned-pnpm installs both run the one-event script;
  - a planted second core copy fails the gate.
- [ ] 4.8 #600 Measured compatibility with TypeScript 6 and 7. Verify that:
  - every example and doc block type-checks under 5.9.2, a pinned 6.0.x and a pinned 7.0.x;
  - a planted type error fails every leg;
  - the declared range is unchanged.

## 5. Documentation and evaluation materials

- [ ] 5.1 #601 Correct the Node binding, core and root READMEs. Verify that:
  - every code block type-checks through the gate;
  - sdk-core's coherence and contract-version-currency checks stay green.
- [ ] 5.2 #602 Privacy guidance, the supported-versus-planned table, and the known issues. Verify that:
  - no planned item is described as implemented;
  - every code block type-checks.
- [ ] 5.3 #603 Evaluation guide, questionnaire and seeded invalid-call exercise. Verify that:
  - the five seeded calls return their expected code and path against the installed kit;
  - the catalog documents each code.

## 6. Kit identity

- [ ] 6.1 #604 Kit identity and completeness. Verify that:
  - the identity file reproduces from the kit's files;
  - the distributable build refuses a dirty tree;
  - removing any kit item fails the gate;
  - nothing is published, tagged or version-moved.

## 7. Evaluation

- [ ] 7.1 Evaluator amendment. No ticket carries this task; it belongs to the owner. The owner amends
  `evaluation-authorization.md` to name the evaluator handles, and names the exact kit too if its
  identity is known by then. The amendment takes effect through the owner's own two-part act: an approval
  comment naming the amendment's head SHA, then the owner's merge. The amendment PR ticks this task.
  Verify that:
  - the authorization no longer reads "none authorized yet";
  - the approval comment names the merged head.

  #605 cannot start until this task is done.
- [ ] 7.2 #605 The evaluation is closed. Before distribution:
  - kit v1's identity was recorded on #605;
  - the evaluators' handles were recorded on #605, and matched the amended authorization.

  Since then, the window has ended or a stop condition has applied, every re-issue fix has merged, and
  #605 is closed as completed.

  #605 writes nothing to the repository. The fold PR (#606), whose start condition is #605's closure,
  therefore ticks this task together with 8.1.

  The decision brief (#608) and the decision (#609) are recorded on the issues and write nothing to the
  repository. They run alongside groups 8 and 9 and have no task here.

## 8. Fold

- [ ] 8.1 #606 While both changes are still active, fold this change's final deltas into
  `openspec/specs/security-audit-sdk-node/spec.md` and `openspec/specs/security-audit-sdk-core/spec.md`,
  and fold the transport change's delta. Do this in one PR of its own, with one fold commit per change.
  Verify that:
  - each requirement and scenario heading appears exactly once;
  - no delta header survives;
  - a scratch-copy archive of each change reports the specs already in sync.

## 9. Archive

- [ ] 9.1 #607 Archive this change and the transport change in one PR of its own. Cut the PR from `main`
  after the fold has merged, and merge it as a merge commit. Verify that:
  - the local archive dry run passes for both changes;
  - both sides of each move are staged;
  - the PR carries no canonical write.
