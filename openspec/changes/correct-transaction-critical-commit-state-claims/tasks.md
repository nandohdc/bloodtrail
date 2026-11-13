# Tasks: Correct transaction-critical commit-state claims (#913)

## 1. Proposal

- [x] 1.1 Author the proposal, design, delta spec (`security-audit-sdk-node`) and tasks from the #913 decision record.
  Verify that `openspec validate correct-transaction-critical-commit-state-claims --strict` passes.
- [x] 1.2 Author `assessment.source.json`, then generate `assessment.json` from it. Verify that
  `node openspec/scripts/generate-assessment.mjs --change correct-transaction-critical-commit-state-claims --check`
  and
  `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change correct-transaction-critical-commit-state-claims`
  both pass, and that the proposal commit changes no path outside this change's directory.
- [x] 1.3 Once every required context plus DeepScan is green, merge the proposal PR as a merge commit. Verify by
  recording the proposal commit and the merge commit here. Merged: #944, proposal commit `520f70e`, merge commit
  `e729cbc`, with all ten required contexts and DeepScan green.

## 2. Tests that expose the defects

- [x] 2.1 Add tests to the transaction-critical claims tests, run through the public binding with the contract's
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

  Failed on the unchanged binding at `e729cbc`, 18 of 136 tests in the two files:
  - each unlisted or absent commit state, and `compensated` for `account.registration.completed`, reported a durable
    status after one gate run;
  - the corrected pair's first delivery was not refused;
  - a change during the probe or the gate reached the handed-off body, and one during the exchange reached the
    status and `event_id`;
  - the caller's own object was handed off;
  - the BigInt, the cycle, a throwing `toJSON` and a `toJSON` returning nothing each failed as
    `audit_durability_failed_after_commit` after the gate ran;
  - the throwing getter, `null` and `42` made `deliver()` reject.
- [x] 2.2 Add tests that pin behaviour the fix must keep:
  - a walk over every `transaction_critical` catalog entry asserts that each allowed commit state reaches its
    documented status and gate behaviour;
  - one delivery records the call order probe → gate → handoff;
  - a duplicate of a settled pair is reported `already_delivered` with zero further gate runs;
  - for each contract example delivered, the handed-off body equals `JSON.stringify` of the example.

  In the class conformance tests, change the `transaction_critical` arm's "delivered" predicate to "reached any
  durable status". Verify that these tests pass on the unchanged binding. They passed: the walk over 11 entries, the order,
  the repeat, byte identity for 11 examples, and both transports' conformance arms.

## 3. Runtime implementation

- [x] 3.1 In the `transaction_critical` binding:
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
- [x] 3.2 Verify that every test from group 2 passes. Then, in a disposable copy, verify that each fails against its
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

  All 253 runtime tests pass. In a disposable copy, with an unplanted null control green, each plant failed its
  named test:

  | Plant | Failing test |
  |---|---|
  | check removed, table defaulting to `committed_and_durable` | each unlisted commit state is refused |
  | union of every entry's list | a commit state another entry allows is refused |
  | `compensated` entry removed | the catalog walk for `data.sensitive_resource.modified` |
  | pipeline reading the caller's object | a change during the probe, the gate and the exchange |
  | serialization check removed | BigInt, cycle and both `toJSON` cases, and the throwing getter |
  | unguarded read of the snapshot | `null` is refused |
  | unguarded read of the caller's identifier | the throwing getter is refused |
  | top-level freeze only | frozen at every depth |
  | key reserved at the commit-state refusal | the corrected pair is delivered |
  | snapshot reordering keys | byte identity for every example |
  | gate before the probe | probe, gate, handoff in order |
  | settled check after the gate | a settled repeat runs nothing |
  | `failed_closed` for the class's own example | the conformance arm, both transports |
  | duplicate check before the occurrence refusals | a settled pair offered again with a disallowed state is refused |
  | template-literal key with a separator | an identifier that shadows `toString`, and `1` against `"1"` |

## 4. Records

- [x] 4.1 In the Node binding's README transaction-critical section:
  - add rows for `commit_state_not_allowed` and `occurrence_not_serializable`;
  - qualify the committed row to an occurrence whose commit state is `committed`;
  - state that the binding delivers and reports one snapshot taken when `deliver()` is called.

  In the migration section, add the #913 entries, the two codes and the refusals that replace a claim or a failure
  after the commit, and a #869 warning: an equality check on `committed_and_durable` no longer matches a
  `partially_committed` or `compensated` occurrence. Verify that no row still implies that the commit state is
  unchecked.
- [x] 4.2 Rewrite the `CONTEXT.md` entry "Commit claim" so that it names the three statuses that make one, each only
  for the commit state it names. Verify that it contains no implementation detail.
- [x] 4.3 Write ADR-NODE-007 recording Decisions 1 to 5 and their rejected alternatives. It cites the #913 decision
  record as its source, and is accepted when this change merges. Add a one-line pointer to #896 and ADR-NODE-007 on
  ADR-NODE-005's #869 known limit.
- [x] 4.4 Add a `freezeRecord.amendments` entry to the Node binding's `compatibility.json` naming the two literals,
  with unchanged counts. Verify that the earlier amendments are byte-identical.

## 5. Integration checks

- [x] 5.1 Verify that `npm run validate --prefix packages/security-audit-sdk-node` passes, with `test:exports` at
  19 value and 44 type-only exports, and that `git diff --check` is clean.
- [x] 5.2 Run `make governance-gates`, then the post-commit governance battery (`--phase final`, the dual check, the
  governance tests). Verify that every step passes.
  `make governance-gates` passed on `ae29cbe` before the merge, and again on `main` at `3f88b28`, which holds the
  merged implementation and the policy from #948. It was not run on the PR head `3808300` itself. The final phase,
  the dual check and the governance tests (374 of 374) passed on the record commit that 6.1 names.
- [x] 5.3 Run `/code-review xhigh` on the implementation range. Verify that no correctness finding is left open,
  and that the PR body discloses its authorship and that independent review was `NOT_PERFORMED`.
  Run on the implementation range before the merge: 8 findings, 5 fixed in `b98537c` and `3808300`, 3 skipped. None
  of the skipped ones is an open correctness defect: this ordering record, which 6.1 now makes; a non-string
  `event_id` kept as Decision 2 specifies; and a defensive branch the public API cannot reach. #946's body discloses
  both.

## 6. Assessment ordering record

- [x] 6.1 After the implementation commits, record in `assessment.source.json`'s `ordering` and regenerate:
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

  Recorded in the commit titled `docs(openspec): record assessment ordering for
  correct-transaction-critical-commit-state-claims (#913)`, called the record commit below. Its hash is not written
  here, because a rebase before the merge changes it. It was made after the merge and not before it as Decision 7
  planned. Until the policy listed the
  generator's source as a planning artifact (#948, `3f88b28`), the record failed
  `assessment-shares-implementation-commit`. The values:
  - `assessment_commit` `520f70e`. A later planning commit, `5516039`, amended the assessment before any
    implementation: it added one owned path. It also precedes the earliest implementation commit;
  - `earliest_governed_implementation_commit` `ae29cbe`, returned by `findEarliestGovernedImplementationCommit`
    walking forward from the proposal baseline `1a365e7`;
  - `final_technical_commit` `b98537c`, the last commit that changes a governed implementation path. The PR head
    `3808300` changes planning text only.

  The record commit changes only `ordering` in the two assessment files. The checker passes in the final phase from
  the record's base on `main` and in the assessment phase, and the dual check passes. In disposable clones of the
  record commit:
  - with `ae29cbe` as `assessment_commit`, both phases fail `assessment-shares-implementation-commit`;
  - with the record commit itself as `assessment_commit`, both phases fail `assessment-follows-implementation`;
  - the record as committed passes.

  The checker still takes these recorded commits as given (#943).

## 7. Merge, fold and archive

- [x] 7.1 Verify that every required context plus DeepScan is green on the implementation PR head. On #946's head
  `3808300`, all ten required contexts and DeepScan were green.
- [x] 7.2 Merge the implementation PR as a merge commit. Verify by recording the merge commit here. Merged by the
  owner: #946, merge commit `a163946`, on 2026-11-11, before 5.2, 5.3 and 6.1 were recorded.
- [x] 7.3 In a separate fold PR, fold the delta into the canonical spec while the change is still active. Verify
  that each scenario heading occurs once in the requirement, and that no delta header survives.
  Folded after the ordering record merged (#950, `ff174f5`). The delta has one MODIFIED requirement, so the fold is an
  amendment: the canonical diff is 60 insertions and 3 deletions. The canonical requirement is byte-identical to the
  delta's, has 16 scenarios with no duplicate heading, and occurs once among the spec's 33 requirements. No delta
  header survives. The canonical file is byte-identical to what `openspec archive` produces from `ff174f5` in a
  disposable copy, and archiving the folded tree again does not change it.
- [ ] 7.4 In a separate archive PR, merged with a merge commit after the fold lands, archive the change. Verify
  that the archived directory carries the UTC date of the archive. The owner then closes the issue by hand.
