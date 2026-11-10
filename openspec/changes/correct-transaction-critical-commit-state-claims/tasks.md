# Tasks: Correct transaction-critical commit-state claims (#913)

## 1. Proposal

- [ ] 1.1 Author the proposal, design, delta spec (`security-audit-sdk-node`) and tasks from the #913 decision record.
  Verify that `openspec validate correct-transaction-critical-commit-state-claims --strict` passes.
- [ ] 1.2 Author `assessment.source.json`, then generate `assessment.json` from it. Verify that
  `node openspec/scripts/generate-assessment.mjs --change correct-transaction-critical-commit-state-claims --check`
  and
  `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change correct-transaction-critical-commit-state-claims`
  both pass, and that the proposal commit changes no path outside this change's directory.
- [ ] 1.3 Once every required context plus DeepScan is green, merge the proposal PR as a merge commit. Verify by
  recording the proposal commit and the merge commit here.

## 2. Tests that expose the defects

- [ ] 2.1 Add tests to the transaction-critical claims tests, run through the public binding with the contract's
  example events. Each test counts probe, gate and handoff calls:
  - each of `pending`, `unknown`, `not_started`, `not_applicable` and an absent commit state is refused as
    `commit_state_not_allowed`, with zero probe, gate and handoff calls;
  - `compensated` on a `transaction_critical` event whose catalog entry does not allow it is refused the same way;
  - a caller's change to a non-frozen occurrence during the probe, during the gate and during the exchange reaches
    neither the handed-off body nor the status. Each case asserts that the body equals the occurrence as it was
    when `deliver()` was called;
  - an occurrence holding a BigInt, and one holding a cycle, are refused as `occurrence_not_serializable`, with
    zero gate runs, and `deliver()` resolves;
  - `null` and a number are refused as `unknown_event_name`, and `deliver()` resolves;
  - an occurrence whose `event` getter throws is refused with an empty `event_id`, and `deliver()` resolves;
  - the occurrence a recording handoff receives is frozen at every depth;
  - an occurrence refused as `commit_state_not_allowed`, corrected and offered again under the same pair, is
    delivered.

  Verify that each test fails on the unchanged binding, and record the failing assertions.
- [ ] 2.2 Add tests that pin behaviour the fix must keep:
  - a walk over every `transaction_critical` catalog entry asserts that each allowed commit state reaches its
    documented status and gate behaviour;
  - one delivery records the call order probe → gate → handoff;
  - a duplicate of a settled pair is reported `already_delivered` with zero further gate runs;
  - for each contract example delivered, the handed-off body equals `JSON.stringify` of the example.

  In the class conformance tests, change the `transaction_critical` arm's "delivered" predicate to "reached any
  durable status". Verify that these tests pass on the unchanged binding.

## 3. Runtime implementation

- [ ] 3.1 In the `transaction_critical` binding:
  - take the snapshot first in admission: `JSON.stringify`, then `JSON.parse`, then a deep freeze. Refuse as
    `occurrence_not_serializable` when serialization throws or returns no string;
  - read the snapshot with guarded property access, so a snapshot that is not an occurrence object is refused as
    `unknown_event_name`, and run the class and transaction identifier checks on it;
  - give every refusal an `event_id` from a guarded read that yields the empty string. The read is of the caller's
    object for a serialization refusal, and of the snapshot otherwise. Use an admitted occurrence's identifier as
    today;
  - refuse as `commit_state_not_allowed` a commit state absent from the occurrence's own catalog entry, read from
    sdk-core's exported catalog;
  - keep the duplicate check and the reservation in one synchronous step after these checks;
  - map commit state to gate behaviour and status through one frozen table with no default branch, consulted
    once;
  - hand the snapshot to the durability point, and build every result from the snapshot;
  - build the deduplication key so that it cannot throw for any identifier the snapshot can hold.

  Add the two literals to `DeliveryClassRefusalCode`, and update the binding's doc comments. The snapshot adds the
  `JSON` language global to the binding's source, so move the scope gate's null-control baseline from 90 to 91
  references. Verify that the scope gate still reports no host coupling.
- [ ] 3.2 Verify that every test from group 2 passes. Then, in a disposable copy, verify that each fails against its
  planted defect:
  - the commit-state check removed, with the table defaulting to `committed_and_durable`;
  - the check replaced by the union of every `transaction_critical` entry's list;
  - one table entry removed;
  - the pipeline reading the caller's object instead of the snapshot;
  - the serialization check removed;
  - an unguarded read of the snapshot;
  - an unguarded read of the caller's identifier;
  - a freeze of the top level only;
  - the key reserved before the commit-state check;
  - a snapshot that reorders keys;
  - the gate run before the probe;
  - the settled check moved after the gate;
  - a binding that reports `failed_closed` for the class's own example, for the conformance arm.

  Record each plant and its failing test.

## 4. Records

- [ ] 4.1 In the Node binding's README transaction-critical section:
  - add rows for `commit_state_not_allowed` and `occurrence_not_serializable`;
  - qualify the committed row to an occurrence whose commit state is `committed`;
  - state that the binding delivers and reports one snapshot taken when `deliver()` is called.

  In the migration section, add the #913 entries, the two codes and the refusals that replace a claim or a failure
  after the commit, and a #869 warning: an equality check on `committed_and_durable` no longer matches a
  `partially_committed` or `compensated` occurrence. Verify that no row still implies that the commit state is
  unchecked.
- [ ] 4.2 Rewrite the `CONTEXT.md` entry "Commit claim" so that it names the three statuses that make one, each only
  for the commit state it names. Verify that it contains no implementation detail.
- [ ] 4.3 Write ADR-NODE-007 recording Decisions 1 to 5 and their rejected alternatives. It cites the #913 decision
  record as its source, and is accepted when this change merges. Add a one-line pointer to #896 and ADR-NODE-007 on
  ADR-NODE-005's #869 known limit.
- [ ] 4.4 Add a `freezeRecord.amendments` entry to the Node binding's `compatibility.json` naming the two literals,
  with unchanged counts. Verify that the earlier amendments are byte-identical.

## 5. Integration checks

- [ ] 5.1 Verify that `npm run validate --prefix packages/security-audit-sdk-node` passes, with `test:exports` at
  19 value and 44 type-only exports, and that `git diff --check` is clean.
- [ ] 5.2 Run `make governance-gates`, then the post-commit governance battery (`--phase final`, the dual check, the
  governance tests). Verify that every step passes.
- [ ] 5.3 Run `/code-review xhigh` on the implementation range. Verify that no correctness finding is left open,
  and that the PR body discloses its authorship and that independent review was `NOT_PERFORMED`.

## 6. Assessment ordering record

- [ ] 6.1 After the implementation commits, record in `assessment.source.json`'s `ordering` and regenerate:
  - `assessment_commit`, the proposal commit from 1.3;
  - `earliest_governed_implementation_commit`, found by walking the history forward from the proposal baseline;
  - `final_technical_commit`.

  Verify that the commit changes only `ordering` in the two assessment files, and that `--phase final` passes. Then,
  in disposable copies, verify two controls:
  - recording the earliest implementation commit as `assessment_commit` fails
    `assessment-shares-implementation-commit`;
  - recording a later commit that touches no governed path, such as this record's own commit, fails
    `assessment-follows-implementation`.

  If a technical commit lands after this record, for example a review or CI fix, record the ordering again before
  the merge.

## 7. Merge, fold and archive

- [ ] 7.1 Verify that every required context plus DeepScan is green on the implementation PR head.
- [ ] 7.2 Merge the implementation PR as a merge commit. Verify by recording the merge commit here.
- [ ] 7.3 In a separate fold PR, fold the delta into the canonical spec while the change is still active. Verify
  that each scenario heading occurs once in the requirement, and that no delta header survives.
- [ ] 7.4 In a separate archive PR, merged with a merge commit after the fold lands, archive the change. Verify
  that the archived directory carries the UTC date of the archive. The owner then closes the issue by hand.
