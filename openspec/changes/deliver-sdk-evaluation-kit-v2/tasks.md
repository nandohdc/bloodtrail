# Tasks

Every sub-issue of #649 appears here exactly once, in blocking order, as a task or as a note.

- **Tickets #650–#668** each have a task.
- **#669 and #670** have a note instead. The decision brief and the decision are recorded on #649 and write
  nothing to the repository.

Each PR ticks its own ticket's task, and its PR body closes that issue and says `Refs #649`.

A ticket filed later, such as an evaluation re-issue fix, adds its own task in the PR that lands it, just
before 7.1.

The evaluation task (7.1) stays unticked until the fold PR, which ticks it together with 8.1. The archive
task (9.1) stays unticked until its own ticket.

## 1. Proposal and authorization

- [x] 1.1 #650 Propose this change, and draft `evaluation-authorization.md` with no evaluator authorized.
  Verify:
  - `openspec validate --strict` passes;
  - each MODIFIED delta replaces its whole canonical requirement block, keeps every canonical scenario, and
    leaves no appended or contradictory SHALL;
  - over the proposal range, these all pass: the governance final phase, both dual-check arms,
    contract-reuse for every active change, and normative precedence at the merge stage.

  Approving the change and its authorization is the owner's act, not a task. The owner posts an approval
  comment naming this change and the head SHA, and then merges personally.

## 2. Gate prefactor, installers and identity

- [x] 2.1 #651 Move the kit gate's failure-path program into a real, type-checked file. Verify that:
  - the same eight failure and lifecycle checks run from that file with unchanged assertions, and pass;
  - the file type-checks in the installed kit under TypeScript 5.9.2 and the pinned 6.0.x and 7.0.x
    releases;
  - a planted type error in it fails the gate, and the control harness asserts the applied count;
  - the file is never a kit item.
- [x] 2.2 #652 pnpm 11 and 12 install the kit. Verify that:
  - the kit contains a generated pnpm settings file, and the consumer manifest has no `pnpm` field;
  - npm and the pinned pnpm 10, 11 and 12 releases each install outside the repository, run the first
    event, and pass the one-core-copy probe, whose null control still fires;
  - no supported installation reports an ignored setting, and the gate asserts it;
  - with the override only in the manifest's `pnpm` field, the gate fails on the pnpm 11 and 12 legs;
  - the quickstart and known issues name npm and pnpm 10, 11 and 12 exactly;
  - the PR records, as a measurement, the time the pnpm legs add.
- [x] 2.3 #653 Build kit artifacts from tracked sources. Verify that:
  - two builds of the same tree, the second after stale content is planted in each package's ignored build
    output, produce identical artifact and kit digests;
  - a builder that packs the build output on disk fails that check;
  - a dirty tree still refuses a distributable kit, and the gate's kit is still marked non-distributable;
  - artifact file names come from the package manifests, and every ordering is code-point order;
  - nothing is published, tagged or version-moved.
- [x] 2.4 #654 Cover every kit file with a checksum list. Verify that:
  - `shasum -a 256 -c` over the list succeeds in an unpacked kit, and the gate asserts it;
  - the identity records an identity-format version, and the kit digest commits to the list;
  - changing one document after the build fails the gate's identity check;
  - the evaluation guide's integrity commands, run by the gate in an unpacked kit, name only shipped files,
    use only `shasum`, and pass;
  - the guide tells the facilitator to record the archive's SHA-256 on the evaluation issue.

## 3. Delivery, receiver and service

- [ ] 3.1 #655 Prove the receiver got exactly the bytes the SDK validated. Verify that:
  - for each of the five demonstrated events, the gate compares the sender's validated bytes with the
    receiver's received bytes;
  - a sink that rewrites one field fails the check, and the applied count is asserted;
  - the gate no longer reads event bodies from the receiver's health endpoint;
  - the existing semantic assertions still hold, taken from the new source.
- [ ] 3.2 #656 Make the example receiver a careful ingress. Verify that:
  - unauthenticated, oversized, malformed, conflicting and SDK-invalid submissions get 401, 413, 400, 409
    and 422, and the next valid event is still accepted after each;
  - an SDK-invalid event is never admitted, so a corrected event with the same identity is admitted;
  - `sdk.redeliver` of a byte-identical copy returns an ok result;
  - the health endpoint returns status and counts only;
  - the wire-protocol failure table gains the duplicate and conflict rows;
  - a receiver that answers a duplicate with 400, and one that rethrows after replying, each fail the gate.
- [ ] 3.3 #657 Make the example service a real `node:http` service, with a driver. Verify that:
  - its handlers emit the five demonstrated events, the modification after `markCommitted()`;
  - the failed login uses `anonymousActor()`;
  - every `onOutcome` report is logged with the event identifier, outcome and status only;
  - the service and the driver run with plain `node` on Node 24 and 26, and type-check under TypeScript
    5.9.2 and the pinned 6.0.x and 7.0.x releases;
  - the byte check passes against the new service;
  - no framework dependency and no tracked manifest are added.
- [ ] 3.4 #658 Report a deadline during the response body as `timeout`. Verify that:
  - a peer that stalls mid-body past the timeout yields `SDK_SINK_FAILURE` with the `onOutcome` cause
    `timeout`;
  - oversized, unparseable and empty bodies still map to a malformed acknowledgment;
  - the existing fetch-exchange and handoff tests stay green;
  - mapping the stall to a malformed acknowledgment fails the gate.
- [ ] 3.5 #659 Add planted-defect controls for the gate checks that have none. Verify that:
  - a misclassified failure status, a broken first-event run, a seeded invalid call that no longer fails,
    and an export removed from the packed entry point each fail the gate;
  - each control runs on a disposable copy, and the harness asserts the applied count;
  - the controls' summary line names every control, old and new.

## 4. Evaluator documents

- [ ] 4.1 #660 Ship the M3 exercise without its answers. Verify that:
  - the kit's seeded-call document lists the five calls and M3's rules only;
  - the seeded example prints each returned error with no verdict;
  - the facilitator answer key holds each call's expected code, path, diagnosis and fix, and every fix
    type-checks against the installed kit;
  - error illustrations use `SafeAuditError`'s real fields, and the questionnaire uses real API names;
  - copying the answer key's content into the kit fails the gate.
- [ ] 4.2 #661 Allow kit documents to name only APIs that exist. Verify that:
  - every call-shaped inline reference in the kit's documents resolves against the installed packages;
  - every current offender is fixed, the privacy guidance's method name included;
  - a planted `op.commit()` in a kit document fails the gate.
- [ ] 4.3 #662 Make the evaluator documents tell the truth about the alpha. Verify that:
  - the Node binding README states its frozen status, and no longer says "provisional";
  - the quickstart describes the core as a regular dependency, and states exactly what a context scope
    supplies and what the types require;
  - the supported-versus-planned table states one attempt, and lists the delivery retry and backpressure
    primitives separately, outside the evaluated path;
  - the known issues describe the collector ingress as structural only, and disclose the over-required
    input types;
  - a planted "Supported" retry row fails the gate.
- [ ] 4.4 #663 Document framework wiring, the test sinks and deterministic providers. Verify that:
  - the Express and Fastify snippets type-check with no framework dependency, under TypeScript 5.9.2 and
    the pinned 6.0.x and 7.0.x releases;
  - the test-sink example asserts on a captured event;
  - the clock and identifier example asserts a stable event identifier and timestamp;
  - every value is synthetic.

## 5. Final kit

- [ ] 5.1 #664 Build and verify kit v2. Verify that:
  - every implementation ticket is closed, and all ten required contexts are green on the build commit;
  - a distributable kit, built from a clean checkout of that commit, records the full identity;
  - unpacked from its archive in a fresh directory, the checksum list verifies, every supported installer
    resolves one core copy, and the examples and seeded calls run;
  - a second build from a separate clean checkout reproduces identical digests;
  - the identity and the archive's SHA-256 are posted on #666, and the kit is not distributed.

## 6. Evaluator amendment

- [ ] 6.1 #665 The owner's amendment. It belongs to the owner, and an agent drafts it only after the owner
  supplies the handles. The owner amends `evaluation-authorization.md` to name each evaluator by GitHub
  handle, together with kit v2's kit digest and archive SHA-256. The amendment takes effect only through the
  owner's SHA-bound approval comment and the owner's own merge. Verify that:
  - the authorization no longer reads "None yet";
  - the approval comment names the merged head.

  #666 cannot start until this task is done.

## 7. Evaluation

- [ ] 7.1 #666 The evaluation is closed. Before distribution:
  - the kit and archive digests matched #664's comment on #666;
  - the evaluators' handles matched the amended authorization.

  Since then, the two-week window has ended or a stop condition has applied, every re-issue fix has merged,
  and #666 is closed as completed.

  #666 writes nothing to the repository. The fold PR (#667), whose start condition is #666's closure,
  therefore ticks this task together with 8.1.

  The decision brief (#669) and the decision (#670) are recorded on #649 and write nothing to the
  repository. They run alongside groups 8 and 9 and have no task here.

## 8. Fold

- [ ] 8.1 #667 While this change is still active, fold its deltas into
  `openspec/specs/security-audit-sdk-node/spec.md`, in a PR of its own. Verify that:
  - each MODIFIED requirement replaces its canonical block in full, with no appended or contradictory SHALL
    left behind;
  - the ADDED receiver requirement appears in the canonical spec;
  - each requirement and scenario heading appears exactly once, and no delta header survives;
  - a scratch-copy archive of the change reports the spec already in sync.

## 9. Archive

- [ ] 9.1 #668 Archive this change in a PR of its own. Cut the PR from `main` after the fold has merged,
  and merge it as a merge commit. Verify that:
  - the local archive dry run passes;
  - both sides of the move are staged;
  - the PR carries no canonical write, and the gates are green in archived mode.
