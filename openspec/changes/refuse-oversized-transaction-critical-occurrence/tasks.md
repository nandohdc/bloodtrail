# Tasks: Refuse an oversized transaction-critical occurrence before the commit

## 1. Proposal

- [x] 1.1 Author the proposal, design, delta spec (`security-audit-sdk-node`) and tasks from the #945 decision record.
  Verify that `openspec validate refuse-oversized-transaction-critical-occurrence --strict` passes.
- [x] 1.2 Author `assessment.source.json`, then generate `assessment.json` from it. Verify that
  `node openspec/scripts/generate-assessment.mjs --change refuse-oversized-transaction-critical-occurrence --check`
  and
  `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change refuse-oversized-transaction-critical-occurrence`
  both pass, and that the proposal commit changes no path outside this change's directory.
- [x] 1.3 Once every required context plus DeepScan is green, merge the proposal PR as a merge commit. Verify by
  recording the proposal commit and the merge commit here. Merged: #953, proposal commit `5829957`, merge commit
  `893ea04`, with all ten required contexts and DeepScan green.

## 2. Tests that expose the defect

- [x] 2.1 Add tests to the transaction-critical claims tests, run through the public binding with the contract's
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

  Added, with two more that the delta's fourth scenario calls for: an oversized occurrence whose commit state its
  entry does not allow is refused as too large, and an oversized occurrence with no JSON serialization is still
  refused as `occurrence_not_serializable`. On the unchanged binding, 9 of these tests fail: every one that expects
  `occurrence_too_large`. The tests in 2.2 and the not-serializable one pass there.

  Two more followed from the review: an oversized occurrence delivered with an empty transaction identifier, and an
  in-flight pair offered again oversized. Both fail on the unchanged binding too, which makes 11 failing there.
- [x] 2.2 Add tests that pin behaviour the fix must keep:
  - an occurrence of exactly the contract's limit is delivered, with one probe, one gate run and one exchange, and
    the exchanged body is that many bytes;
  - the handoff, called directly, returns `request_too_large` for a body one byte over the contract's limit and
    makes an exchange for a body exactly at it. The existing handoff test takes its size from the contract too.

  These pass on the unchanged binding. They import only the public entry.
  Done: the claims tests gain the at-the-limit delivery, and the handoff tests gain the exchange exactly at the
  limit. The handoff's existing over-the-limit test now builds its body from the contract's limit.

## 3. Runtime implementation

- [x] 3.1 In the Node binding:
  - in `http-handoff.ts`, rename the handoff's limit to `EVENT_MAX_BYTES` and export it from that module. Do not
    re-export it from the package entry;
  - in `transaction_critical` admission, measure the snapshot's serialization with the binding's byte count, right
    after the serialization check and before the parse and the freeze. Refuse it as `occurrence_too_large` when it
    is larger than the constant, reporting the identifier through the guarded read of the caller's object;
  - add `occurrence_too_large` to `DeliveryClassRefusalCode`, with a doc comment naming #945.

  Verify that `npm run typecheck` passes and that the scope gate reports no host coupling. If the null control's
  count of platform references changes, move its baseline in the same commit and say why.
  Done. The null control's count moved from 91 to 92 with no host coupling. The one new reference is
  `delivery-classes.ts` importing `./byte-length.js`. Measured in a disposable copy: that import alone moves the
  count to 92, and turning the existing `./http-handoff.js` type import into a value import leaves it at 91.
- [x] 3.2 Verify that every test from group 2 passes. Then, in a disposable copy, verify that each fails against its
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

  All 268 runtime tests pass. In a disposable copy, the unplanted null control passed 114 of 114 in the two test
  files, and each plant failed at least the test named here:

  | Plant | Failing test |
  |---|---|
  | the size check removed | every test that expects `occurrence_too_large` (11) |
  | the comparison refuses the limit itself | delivers an occurrence exactly at the limit |
  | the comparison allows one byte more | refuses an occurrence one byte over the limit |
  | the string's length in place of its byte count | counts UTF-8 bytes, not characters |
  | the check applied only when the gate runs | refuses an oversized `not_committed` occurrence |
  | the size check moved after the class check | refuses an oversized occurrence of another delivery class; an oversized string |
  | the key reserved before the size check | leaves the pair deliverable once the refused occurrence is made to fit |
  | the size check moved after the duplicate check | refuses a settled pair offered again oversized; an in-flight pair offered again oversized |
  | the size check moved after the transaction identifier check | refuses an oversized occurrence delivered with an empty transaction identifier |
  | the size check moved between the settled and the in-flight checks | refuses a settled pair offered again oversized |
  | the constant lowered by one | the at-the-limit tests, for admission and for the handoff |
  | the constant raised to 70,000 | the over-the-limit tests, for admission and for the handoff |
  | the handoff reading 70,000 | the handoff's over-the-limit test |
  | the handoff reading 60,000 | the at-the-limit tests, for admission and for the handoff |

## 4. Records

- [x] 4.1 In the Node binding's README transaction-critical section, add a row for `occurrence_too_large`. In its
  migration section, add the new code and say that an oversized occurrence is now refused before the commit gate
  where it used to fail after it. Verify that the row and the note agree with the MODIFIED requirement.
  Done. The lead-in list of refusals gains the size refusal in its place, and the note names the known limit.
- [x] 4.2 Write ADR-NODE-008 at
  `packages/security-audit-sdk-node/adr/008-oversized-occurrences-are-refused-before-the-commit.md`, the path the
  assessment owns. It records Decisions 1 to 5, their rejected alternatives and the two known limits from the
  design's Risks, and cites the #945 decision record. In ADR-NODE-007, add to the line that leaves the size case out of scope a pointer to ADR-NODE-008. Verify
  that no other line of ADR-NODE-007 changes.
  Done: ADR-NODE-007 gains one line under its out-of-scope bullet.
- [x] 4.3 Add a `freezeRecord.amendments` entry to the Node binding's `compatibility.json` naming the literal, the
  issue and ADR-NODE-008, with 19 value and 44 type-only exports. Verify that every earlier amendment is
  byte-identical and that `npm run test:compatibility` passes.
  Done: the diff to `compatibility.json` is 7 inserted lines and one comma, and `test:compatibility` passes.

## 5. Integration checks

- [x] 5.1 Verify that `npm run validate --prefix packages/security-audit-sdk-node` passes, with `test:exports` at
  19 value and 44 type-only exports, and that `git diff --check` is clean.
  Passed: 268 runtime tests, 19 value and 44 type-only exports, and a clean `git diff --check`.
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
