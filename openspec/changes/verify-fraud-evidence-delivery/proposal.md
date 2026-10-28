## Why

Stage P (#795, #800–#808) answered the in-process questions, and system ADR 0014 records the verdict. It
explicitly left three verdict criteria to a separate Stage 2 (#833):

- **Criterion 3, chain reconstruction.** Every ground-truth account-takeover chain is reconstructed through
  post-authentication join identifiers, from successful authentication onward.
- **Criterion 4, per-source counts.** Per-source counts equal ground truth after delivery.
- **Criterion 5, host-composed delivery.** Under every fault plan, there is zero silent loss and every undelivered
  occurrence is reported. Every scheduled delay is reported. Shutdown drains within its deadline and accounts for
  every admitted occurrence.

Every delivery claim a fraud-engine integrator would depend on is a claim about a **host composition**: the HTTP
delivery handoff with bounded delivery retry, bounded backpressure and deadline-bounded shutdown. Nobody has
measured it end to end at volume, against a collector with storage, under outages, redeliveries and restarts.

G4 makes the gap concrete: a `security_significant` binding is added only if Stage 2 shows the hand composition
fails the delivery-policy row's in-process half. Without Stage 2, that decision has no evidence.

G41 records the owner's ADR 0014 approval as the G22 review of Stage P's results, so this proposal may now be
opened. Merging it authorizes no run.

## What Changes

- **Change directory.** This change adds harness source, frozen expectations and raw synthetic results, per probe
  ticket (#836–#842), executed only as an evaluator's own service outside the repository. The tracer bullet
  (#836) adds the shared harness; this proposal adds none.
- **Verdict.** The Stage 2 verdict goes in a new system ADR 0015 (#843, G43): criteria 3, 4 (per source) and 5,
  with G4 answered.
- **Profile.** The consumer integration profile's table of demonstrated versus host-composed delivery guarantees
  is rewritten from the measurements (#844).
- **Glossary.** "Reference composition", "accounting identity" and "terminal bucket" are added to
  `docs/fraud-evidence/CONTEXT.md` in this PR.
- **Specs.** No spec deltas (`skip_specs`). Stage 2 is evidence only. Any binding G4 calls for is a separate,
  later Node-binding change. #845 (the fold) therefore resolves as not planned.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. The change carries no spec deltas.

## Impact

Apart from this change directory, only documentation changes:
- the glossary terms here;
- ADR 0015 (#843);
- the consumer integration profile (#844).

No contract, package API, package implementation, generated artifact or canonical spec changes. The harness runs
against the packed evaluation kit built from each run's exact approved head. Nothing is added to Bloodtrail.

The contract-reuse gate must return `approved-skip`. The proposal and the tracer bullet are separate PRs, as in
Stage P.

## Run authorization

These are **proposed terms**, not an execution grant. The owner decisions are recorded in `design.md`: G41–G45 (#795), the G46 terms this authorization rests on (Q45, Q48, Q68, Q73, Q74 and Q94; #833), and a summary of G47 (#833), each with its comment link.

- **Environment (G42):** this workstation (macOS, Apple Silicon), under G38's environment terms.
  - Node 26 is installed outside the repository.
  - The evaluation kit is built by the governed kit builder, in distributable mode, from the exact approved head
    commit, and consumed outside the repository.
  - The kit build's `npm ci` may use the npm registry or the local cache.
  - Probe traffic stays on loopback (`127.0.0.1`/`::1`), enforced by the loopback guard described in `design.md`.
  - Each run's provenance records the environment and the declared driver lane (a self-reported flag, G45). Under G46 Q45, AGY writes the code and Claude Code reviews it, and Claude Code alone executes runs (G46 Q94).
- **Data class:** synthetic opaque identifiers, never email-like. Addresses come only from `192.0.2.0/24`,
  `198.51.100.0/24`, `203.0.113.0/24` and `2001:db8::/32`. No real-user data is used or derived.
- **Volume and window (G42):**
  - at most **16 runs**, shared across the Stage 2 probe tickets and not renewed per ticket (amended from 12 by G46, owner 2026-10-27, after the copies probe lost runs 5 and 6 to harness defects). The 16-run limit applies from the head that merges this amendment; runs 1–7 executed under the 12-run limit, which their results pin (`executed_file_hashes` for `lib/results.mjs`).
    - run slots (G46, Q74): runs 1–7 are used (see the ledger); 8 is #840, 9 is #842, 10–12 are #841, and 13–16 are **reserve**. A reserve slot is used only under an explicit owner disposition recorded on the probe ticket, whatever the reason;
  - at most **50,000 SDK calls per run**, accepted or refused, with delivery attempts recorded but not capped;
  - a **14-day window** from the first Stage 2 run approval.

  A lapsed window is amended through this change, never stretched.
- **Owners:** the project owner holds the data, retention and key roles. Naming the role is not a claim that any
  run is approved.
- **Synthetic stores:** the collector's SQLite storage file and the host-outbox database are harness-local
  scratch. They are neither Bloodtrail storage nor a Bloodtrail outbox product.
- **Keys:** per-run, held only in memory, never written to the kit, a database or a log.
- **Deletion:** the kit, collector storage, synthetic database and logs are deleted at the end of every run,
  including after a stop. Committed harness source and synthetic results stay distinct from that scratch.
- **Approval (S1, G44):** each run has exactly one approval comment naming the exact 40-character head.
  - The orchestrator may post it as a **delegated** approval. It is a new, unedited comment on the probe's
    ticket, containing the line `S1 approval: <probe> run <N> for #<ticket> at <HEAD>` and the statement
    `Delegated S1 under G44`.
  - It is posted only after the full TEST_CMD, all-green CI, review and the frozen expectations hash are
    verified.
  - The kit identity commit must equal that head.
  - The approval and its comment hash are recorded before execution, in the run ledger and in the results.
  - A run lost to a harness defect is re-executed, and a reserve slot (13–16) is used, only under an explicit owner disposition recorded on the probe ticket (G46, Q68). G44 delegates the S1 approval, never that disposition. From the head that merges this amendment, a rerun inside a ticket's own slots (for example within #841's 10–12) supplies its disposition, which the harness then validates and records but cannot require, since it cannot tell a rerun from a planned run. Run 7's disposition is G46 Q47 (#833 issuecomment-6449640834), relayed on #839 at issuecomment-6449678473 and cited in run 7's S1; it predates the amendment.
  - The harness checks a disposition's form, not who posted it. A reserve run (13–16) needs an unedited comment on the probe ticket containing the exact line `Owner disposition: <probe> run <N> for #<ticket>` and no "delegated" text in any letter case, created at or after the window opens and at or before the run's S1. Its sha256 is recorded in the results. Every Stage 2 comment, including the orchestrator's delegated S1s, is posted from the owner's GitHub account. Q68 requires the disposition to record the owner's decision; that it does is audited from the ticket, not proven by the harness.
- **Stop conditions (S2):** halt and report, and do not continue under this authorization, if any of these occurs:
  - non-synthetic data appears;
  - a critical security defect is found;
  - any non-loopback connection is attempted;
  - a write lands outside the authorized scratch location;
  - a run exceeds its deadline.

  No run follows an S2 halt without the owner.

## Status

Stage 2 runs execute only under these terms, each with its own exact-head S1; see `harness/run-ledger.md` for the runs executed. Merging this change, or any amendment to it, authorizes no run.
