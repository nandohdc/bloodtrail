## Sequencing and authorization

Each probe ticket is its own PR: a build commit, then an evidence commit after its S1 approval. Probes run in the
order #836 → #837 → #838 → #839 → #840 → #842 → #841.
- **Merging is not a run approval.** Merging the proposal (#835) authorizes no run.
- **Per run.** Each run needs its own exact-head S1 approval (G44) and honours the S2 stop conditions in
  `proposal.md`, within the shared G42 limits as amended by G46.
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
- [x] 4.6 Under its delegated S1 (G44), execute Stage 2 load probe run 4 using frozen `load.v2.json`. Record 17/17 cases matched (all 11 small cases and all 6 volume cases, 1,456 SDK calls), with zero invalidations and confirmed scratch deletion. Fulfills #838 acceptance criteria.

## 5. Copies, duplicates, conflicts and restarts (#839)

- [x] 5.1 Build and freeze:
  - the byte-identity checks at the exchange and the ingress;
  - the attempt-ordinal check;
  - the duplicate and conflict cases;
  - re-execution;
  - the callback-timed collector restart;
  - the storage-less bound phase.
- [x] 5.2 Under its own S1, record the collector outcomes and durable identity across the restart. Run 7 (G44 S1, approved head 707b1dc) matched 11 of 11 cases of copies.v2.json in 147 SDK calls, with no invalidations and confirmed scratch deletion: results/copies-run-7.json. The five-minute deduplication retention is reported as the collector's documented bound, not measured. The accounting identity is reported for consumer_restart only, and is filed as finding #910.
- [x] 5.3 Rebuild the copies probe under expectations/copies.v2.json (#905, G47):
  - in-process collector restart tracking restart boundaries (before-restart record count, storage closure, and reopening) keeping server, port, storage mode, and fault ordinals across SQLite reopen;
  - observable-only verdicts deriving from ingress records, sender calls/logs, and read-back without unobservable constants;
  - total observers normalized without branches and strict element field-read parity;
  - transport-neutral storage conflict and deduplication capacity assertions (COLLECTOR_STORAGE_CONFLICT and COLLECTOR_DEDUPLICATION_CAPACITY);
  - distinct occurrences derived per phase from workload generators independent of retry attempts, with occurrence-aligned retry schedule;
  - consumer restart mid-burst with pure phase module, post-shutdown fencing, timer release to fence, byte-identical unacknowledged redelivery via core SDK redelivery path, and total accounting;
  - sanctioned re-attempt using identical identities with SDK retry correlation (original_event_id and retry_attempt);
  - correlation.retry_attempt and correlation.original_event_id recorded by ingress from parsed event;
  - real observers exercised by pre-traffic planted controls;
  - pre-traffic isolation controls with exact planted guard violation (192.0.2.1);
  - planned call budget upper bound (149 calls);
  - freeze expectations/copies.v2.json at base a2cdbc120eabaf95479bc83e8afbd3aff50ed9f2 while preserving copies.v1.json byte-identical.

## 6. Account-takeover chain reconstruction (#840)

- [x] 6.1 Build the seeded ground-truth chain workload and the rule-free reconstruction step. Freeze the chains,
  including chains that share a source address. Built under expectations/chains.v1.json (#840, Q201–Q242).
- [x] 6.2 Under its own S1, compare the reconstructed chains with ground truth (criterion 3). Run 8 (G44 S1, approved head 2aa872f) matched 11 of 11 cases of chains.v1.json, with both passes, in 792 SDK calls, no invalidations and confirmed scratch deletion: results/chains-run-8.json.

## 7. Host-outbox relaying (#842)

- [x] 7.1 Build the harness-local `node:sqlite` outbox with a transaction-bound sink, the relay through the
  composition, and the rollback and relay crash-and-restart phases. Built under expectations/outbox.v1.json (#842, Q243–Q258).
- [x] 7.2 Under its own S1, record that a rollback relays nothing and a commit relays at least once, with
  deduplication by event ID and transaction ID. Run 9 matched 11 of 11 frozen cases, with no invalidations and confirmed scratch deletion: `results/outbox-run-9.json`. The transaction-ID criterion is accepted as narrowed by the owner's H-06 disposition (#842, issuecomment-6674456274). Redeliveries arrive as collector duplicates. With storage, the collector's identity is the storage scope and `event.id` with whole-body equality, so a duplicate shares both the event ID and the transaction ID. Every persisted transaction ID equals its host row's and is unique. Not demonstrated, and not claimed: pair-keyed deduplication in the Node binding's sense, which this probe does not use (Q257), and that a transaction ID shared by two distinct events suppresses neither, since every run-9 transaction carries one event (#921). The relay restart is in-process.

## 8. Per-source counts, throughput and latency (#841)

- [x] 8.1 Build the at-volume per-source count comparison under every earlier fault plan, and the labelled
  throughput and latency recorder. Built under expectations/counts.v1.json (#841, Q259–Q276).
- [x] 8.2 Under its own S1 approvals, run exactly three times, in slots 10–12 (any further run needs a
  reserve slot and an owner disposition, G46, Q68). Record per-source counts against ground truth
  (criterion 4) and the run-to-run spread. Runs 10, 11 and 12 each matched all 10 frozen cases, with no invalidations and confirmed scratch deletion: `results/counts-run-10.json`, `results/counts-run-11.json`, `results/counts-run-12.json`; spread in `results/counts-spread.json`.

## 9. Stage 2 verdict and system ADR 0015 (#843)

- [x] 9.1 Record criteria 3, 4 (per source) and 5 with their evidence and fix owners, and answer G4 by its four
  predicates. If G4 fails, state the requirement for a separate Node-binding change. Seek the owner's approval
  against a named head. Recorded in system ADR 0015
  (`docs/adr/0015-stage-2-requires-no-security-significant-binding-on-contract-2-1-0.md`), under G48
  (#833, issuecomment-6675845498).
  - Criteria 3, 4 (per source) and 5 are met on synthetic evidence, within the limits the ADR states.
  - All four G4 predicates hold at the reference composition's deadline (G48 D1), so no
    `security_significant` binding is required. The shutdown primitive's late report is #932.
  - The owner's approval is sought on #843 against the PR's exact head, and the PR merges only after it.

## 10. Consumer integration profile (#844)

- [x] 10.1 Rewrite the profile's demonstrated versus host-composed delivery-guarantees table from the measurements.
  Rewritten in `docs/fraud-evidence/consumer-integration-profile.md` by #934 (merge commit `b2cdf12`), with two
  glossary definitions corrected in `docs/fraud-evidence/CONTEXT.md`.
  - 11 guarantees are marked demonstrated, each citing its Stage 2 run and cases, and 3 are host-composed only.
  - The collector's storage-less bound of 32 live identities is measured. Its 300-second retention is stated as
    the collector specification's bound, not measured.
  - Claude Code wrote it on the owner's instruction. Independent review was not performed.

## 11. Verification

- [x] 11.1 On each PR head, run:
  - strict validation;
  - assessment- and final-phase governance;
  - the dual check;
  - contract reuse;
  - the Git-state, generated and changed-path gates;
  - `make test`;
  - the CodeScene delta;
  - `node --test` on the harness tests.

  Verify every required CI context plus DeepScan.
  Checked through the GitHub API on the heads of the 29 merged PRs that touched this change, #876 to #935.
  - All 10 required contexts concluded `success` on every head.
  - DeepScan passed on 28 heads. #903's head `ceca85c` carries no DeepScan status.
  - Each PR records its own gate run in its body. This PR records the gates on its own head, and the archive
    PR (#846) runs them again on its head.
- [x] 11.2 Before declaring Stage 2 complete, verify:
  - each run's kit identity equals its approved head;
  - expectations hashes are unchanged;
  - the ledger stays within the G42 limits as amended by G46;
  - scratch is deleted.

  Verified at `main` `1843ff6` by a script that imports no harness code. It passed all 215 checks over runs 1–12:
  - Each run's `kit_identity.commit` equals its ledger head and the head its S1 comment names, and every
    executed file's blob equals that head's.
  - Each expectations file equals its recorded sha256 at the approved head and on `main`.
  - 12 of 16 runs were used, with 15,708 ledger calls, and no run exceeds its call bound or 50,000.
  - Every S1 is unedited and inside the window, and every run ended before it closed.
  - Every run records `scratch_deletion.recursively_absent: true`. The once-markers sit on the run host and
    were not read.
  - Runs 5 and 6's S1 hashes cover a trailing newline, as #907 records. Every other S1 hash is byte-exact.

## 12. Fold (#845)

- [x] 12.1 Close #845 as not planned, citing this change's no-delta declaration, after #843 and #844 merge.
  Closed as not planned on 2026-11-06T17:53:03Z (#845, issuecomment-6691615204), after #933 and #934 merged.

## 13. Archive (#846)

- [x] 13.1 In a separate later PR, archive the completed change, after the verdict and the profile land.
  Relocated to `openspec/changes/archive/2026-11-06-verify-fraud-evidence-delivery/` in this dedicated archive PR,
  after the verdict PR #933 merged as `f0ea30b2a9fce80c76e00ef55f32a7d293d694e5` and the profile PR #934 merged as
  `b2cdf12025c2727e568fd047071ea83a257549ec`. No fold preceded it: the change carries no spec deltas, and #845 was
  closed as not planned.
