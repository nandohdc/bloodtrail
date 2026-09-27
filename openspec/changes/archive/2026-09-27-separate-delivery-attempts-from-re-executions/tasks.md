# Tasks

This change fixes #577. The proposal and the implementation are separate commits. The fold (6.1) and the
archive (7.1) are separate pull requests, and their tasks stay unticked until those land.

## 1. Proposal

- [x] 1.1 Propose this change with its three capability deltas and exact owned paths. Verify:
  - `openspec validate separate-delivery-attempts-from-re-executions --strict` passes;
  - the design-pattern assessment phase passes for this change;
  - over the proposal range, the governance final phase and normative precedence at the merge stage both
    pass.

  Approving this change is the owner's act, not a task: an approval comment that names this change and
  the head SHA, then the owner's own merge.

## 2. Vocabulary and decision record

- [x] 2.1 Add a glossary for the Node binding and one for the collector, and register both in
  `CONTEXT-MAP.md` with their relationship. Verify:
  - every term matches the delta specs' vocabulary;
  - no term is defined in two contexts;
  - the new files pass the repository's whitespace and final-newline rules.
- [x] 2.2 Add a system-wide ADR recording that delivery attempts never enter the canonical event, with the
  rejected alternatives. Verify that it cites the contract evidence on both sides and refers to #577.

## 3. Node binding: the handoff sends the occurrence unchanged

- [x] 3.1 Write the failing test at the Node delivery seam: the bounded retry composed over the real
  handoff, with a recording exchange. Verify that it fails against the current projection. It asserts:
  - every attempt's body equals the canonical serialization of the supplied occurrence;
  - every body passes the SDK's complete-event validation;
  - a re-execution keeps retry attempt `2` on every attempt;
  - the attempt ordinals stay observable through the descriptors, the results and `onAttemptScheduled`.
- [x] 3.2 Make the handoff serialize the occurrence as supplied, and restate the attempt-ceiling comments
  in the handoff and the retry. Verify:
  - 3.1 passes;
  - the handoff tests assert the ordinal outside the occurrence;
  - the export check passes with no edit to its frozen lists;
  - every emitted declaration file is byte-identical to the one built from `main`.
- [x] 3.3 Add a mutation check for the handoff, run on disposable clones of the built package. Verify:
  - a mutant that writes the ordinal into `correlation.retry_attempt` is killed;
  - a mutant that rewrites another correlation field is killed;
  - the run asserts the number of mutants applied.
- [x] 3.4 Remove the known issue for #577 and correct the README's retry description. Verify:
  - the evaluation-kit gate passes;
  - no Node document says the ordinal travels in `correlation.retry_attempt`.

## 4. Collector: duplicates are decided over the whole submission

- [x] 4.1 Change the ingress and storage tests. Verify that they fail against the current key:
  - a same-identity body that differs only in `correlation.retry_attempt` is a conflict;
  - its storage-backed counterpart is a storage conflict;
  - a re-execution with a new event ID is admitted as its own occurrence.
- [x] 4.2 Drop the exclusion from the canonical deduplication key, and restate the storage record's key
  comment. Verify:
  - 4.1 passes with the rest of the collector suite;
  - `npm run validate --prefix packages/security-audit-collector` passes.

## 5. Verification

- [x] 5.1 Verify the whole implementation. The following must all pass:
  - `make` across every declared workspace;
  - the governance final phase over the implementation range;
  - normative precedence at the merge stage;
  - `codescene delta` on the changed files.

## 6. Fold

- [x] 6.1 Fold the three deltas into the canonical specs while this change is still active. Add one new
  `CURRENT` pin set recomputed for the folded state, and leave every existing pin set byte-identical.
  Verify:
  - each requirement and scenario heading appears exactly once;
  - no delta header survives, and the removed requirements are gone;
  - a scratch-copy archive reports the specs already in sync;
  - normative precedence passes at the candidate and merge stages, selects the new pin set, and reports
    no `fold-pin-set-*` diagnostic.

## 7. Archive

- [x] 7.1 Archive this change in its own pull request, cut from `main` after the fold merges and merged as
  a merge commit. Verify:
  - the local archive dry run passes;
  - both sides of the move are staged;
  - the pull request carries no canonical write.
