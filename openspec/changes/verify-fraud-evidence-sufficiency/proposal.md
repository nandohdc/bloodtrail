## Why

#795 asks whether Bloodtrail can supply an external fraud-evidence consumer with sufficiently complete, correctly structured and appropriately trusted evidence for account takeover and credential stuffing. Architecture reading and earlier unexecuted AI research are not demonstrations. Bloodtrail emits evidence; external consumers perform detection, scoring and fraud verdicts.

The four gaps identified by #795 are:

1. No known honest carrier for a failed login's target, including an unresolved presented identifier. Authoritative identity/resource fields cannot honestly substitute for client-presented identifiers; display names are display text, not identifiers.
2. Transaction-critical delivery ordering, retry and persistence concerns: the durability probe precedes the commit gate, truthful committed occurrences require a prior business commit, and fail-closed redelivery repeats the probe and gate. Instance-local successful-delivery memory is not persistent retry after commit.
3. Transformation-hook key IDs do not reach occurrences; only a host-set credential key ID marks a keyed value.
4. Post-authentication joins are underspecified: per-event purpose and tenant-scoped hooks do not guarantee stable values across the chain.

These motivate Stage P hypotheses, not measured findings or an evidence-sufficiency verdict. The historical default-event-ID defect #796 has since been fixed on main at `02ce833`; the design retains a fresh-process comparison without treating that defect as current.

## What Changes

- Retain #799's approved proposal. Add the packed-public-API tracer, observation recorders and provenance, and each probe's frozen expectations and raw synthetic results (#800–#804).
- Add usage-only `fraud-evidence-profile` requirements for contract 2.1.0, without redefining any field.
- Propose bounded run-authorization terms requiring a separate exact-head owner comment for each run.
- Record the Stage P verdict in system ADR 0014 (`docs/adr/`, #805), then add the consumer integration profile and glossary (#806), verification, and separate fold and archive PRs (#807, #808).
- Record a full, security-sensitive assessment generated from its authored source (G30).

## Capabilities

### New Capabilities

- `fraud-evidence-profile`: usage constraints for external fraud-evidence consumers, including trust, exclusions and post-authentication joins, within the canonical contract.

### Modified Capabilities

None.

## Impact

Apart from this change directory, only documentation is added: system ADR 0014 (#805) and the consumer integration profile and glossary (#806). No contract, pinned capability, package API, package implementation, generated package artifact or canonical spec is changed. The harness, frozen expectations, raw results and offline fixture tests implement task groups 1–5. Normative WHEN/THEN scenarios and executable governance/product gates provide regression coverage, not Stage P measurements. G27 requires no pin move; the contract-reuse gate must return `approved-skip`.

The proposal and tracer bullet are separate PRs (G35). The orchestrator delivers this proposal; owner review and merge remain the S3 stop point. Later results may motivate a separate governed minor contract change after normative-precedence work, never a field change here. Stage 2 requires its own change and authorization after owner review of Stage P (G22).

## Run authorization

These are **proposed terms**, not an execution grant. Verbatim owner decisions and statuses are retained in `design.md`; the historical pilot supplies structure only, not delegated authorization.

- **Environment (G38, superseding G15):** the owner's workstation (macOS, Apple Silicon), driven by Tamandua with pi. Node 26 is installed outside the repository. The evaluation kit is built by the governed kit builder in distributable mode from the exact approved head commit and consumed outside the repository. Probe processes use no network beyond loopback: they run under Node's permission model without network access. The kit build's `npm ci` may use the npm registry or the local cache. Each run's provenance records the model lane that drove it.
- **Data class:** synthetic opaque identifiers, never email-like, and addresses only in `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24` and `2001:db8::/32`. No real-user data is used or derived. Explicitly labelled synthetic prohibited-data markers are allowed in P-D only.
- **Volume (G20, G34):** at most 10 runs of at most 5,000 occurrences each; the limits are shared across the Stage P probe tickets, not renewed per ticket.
- **Window (G34):** 7 days from the owner's **FIRST run-approval comment** (the tracer-bullet ticket). A lapsed window is amended through the change, never stretched.
- **Owners (G20):** the project owner holds the data, retention and key roles. This role naming is not a claim that the owner has approved any run.
- **Synthetic host database:** harness-local, neither Bloodtrail storage nor a Bloodtrail outbox. The future host-outbox probe tests a host composition, not a shipped Bloodtrail persistence feature.
- **Keys:** per-run, held only in memory, never persisted in the kit, database or logs.
- **Deletion:** the kit, synthetic host database and logs are deleted at the end, including after a stop. Future committed harness source and synthetic result evidence remain distinct from this disposable scratch.
- **Approval (S1; G39):** each run has exactly one approval comment naming the exact head commit. For #800, that was the owner's own comment. For #801–#804 under G39, it may be a **delegated** approval posted by the orchestrator as a new, unedited comment on the probe's ticket, containing the exact approval line `S1 approval: <probe> run <N> for #<ticket> at <HEAD>` (the exact 40-character head) and the statement `Delegated S1 under G39`. It is posted only after the orchestrator has verified the head: the full TEST_CMD, 10/10 required CI, the code review, and the frozen expectations hash. The kit identity commit must equal that approved head. The authorization reference and approving-comment hash are recorded before execution; delegated approval is recorded in the run ledger and the results' approval record.
- **Stop conditions (S2):** if non-synthetic data appears, or a critical security defect is found, halt and report. Do not continue under this authorization.

## Status

Stage P is complete. Five runs executed, one per probe, for 5,494 occurrences within the shared limits. Each ran once under its own S1 approval at an exact head: run 1 by the owner's own comment, runs 2–5 delegated under G39. Every executed case matched its frozen expectation, and no run was invalidated.

System ADR 0014 records the verdict: **synthetic evidence-sufficiency is not met on contract 2.1.0**. Criterion 1 (target attribution) fails, and criterion 2 (signal fit) passes (G40). No further run is authorized or planned, and the window closes at 2026-10-24T02:22:47Z. Passing gates, delegated authority and merged code are not approval: the ADR is approved by the owner against its named head.
