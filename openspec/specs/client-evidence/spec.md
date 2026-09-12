# client-evidence Specification

## Purpose

Bounded, low-assurance client claims for one purpose only — interaction-scoped audit correlation
(P1) — carried in a separate, closed, versioned envelope, validated fail-closed at the backend, and
mapped into audit records without ever becoming server evidence. Established under delegation from
the project owner on 2026-09-10; it authorizes no production, publication, deployment, or real-user
collection.

## Requirements

### Requirement: Client evidence serves purpose P1 and no other

Client evidence SHALL serve only P1, as recorded in `decisions/117-client-evidence-purpose.md`: letting
a person answering an audit inquiry decide which server-side audit events one user-initiated client
interaction caused. It SHALL NOT be used as a risk-model input, identity attribution, authentication
evidence, an authorization or enforcement input, or a detection signal, and the 2026-07-31 no-adoption
outcome SHALL continue to govern every purpose other than P1. Adding a purpose SHALL require a new
purpose record in the same format.

#### Scenario: A client claim reaches a risk model
- **WHEN** a risk model lists a client-evidence input in `derived_from` and declares a trust level
  more trusted than `client_claim`
- **THEN** contract validation rejects it with the trust-floor outcome, so client evidence can never
  raise a risk result's trust

#### Scenario: A client claim reaches an authorization or enforcement path
- **WHEN** a mapping or ingress change would write a client-evidence value into an authorization,
  authentication, decision, or enforcement field
- **THEN** a mapping mutation arm fails and the change is rejected

### Requirement: The client-evidence data inventory is closed and minimal

An envelope SHALL carry exactly the inventory recorded in #117: one 128-bit interaction identifier
generated per interaction and never persisted or reused; one interaction kind from a closed vocabulary
of at most eight values; envelope version and bounds metadata; and, in Mode A only, an echoed
server-issued nonce. It SHALL NOT carry URLs, paths, query strings, DOM or form content, user-agent
strings, device, screen, hardware, locale, or time-zone characteristics, IP addresses, geolocation,
cookies or storage identifiers, account, user, or device identifiers, or any value stable across
interactions.

#### Scenario: A prohibited field is present
- **WHEN** an envelope carries any field outside the inventory
- **THEN** it is rejected at ingress and never mapped or stored

#### Scenario: An identifier is reused across interactions
- **WHEN** the SDK is exercised across many interactions
- **THEN** no interaction identifier repeats and none is written to any browser storage API

### Requirement: ClientEvidenceEnvelope v1 is a separate, closed, versioned contract

The envelope SHALL be defined by its own authored source, independent of the security-audit event
contract, the SDK Core, and the delivery contract, with an explicit `v1` discriminator, bounded
strings and collections, and generated artifacts drift-gated against the source. Unknown versions and
unknown fields SHALL be rejected, and oversized content SHALL be rejected rather than truncated.
Every claim in it SHALL carry or inherit `client_claim` trust.

#### Scenario: A canonical envelope validates
- **WHEN** a well-formed v1 envelope within every bound is validated
- **THEN** it passes the generated validation and its claims carry `client_claim` trust

#### Scenario: An unknown version, oversized collection, or malformed provenance is supplied
- **WHEN** an envelope declares an unknown version, exceeds a bound, or carries malformed provenance
- **THEN** it deterministically fails validation and is not repaired

### Requirement: The browser package uses Web APIs only and neither transmits nor persists

The browser package SHALL use Web APIs only, SHALL NOT import or depend on the SDK Core, a Node
built-in, or any runtime package, SHALL generate identifiers with `crypto.getRandomValues`, SHALL use
no storage API, and SHALL make no network request. The host application sends the envelope with its
own request. Missing browser capabilities SHALL produce documented, bounded behaviour, never a weaker
identifier.

#### Scenario: The package is inspected for Core and Node coupling
- **WHEN** dependency and bundle inspection runs over the browser package
- **THEN** it finds no import of the SDK Core, no Node built-in, and no runtime dependency

#### Scenario: Secure randomness is unavailable
- **WHEN** `crypto.getRandomValues` is unavailable
- **THEN** the package produces no envelope and reports a bounded capability error rather than
  falling back to a weaker source

### Requirement: Backend ingress validates client evidence fail-closed

Backend ingress SHALL validate the envelope's version, structure, bounds, vocabulary, and, in Mode A,
its nonce's issuance, freshness, and single use, before any mapping. It SHALL reject a replayed or
substituted nonce, SHALL reject any attempt to assert or overwrite a server-owned field, and SHALL
record rejections only as bounded counters keyed by stable class, never as audit evidence and never
carrying a raw payload or identifier. The absence of client evidence SHALL carry no security meaning.

#### Scenario: A replayed envelope is submitted
- **WHEN** a Mode A envelope whose nonce was already used, or has expired, is submitted
- **THEN** ingress rejects it with the replay class and maps nothing

#### Scenario: A client attempts server-field fabrication
- **WHEN** an envelope carries a value addressed to a server-owned risk, trust, actor, or tenant field
- **THEN** ingress rejects it with the fabrication class before mapping

#### Scenario: A spoofed interaction identifier is submitted
- **WHEN** a well-formed envelope carries a forged interaction identifier with a valid nonce
- **THEN** ingress accepts it as a `client_claim` and nothing downstream treats it as more than a claim

### Requirement: Mapping preserves client trust and never fabricates server evidence

Mapping SHALL link a validated claim to the audit event it correlates, SHALL preserve `client_claim`
trust and its provenance, and SHALL NOT write a client value into any server-owned field. Missing or
ambiguous correlation and conflicting claims SHALL produce a deterministic, documented outcome.

#### Scenario: A mapping labels a client value as server-derived
- **WHEN** a mapping mutation labels a client value `derived_server` or more trusted
- **THEN** a mapping test deterministically fails

### Requirement: A Mode A proof of concept decides whether the wave continues

A synthetic, non-production Mode A proof of concept SHALL measure every metric and stop criterion in
`decisions/118-success-and-stop-criteria.md` against its stated baseline, attempt replay, claim
substitution, correlation collision, and server-field fabrication, and record GO, NO-GO, or REVISE.
A NO-GO, or any stop criterion firing, SHALL end the wave.

#### Scenario: Trace context alone groups interactions as well
- **WHEN** the proof of concept measures an incremental utility below the #118 threshold
- **THEN** the outcome is NO-GO and later task groups do not proceed

### Requirement: Mode B device trust is a separate decision

Any trust above `client_claim` for device-originated claims SHALL require a separate Mode B decision
naming each supported attestation mechanism or selecting NO-GO. Until a GO exists, unavailable,
invalid, stale, or replayed attestations SHALL NOT receive elevated trust, and no Mode B
implementation SHALL exist.

#### Scenario: No Mode B decision exists
- **WHEN** a device claim arrives with an attestation and no Mode B GO decision exists
- **THEN** it is treated at `client_claim` trust or rejected, and never elevated

### Requirement: Client-evidence governance carries its delegated provenance

Every client-evidence record, requirement, and implementation change SHALL carry
`decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner decision"` until
the owner personally reviews it, and SHALL NOT be cited as exact-commit owner authorization. This
capability SHALL authorize no production, publication, deployment, or real-user collection, and SHALL
state that the qualified privacy/legal review required by the 2026-07-31 outcome remains outstanding.

#### Scenario: The capability is cited as authorization to collect from real users
- **WHEN** this capability is cited as authorization for real-user collection
- **THEN** the citation fails, because the capability authorizes none and the qualified review is
  outstanding
