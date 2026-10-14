## Purpose

Constrain usage of canonical Bloodtrail contract 2.1.0 as evidence for external fraud-evidence consumers without redefining a contract field. Bloodtrail emits evidence; external consumers own detection, scoring and fraud verdicts. This profile excludes client evidence and risk and makes no execution or evidence-sufficiency claim.

## ADDED Requirements

### Requirement: No target on failed authentication

For failed authentication, producers SHALL send no subject, no credential reference, and no presented identifier or account reference in any server-authoritative field (G13). A credential type SHALL appear only when safe under the canonical resource rule. Keying a value SHALL NOT confer authority or permit an otherwise prohibited target.

#### Scenario: Unresolved failed login
- **WHEN** an authentication failure follows presentation of an identifier that resolves to no account
- **THEN** the occurrence contains no subject or credential reference and no presented identifier or account reference in any server-authoritative field, with credential type included only when safe

#### Scenario: Resolved failed login
- **WHEN** authentication fails after the host has resolved an account
- **THEN** the occurrence still carries no target, including no subject, credential reference or account reference in any server-authoritative field

### Requirement: Resolved accounts only as the contract allows

Reset requests and registration attempts SHALL carry an account only after safe server resolution and only as the canonical contract allows (G27). This profile SHALL NOT tighten the contract's allowed safely resolved cases or add a target the contract forbids. Client-presented locators SHALL NOT substitute for committed server-state authority.

#### Scenario: Reset request safely resolved
- **WHEN** the server safely resolves the account for a reset request and the contract permits its inclusion
- **THEN** the occurrence may carry that server-resolved account, under the existing resource rule without an additional profile restriction

#### Scenario: Registration attempt safely resolved
- **WHEN** the server safely resolves an account for a registration attempt and the contract permits its inclusion
- **THEN** the occurrence may carry that server-resolved account as the existing contract allows

#### Scenario: Request remains unresolved
- **WHEN** a reset request or registration attempt has no safely server-resolved account
- **THEN** no account is asserted by substituting a presented identifier in an authoritative field

### Requirement: Non-disclosing first-factor failures

On a **first-factor** authentication failure, outcome reasons, failure reasons, outcome messages and resource content SHALL NOT distinguish an identifier that matches an account from one that does not (G36). Second-factor `mfa_failed` and per-account lockout `rate_limited` reasons are allowed once first-factor resolution has made disclosure inherent, but SHALL still carry no target and SHALL obey the no-target requirement.

#### Scenario: Matched and unmatched first-factor failure
- **WHEN** first-factor authentication fails for either a matched or an unmatched presented identifier
- **THEN** outcome reasons, failure reasons, outcome messages and resource content do not disclose which account-existence case occurred

#### Scenario: Second-factor failure
- **WHEN** a second-factor challenge fails after the first factor has resolved the account
- **THEN** the occurrence may use mfa_failed but carries no target, subject or credential reference

#### Scenario: Per-account lockout
- **WHEN** an authentication failure reports per-account lockout after first-factor resolution
- **THEN** the occurrence may use rate_limited but carries no target, subject or credential reference

### Requirement: Exact observed source address

Producers SHALL send exact observed addresses under the recorded fraud-evidence direct-reference exception to `source.observed.address`'s `transform_required` policy (G3): exactness is necessary for geolocation, network-owner and reputation enrichment in the external engine, never Bloodtrail. Trusted-hop extraction SHALL be host-owned; forwarding headers SHALL NOT be trusted by default. Real-user use SHALL require a data-protection impact assessment in the consumer integration profile.

#### Scenario: Synthetic observed-address evidence
- **WHEN** a host emits source evidence for the fraud-evidence purpose
- **THEN** it sends the exact observed address with the recorded purpose exception for downstream geolocation, network-owner and reputation enrichment in the external consumer, never Bloodtrail; host-controlled trusted-hop extraction determines that observation

#### Scenario: Real-user integration proposed
- **WHEN** an integration seeks to use real-user exact observed addresses
- **THEN** it requires a DPIA before that use

### Requirement: Stable post-authentication join identifiers

Internal opaque account identifiers SHALL be sent directly under a recorded fraud-evidence direct-reference exception, identical on every post-authentication occurrence (G29). Session identifiers SHALL be host-computed keyed fingerprints of the server session handle under one key scope shared by the chain, never bearer values and never computed through a transformation hook.

#### Scenario: Account chain
- **WHEN** success, session creation, MFA removal, password-reset completion and session revocation occurrences refer to the same internal account
- **THEN** each sends the identical opaque account identifier directly under its recorded exception, not a per-event keyed variant or presented login identifier

#### Scenario: Session creation through revocation
- **WHEN** permitted chain occurrences refer to the same server session handle
- **THEN** the host supplies the same keyed fingerprint under the shared chain key scope, without sending the bearer value or relying on per-event transformation hooks

### Requirement: Event identity survives processes and restarts

Producers SHALL supply event IDs unique across processes and restarts, satisfied by SDK core defaults since #796 was fixed, Node defaults or a qualifying caller-supplied random source. Consumers may rely on canonical byte-identical copies and absence of delivery-attempt metadata in occurrences (`openspec/specs/delivery-conformance-contract/spec.md`; system ADR 0013, `docs/adr/0013-delivery-attempts-never-enter-the-canonical-event.md`).

#### Scenario: Fresh producer process
- **WHEN** a producer starts or restarts using a qualifying core, Node or caller-supplied random identifier source
- **THEN** new occurrences receive identifiers unique across those processes and restarts, rather than restarting a deterministic sequence

#### Scenario: Occurrence redelivery
- **WHEN** the same occurrence is copied or redelivered
- **THEN** its event identifier and bytes remain identical and no delivery-attempt metadata is added to it

### Requirement: Consumers interpret trust and deduplicate

Consumers SHALL read trust from the published field policy together with in-event actor provenance and SHALL deduplicate on event id. Consumers SHALL NOT treat SDK acceptance or branding as attestation of host truth or origin, or assume an unmarked value is raw.

#### Scenario: Accepted authoritative field
- **WHEN** a consumer receives a structurally accepted occurrence
- **THEN** it interprets each field using the published policy and actor provenance; only actor provenance is recorded per occurrence and other fields depend on host conformance, not attestation from acceptance

#### Scenario: Unmarked keyed value
- **WHEN** a consumer receives a value that may have been keyed
- **THEN** absence of a marker does not establish that it is raw: a transformation hook's key ID does not reach the occurrence, apart from a credential key ID separately set by the host

#### Scenario: Duplicate occurrence
- **WHEN** a consumer receives another copy with the same event id
- **THEN** it deduplicates that occurrence rather than inflating evidence counts

### Requirement: Exclusions and recorded purpose exceptions

Producers SHALL NOT send interaction-scoped client evidence, a risk block or enrichment verdicts, device fingerprints, secrets or bearer values, or presented login identifiers such as usernames, email addresses or phone numbers. Exact observed addresses and directly sent internal opaque account identifiers SHALL be the recorded exceptions to the default privacy transform, each under its purpose justification. An opaque account ID SHALL NOT be a presented login identifier in disguise.

#### Scenario: Consumer payload composition
- **WHEN** a host composes evidence for the external consumer
- **THEN** it excludes all listed prohibited content and applies only the recorded exact-address and direct opaque-account exceptions, never secrets, bearers or presented login identifiers

### Requirement: Usage-only canonical boundary

This capability SHALL constrain usage only and SHALL redefine no contract field. Bloodtrail SHALL remain canonical; client evidence and risk SHALL remain excluded. The profile SHALL NOT present a future honest presented-identifier field as an existing field in 2.1.0 or substitute display names, usernames, email addresses or client claims for authoritative identifiers. Any later field requirement SHALL be addressed by a separate governed contract change, not by this capability delta.

#### Scenario: Target-carrier gap
- **WHEN** a consumer needs an unresolved presented-identifier carrier absent from the canonical contract
- **THEN** this profile does not invent one or reinterpret an authoritative field, and any field addition requires its separate governed contract change
