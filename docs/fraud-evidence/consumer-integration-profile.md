# Fraud-evidence consumer integration profile

For integrators who feed Bloodtrail occurrences to an external fraud engine, a **fraud-evidence consumer**.
Terms in bold are defined in this directory's `CONTEXT.md`.

## Status and boundaries

- **Normative source.** This profile explains the `fraud-evidence-profile` capability, which is the normative
  text. That capability is `openspec/specs/fraud-evidence-profile/spec.md` once #807 folds it; until then, it is
  the delta in the active OpenSpec change `verify-fraud-evidence-sufficiency`. Where this profile and the
  capability differ, the capability wins.
- **Contract.** Everything here applies to canonical contract 2.1.0. The profile constrains usage only and
  redefines no contract field.
- **Verdict.** System ADR 0014 (`docs/adr/0014-fraud-evidence-sufficiency-is-not-met-on-contract-2-1-0.md`)
  records the Stage P verdict: **synthetic evidence-sufficiency is not met on contract 2.1.0**, because no
  existing field is an **honest carrier** for a failed login's target. This profile describes how to use 2.1.0
  honestly under that verdict. It makes no sufficiency claim.
- **Roles.** Bloodtrail emits evidence. The consumer owns detection, scoring and fraud verdicts, and the host
  owns the relay that adapts Bloodtrail-native JSON to the consumer's API.
- **Authorization.** This profile authorizes nothing. Production deployment, real-user data, transports,
  exporters, collectors and integration with a real engine each need their own governed change and explicit
  authorization. Stage P used synthetic data only.

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

**Demonstrated.** Stage P measured these on the packed evaluation kit, with synthetic data:

- event identifiers from core's and the Node binding's defaults are unique across fresh processes and restarts;
- every copy and redelivery of an occurrence is byte-identical, and no delivery-attempt metadata enters it
  (ADR 0013);
- a transaction-bound event without an operation handle cannot claim a terminal commit it never reached;
- the transaction-critical binding probes audit durability before running the business commit gate, and fails
  closed without running the gate when the probe reports durability unreachable.

**Not provided by the binding: only the host can compose these.**

- **Commit evidence.** The transaction-critical binding's result and declared guarantees are not proof of a
  business commit. Stage P saw `committed_and_durable` reported for a `not_committed` occurrence, and a failure
  after the commit gate ran declared as failing closed before commit (#860). Out-of-type probe and gate values
  fail open (#859). The consumer reads whether a business change committed from the occurrence's own
  `event.commit_state`.
- **Atomicity.** A host that needs the business change and its audit record to commit or roll back together
  writes the audit record inside the business transaction, and never defers that write past the commit or
  rollback. A write deferred past a rollback left an orphan audit row in Stage P.
- **Persistence.** There is no persistent retry and no retry scheduler. Deduplication happens only inside one
  binding instance, so a second instance delivers the same occurrence again.
- **Operations.** There is no backlog alert and no shutdown drain on this binding.
- **Crashes.** Durability across crashes belongs to the host (G4).

The consumer deduplicates on `event.id`, so a redelivered copy never inflates evidence counts. Delivery under
outages, saturation, duplicates and restarts is Stage 2's scope (#833) and is not measured here.

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
