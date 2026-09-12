# Canonical Client Correlation Field Decision (#122)

Status: **decided — for purpose P1 only, taken under delegation**.

This record selects the canonical name, semantics, cardinality, lifecycle, generation authority,
and privacy treatment for client-to-server correlation, satisfying the source-plan traceability
requirement PLAN-081 and Issue #122 within the governed capability `add-client-evidence-capability`.

## Decision record

- **Decision taken by:** Antigravity (AI coding assistant), acting under delegation from the project owner
- **Project owner:** Fernando Homem da Costa (`nandohdc`)
- **Delegation:** on 2026-09-11, the owner instructed: *"I want you to keep going and implement ONLY the issues between #96 to #132 … you full authorization to implement them"* and *"I dont have time to make decisions, you must do for me. I authorized you to merge the PRs using --admin when CI has no failures."* Issue #122 is in that range.
- **Decision source:** `decision_source = "delegated to Antigravity by the owner, 2026-09-11; not a human owner decision"`
- **Review type:** delegated architectural decision. **The owner has not personally reviewed this record.** It is not an exact-commit human owner authorization, and it must not be cited as one.
- **Date:** 2026-09-11
- **Prerequisite records bound to:**
  - `117-client-evidence-purpose.md` (Purpose P1: interaction-scoped audit correlation)
  - `118-success-and-stop-criteria.md` (Metric and stop thresholds)
  - `119-privacy-and-threat-review.md` (Technical privacy and threat-model review)
  - `121-implementation-authorization.md` (Delegated owner authorization for implementation)
  - Canonical contract version support policy: `EXACT_ONE` per package version (#75, ratified at `main@14ccbc6889f37922b21e62cfc764186b2c5e8388`)
- **Decision:** **Adopt `interaction_id` as the canonical client correlation field** with the exact specifications below.

---

## The canonical field: `interaction_id`

### 1. Field name and paths

- **Envelope contract name:** `interaction_id` (declared at the root of `ClientEvidenceEnvelope` v1 in #123).
- **Audit event reference path:** `client_evidence.interaction_id` (referenced in the security-audit event contract at `client_claim` trust level in #125).
- **Ingress header representation:** `X-Bloodtrail-Interaction-Id` (or carried in the serialized envelope body via `X-Bloodtrail-Client-Evidence`).

### 2. Semantic definition

`interaction_id` denotes an **interaction-scoped audit correlation identifier**. It represents an
ephemeral grouping of client-side events and resultant server-side audit events caused by *one*
discrete user-initiated interaction (e.g., clicking a button that triggers multiple concurrent or
sequential API requests, completing a multi-step form, or retrying a failed form submission).

**Trust posture:**
- Explicitly **untrusted**: `trust_level = "client_claim"`.
- Treated strictly as an unverified client assertion.
- MUST NOT be used for identity attribution, authentication, authorization, access control, risk scoring, customer enforcement, or fraud verdicts.
- #96's trust floor ensures mechanically that any derived calculation consuming `interaction_id` cannot claim more than `client_claim` trust.

### 3. Generation authority

- **Authoritative generator:** The client browser package (`@bloodtrail/client-evidence-browser`).
- **Cryptographic entropy source:** Standard Web Cryptography API:
  - `crypto.randomUUID()` when available; or
  - `crypto.getRandomValues(new Uint8Array(16))` formatted as a lowercase RFC 4122 UUID v4 string.
- **Fail-closed generation:** If cryptographically secure randomness (`crypto`) is unavailable in the execution context, the client package MUST fail closed: it MUST NOT generate a weak identifier, MUST NOT fall back to `Math.random()`, timestamp-based generation, or sequential counters, and MUST return a structured capability-missing error without producing an envelope.
- **Server authority:** The server NEVER generates or re-keys an `interaction_id`. In Mode A, the server generates and issues an ephemeral, single-use `nonce` which the client echoes in the envelope, cryptographically binding the client claim to an authorized server interaction window.

### 4. Lifetime and ephemerality

- **Interaction-scoped only:** The identifier is instantiated when a distinct user interaction starts and is discarded immediately when the interaction completes.
- **Storage prohibition:** An `interaction_id` MUST NEVER be persisted across browsing contexts or page reloads. The SDK is prohibited from writing `interaction_id` to `localStorage`, `sessionStorage`, `IndexedDB`, cookies, CacheStorage, ServiceWorker storage, or OPFS.
- **Interaction timeout:** An active interaction that does not complete within a bounded duration (maximum 60 seconds) is terminated by the SDK and its `interaction_id` is discarded.

### 5. Format and representation

- **Representation:** RFC 4122 UUID version 4 in lowercase hexadecimal with canonical hyphen delimiters:
  `8-4-4-4-12` format, exactly 36 characters.
- **Pattern:** `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`
- **Bounds:** Fixed length: 36 bytes UTF-8 string. Any value with length $\neq 36$ or failing regex validation is rejected fail-closed at backend ingress (#126).

### 6. Cardinality and relationship

- **1-to-N interaction mapping:** One user interaction produces exactly one `interaction_id`, which annotates $1 \dots N$ subsequent HTTP requests and their server-side audit events.
- **1-to-1 envelope mapping:** Each `ClientEvidenceEnvelope` v1 carries exactly one `interaction_id`.
- **Mode A binding:** In Mode A, the envelope pairs `interaction_id` with exactly one server-issued `nonce`.

### 7. Collision handling

- **Entropy:** 122 bits of cryptographic randomness yield a collision probability of $2^{-122}$, making accidental collision mathematically negligible across all synthetic and operational volumes.
- **Deterministic resolution:** In the event of an identical `interaction_id` observed across different sessions, tenants, or disjoint time windows, the server treats them as independent claims disambiguated by server-authoritative context (`session.id`, `tenant.id`, `timestamp`).

### 8. Cross-origin and cross-device boundaries

- **Strictly single-origin:** An `interaction_id` MUST NOT be shared across distinct origins, sent to third-party domains, or transmitted via cross-origin messaging (`postMessage` to foreign origins).
- **Strictly single-device:** An `interaction_id` MUST NOT cross device boundaries or be propagated via push notifications or sync services.
- **Device fingerprinting prohibited:** As mandated by #117 and the 2026-07-31 project owner outcome, no hardware, screen, audio, canvas, font, battery, or device-specific signals may be collected, hashed, or combined with `interaction_id`.

### 9. Server mapping and evidence separation

- **Ingress validation:** Collector ingress validates format, bounds, version, and Mode A nonce validity fail-closed before mapping (#126).
- **Field non-overwriting:** `interaction_id` MUST NEVER overwrite or mutate existing server-authoritative fields:
  - `request.id` (stays server-unique per HTTP request)
  - `correlation.correlation_id` (stays server-assigned operation identifier)
  - `correlation.trace_id` (stays transport-propagated trace context)
- **Record placement:** Mapped into the audit record under `client_evidence.interaction_id` alongside `provenance.source = "client_reported"`.

### 10. Privacy transformation, retention, and deletion

- **Zero embedded semantics:** The identifier carries pure cryptographic randomness with no embedded timestamps, network addresses, or personal attributes.
- **Privacy boundary:** The identifier is not direct personal data; it derives personal character solely by linkage to the containing audit record.
- **Retention:** Follows the parent audit record's `data.retention_class` in collector storage; deleted synchronously when the audit record reaches its retention deadline.
- **No hashing required:** Because the identifier is a one-time random token with high entropy and zero persistent linkability, neither tokenization nor hashing is required.

### 11. Compatibility and version policy

- **Exact-one policy:** Complies with #75 (`openspec/specs/security-audit-sdk-core/spec.md`). Each SDK version supports exactly one canonical contract version.
- **Contract evolution:** Adding `client_evidence.interaction_id` to the audit contract is scheduled as a governed additive minor move (`2.0.0` $\rightarrow$ `2.1.0`) under Issue #125, preserving backwards compatibility for earlier records.

---

## Alternatives considered and rejected

| Alternative | Evaluation & Force Analysis | Rejection Reason |
|---|---|---|
| `session.id` | Already exists in audit events; groups hours of disparate user activity. | **Rejected:** Far too coarse. Fails to answer whether two requests came from one click; enables cross-interaction tracking and violates data minimization (#117). |
| `request.id` / `correlation.id` | Unique per HTTP request or operation. | **Rejected:** Far too fine. Twelve requests from one multi-step interaction produce twelve distinct IDs; cannot establish interaction grouping. |
| `correlation.trace_id` | Propagated via standard W3C tracecontext. | **Rejected:** Labeled `observed_transport` in the contract, which overstates client trustworthiness. Trace context is frequently reused across multiple interactions by application frameworks and lacks interaction-boundary semantics. |
| Stable device/hardware identifier | Derived from hardware or browser characteristics. | **Rejected:** Violates privacy commitments. Explicitly prohibited by #117 and the 2026-07-31 owner outcome. Enables cross-site tracking. |
| Monotonically increasing counter | Sequence counter per session (1, 2, 3...). | **Rejected:** Predictable and leakable. Exposes interaction volume and sequencing to eavesdroppers or concurrent scripts, susceptible to injection and spoofing. |
| `client_interaction_id` (name) | Descriptive but verbose naming alternative. | **Rejected:** Redundant when placed under the `client_evidence` namespace (`client_evidence.interaction_id`). `interaction_id` is clean, concise, and standard. |

---

## Decision provenance

`decision_source = "delegated to Antigravity by the owner, 2026-09-11; not a human owner decision"`.
