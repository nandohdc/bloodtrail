## ADDED Requirements

### Requirement: Derived-field material inputs have an optional, closed provenance representation

Contract version `1.1.0` SHALL define `risk.model.provenance.derived_from` as the optional
material-input provenance representation for the event's server-derived risk result. Its absence
SHALL preserve the meaning of a valid `1.1.0` event and SHALL NOT be repaired by inventing inputs.
When present, it SHALL be a non-empty set of one to the contract's bounded maximum number of
code-point-sorted field paths. It SHALL be present only with `derived_server` provenance; a
non-derived provenance declaration that carries it SHALL be rejected.

Each path SHALL resolve either to a canonical field defined by the declared contract version or to a
registered extension namespace. Every resolved canonical path SHALL be present in the same event.
The list SHALL name each material input exactly once, SHALL have no positional meaning, and SHALL
not contain the provenance field itself or any path that forms a derivation cycle. Validation SHALL
reject malformed, duplicate, unsorted, unresolvable, absent, empty, non-derived, and cyclic input
lists with distinct stable outcomes. It SHALL NOT deduplicate, sort, substitute `unknown`, or
otherwise normalize an invalid declaration.

#### Scenario: Canonically ordered material inputs are supplied
- **WHEN** a `1.1.0` event's derived risk provenance declares unique, code-point-sorted paths to
  fields present in that event
- **THEN** validation accepts the provenance and preserves the declared paths without assigning
  precedence, weight, recency, or evaluation order to their positions

#### Scenario: A valid event omits optional provenance
- **WHEN** a structurally and semantically valid `1.1.0` event does not contain
  `risk.model.provenance.derived_from`
- **THEN** validation accepts the event without inferring material inputs or a trust-floor result

#### Scenario: A duplicate or unordered input list is supplied
- **WHEN** a provenance declaration repeats an input path or lists otherwise valid paths outside
  code-point order
- **THEN** validation rejects the event with the distinct duplicate-input or non-canonical-order
  outcome and does not repair the list

#### Scenario: An input is unresolvable or absent
- **WHEN** a provenance declaration names neither a canonical field nor a registered extension
  namespace, or names a canonical field absent from the event instance
- **THEN** validation rejects the event with the distinct unresolvable-input or absent-input outcome

#### Scenario: A derived declaration is empty or cyclic
- **WHEN** a derived provenance declaration is empty or its input path creates a derivation cycle
- **THEN** validation rejects the event with the distinct empty-input or cyclic-derivation outcome

### Requirement: The provenance addition follows the exact-version compatibility policy

The optional provenance representation SHALL be an additive minor contract change from `1.0.0` to
`1.1.0`. Generated artifacts, catalog metadata, documentation, fixtures, provenance bindings, and
private SDK projections SHALL identify `1.1.0` consistently. Each SDK package version SHALL replace
its sole supported-contract baseline with `1.1.0` and take the compatibility-major version step
required by the exact-one contract-version support policy; it SHALL NOT offer an implicit,
negotiated, or multi-version fallback.

#### Scenario: A producer declares the new contract version
- **WHEN** a producer uses the provenance representation
- **THEN** it declares schema version `1.1.0`, and the matching SDK projection accepts exactly that
  contract version

#### Scenario: A consumer presents the superseded version to the new SDK
- **WHEN** a producer configures a `1.1.0` SDK projection with contract version `1.0.0`
- **THEN** construction fails closed with the established unsupported-contract-version outcome

#### Scenario: Generated artifacts are evaluated after the contract move
- **WHEN** contract generation and generated-artifact drift verification run for version `1.1.0`
- **THEN** every generated contract artifact and SDK projection is derived from the same authored
  source and no hand-edited generated artifact is accepted
