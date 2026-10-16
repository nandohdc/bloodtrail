## Context and scope

This retains #799's proposal design for #795, originally based on main `6ee6f57037466ac80fd0b9b181f6e881cde62520` and contract 2.1.0. #800 task 1.1 adds a build-only harness and frozen corrected P-ids expectations at baseline `101d083636044fe86cc019d1f1228f7feb021e39`. One clean-tree dry run built/installed a distributable kit and read declarations as text, without importing or executing kit code; scratch was deleted. No probe result or Stage P run exists. The owner approves the exact execution head at S1 and merges at S3; no run approval is inferred.

The authoritative decision log is [#795's G1–G37 comment](https://github.com/nandohdc/bloodtrail/issues/795#issuecomment-6134522416). The issue body wins disagreements except G34–G37, which postdate and override it. The decision register below preserves verbatim decision text and statuses; implementation choices and unanswered assumptions are separate.

## Seam and observation boundaries

The **only seam** is the evaluation kit's packed public API, consumed as an evaluator's own service installed outside the repository. No new seams in Bloodtrail, internal registry inspection, operation-authority inspection, private-state inspection or in-repository package test files are permitted. Future harness source and results live inside this change, but execution uses the outside-repository installation.

Modules exercised later are core's SDK factory and default identifiers; named event methods, context constructors, operation handles and standalone validator; testing sinks; and the Node binding's SDK factory, delivery handoff and transaction-critical binding.

Exactly three public observation boundaries are planned:

1. **Outcome of every public call:** returned results and thrown errors from context constructors, frame helpers, context-scoping methods and SDK factories as well as event methods. Record each refusal as code, category and path where supplied; retain raw errors without inventing structured fields. Record explicit acceptance for every attempt, especially an expected refusal that passes.
2. **Core sink interface:** frozen canonical validated event objects received through a testing capturing sink, or the host transaction-bound sink in P-E. This is not serialized delivery-body observation.
3. **Injected delivery-handoff exchange:** including the transaction-critical binding's handoff. Record each delivery attempt and its body hash; body bytes are observed **only here**, not by inspecting private state. Delivery-attempt metadata never enters the occurrence.

Prior art informs design, not authorization or new evidence: the governed kit gate's outside-repository own service, example authentication flows, core authority/handle and conformance tests, delivery-class injected-exchange tests and the archived non-production delivery pilot.

## Provenance and expectations

Before a future run, the recorder binds the kit identity **commit, package-set digest and kit digest**, package/contract and runtime versions, Node version, environment, authorization reference and hash of the approving owner comment. The kit commit must equal the exact approved head (S1). Task 1.1's build-only dry run confirmed Node 26 and availability of `db.isTransaction` in a closed in-memory database; this is runtime verification, not a P-E database probe.

The future expectations file is committed and hashed **before a run**, with hypotheses, measurement thresholds and the redelivery count frozen. It is never edited after that run starts. Results are separate, raw observations tagged with provenance; a mismatch is reported, never "fixed" by changing expectations. Reproduction starts from the kit identity commit. Disposable kit/database/logs are deleted as the proposal requires; future committed synthetic evidence is distinct from scratch. #800 task 1.1 now freezes `harness/expectations/p-ids.v1.json`; it adds no probe results. `harness/README.md` documents the implementer-default counting model, exact per-role budgets, future permission-constrained execution and fixture-only verification.

## Stage P verdict and fix ownership

Provenance ambiguity means **a field whose published policy trust disagrees with where its value actually came from**.

The first two verdict criteria are reproduced from #795:

1. **Target attribution.** The contract has a field that honestly carries the attempted identifier, and that field, used as the capability prescribes, is accepted by the SDK with zero provenance ambiguity.
2. **Signal fit.** No missing account-takeover signal is judged "misrepresents".

Criterion 1's expected failure on 2.1.0 is a hypothesis, not an observed verdict. If it fails, synthetic evidence-sufficiency is not met on 2.1.0 regardless of Stage 2. The likely fix owner is the Bloodtrail contract through a separate governed field change. SDK acceptance of a misrepresenting carrier is a **separate finding**: the capability prohibition is the immediate control, host conformance remains the host's obligation, and resource-rule enforcement is later Bloodtrail package work. Every unmet criterion must identify its gap and fix owner: Bloodtrail contract, Bloodtrail package, host or engine, based on the observations rather than presumption.

The remaining criteria are **out of scope, Stage 2**:

3. **Chain reconstruction:** every ground-truth account-takeover chain reconstructed through join identifiers from successful authentication onward. Linking pre-authentication failures is not scored on 2.1.0; grouping failures by source and time is only reported.
4. **Counts:** per-source counts equal ground truth in Stage 2; per-target counts wait for the contract field and are remeasured after it lands.
5. **Host-composed delivery:** under every fault plan, zero silent loss; every undelivered occurrence reported by a result, retry-exhaustion or overload signal; every scheduled delay reported; shutdown drains within its deadline and accounts for every admitted occurrence. Durability across crashes remains host-owned and is not judged here.

Stage 2 requires a separate change and authorization after owner review of Stage P (G22). It covers HTTP loopback delivery, consumer outages/status handling, redeliveries and collector duplicate/conflict outcomes, consumer restart, collector storage, throughput/latency, host-outbox relaying with composed retry and reconstruction at scale. None is measured here.

Bloodtrail emits evidence, not fraud detection. External fraud-evidence consumers own detection, scoring and fraud verdicts. Fraud rules, thresholds, flags and verdicts are excluded from these probes; evidence-sufficiency and signal-fit verdicts judge evidence only. No production deployment, real-user data or publication is proposed.

## Planned probes and hypotheses

### P-ids — tracer bullet (#800)

Compare core's default SDK identifiers across two fresh processes, then compare the Node factory across two fresh processes, including restart boundaries. Hypothesis on this fixed baseline: identifiers are unique across processes/restarts without repetition. #796 was fixed on main at `02ce833`: core now uses Web Crypto `crypto.randomUUID`, Node uses `node:crypto` `randomUUID`, and a qualifying caller-supplied random provider also satisfies the uniqueness obligation. The review row's temporary bar "until #796 is fixed" is lifted; its historical defect is not a current finding. No execution evidence is asserted. Collector consequences are analysis only; collector probing belongs to Stage 2.

### P-D — integrity outcomes (#801)

Attempt unbranded and cloned contexts; a client claim promoted to authority; a principal on an anonymous actor; premature commit state; forged and foreign operation handles; prohibited keys and values, including the underscore bypass; and a malformed event passed to the standalone validator. Hypothesis: the public integrity controls refuse invalid construction, with each actual acceptance/refusal measured at the call boundary and admitted occurrences recorded at the sink. Record raw reflection `TypeError`s as observations, not invented SDK error codes. Prohibited-data strings are explicitly synthetic markers and confined to P-D.

The SDK cannot establish whether host-supplied facts are true or where their values originated. In-process branding is **not attestation**. It cannot establish host conformance or enforce event resource rules merely through structural validation; nor can it establish durable host state, business/audit atomicity or fraud. P-D records these limits rather than presenting acceptance as factual authority.

### P-attr — target carriers (#802)

Apply the full carrier matrix to **failed authentication, successful authentication, password-reset request and registration attempt**:

- anonymous actor only;
- anonymous claimed actor with raw ID, and with hook-keyed ID;
- keyed display name;
- raw authoritative subject, and server-resolved subject;
- keyed resource ID;
- keyed credential reference with a subject, and without one;
- tenantless and conflicting claimed tenants;
- authority-escalation negatives.

For every event/carrier pair, record SDK acceptance, provenance ambiguity, event resource-rule conformance (including account-existence disclosure) and misuse of field meaning. Hypothesis: no existing field honestly carries an **unresolved presented identifier**. Accepted candidates either omit the target or misuse trust, resource rules or meaning. Keying does not repair authority. The hook-keyed candidate uses the SDK-supplied per-event purpose and effective tenant; a keyed display name is meaning misuse. Account-bearing reset/registration cases follow safe server resolution exactly as the contract permits, without tightening it (G27). Failed authentication carries no target (G13); G36's targetless second-factor/lockout reasons do not create an account carrier.

### P-E — ordering, retries and host composition (#803)

Use SDK-constructed occurrences to test construction before business commit; truthful ordering; untruthful ordering; a commit gate running for an honest `not_committed` occurrence; and fail-closed redelivery. Count durability-probe and commit-gate executions across k=3 redeliveries (implementer default, frozen in future expectations), including a new binding instance. Hypothesis: probe-before-gate ordering and instance-local success memory do not supply persistent retry after commit or atomicity.

Test host-outbox commit and rollback paths: emit through a host transaction-bound sink inside the business transaction, then commit or roll back. Compare in-memory handle state with durable host state and assess whether the business change and audit record are atomic under that composition. The database is harness-local, not Bloodtrail storage/outbox. Relaying is Stage 2, not this probe. The recorder must confirm `db.isTransaction` on the actual Node 26 runtime.

The [2026-10-13 triage note on #795](https://github.com/nandohdc/bloodtrail/issues/795#issuecomment-6147122487) states that the binding reads neither `event.commit_state` nor `event.outcome`: after probe/gate/handoff success it may return `committed_and_durable` even for an honest `not_committed` occurrence. That concern is outside #797 and belongs to G5's later Node-binding change, informed by this P-E case. #812 concerns related contradictory outcome/commit pairs through a handle. No package correction is part of this proposal.

### P-map — signal fit (#804)

Classify **logout, MFA challenge failure, contact-detail change, lockout, lockout release and credential rotation** against existing events as `fits`, `strained` or `misrepresents`, documenting resource rules and field meanings. Hypothesis: the matrix can decide criterion 2; no fit verdict is predetermined. G36 permits `mfa_failed` and `rate_limited` reasons but still no target. Record that the engine cannot attribute them to an account, as further design input for a later contract field. Propose a catalog addition only for an evidenced real misfit (G10).

## Delivery sequence and later records

All ten tickets stay separate (G35): #799 proposal, #800 tracer bullet/P-ids, then #801 P-D, #802 P-attr, #803 P-E and #804 P-map in parallel; #805 ADR/verdict and #806 consumer profile/glossary in parallel; #807 fold and #808 archive as separate later PRs. Proposal and tracer are separate PRs. Each future run independently passes S1 and S2; proposal merge is not run permission.

**System ADR 0014 (`docs/adr/`) is future #805 work**, owner-approved against a named head commit and with no contract version move (G6). If P-attr proves the gap, it records the requirement for a **separate governed minor contract change after active normative-precedence work**, adding a keyed presented-identifier reference with client-claim trust and no account-existence disclosure (G33). It also records hook key IDs not reaching occurrences. The withdrawn G1-dependent carrier ideas are open later-field design inputs only: login-surface key selection; purpose scope (authentication family as candidate); lookup-canonical form; key epochs in occurrences; per-method credential typing including first-factor passkeys; host-computed values. They are not approved fields on 2.1.0.

#806 later documents what is sent/never sent, field meanings, keyed-field possibilities and lack of hook key-ID marking apart from host-set credential key ID, demonstrated versus host-composed delivery guarantees, exact-address joins across tenants under engine governance and real-user DPIA. Its context-map glossary defines fraud-evidence consumer (downstream engine, distinct from an own service), post-authentication join identifier, session fingerprint, presented identifier, honest carrier and provenance ambiguity; surface-key terms wait for the later field change.

G9/G24's AI-research errata index remains **Pending owner go-ahead**, not work here. G8/G37 defect filing is Done, not a claim of present unfixed behaviour or run approval.

## Implementer defaults — not owner decisions

- Use the Node binding's SDK factory, except in P-ids, which compares core's defaults with the Node binding's.
- P-E redelivery uses k=3, frozen in the expectations file.
- The P-attr hook-keyed carrier keys with the purpose and tenant the SDK supplies (the per-event semantic and the effective tenant), as the SDK actually behaves.
- A display name holding a keyed identifier is classified as meaning misuse.
- The P-ids consequence for the collector is analysis only; the collector is Stage 2.
- The prohibited-data test strings are synthetic markers, and the run authorization says so.
- P-D records raw reflection `TypeError`s as observations.
- The provenance recorder confirms `db.isTransaction` on the Node 26 runtime.

These are future execution defaults, not measurements made by this proposal.

## Assumptions — not owner decisions

- **A1.** The target engine is generic, fed by a host-owned relay that adapts Bloodtrail-native JSON to the engine's API.
- **A2.** This milestone is a go/no-go on continuing Bloodtrail as the evidence SDK for fraud engines. The production governance track has not started.

These are Claude's recommendations left unanswered by the owner, not approval of deployment or a production claim.

## Decision register — verbatim provenance

The following tables reproduce the authoritative log's decision cells and statuses verbatim. Withdrawn, superseded and design-input rows are historical, not active decisions. The conditional review row is read with #796's fixed status above. No table entry grants an actual run approval.

### Target attribution (the central finding)

| ID | Decision | Status |
|---|---|---|
| G33 | Stage P's carrier matrix **proves or refutes the gap**: does any existing field carry a failed login's target without misrepresentation? If the gap is proven, a **separate governed contract minor version**, sequenced after the active normative-precedence change, adds a keyed presented-identifier reference with client-claim trust that never reveals whether an account exists. | **Stands** (owner) |
| G1 | Put a keyed hash of the presented login identifier in the credential reference on failed authentication. | **Withdrawn.** The contract forbids it. The catalog resource rule allows "credential type only when safe". The credential reference is server-authoritative under the authenticated-identity authority (validated session, token or assertion context; not user-controlled). The canonical capability says usernames, email addresses or client claims SHALL NOT substitute for authoritative identifiers. The contract's examples carry the field only because a generator template stamps it onto every example. |
| G2 | Tenantless failures use a platform-login-scope key. | **Withdrawn** (depended on G1). Now a **design input**: login-surface key selection. |
| G11 | Successful authentication carries the same keyed reference, so failures link to the success. | **Withdrawn** (depended on G1). **Design input.** Note: SDK transformation hooks receive the per-event purpose and the resolved tenant, so they cannot select a login-surface key. |
| G12 | Hash the authentication authority's lookup-canonical form of the identifier. | **Withdrawn** as a decision. **Design input.** |
| G14 | Rotate keys on a schedule longer than the engine's correlation window; the key id marks epochs. | **Withdrawn** as a decision. **Design input.** |
| G16 | Reset requests and registration attempts carry the same reference. | **Withdrawn** (depended on G1). **Design input.** |
| G17 | The host computes the keyed reference because hooks cannot. | **Withdrawn** as a decision. **Design input.** The underlying fact stands and goes into the ADR. |
| G18 | Passkey and SSO failures carry a keyed reference to whatever the authority looked up. | **Withdrawn** as a decision. **Design input**, including which existing credential type a first-factor passkey takes. |

### The `fraud-evidence-profile` capability: what Bloodtrail can promise on 2.1.0

| ID | Decision | Status |
|---|---|---|
| G27 | The normative text lives in a **new capability, `fraud-evidence-profile`**, with ADDED requirements only. It touches no protected contract path and no pinned capability, so it needs no pin move and no contract-reuse assessment. It redefines no contract field. **Refined:** it follows the contract on reset requests and registration attempts (a server-resolved account appears only after safe resolution), and is not tightened beyond it. | **Stands** |
| G25 | Write the semantics as a delta to the security-audit event-contract capability. | **Superseded by G27.** That capability sits under a protected prefix whose only permitted writer is the active normative-precedence change. |
| G13 | Failed authentication carries **no target**: no subject, no credential reference, no presented identifier in any server-authoritative field. | **Stands** (broadened from "omit subject") |
| G3 | Send the **exact observed source address**. Exactness is necessary because geo, network-owner and reputation enrichment run in the engine, never in Bloodtrail. Record the purpose justification. Real-user use needs a DPIA. Trusted-hop extraction stays with the host. | **Stands** |
| G29 | Post-authentication join identifiers. Internal opaque account IDs are sent directly under a recorded direct-reference exception, identical on every occurrence. Session IDs are host-computed keyed fingerprints of the server session handle under one key scope shared by the chain, never bearer values. | **Stands** (refined by review) |
| (review) | Producers supply event IDs unique across processes and restarts: the Node binding's identifiers or another random source, never core's defaults until #796 is fixed. | **Stands** |
| G19 | A consumer integration profile document for external-engine integrators. | **Stands** |
| G32 | A fraud-evidence consumer glossary context, with a context-map entry. Terms: fraud-evidence consumer, post-authentication join identifier, session fingerprint, presented identifier, honest carrier, provenance ambiguity. | **Stands** (terms updated after G33) |

### Delivery

| ID | Decision | Status |
|---|---|---|
| G4 | The **host owns durability** for security-significant evidence. Bloodtrail owns honest conformance claims, visible loss, and a measured reference composition. A security-significant binding is added only if Stage 2 shows the hand composition fails the row's in-process half. | **Stands** |
| G5 | If P-E confirms the ordering hypothesis, test the **host-outbox pattern**: emit through a transaction-bound sink inside the business transaction, then relay. The transaction-critical binding is later documented as not providing atomicity, in a separate Node-binding change. | **Stands** |

### Process and governance

| ID | Decision | Status |
|---|---|---|
| G6 | Run Stage P first, then record the decisions in a system ADR (the next number, 0014), following the delivery-attempts ADR precedent: owner approval against a named head commit, no contract version move. | **Stands** |
| G7 | Stage P runs **inside the change**, under a written run authorization in the style of the archived non-production delivery pilot. Harness and results are committed in the change. | **Stands** |
| G15 | Stage P runs in a Claude cloud session container: Node 26 installed outside the repo, the kit built by the governed kit builder, loopback only. | **Superseded by G38** |
| G20 | Run authorization terms. The owner holds the data, retention and key roles. Synthetic data only. A 7-day window (opening per G34). At most 10 runs of at most 5,000 occurrences each. Loopback only. Per-run keys held in memory. A harness-local synthetic host database. Scratch deleted at the end. Each run approved by an owner comment naming the exact head commit. | **Stands** |
| G21 | Original verdict criteria. | **Superseded** by the redefined criteria in this issue's body |
| G22 | Stage 2 (HTTP, outages, duplicates, restart, storage, throughput, reconstruction at scale) is proposed only after the owner reviews Stage P's results. | **Stands** |
| G26 | The change opens as a PR. Proposal and implementation commits may share a PR; fold and archive are separate PRs. | **Stands** (G35 keeps the proposal and the tracer bullet as separate PRs) |
| G28 | Change `verify-fraud-evidence-sufficiency`, capability `fraud-evidence-profile`. | **Stands** |
| G31 | Branch convention `docs/<slug>-<N>` with `(#N)` in commit subjects. This issue is N. | **Stands**. Branch: `docs/verify-fraud-evidence-sufficiency-795` |
| G23 | Earlier branch naming. | **Superseded by G31** |
| G30 | Full assessment: canonical-capability-requirement trigger, material capability modification, `security_sensitive: true`, declaring only `fraud-evidence-profile`, with pinned verification task ids. | **Stands** |
| G10 | P-map probe for the missing account-takeover signals; a catalog addition only for a real misfit. | **Stands** |
| G8 / G37 | Defects found in passing, filed: **#796** core's default identifiers repeat the same ID sequence in every process (high); **#797** a failed or denied transaction-critical event without an operation handle is recorded as `committed` (high); **#798** the evaluation kit receiver answers the ratified deduplication capacity with an unnamed `500` (low). | **Done** (filed 2026-10-12) |
| G9 / G24 | A docs-only errata index for the four AI research reports under `docs/reviews/`, keeping the originals. | **Pending** owner go-ahead |

### Decisions made while ticketing (postdate the issue body; they override it where they differ)

| ID | Decision | Status |
|---|---|---|
| G34 | The 7-day run window opens at the owner's **first run-approval comment** (ticket 2). The 10-run and 5,000-occurrence limits are shared across the Stage P probe tickets. If the window lapses, the authorization is amended through the change, never stretched. | **Stands** |
| G35 | Keep **all ten tickets separate**. P-D, P-attr, P-E and P-map run in parallel after the tracer bullet. The ADR and the consumer profile run in parallel. The proposal and the tracer bullet are separate PRs. | **Stands** |
| G36 | The capability's non-disclosure requirement is **scoped to first-factor failures**. Second-factor reasons (`mfa_failed`) and per-account lockout reasons (`rate_limited`) are allowed, because disclosure is inherent once the first factor has resolved the account. They still carry no target. P-map records that the engine cannot attribute them to an account, as a further design input for the contract field. **This refines the issue body's "non-disclosing failures" requirement.** | **Stands** |
| G37 | File the three defects before the tickets, so the tickets can reference them: #796, #797 and #798. | **Done** |
| G38 | Stage P runs execute on the owner's workstation (macOS, Apple Silicon), driven by Tamandua with pi, not in a Claude cloud session container. See the terms below. | **Stands** (owner, 2026-10-16) — [decision and terms](https://github.com/nandohdc/bloodtrail/issues/795#issuecomment-6219739604) |
