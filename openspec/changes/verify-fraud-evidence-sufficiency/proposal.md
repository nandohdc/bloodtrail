## Why

#795 asks whether Bloodtrail can supply an external fraud-evidence consumer with sufficiently complete, correctly structured and appropriately trusted evidence for account takeover and credential stuffing. Architecture reading and earlier unexecuted AI research are not demonstrations. Bloodtrail emits evidence; external consumers perform detection, scoring and fraud verdicts.

The four gaps identified by #795 are:

1. No known honest carrier for a failed login's target, including an unresolved presented identifier. Authoritative identity/resource fields cannot honestly substitute for client-presented identifiers; display names are display text, not identifiers.
2. Transaction-critical delivery ordering, retry and persistence concerns: the durability probe precedes the commit gate, truthful committed occurrences require a prior business commit, and fail-closed redelivery repeats the probe and gate. Instance-local successful-delivery memory is not persistent retry after commit.
3. Transformation-hook key IDs do not reach occurrences; only a host-set credential key ID marks a keyed value.
4. Post-authentication joins are underspecified: per-event purpose and tenant-scoped hooks do not guarantee stable values across the chain.

These motivate Stage P hypotheses, not measured findings or an evidence-sufficiency verdict. The historical default-event-ID defect #796 has since been fixed on main at `02ce833`; the design retains a fresh-process comparison without treating that defect as current.

## What Changes

- Retain #799's approved proposal and add #800 task 1.1's build-only packed-public-API tracer, observation recorders, provenance and frozen corrected P-ids expectations. No probe executes.
- Add usage-only `fraud-evidence-profile` requirements for contract 2.1.0, without redefining any field.
- Propose bounded run-authorization terms requiring a separate exact-head owner comment for each run.
- Plan subsequent tracer/probe tickets, system ADR 0014 (`docs/adr/`) and the Stage P verdict, consumer integration profile and glossary, verification, then separate fold/archive PRs.
- Record a full, security-sensitive assessment generated from its authored source (G30).

## Capabilities

### New Capabilities

- `fraud-evidence-profile`: usage constraints for external fraud-evidence consumers, including trust, exclusions and post-authentication joins, within the canonical contract.

### Modified Capabilities

None.

## Impact

Only this change directory is modified. No contract, pinned capability, package API, package implementation, generated package artifact or canonical spec is changed. The harness, frozen expectations and offline fixture tests implement task 1.1; no probe results file is created. Normative WHEN/THEN scenarios and executable governance/product gates provide regression coverage, not Stage P measurements. G27 requires no pin move; the contract-reuse gate must return `approved-skip`.

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
- **Approval (S1):** one owner approval comment per run, naming the exact head commit. The kit identity commit must equal that approved head. The authorization reference and approving-comment hash are recorded before execution.
- **Stop conditions (S2):** if non-synthetic data appears, or a critical security defect is found, halt and report. Do not continue under this authorization.

## Status

Build-only task 1.1, awaiting exact-head run approval at S1 and owner merge at S3. **This PR authorizes no run. Each run needs its own owner approval comment.** One clean-tree distributable kit build/install-only dry run verified runtime, packed declarations, single core and deletion; no kit code was imported or executed by Stage P. No approval, probe execution or Stage P result is claimed. Passing gates, historical pilot delegation and merged code are not approval. Only task 1.1 is checked; task 1.2 and all later tasks remain future work.
