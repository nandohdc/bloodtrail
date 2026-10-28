# Bloodtrail: implementation and closure plan for all 19 issues

## 1. Objective and baseline

Resolve every actionable issue through implementation, verification, evidence delivery, and governed closure. Preserve #817’s explicit deferral to a future contract major.

Start from verified live `main`; the investigated baseline is `7eede0ef772d7571dcaa973435caee7bac0d70b5`. Refresh issue, PR, authorization, and branch state before execution.

Use interchangeable authoring tools, independent review bound to the final commit, and separate owner authority where required. Production collection, publication, release #672, and real-user processing remain outside this program.

## 2. Delivery sequence

### A. Reconcile work already delivered

| Issues | Required action | Completion condition |
|---|---|---|
| #889, #891 | Verify the merged storage-discriminator and conditional-cleanup corrections against acceptance criteria. Publish concise acceptance records. | Close after confirming the corrections and their regression evidence; preserve run 3 unchanged. |
| #877 | Record the owner’s acceptance of delivered CI behavior and disposition of the historical review gap. | Close while retaining the unchecked historical sequencing task and its explanation. |
| #830 | Publish a supersession record mapping valid requirements to Stage P, Stage 2, G33, and delivery follow-ups. | Close as superseded/not planned; preserve historical reports. |
| #817 | Retain its future-major classification and existing scope decisions. | Remains open and explicitly deferred; no 2.x implementation. |

The #889/#891 implementation is already merged through [#892](https://github.com/nandohdc/bloodtrail/pull/892). #877’s implementation, canonical fold, and archive are also delivered; [#895](https://github.com/nandohdc/bloodtrail/pull/895) preserves the unresolved historical sequence.

### B. Correct transaction-critical results — #869

Create a separate governed Node change.

- Retain commit-gate execution for `partially_committed` and `compensated`.
- After acknowledged durability, return `partially_committed_and_durable` or `compensated_and_durable`, respectively.
- Retain existing failure outcomes and committed/not-committed behavior.
- Treat both new durable outcomes as settled successes for pair-based deduplication.
- Preserve synchronous reservation of `(event.id, transactionId)` before asynchronous work.
- Amend the frozen result union, canonical requirements, compatibility record, ADR, and consumer migration guidance.
- Follow the established union-widening precedent without moving the private package version or adding Node exports.

Complete implementation, review, fold, and archive before closing #869.

### C. Remedy and remeasure shutdown behavior — #890 → #838

Attribute the observed failure precisely: distinguish the primitive’s timer/report work from reference-composition bookkeeping. Do not characterize the record as proving a collector defect or an exclusively package-owned defect.

Implement the prospective composition remedy:

- Keep the complete-report deadline at **200 ms**.
- Use a **180 ms primitive drain budget and 20 ms report reserve** for `abandon` and `retry_shutdown`.
- Preserve the existing explicitly configured budgets for other phases.
- Freeze these parameters in `load.v2.json`; retain v1, its hash, approved source, and run-3 output unchanged.
- Replace hardcoded v1 selection with an explicit approved expectation path/version. Reject unsupported versions; never discover “latest” dynamically.
- Include occurrence reconciliation, bookkeeping, and the final report inside the outer timing measurement.

This uses the existing shutdown API. It is a measured mitigation: Node provides no exact timer-callback guarantee. Every complete report exceeding 200 ms still fails. [Node timer documentation](https://nodejs.org/api/timers.html#settimeoutcallback-delay-args)

Deliver the build separately from its execution evidence. After fresh exact-head S1 approval, execute one prospective #838 measurement. Close #890 after its attribution/remediation requirements are met; close #838 only when its acceptance criteria are demonstrated.

If the new measurement fails, preserve and publish it, keep unmet criteria open, and stop the serial measurement sequence pending explicit owner disposition.

### D. Complete the remaining Stage 2 probes

Keep this execution order:

`#838 → #839 → #840 → #842 → #841`

| Issue | Implementation and acceptance |
|---|---|
| #839 | Verify send/receive byte identity, sender-only attempt ordinals, duplicate acknowledgment without readmission, changed-content conflicts, new-occurrence identity, callback-triggered restarts, durable deduplication, and the deliberate storage-less capacity phase. |
| #840 | Generate frozen synthetic chain ground truth; reconstruct from persisted occurrence fields and event time. Keep shared-source accounts separate, use opaque account IDs and keyed session fingerprints, and leave failed logins anonymous and untargeted. |
| #842 | Implement the harness-local SQLite transaction-bound sink and relay. Demonstrate rollback, committed-record delivery, crash/restart recovery, acknowledgment-before-relayed ordering, and downstream deduplication. |
| #841 | Exercise the frozen earlier fault plans at volume. Reconcile persisted and reported-undelivered counts per source, exclude duplicate inflation, and record latency/throughput spread over three runs. Do not attempt per-target counts. |

Each probe receives planted-defect/null controls, frozen expectations, a reviewed build, its own exact-head approval, and a separate evidence delivery.

The intended allocation is:

| Run | Measurement |
|---|---|
| 4 | #838 v2 |
| 5 | #839 |
| 6 | #840 |
| 7 | #842 |
| 8–10 | #841 |

This reaches **10/12 total runs**, leaving two unallocated slots. The existing window ends **2026-11-06T13:18:26Z**; spare capacity does not authorize automatic retries. The standing [G41–G45 decisions](https://github.com/nandohdc/bloodtrail/issues/795#issuecomment-6346915049) continue to govern execution limits.

### E. Resolve recovery and finish Stage 2

- **#870:** after #842, deliver a governed documentation/specification resolution using host-owned outbox recovery. Explicitly distinguish confirmed commit from unknown commit. Require host reconciliation after `business_commit_unconfirmed`; explain why calling `deliver()` again is not a durability-only retry. Add no new recovery API.
- **#843:** write ADR 0015 with criterion-by-criterion results, original and remediated observations, fix ownership, and an explicit G4 assessment. Any remaining failure produces a separately governed Node-binding requirement. Obtain owner approval against the exact ADR head.
- **#844:** update the profile and glossary using demonstrated measurements. Identify host-composed guarantees and storage requirements; derive no service levels.
- **#845:** after #843/#844 land, close as not planned, citing the existing `skip_specs` declaration.
- **#846:** archive in a separate UTC-dated PR, preserving source and evidence bytes and using a merge commit.
- **#833:** prepare the complete acceptance reconciliation for owner-controlled parent closure.

### F. Complete normative prerequisites before G33

Run this as a separate governance workstream; preparation may proceed alongside Stage 2.

1. Re-freeze the prospective sequential-authorization replay against current trusted `main`, including exact paths, controls, mutation obligations, and integration topology.
2. Obtain fresh exact-content owner review and signed operation-specific implementation authority.
3. Replay the removed mechanism while preserving T3 ancestry and signed history. Do not reset to the historical T3 topology or treat restoration authority as replay authority.
4. Verify the replay, complete exact-current technical review, and obtain the required integration/merge authority.
5. Establish the normative change’s verified state through supported lifecycle transitions.
6. Produce an isolated deterministic fold preview; obtain distinct FOLD authority; fold the three active deltas and recompute applicability, overlap, and pins.
7. Obtain folded-content review and separate activation authority; validate the dedicated activation record.
8. Complete separate archival.

The [restoration closeout](https://github.com/nandohdc/bloodtrail/issues/544#issuecomment-5767426954) supplies historical evidence, not authority for these prospective operations.

## 3. G33 implementation — #863

Begin contract mutation only after the normative prerequisite and the current Stage 2 evidence lifecycle finish.

### Contract and SDK surface

Introduce contract **2.2.0** with an optional top-level `presented_identifier` claim on `authentication.failed` and `authentication.succeeded`.

Use one closed object containing:

- `reference`: canonical unpadded base64url encoding of the full 32-byte HMAC-SHA-256 result.
- `scope_id` and `key_id`: bounded opaque nonsecret scope and epoch identifiers.
- Fixed `client_claim` provenance, using existing bounded provenance conventions.

The host computes the reference using a versioned, unambiguous UTF-8 JSON-array input containing the domain tag, authentication purpose, tenant/platform scope, login surface, identifier kind, canonicalization version, key epoch, and canonical identifier.

Keys, raw identifiers, and canonicalization logic remain outside Core. Known and unknown first-factor identifiers follow the same computation and presence policy. Identifierless flows omit the whole object; MFA/lockout may include it only when an actual presented identifier is available. Reset and registration remain deferred.

Add a dedicated branded Core constructor/type. Integrate it into generated inputs, frame validation, atomic context merging, event assembly, and public exports. Reject forged contexts and use on unrelated events. Preserve Node’s existing export set.

### Version compatibility

- Preserve the exact 2.1.0 structural validator and provenance before regeneration.
- Generate the 2.2.0 validator and an explicit collector version registry.
- Dispatch each supported version to its matching validator.
- Enforce allowed events, closed members, encoding, and fixed claim provenance structurally as well as in Core.
- Keep existing deduplication identity: changing version, reference, scope, or epoch under the same event identity remains a conflict.
- Preserve old stored bytes and readable 2.1.0 rows; no SQLite table migration is required.
- The updated SDK emits 2.2.0. Existing 2.1.0 outbox records continue through their original relay without upconversion.

Update canonical source, generators, all documented version pins, packaging checks, contract-reuse fixtures, and current documentation together. Verify a subsequent change against a baseline already containing 2.2.0.

Remeasure criterion 1 and per-target counts under a separate proposed authorization: **up to three runs, 5,000 SDK calls per run, seven days from first S1**. Preserve the original 2.1.0 verdict and evidence.

## 4. Verification and delivery controls

Every change starts with its owning OpenSpec assessment before implementation. Use small reviewable PRs, separate required fold/archive stages, and rebase onto current `main`.

Required focused coverage:

- **#869:** real contract fixtures; gate count/order; qualified success; failures; concurrent reservation; settled deduplication; unchanged occurrence bytes.
- **Shutdown:** 180 ms inner versus 200 ms outer budget; exactly 200 passes and 200.001 fails; invalid budgets fail before approval consumption; late completion cannot rewrite abandonment; failed small pass suppresses volume.
- **Stage 2:** each accounting, reconstruction, identity, and relay property has a failing planted control and passing null control.
- **G33:** deterministic HMAC vectors; scope/epoch separation; known/unknown non-disclosure; omitted identifierless claims; constructor forgery; prohibited-event misuse; mixed-version admission/storage; cross-version conflicts; restart deduplication; packed availability of both validators.

Run generated-drift checks before regeneration can mask drift, focused workspace validation, active harness fixtures, `make test`, full `make governance-gates`, strict relevant OpenSpec validation, baseline/candidate governance checks, contract reuse, and whitespace checks.

Cover all six declared workspaces and the client-envelope tests invoked by `make`. Distinguish pre-existing repository-wide validation failures from changed-scope results.

Require independent final-commit review, both build-review axes, all declared CI contexts, and DeepScan before merge. Missing independent review remains `NOT_PERFORMED`.

## 5. Completion criteria

The program completes when every actionable issue has its required implementation or agreed disposition, acceptance evidence, and completed lifecycle.

#817 remains explicitly deferred. Original failed measurements and historical procedural gaps remain visible. Any new S2 halt, expired authorization, or unmet acceptance condition follows its defined owner decision boundary.

Planning approval supplies no substitute for exact-content signatures, per-run S1 records, ADR approval, or reserved parent closure.
