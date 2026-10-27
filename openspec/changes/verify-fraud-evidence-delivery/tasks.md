## Sequencing and authorization

Each probe ticket is its own PR: a build commit, then an evidence commit after its S1 approval. Probes run in the
order #836 → #837 → #838 → #839 → #840 → #842 → #841.
- **Merging is not a run approval.** Merging the proposal (#835) authorizes no run.
- **Per run.** Each run needs its own exact-head S1 approval (G44) and honours the S2 stop conditions in
  `proposal.md`, within the shared G42 limits.
- **Later work.** The verdict (#843) and the profile (#844) follow the probes. The fold (#845) is not planned,
  because the change carries no spec deltas. The archive (#846) is a separate later PR.

## 1. Proposal (#835)

- [x] 1.1 Author the proposal, design, tasks and assessment:
  - the seam, the four observation boundaries and the reference composition;
  - the harness architecture and the G4 predicates;
  - the expectations format and the run authorization;
  - G41–G45 verbatim, and the glossary terms in `docs/fraud-evidence/CONTEXT.md`.

  Declare no spec deltas (`skip_specs`).
- [x] 1.2 Run strict validation, assessment-phase governance and contract reuse (approved skip) before the
  proposal commit.

## 2. Tracer bullet (#836)

- [x] 2.1 Build the shared harness:
  - the kit pipeline, provenance, the loopback guard, the injected clock and timers, the fault injector;
  - the ingress around the kit collector with SQLite storage;
  - the accounting identity, its planted-defect and null controls, and the tracer's frozen expectations.

  Check every symbol against the packed declarations without importing the kit.
- [x] 2.2 Under its own S1, run one synthetic occurrence through the reference composition into the collector over
  loopback. Commit the provenance-tagged result, the ledger row and the scratch-deletion proof.

## 3. Outages, delivery retries and loss accounting (#837)

- [x] 3.1 Build and freeze the fault plans:
  - 503, 429 and 408;
  - timeouts and transport failures;
  - permanent 4xx;
  - malformed acknowledgments;
  - a lost acknowledgment.
- [x] 3.2 Under its own S1, record every retry, exhaustion and terminal bucket against the expectations.

## 4. Saturation, shutdown and `best_effort` loss (#838)

- [x] 4.1 Build and freeze the overload, strict mid-burst deadline-bounded shutdown, combined pending-retry/saturation/unpersisted-abandonment and `best_effort` loss plans. Verify per-occurrence callback ordering and drop identity, runtime pre-traffic accounting controls, confirmed final quiescence, cleanup failures, the bounded Codex lane and the 1,456-call cap with focused fixture tests.
- [x] 4.2 Under its own S1, record overload rejections with depth and capacity, the shutdown report, and the loss
  counter and ceiling signals.

  Run 3 recorded 46 SDK calls. L-04, L-07 and L-10 expose the strict timing failure (#890); L-11 exposes the harness's storage-result discriminator defect (#889). Six volume cases remain unexecuted. This task records the evidence; #838's unmet acceptance criteria remain open.

- [x] 4.3 Correct the public storage-absence discriminator and its runtime/fixture controls (#889); verify absent, found and uncertain outcomes without changing frozen expectations or run 3.
- [x] 4.4 Prevent scratch deletion after unconfirmed role closure (#891); verify failed-close and confirmed-close controls, original S2 classification and partial observations across the finalization seam.
- [x] 4.5 Implement the composition shutdown budget remedy (#890, #838):
  - Split the 200 ms shutdown budget into a 180 ms primitive drain budget and a 20 ms report reserve for `abandon` and `retry_shutdown` while keeping the outer complete-report deadline strictly 200 ms.
  - Freeze these parameters in `load.v2.json`; keep `load.v1.json`, its hash, approved source, and run-3 output unchanged.
  - Replace hardcoded v1 selection in the harness runner with explicit expectation path/version selection; reject unsupported versions and dynamic discovery.
  - Verify 180 ms inner versus 200 ms outer budget, zero-margin timing assertions (200.000 ms passes, 200.001 ms fails), budget validations before approval consumption, and suppression of volume pass on failed small pass.

## 5. Copies, duplicates, conflicts and restarts (#839)

- [ ] 5.1 Build and freeze:
  - the byte-identity checks at the exchange and the ingress;
  - the attempt-ordinal check;
  - the duplicate and conflict cases;
  - re-execution;
  - the callback-timed collector restart;
  - the storage-less bound phase.
- [ ] 5.2 Under its own S1, record the collector outcomes and durable identity across the restart.

## 6. Account-takeover chain reconstruction (#840)

- [ ] 6.1 Build the seeded ground-truth chain workload and the rule-free reconstruction step. Freeze the chains,
  including chains that share a source address.
- [ ] 6.2 Under its own S1, compare the reconstructed chains with ground truth (criterion 3).

## 7. Host-outbox relaying (#842)

- [ ] 7.1 Build the harness-local `node:sqlite` outbox with a transaction-bound sink, the relay through the
  composition, and the rollback and relay crash-and-restart phases.
- [ ] 7.2 Under its own S1, record that a rollback relays nothing and a commit relays at least once, with
  deduplication by event ID and transaction ID.

## 8. Per-source counts, throughput and latency (#841)

- [ ] 8.1 Build the at-volume per-source count comparison under every earlier fault plan, and the labelled
  throughput and latency recorder.
- [ ] 8.2 Under its own S1 approvals, run at least three times. Record per-source counts against ground truth
  (criterion 4) and the run-to-run spread.

## 9. Stage 2 verdict and system ADR 0015 (#843)

- [ ] 9.1 Record criteria 3, 4 (per source) and 5 with their evidence and fix owners, and answer G4 by its four
  predicates. If G4 fails, state the requirement for a separate Node-binding change. Seek the owner's approval
  against a named head.

## 10. Consumer integration profile (#844)

- [ ] 10.1 Rewrite the profile's demonstrated versus host-composed delivery-guarantees table from the measurements.

## 11. Verification

- [ ] 11.1 On each PR head, run:
  - strict validation;
  - assessment- and final-phase governance;
  - the dual check;
  - contract reuse;
  - the Git-state, generated and changed-path gates;
  - `make test`;
  - the CodeScene delta;
  - `node --test` on the harness tests.

  Verify every required CI context plus DeepScan.
- [ ] 11.2 Before declaring Stage 2 complete, verify:
  - each run's kit identity equals its approved head;
  - expectations hashes are unchanged;
  - the ledger stays within the G42 limits;
  - scratch is deleted.

## 12. Fold (#845)

- [ ] 12.1 Close #845 as not planned, citing this change's no-delta declaration, after #843 and #844 merge.

## 13. Archive (#846)

- [ ] 13.1 In a separate later PR, archive the completed change, after the verdict and the profile land.
