# Fraud-evidence consumer integration profile

For integrators who feed Bloodtrail occurrences to an external fraud engine, a **fraud-evidence consumer**.
Terms in bold are defined in this directory's `CONTEXT.md`. Delivery terms follow two other glossaries:
occurrence, copy, redelivery, re-execution and delivery attempt follow the Node binding's
(`packages/security-audit-sdk-node/CONTEXT.md`), and identity, duplicate and conflict follow the collector's
(`packages/security-audit-collector/CONTEXT.md`).

## Status and boundaries

- **Normative source.** This profile explains the `fraud-evidence-profile` capability, which is the normative
  text: `openspec/specs/fraud-evidence-profile/spec.md`. Where this profile and the capability differ, the
  capability wins.
- **Contract.** Everything here applies to canonical contract 2.1.0. The profile constrains usage only and
  redefines no contract field.
- **Verdict.** System ADR 0014 (`docs/adr/0014-fraud-evidence-sufficiency-is-not-met-on-contract-2-1-0.md`)
  records the Stage P verdict: **synthetic evidence-sufficiency is not met on contract 2.1.0**, because no
  existing field is an **honest carrier** for a failed login's target. System ADR 0015
  (`docs/adr/0015-stage-2-requires-no-security-significant-binding-on-contract-2-1-0.md`) records the Stage 2
  verdict: account-takeover chain reconstruction, per-source counts and host-composed delivery are met on
  synthetic evidence, within the limits it states. It leaves ADR 0014's verdict unchanged. This profile describes
  how to use 2.1.0 honestly under both verdicts. It makes no sufficiency claim.
- **Roles.** Bloodtrail emits evidence. The consumer owns detection, scoring and fraud verdicts, and the host
  owns the relay that adapts Bloodtrail-native JSON to the consumer's API.
- **Authorization.** This profile authorizes nothing. Production deployment, real-user data, transports,
  exporters, collectors and integration with a real engine each need their own governed change and explicit
  authorization. Stage P and Stage 2 used synthetic data only, and Stage 2 used loopback HTTP only.

## What is sent, and what it means

Each occurrence is one canonical event, validated against the contract and identified by `event.id`. The
consumer reads a field's meaning and trust from the published field policy
(`contracts/security-audit/policies/field-policy.json`), together with the in-event actor provenance. These are
the fields an account-takeover consumer relies on most:

| Field | Contract meaning | Published trust |
|---|---|---|
| `event.id` | The occurrence's identity: unique across processes and restarts, and unchanged on every copy | authoritative server |
| `event.name`, `event.outcome`, `event.commit_state` | What happened, how it ended, and whether a business change committed | authoritative server |
| `actor.type`, `actor.id` | Who acted. On a failed login the actor is anonymous. | authoritative server |
| `actor.provenance.trust_level`, `actor.provenance.source` | The actor value's trust level, and the system it was resolved from. This is the only per-occurrence provenance. | authoritative server |
| `authenticated_principal.id` | The identity a validated session, token or assertion established | verified assertion |
| `subject.id` | The account or resource the action was about | authoritative server |
| `credential.type` | The kind of credential used | authoritative server |
| `credential.reference`, `credential.key_id` | A server-authoritative reference to the credential, and the key id the host set for it | authoritative server |
| `session.id` | The session: under this profile, a **session fingerprint** | authoritative server |
| `authentication.failure_reason`, `authentication.mfa_state` | Why authentication failed, and the second-factor state | authoritative server |
| `source.observed.address` | The network address the host observed | observed transport |
| `source.client_reported.*` | What the client said about itself | client claim |
| `tenant.effective_tenant_id`, `tenant.claimed_tenant_id` | The authoritative tenant, and a tenant the client only claimed | authoritative server; client claim |
| `request.id`, `correlation.correlation_id`, `correlation.causation_id`, `correlation.operation_id`, `correlation.original_event_id` | Host-supplied request, correlation and causality identifiers | authoritative server |
| `correlation.trace_id`, `correlation.span_id`, `correlation.message_id` | Transport trace and message identifiers | observed transport |

Trust is published per field, but only the actor carries per-occurrence provenance. Every other field depends on
the host's conformance. SDK acceptance is not an attestation of host truth, of where a value came from, or of
conformance to the catalog's resource rules.

## What is never sent

- secrets and bearer values, including session bearer tokens;
- **presented identifiers**, such as usernames, email addresses or phone numbers, in any field;
- interaction-scoped client evidence;
- a risk block, risk verdicts or enrichment verdicts;
- device fingerprints, which are a different thing from a **session fingerprint**.

An opaque account identifier must never be a presented identifier in disguise.

## Keyed values

The field policy marks these fields `transform_required`: a purpose-scoped keyed transform, or an approved
direct-reference exception:

- `actor.id`, `subject.id` and `authenticated_principal.id`;
- `credential.reference` and `session.id`;
- `source.observed.address`;
- `resource.id`;
- the tenant identifiers;
- `correlation.transaction_id`.

This profile records exactly two direct-reference exceptions, each under its purpose:
- the **exact observed address**;
- the **internal opaque account identifier**, sent directly.

**The occurrence marks no keyed value, except a credential key id the host sets itself in `credential.key_id`.**
A transformation hook's key id is validated but never written to the occurrence (ADR 0014). A consumer
therefore cannot tell a keyed value from a raw one, or one key epoch from another. An unmarked value is not
evidence that it is raw.

## Failed logins carry no target

On contract 2.1.0, a failed login carries no target. That means no subject, no credential reference, and no
presented identifier or account reference in any server-authoritative field (G13). A credential type appears
only when it is safe. This is the only conforming option: Stage P measured 25 candidate carriers on failed
authentication, and none of them is an honest carrier (ADR 0014).

- **No per-target grouping.** A consumer derives no target from the actor identifier, display names, subjects,
  credential references, principals or keyed values. It cannot count or group failed logins per attempted
  account on 2.1.0. Grouping failures by source and time remains available.
- **Non-disclosure.** On a first-factor failure, reasons, messages and resource content never distinguish an
  identifier that matches an account from one that does not.
- **Second-factor and lockout reasons (G36).** After the first factor has resolved the account, `mfa_failed`
  and `rate_limited` are allowed, but they still carry no target, so the occurrence attributes them to no
  account. The host's request and correlation identifiers survive in the occurrence. A consumer that links such
  a failure to an account through them relies on the host's own linkage, which the SDK neither sets nor checks.
  That linkage is not attribution made by the evidence.
- **An accepted target is a conformance failure.** If an accepted failed-authentication occurrence carries a
  subject, credential reference or authenticated principal, the consumer treats it as a host conformance
  failure, not as attributed evidence.
- **Reset requests and registration attempts** carry an account only after safe server resolution, exactly as
  the contract allows.

A keyed presented-identifier reference with client-claim trust is planned as a separate governed contract minor
version (G33, #863). It is not a field on 2.1.0.

## Post-authentication joins

From successful authentication onward, two **post-authentication join identifiers** link one account's chain:

- **The internal opaque account identifier.** It is sent directly under its recorded exception, and is identical
  on every occurrence of the chain: success, session creation, MFA removal, password-reset completion and
  session revocation. It is never keyed per event and never keyed per path. Stage P found that per-path hook
  keying breaks the actor and subject equality that tells a logout from an administrator's revocation.
- **The session fingerprint.** The host computes it from the server session handle, under one key scope shared
  by the whole chain. It is never computed through a transformation hook, whose per-event purpose cannot give a
  stable value across the chain.

On 2.1.0 there is no honest way to link failures before authentication to the later success.

## Exact observed addresses

- **What is sent.** The host sends the exact observed address under the fraud-evidence direct-reference
  exception, because the engine needs exactness for geolocation, network-owner and reputation enrichment.
  Bloodtrail performs no enrichment.
- **Trusted hops.** Extracting the trusted hop is the host's job. Forwarding headers are not trusted by default.
- **Joining across tenants.** Joining exact addresses across tenants happens in the engine, under the engine's
  own governance, never in Bloodtrail.
- **Real users.** Using real-user exact addresses requires a **data-protection impact assessment** first. Stage
  P used documentation-range addresses only.

## Delivery guarantees

**What Stage 2 measured.** Stage 2 (ADR 0015) sent synthetic occurrences through the **reference composition**,
over loopback HTTP, into the evaluation kit's collector configured with SQLite storage, on one workstation. The
harness consumed the packed kit as an evaluator's own service. The composition nests the Node binding's
deadline-bounded shutdown, bounded backpressure, bounded delivery retry, and single-attempt HTTP handoff over the
governed fetch adapter. Each layer is a Bloodtrail export. Composing them, choosing their parameters and turning
their callbacks into operator alerts is host work. The collector stood in for a receiving ingress; it is not a
fraud-evidence consumer.

With the parameters frozen for Stage 2, the reference composition met the in-process half of the delivery
policy's `security_significant` row (`contracts/security-audit/docs/delivery-policy.md`). That half is bounded
retry with jitter and delay accounting, a retry-exhaustion signal, a signal before any overload loss, and
bounded flush. G4 therefore requires no separate `security_significant` binding. The row's other cells, a durable
or protected queue and a durable handoff, stay with the host. The signals are callbacks: they become operator
alerts only when the host routes them.

**Reading the table.** The Stage 2 column holds one of two marks:
- **Demonstrated**, with the run and cases it rests on;
- **Host-composed only**: no Bloodtrail component supplies it, and Stage 2 did not measure it.

"Supplied by" names what provides the behavior. A demonstrated row still holds only as the host composed and
configured it. Run numbers and case IDs refer to the Stage 2 results that ADR 0015 lists with their sha256.

| Guarantee | Stage 2 | Supplied by | The host must | Limits |
|---|---|---|---|---|
| Every copy of an occurrence, first attempt or redelivery, is byte-identical, and no delivery-attempt number enters it | Demonstrated: run 7, C-01 and C-02; run 2, O-07 and O-13 | Core and the HTTP handoff, which send the occurrence unchanged | keep `event.id` and every field value unchanged in any relay that adapts the JSON for an engine | Measured from the handoff to the collector's storage, not through an engine relay. `correlation.retry_attempt` stayed the same on every attempt. Byte identity is not durable delivery |
| An identical copy is acknowledged as a duplicate and stored once. Different content under the same identity is rejected as a conflict, and the stored record stays unchanged. A re-execution is a new occurrence and is stored separately | Demonstrated: run 7, C-03, C-04, C-05 and C-11; run 2, O-01; run 9, H-05 | The collector with storage. Its identity is the storage scope and `event.id`, compared over the whole body | configure storage, and never reuse an `event.id` for different content | 100 deliveries of 50 occurrences stored 50 (C-11). By the same whole-body rule, the same `event.id` under a different transaction ID is a conflict, not a copy |
| Duplicate decisions survive a close and reopen of the collector's storage. After the sending composition is rebuilt, every unacknowledged occurrence is redelivered byte-identically and stored once | Demonstrated: run 7, C-06 and C-07 | The collector's storage. The host kept the unacknowledged occurrences and rebuilt the composition | keep every occurrence until it is acknowledged, and redeliver it after a restart | Both restarts were in process; neither is a process or operating-system crash. The redelivered set was not cross-checked against the unacknowledged one |
| Without storage, the collector deduplicates in memory, holds at most 32 live identities, and refuses the next with `COLLECTOR_DEDUPLICATION_CAPACITY` | Demonstrated: run 7, C-08 | The collector without storage | configure storage for more than 32 distinct occurrences within 300 seconds. With storage, the 32-identity bound does not apply | The 300-second retention is the collector specification's bound and was not measured. A storage-less acknowledgment is not persistence: the 32 acknowledged occurrences were never stored (#910) |
| Retryable failures are retried within the attempt budget, and every scheduled delay is reported through `onAttemptScheduled(nextAttempt, delayMs)` with the number of the attempt it precedes | Demonstrated: run 2, O-02, O-03, O-05, O-10 and O-11; run 4, L-11 | `createBoundedDeliveryRetry` | supply the jitter source, the timer provider, the attempt budget and the delays | Exercised: 503, 429, 408, a timeout after ingest, a transport failure and a lost acknowledgment, within a budget of 4 attempts. The jitter was seeded and the timers injected, so a reported delay is the computed one, not wall-clock time. Retry state is in memory and ends with the process |
| Exhaustion and permanent failures are reported. An exhausted occurrence produces `onExhausted(attempts)`, with attempts equal to the budget, and a failed result. A permanent 400 is reported non-retryable without a retry. A malformed acknowledgment is reported as `protocol_error` without a retry | Demonstrated: run 2, O-01, O-05 and O-11; run 4, L-11 | The bounded delivery retry and the HTTP handoff | route `onExhausted` to an alert, and decide what to do with each failed result | The malformed acknowledgment followed a durable write, so that occurrence was stored although reported failed. Redelivering it gets a duplicate answer |
| At capacity, each further submission is rejected at once, reported through `onRejectedOverload(depth, capacity)` before its result, and never reaches the network | Demonstrated: run 4, L-01, L-07, L-09, L-12 and L-16 | `createBoundedDeliveryBackpressure` | keep each rejected occurrence and redeliver it, or count it as reported undelivered; route the callback to an alert | The gate is not a queue. It holds no backlog, and Bloodtrail keeps no rejected occurrence. 6 of 10 were rejected at small volume, and 900 of 1,000 at volume |
| Once shutdown begins, new submissions are rejected as `rejected_shutting_down`. Every shutdown report satisfies accepted = completed + abandoned. Each composition report returned within its deadline, including the strict 200 ms one | Demonstrated: run 4, L-02, L-03, L-04, L-07, L-10, L-13, L-14 and L-16 | `createDeliveryShutdown`, inside the host's own deadline | give the primitive a deadline shorter than its own, and reserve time for the report. Stage 2 used a 180 ms drain and a 20 ms reserve inside 200 ms, which is not a sizing rule | The primitive returned its report after its own deadline in all 10 samples, by 0.58 to 2.73 ms (#932). Run 3's composition, which gave the primitive the whole 200 ms, missed that deadline (#890). Abandoned means unfinished, not lost: all 6 occurrences abandoned in L-04 were stored, and none of the 4 in L-10 was |
| `best_effort` delivery makes one attempt with no retry, reports every drop with a saturating loss count, signals the loss ceiling once, and never claims delivery | Demonstrated: run 4, L-05 and L-15 | `createBestEffortDelivery`, for `authorization.allowed`, the catalog's only `best_effort` event | route `onDropped` and `onLossCeilingReached` to monitoring, and accept the loss | Lossy by design: 5 of 8 and 100 of 200 were dropped, each one reported |
| Every non-delivery is reported. Each generated occurrence ends in exactly one **terminal bucket**, and none is unexplained: the **accounting identity** | Demonstrated in every accepted run, for example run 2, O-03 and O-10; run 4, L-02, L-04, L-10, L-13 and L-14; run 7, C-07; run 9, H-11; runs 10–12, N-01 to N-10 | The primitives' results, callbacks and shutdown report, and the collector's outcomes, which make each ending visible | keep a record of each occurrence until it reaches a terminal bucket, and count a persisted occurrence as persisted first | The accounting was host code. The copies probe's storage-less phase has no bucket (#910). A burst above the listen backlog can lose first attempts under contention (#926) |
| A business change and its audit record commit together in one transaction. A rollback relays nothing. Committed records are relayed, deferred through an outage, and resumed after a relay restart. A redelivery reaches the collector as a duplicate | Demonstrated: run 9, H-01 to H-07 and H-11 | The host's own database, outbox, relay and persistent retry, relaying through the reference composition | write the audit record inside the business transaction, and relay it from its own outbox | A harness-local synthetic database, not a Bloodtrail outbox product. The relay restart was in process. Each transaction carried one event, so deduplication on event and transaction ID together is not shown (#921). The relay is at-least-once: persistence is idempotent through the collector's identity rule, which is not exactly-once delivery |
| A durable or protected queue, a durable handoff, crash recovery, and persistent retry after a business commit | Host-composed only | The host (G4, G5, #870) | build and operate them | Not measured |
| Operator alerts | Host-composed only | The host | route `onExhausted`, `onRejectedOverload`, `onDropped` and `onLossCeilingReached` to its own alerting | The callbacks are demonstrated above. Bloodtrail raises no alert itself |
| Composition parameters | Host-composed only | The host | choose every parameter, including the jitter source, timer provider, capacity, deadlines and shutdown reserve, and size the listen backlog for bursts (#926) | Stage 2's values are measurements, not recommendations |

**Zero silent loss is not zero delivery failure.** In each of runs 10–12, 1,968 occurrences ran under 20 of
the outage, load and copies fault plans. 888 were persisted. The other 1,080 were not delivered, and each was
reported by a delivery result, an admission signal or the shutdown report.

86 of the persisted occurrences were also reported failed, as a malformed acknowledgment, an abandonment at
shutdown or an overload rejection. A copy of each was stored, either before the failure report or by a later
redelivery. A failure report is therefore not proof that an occurrence was not stored, and a persisted
occurrence counts as persisted.

Per-source counts equal ground truth only when the persisted distinct occurrences are added to the itemized
reported-undelivered remainder. Persisted counts alone fall short under every plan that reports a loss, and raw
sightings include duplicates.

**Not demonstrated by Stage 2.**
- Recovery from a process or operating-system crash. Every restart was in process.
- Deduplication on event ID and transaction ID together, and the case of two events sharing one transaction ID.
- The transaction-critical binding itself: no Stage 2 probe called it, and #913 tracks its open defects.
- The collector's 300-second in-memory retention.
- Chain reconstruction under faults. Stage 2 reconstructed every ground-truth post-authentication chain from
  collector-persisted bodies, but only with no fault plan.
- Per-target counts, or attributing failures before authentication to an account (#863).
- Any network but loopback, any real engine, and production.
- **Any service level.** Stage 2 recorded throughput and latency on one workstation as observations. None of
  them is a service level, a capacity or a sizing rule.

**Demonstrated in Stage P.** Stage P measured these in process, on the packed evaluation kit, with synthetic
data (ADR 0014):

- event identifiers from core's and the Node binding's defaults are unique across fresh processes and restarts;
- every copy and redelivery of an occurrence is byte-identical, and no delivery-attempt metadata enters it
  (ADR 0013);
- a transaction-bound event without an operation handle cannot claim a terminal commit it never reached;
- the transaction-critical binding probes audit durability before running the business commit gate, and fails
  closed without running the gate when the probe reports durability unreachable.

**Not provided by the transaction-critical binding: only the host can compose these.**

- **Commit evidence.** The transaction-critical binding's result and declared guarantees are not proof of a
  business commit. Stage P measured them claiming more than the binding checked (#859, #860). Since that was
  corrected, a `not_committed` occurrence is reported `durable_without_commit` without the commit gate running,
  a failure after the gate committed is reported as `audit_durability_failed_after_commit`, and out-of-type
  probe and gate values fail closed. #913 records that the binding still claims a commit for commit states the
  correction did not list, such as `pending` or an absent commit state. The consumer still reads whether a
  business change committed from the occurrence's own `event.commit_state`.
- **Atomicity.** A host that needs the business change and its audit record to commit or roll back together
  writes the audit record inside the business transaction, and never defers that write past the commit or
  rollback. A write deferred past a rollback left an orphan audit row in Stage P. Stage 2 measured this pattern
  with a host outbox (the table above).
- **Persistence.** The binding has no persistent retry and no retry scheduler; the bounded delivery retry
  retries in memory only. The binding deduplicates only inside one instance, so a second instance delivers the
  same occurrence again.
- **Operations.** The binding has no backlog alert and no shutdown drain. Shutdown draining belongs to the
  reference composition.
- **Crashes.** Durability across crashes belongs to the host (G4).

The consumer deduplicates on `event.id`, so a redelivered copy never inflates evidence counts.

## Expressing the missing signals

Six account-takeover signals have no dedicated catalog event. Stage P's P-map probe classified the best
expression of each on 2.1.0. **Fits** means the catalog covers the signal. **Strained** means the expression is
contract-legal and keeps trust, but the event's purpose does not name the signal. No signal misrepresents, so
no catalog addition is proposed (G10).

| Signal | Express it as | Verdict | Do not |
|---|---|---|---|
| Logout | `session.revoked`, with the user as both actor and subject, and a genuine committed operation handle | fits | use an anonymous actor (misrepresents) |
| MFA challenge failure | `authentication.failed` with `failure_reason` and outcome reason `mfa_failed`, `mfa_state` `failed`, an anonymous actor and no subject | fits | attach the resolved account as subject, or use an authenticated actor because the first factor passed (both misrepresent) |
| Contact-detail change (email, or a phone that is not an MFA factor) | `data.sensitive_resource.modified` on `resource.type` `account`, with an opaque `change_categories` token | strained | put the new value in a category, or label it a security configuration change (both misrepresent) |
| Phone change for an MFA factor | `authentication.mfa.removed` followed by `authentication.mfa.enrolled` | fits | |
| Lockout | `data.sensitive_resource.modified` on the account, with `change_categories` `["lockout"]` and an `allow` authorization from the recorded lockout-policy decision | strained | emit only a targetless `rate_limited` failure, record the lock with authorization `not_applicable`, label it configuration, or record an anonymous deny (all misrepresent) |
| Lockout release | an independent `data.sensitive_resource.modified` on the account, with `change_categories` `["lockout_release"]`, by an administrator or a scheduled process | strained | mark the lock's handle compensated (misrepresents) |
| Password change | `account.password_reset.requested` then `.completed`, linked by genuine causation and original-event links | strained | link the completion to a login rather than to the change request (misrepresents) |
| API or other credential rotation | `data.sensitive_resource.modified` on `resource.type` `credential`, with `change_categories` `["rotation"]` | strained | label it a role assignment (misrepresents) |
| MFA factor replacement | `authentication.mfa.removed` then `authentication.mfa.enrolled` | fits | |

These readings are owner-confirmed (G40):
- an automatic threshold lock is a genuine authorization decision;
- the `password_reset` purpose covers an authenticated password change.

**Conventions.**
- **`change_categories`.** The contract leaves it free-form: there is no registry, enumeration or item length
  limit, and object items are accepted. Use only opaque, lowercase category tokens, such as `lockout`,
  `lockout_release`, `rotation` and a contact token such as `contact_email` or `contact_phone`. Never use a value, an
  address, or anything shaped like personal data.
- **Logout reason.** There is no logout reason code. Logout is told apart from an administrator's revocation
  only by actor and subject equality and by the authorization decision.
- **Tenant scope.** A tenantless login is accepted, but logout, contact change, lockout, release and rotation
  require tenant scope.
- **Lock expiry.** A lock that lapses lazily has no commit point. Emit a release only when the host commits an
  explicit, or scheduled, release.
- **Containment revocations.** `session.revoked` is transaction-critical. A containment revocation that fails
  closed before the business commit can leave a compromised session alive, so the host decides how containment
  proceeds when audit durability is unreachable.
