# Tasks: Document durability-only redelivery for transaction-critical delivery (#870)

## 1. Proposal

- [x] 1.1 Author the proposal, design, delta specs (`security-audit-sdk-node`, `fraud-evidence-profile`) and tasks
  from the #870 decision record. Verify that `openspec validate document-transaction-critical-redelivery --strict`
  passes.
- [x] 1.2 Author `assessment.source.json`, then generate `assessment.json` from it. Verify that
  `node openspec/scripts/generate-assessment.mjs --change document-transaction-critical-redelivery --check` and
  `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change document-transaction-critical-redelivery`
  both pass.
- [x] 1.3 Once every required context plus DeepScan is green, merge the proposal PR as a merge commit. Verify by
  recording the merge commit here. Merged: #939, head `c493b17`, merge commit `b4481e6`, with all ten required
  contexts and DeepScan green.

## 2. Pin the binding's redelivery behaviour

- [x] 2.1 Add tests to the transaction-critical claims tests, run through the public binding with the contract's
  example events:
  - **(A)** after `audit_durability_failed_after_commit`, a second `deliver()` with a gate that commits on every
    call reports `committed_and_durable`, and the gate has run twice;
  - **(B)** with a gate that rejects once, the results are `business_commit_unconfirmed` then
    `committed_and_durable`, and the gate has run twice.

  Verify that `npm test --prefix packages/security-audit-sdk-node` passes. Then, in a disposable copy, verify that
  both tests fail against a planted defect: a binding that skips the commit gate for any pair whose earlier
  attempt ran it, whatever that attempt's result. A plant that skips only pairs whose gate committed would leave
  B passing.
- [x] 2.2 In the Node binding's README, add a subsection "Redelivering after a failure following the commit" to the
  transaction-critical section. It must distinguish a confirmed commit (`audit_durability_failed_after_commit`) from
  an unknown one (`business_commit_unconfirmed`), and state that `deliver()` runs the durability probe and the
  commit gate again. Verify that the sentence which only pointed at #870 is gone.

## 3. Document the reconciling commit gate route

- [x] 3.1 Add tests through the public binding:
  - **(C)** after `audit_durability_failed_after_commit`, a reconciling gate leads to `committed_and_durable` with
    one business commit and two handoff attempts;
  - two occurrences sharing one transaction identifier, delivered with a reconciling gate, are both durable with
    one business commit.

  Verify that the tests pass. Then, in a disposable copy, verify that each fails against a planted binding
  defect:
  - C fails against a binding that records a pair which failed after the commit as delivered, so the second call
    reports `already_delivered`;
  - the shared-transaction test fails against a binding that deduplicates on the transaction identifier alone.

  Changing the test's own gate is not a control.
- [x] 3.2 Extend the README subsection with the reconciling-gate contract:
  - the host builds it for one transaction identifier on each delivery, because the binding passes the gate no
    arguments, so a single gate shared across transactions cannot reconcile;
  - it returns `committed` only for a change it confirms committed;
  - it returns `declined` for a change that has not committed and will not be;
  - it rejects when it cannot tell.

  Also state the host's redelivery bound and alert, and crash recovery through the host's own durable record (G5).
  Verify that the subsection matches the ADDED `fraud-evidence-profile` requirement.
- [x] 3.3 Update the consumer integration profile's "Persistence" bullet with the in-process redelivery route, and
  state that crash recovery stays with the host. Verify that it cites #870 and does not claim persistence in the
  binding.
- [x] 3.4 Add "Reconciling commit gate" to the Node binding's `CONTEXT.md`, under Delivery, with the avoid-list
  *idempotent gate*, *retry-safe gate*. Verify that it contains no implementation detail.
- [x] 3.5 Write ADR-NODE-006 recording Decision 1 and its rejected alternatives, citing the #870 decision record as
  its source, and accepted when this change merges. Add a one-line pointer to it on ADR-NODE-005's #870 known
  limit. Verify that ADR 0015 is unchanged.

## 4. Integration checks

- [x] 4.1 Verify that `npm run validate --prefix packages/security-audit-sdk-node` passes, with `test:exports` at
  19 value and 44 type-only exports.
- [x] 4.2 Verify that `git diff --exit-code origin/main...HEAD -- packages/security-audit-sdk-node/src packages/security-audit-sdk-node/compatibility.json`
  is empty, measured from the merge base so that later changes on `main` do not count, and that `git diff --check`
  is clean.
- [x] 4.3 Run `make governance-gates`, then the post-commit governance battery (`--phase final`, the dual check, the
  governance tests). Verify that every step passes.
- [x] 4.4 Run `/code-review xhigh` on the implementation range. Verify that no correctness finding is left open,
  and that the PR body discloses its authorship and that independent review was `NOT_PERFORMED`.

## 5. Merge, fold and archive

- [x] 5.1 Verify that every required context plus DeepScan is green on the implementation PR head. Green: #940, head
  `d487f9d`, with all ten required contexts and DeepScan.
- [x] 5.2 Merge the implementation PR as a merge commit. Verify by recording the merge commit here. Merged: #940,
  merge commit `be1ebd6`.
- [x] 5.3 In a separate fold PR, fold both deltas into the canonical specs while the change is still active. Verify
  that each requirement and scenario heading occurs exactly once and that no delta header survives. Folded: each
  of the deltas' 15 headings occurs once in its canonical spec, and no delta header survives. Both canonical files
  match `openspec archive` from `be1ebd6` byte for byte. The sdk-node spec's repeated heading "A redirect is never
  followed" sits under two other requirements and predates the fold.
- [ ] 5.4 In a separate archive PR, merged with a merge commit after the fold lands, archive the change, then close
  #870 by hand. Verify that the archived directory carries the UTC date of the archive.
