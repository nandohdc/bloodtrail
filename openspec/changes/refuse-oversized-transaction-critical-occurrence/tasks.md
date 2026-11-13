# Tasks: Refuse an oversized transaction-critical occurrence before the commit

## 1. Proposal

- [ ] 1.1 Author the proposal, design, delta spec (`security-audit-sdk-node`) and tasks from the #945 decision record.
  Verify that `openspec validate refuse-oversized-transaction-critical-occurrence --strict` passes.
- [ ] 1.2 Author `assessment.source.json`, then generate `assessment.json` from it. Verify that
  `node openspec/scripts/generate-assessment.mjs --change refuse-oversized-transaction-critical-occurrence --check`
  and
  `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change refuse-oversized-transaction-critical-occurrence`
  both pass, and that the proposal commit changes no path outside this change's directory.
- [ ] 1.3 Once every required context plus DeepScan is green, merge the proposal PR as a merge commit. Verify by
  recording the proposal commit and the merge commit here.

## 2. Tests that expose the defect

- [ ] 2.1 Add tests to the transaction-critical claims tests, run through the public binding with the contract's
  example events padded to an exact serialized size. Each test counts probe, gate and handoff calls:
  - an occurrence of 65,537 bytes, and one well over the limit, is refused as `occurrence_too_large` with zero
    probe, gate and handoff calls;
  - an occurrence with fewer characters than the limit but more UTF-8 bytes is refused the same way;
  - an oversized `not_committed` occurrence is refused the same way;
  - an oversized occurrence of the wrong delivery class is refused as `occurrence_too_large`, not as a class
    mismatch;
  - a refused oversized occurrence, corrected to fit and offered again under the same pair, is delivered;
  - a settled pair offered again oversized is refused as `occurrence_too_large`, not reported delivered;
  - an oversized string, which is not an occurrence object, is refused as `occurrence_too_large`.

  Every size comes from `bounds.event_max_bytes`, read from the contract source. No test names the number as a
  literal.

  Verify that each fails on the unchanged binding, and record the failures.
- [ ] 2.2 Add tests that pin behaviour the fix must keep:
  - an occurrence of exactly the contract's limit is delivered, with one probe, one gate run and one exchange, and
    the exchanged body is that many bytes;
  - the handoff, called directly, returns `request_too_large` for a body one byte over the contract's limit and
    makes an exchange for a body exactly at it. The existing handoff test takes its size from the contract too.

  These pass on the unchanged binding. They import only the public entry.

## 3. Runtime implementation

- [ ] 3.1 In the Node binding:
  - in `http-handoff.ts`, rename the handoff's limit to `EVENT_MAX_BYTES` and export it from that module. Do not
    re-export it from the package entry;
  - in `transaction_critical` admission, measure the snapshot's serialization with the binding's byte count, right
    after the serialization check and before the parse and the freeze. Refuse it as `occurrence_too_large` when it
    is larger than the constant, reporting the identifier through the guarded read of the caller's object;
  - add `occurrence_too_large` to `DeliveryClassRefusalCode`, with a doc comment naming #945.

  Verify that `npm run typecheck` passes and that the scope gate reports no host coupling. If the null control's
  count of platform references changes, move its baseline in the same commit and say why.
- [ ] 3.2 Verify that every test from group 2 passes. Then, in a disposable copy, verify that each fails against its
  planted defect, beside a null control that stays green:
  - the size check removed;
  - the comparison changed to refuse the limit itself;
  - the comparison changed to allow one byte more;
  - the string's length used in place of its byte count;
  - the check applied only when the commit gate runs;
  - the size check moved after the class check;
  - the key reserved before the size check;
  - the size check moved after the duplicate check;
  - the constant changed;
  - the handoff reading a literal that differs from the constant.

  Record each plant and its failing test.

## 4. Records

- [ ] 4.1 In the Node binding's README transaction-critical section, add a row for `occurrence_too_large`. In its
  migration section, add the new code and say that an oversized occurrence is now refused before the commit gate
  where it used to fail after it. Verify that the row and the note agree with the MODIFIED requirement.
- [ ] 4.2 Write ADR-NODE-008 at
  `packages/security-audit-sdk-node/adr/008-oversized-occurrences-are-refused-before-the-commit.md`, the path the
  assessment owns. It records Decisions 1 to 5, their rejected alternatives and the two known limits from the
  design's Risks, and cites the #945 decision record. In ADR-NODE-007, add to the line that leaves the size case out of scope a pointer to ADR-NODE-008. Verify
  that no other line of ADR-NODE-007 changes.
- [ ] 4.3 Add a `freezeRecord.amendments` entry to the Node binding's `compatibility.json` naming the literal, the
  issue and ADR-NODE-008, with 19 value and 44 type-only exports. Verify that every earlier amendment is
  byte-identical and that `npm run test:compatibility` passes.

## 5. Integration checks

- [ ] 5.1 Verify that `npm run validate --prefix packages/security-audit-sdk-node` passes, with `test:exports` at
  19 value and 44 type-only exports, and that `git diff --check` is clean.
- [ ] 5.2 Run `make governance-gates` on the implementation PR's final technical commit, then the post-commit
  governance battery (`--phase final`, the dual check, the governance tests). Verify that every step passes, and
  record the commit each ran on.
- [ ] 5.3 Run `/code-review xhigh` on the implementation range. Verify that no correctness finding is left open,
  and that the PR body discloses its authorship and that independent review was `NOT_PERFORMED`.

## 6. Assessment ordering record

- [ ] 6.1 After the implementation commits, and before the implementation PR merges, record in
  `assessment.source.json`'s `ordering` and regenerate:
  - `assessment_commit`, the proposal commit from 1.3;
  - `earliest_governed_implementation_commit`, found by walking the history forward from the proposal baseline;
  - `final_technical_commit`.

  Verify that the commit changes only `ordering` in the two assessment files, and that `--phase final` passes. Then,
  in disposable copies, verify two controls:
  - recording the earliest implementation commit as `assessment_commit` fails
    `assessment-shares-implementation-commit`;
  - recording the record's own commit as `assessment_commit` fails `assessment-follows-implementation`.

  If the branch is rebased, or a technical commit lands after this record, record the ordering again and run both
  controls again before the merge. Name branch commits here by their titles, not their hashes.

## 7. Merge, fold and archive

- [ ] 7.1 Verify that every required context plus DeepScan is green on the implementation PR head, and that the
  recorded ordering commits exist on that head.
- [ ] 7.2 Merge the implementation PR as a merge commit. Verify by recording the merge commit here.
- [ ] 7.3 In a separate fold PR, fold the delta into the canonical spec while the change is still active. Verify
  that each scenario heading occurs once in the requirement, that no delta header survives, and that the canonical
  file equals what `openspec archive` produces in a disposable copy.
- [ ] 7.4 In a separate archive PR, merged with a merge commit after the fold lands, archive the change. Verify
  that the archived directory carries the UTC date of the archive. The issue stays open for the owner.
