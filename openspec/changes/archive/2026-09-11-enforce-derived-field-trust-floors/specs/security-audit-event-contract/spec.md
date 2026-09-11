## ADDED Requirements

### Requirement: Derived-field material inputs have a mandatory, floor-enforced provenance representation

From contract version `2.0.0`, an event that carries `risk` SHALL carry both
`risk.model.provenance.trust_level` and `risk.model.provenance.derived_from`, and an event missing
either SHALL be rejected with the distinct missing-provenance outcome pointed at the missing path.
`derived_from` SHALL be a non-empty set of one to the contract's bounded maximum number of
code-point-sorted field paths.

Each path SHALL resolve either to a canonical field defined by the declared contract version or to a
registered extension namespace, and every resolved canonical path SHALL be present in the same event.
The list SHALL name each material input exactly once, SHALL have no positional meaning, and SHALL NOT
contain the provenance field itself or any path under `risk`, each of which is a derivation cycle.

An input's trust SHALL be the contract's own declaration for it: the field-policy trust of a canonical
path, or the declared trust of a registered extension namespace. It SHALL NOT be read from the event
instance. The declared `trust_level` SHALL be no more trusted than `derived_server`, the producer's
transformation ceiling, and no more trusted than the least trusted input, both compared by the
canonical trust order. A declaration above the ceiling SHALL be rejected with the non-derived outcome;
a declaration above the least trusted input SHALL be rejected with the distinct trust-floor outcome,
pointed at the first input in canonical order that carries the floor level, by position and without
echoing the path.

Validation SHALL reject missing, malformed, duplicate, unsorted, unresolvable, absent, empty,
non-derived, cyclic, and floor-exceeding declarations with distinct stable outcomes, and SHALL NOT
deduplicate, sort, substitute `unknown`, lower the declared level, or otherwise normalize an invalid
declaration.

#### Scenario: Inputs at or above the declared level are accepted
- **WHEN** a `2.0.0` event's risk provenance declares `derived_server` and unique, code-point-sorted
  inputs each declared `derived_server` or more trusted, all present in the event
- **THEN** validation accepts the provenance without assigning precedence, weight, recency, or
  evaluation order to input positions

#### Scenario: A lower-trust input lowers what may be claimed
- **WHEN** a risk model's inputs include a field whose declared trust is `client_claim` and the model
  declares `client_claim`
- **THEN** validation accepts it, and the same inputs with a `derived_server` declaration are
  rejected with the trust-floor outcome pointed at the `client_claim` input's position

#### Scenario: Lowering one input's trust makes an unchanged claim fail
- **WHEN** one material input of an accepted `derived_server` declaration is replaced by a present
  input whose declared trust is less trusted than `derived_server`, and the declared level is unchanged
- **THEN** validation deterministically rejects it with the trust-floor outcome

#### Scenario: Provenance is omitted
- **WHEN** a `2.0.0` event carries `risk` without `trust_level` or without `derived_from`
- **THEN** validation rejects it with the missing-provenance outcome and does not infer inputs

#### Scenario: A declaration exceeds the transformation ceiling
- **WHEN** a risk model declares `authoritative_server`, `verified_assertion`, or `observed_transport`
- **THEN** validation rejects it with the non-derived outcome whatever its inputs

#### Scenario: A duplicate or unordered input list is supplied
- **WHEN** a provenance declaration repeats an input path or lists otherwise valid paths outside
  code-point order
- **THEN** validation rejects the event with the distinct duplicate-input or non-canonical-order
  outcome and does not repair the list

#### Scenario: An input is unresolvable or absent
- **WHEN** a provenance declaration names neither a canonical field nor a registered extension
  namespace, or names a canonical field absent from the event instance
- **THEN** validation rejects the event with the distinct unresolvable-input or absent-input outcome

#### Scenario: A declaration is empty or cyclic
- **WHEN** a provenance declaration is empty, names the provenance field, or names any path under
  `risk`
- **THEN** validation rejects the event with the distinct empty-input or cyclic-derivation outcome

### Requirement: Derived provenance version moves follow the exact-version compatibility policy

Introducing the optional provenance representation SHALL have been the additive minor move
`1.0.0` → `1.1.0`, and making it mandatory with the trust floor enforced SHALL be the breaking major
move `1.1.0` → `2.0.0`. After each move, generated artifacts, catalog metadata, documentation,
fixtures, provenance bindings, and private SDK projections SHALL identify the new version
consistently, and each SDK package version SHALL replace its sole supported-contract baseline with it
and take the compatibility-major version step the exact-one policy requires, without an implicit,
negotiated, or multi-version fallback.

#### Scenario: A producer declares the current contract version
- **WHEN** a producer uses the mandatory provenance representation
- **THEN** it declares schema version `2.0.0`, and the matching SDK projection accepts exactly that
  contract version

#### Scenario: A consumer presents a superseded version to the new SDK
- **WHEN** a producer configures a `2.0.0` SDK projection with contract version `1.1.0` or `1.0.0`
- **THEN** construction fails closed with the established unsupported-contract-version outcome

#### Scenario: Generated artifacts are evaluated after the contract move
- **WHEN** contract generation and generated-artifact drift verification run for version `2.0.0`
- **THEN** every generated contract artifact and SDK projection is derived from the same authored
  source and no hand-edited generated artifact is accepted

## REMOVED Requirements

### Requirement: Derived-field material inputs have an optional, closed provenance representation

**Reason**: Contract `2.0.0` makes the provenance mandatory for every event that carries `risk` and
enforces the trust floor; the optional `1.1.0` representation and its scenario accepting an event that
omits it no longer describe the contract.

**Migration**: Replaced by *Derived-field material inputs have a mandatory, floor-enforced provenance
representation*. A producer adds `derived_from` listing every material input and declares a
`trust_level` no more trusted than its least trusted input.

### Requirement: The provenance addition follows the exact-version compatibility policy

**Reason**: It described only the `1.0.0` → `1.1.0` move and named `1.1.0` as the current version.

**Migration**: Replaced by *Derived provenance version moves follow the exact-version compatibility
policy*, which records both moves and names `2.0.0`.
