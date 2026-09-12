## ADDED Requirements

### Requirement: Audit records carry an optional closed client-evidence reference

The additive contract move from `2.0.0` to `2.1.0` SHALL permit an audit record to omit
`client_evidence` entirely. When present, `client_evidence` SHALL contain exactly one v1 reference:
`interaction_id`, `interaction_kind`, `envelope_version`, and provenance. The interaction identifier
SHALL be a lowercase UUID version 4; the interaction kind SHALL be one of the eight P1 vocabulary
values; and the envelope version SHALL be exactly `1`.

The reference SHALL NOT contain the raw client envelope, nonce, client timestamp, individual claim,
transform history, URL, storage identifier, device signal, server-owned value, or an unbounded object.
The contract SHALL reject an unknown member, invalid identifier, unapproved interaction kind, or an
unknown envelope version without repairing, truncating, or projecting it into another field.

#### Scenario: A server-only audit record remains valid
- **WHEN** a record otherwise valid for contract `2.1.0` omits `client_evidence`
- **THEN** the contract accepts it without inferring a client interaction or changing any
  server-owned correlation, request, risk, tenant, actor, authorization, or trust field

#### Scenario: A bounded v1 reference is present
- **WHEN** a `2.1.0` record carries one lowercase UUID v4 interaction identifier, one approved
  interaction kind, envelope version `1`, and the fixed provenance representation
- **THEN** the contract accepts the reference as a client-originated correlation annotation only

#### Scenario: An unapproved reference representation is supplied
- **WHEN** a record supplies an unknown envelope version, an invalid or oversized interaction
  identifier, an unapproved interaction kind, or a raw envelope member under `client_evidence`
- **THEN** contract validation rejects the record and preserves no transformed or partial reference

### Requirement: Client-evidence provenance is fixed at client claim trust

Every present `client_evidence` reference SHALL declare provenance source `client_reported`, trust
level `client_claim`, platform `web_browser`, and capture scope `interaction_ephemeral`. The schema
SHALL reject any other value for those fields. Client evidence SHALL remain a correlation annotation
and SHALL NOT overwrite, elevate, derive, authenticate, authorize, enforce, or become evidence for a
server-owned field.

#### Scenario: A client attempts trust or provenance escalation
- **WHEN** a record carries `client_evidence` with a source, trust level, platform, or capture scope
  other than the fixed P1 values
- **THEN** contract validation rejects the record before any consumer can treat the reference as a
  server or attested claim

#### Scenario: A risk model depends on the interaction reference
- **WHEN** a risk model declares `client_evidence.interaction_id` as a material input
- **THEN** the contract's provenance floor limits the model to `client_claim` and rejects a higher
  declared trust level

### Requirement: Client-evidence contract compatibility is exact and generated

The optional reference SHALL be the governed additive contract move `2.0.0` to `2.1.0`. The sole
authored contract source, every generated contract artifact, committed compatibility fixture, contract
provenance record, candidate governance binding, and each exact-version SDK and collector projection
SHALL identify `2.1.0` together. A newly generated consumer SHALL accept exactly `2.1.0` and reject
superseded versions; the compatibility fixture for server-only records proves field compatibility
within `2.1.0`, not multi-version runtime support.

#### Scenario: Generated artifacts agree on the minor move
- **WHEN** generation and drift validation run after the `2.1.0` move
- **THEN** every derived contract and consumer projection is byte-derived from the same authored
  source and no hand-edited generated artifact is accepted

#### Scenario: A superseded version reaches a new exact-version consumer
- **WHEN** a new SDK or collector projection is configured with contract `2.0.0` or an earlier
  version
- **THEN** it fails closed with the established unsupported-contract-version outcome
