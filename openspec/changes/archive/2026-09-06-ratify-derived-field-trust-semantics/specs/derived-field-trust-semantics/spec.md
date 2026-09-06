## ADDED Requirements

### Requirement: Trust levels form a total order with unknown as the floor

The canonical trust levels SHALL be ordered, most trusted first: `authoritative_server`,
`verified_assertion`, `observed_transport`, `derived_server`, `downstream_enrichment`,
`client_claim`, `unknown`. `unknown` SHALL be the least trusted level and SHALL participate in the
order rather than being treated as unordered or absent.

Comparison of two trust levels SHALL be total and deterministic, and SHALL depend on nothing but the
two levels compared.

#### Scenario: Unknown input is the least trusted
- **WHEN** two trust levels are compared and one of them is `unknown`
- **THEN** `unknown` is the less trusted of the two

#### Scenario: Ordering is independent of context
- **WHEN** the same two trust levels are compared in any two evaluations
- **THEN** the comparison yields the same result in both

### Requirement: Material derivation inputs are defined by counterfactual and are listed exhaustively

An input SHALL be material to a derivation exactly when the derived value could differ had that
input differed while every other input was held fixed. Every material input SHALL be listed in the
derived field's provenance. An input that is not material SHALL NOT be listed.

Materiality SHALL be a property of the derivation rather than a category of field, so that no
enumerated list of input kinds needs maintaining as the contract grows.

#### Scenario: Input that can change the output is material
- **WHEN** a derived value would differ for some admissible alternative value of an input
- **THEN** that input is material and is listed in the derived field's provenance

#### Scenario: Input that cannot change the output is not listed
- **WHEN** an input cannot change the derived value for any admissible alternative value
- **THEN** that input is not material and is not listed

#### Scenario: Presence-determining input is material
- **WHEN** an input determines only whether the derived field is emitted at all
- **THEN** that input is material, because the output differs by existing or not

### Requirement: Derived-field provenance is a set with no positional meaning

Derived-field provenance SHALL be a set of input paths. Position SHALL carry no meaning, and a
consumer SHALL NOT infer precedence, weight, recency, or evaluation order from it. The canonical
serialization SHALL be sorted by code point, so that the ordering is deterministic and independent
of locale.

#### Scenario: Two orderings denote the same provenance
- **WHEN** two provenance declarations list the same input paths in different orders
- **THEN** they denote the same set and are treated identically

#### Scenario: Canonical serialization is code-point sorted
- **WHEN** provenance is serialized canonically
- **THEN** its entries are ordered by code point, and the result does not vary with locale

### Requirement: Malformed provenance is rejected rather than normalized

Provenance SHALL be rejected, with a distinct named outcome for each condition and without
normalization, when: the same input path appears more than once; an input path resolves to no field
of the contract version in force and to no registered extension namespace; an input path resolves
but names a field absent from the event instance; the derivation graph contains a cycle; or the set
is empty on a field whose declared trust is a derived level.

Rejection SHALL NOT be replaced by deduplicating a repeated path, by scoring an unresolvable path as
`unknown`, or by any other repair, because a repair makes two different producer states
indistinguishable to the consumer.

#### Scenario: Repeated input path
- **WHEN** a provenance declaration lists the same input path twice
- **THEN** validation rejects it as a duplicate input, and does not deduplicate and continue

#### Scenario: Unresolvable input path
- **WHEN** a provenance declaration names a path that is neither a field of the contract version in
  force nor within a registered extension namespace
- **THEN** validation rejects it as an unresolvable input, rather than assigning it `unknown` trust

#### Scenario: Resolvable but absent input path
- **WHEN** a provenance declaration names a field that the contract defines but that this event
  instance does not carry
- **THEN** validation rejects it as an absent input

#### Scenario: Cyclic derivation
- **WHEN** the derivation graph implied by an event's provenance declarations contains a cycle
- **THEN** validation rejects it as a cyclic derivation

#### Scenario: Empty input set on a derived field
- **WHEN** a field whose declared trust is a derived level declares an empty provenance set
- **THEN** validation rejects it as an empty input set, because a derived field has at least one
  material input

### Requirement: Provenance records one hop and trust is evaluated over the transitive closure

A derived field's provenance SHALL record its immediate material inputs only. Maximum output trust
SHALL be evaluated over the transitive closure of those inputs, resolved within the same event.

Recording the transitive closure in provenance SHALL NOT be required, and evaluating trust over the
immediate inputs alone SHALL NOT be sufficient: a two-step derivation must not be able to launder a
less trusted input through a more trusted intermediate field.

#### Scenario: Two-step derivation cannot launder a low-trust input
- **WHEN** field C is derived from field B, and field B is derived from an input of lower trust than
  B's own declared level
- **THEN** C's maximum output trust accounts for that lower-trust input through the closure

#### Scenario: Provenance does not repeat the closure
- **WHEN** a derived field's immediate material inputs are themselves derived
- **THEN** the field's provenance lists only its immediate inputs

### Requirement: Maximum output trust is the lesser of the input floor and the transformation ceiling

Maximum output trust for a derived field SHALL be the lesser of the least trusted material input in
its transitive closure and the ceiling the transformation's own authority supports. The ceiling SHALL
be `derived_server` for a derivation performed by the producer under server authority, and
`downstream_enrichment` for one performed within a registered downstream enrichment namespace.

A declared trust exceeding that maximum SHALL be rejected, and the diagnostic SHALL name the input
that set the floor. No transformation SHALL raise trust above its least trusted material input, and
no transformation SHALL exceed its own authority even when every material input is more trusted than
that authority.

#### Scenario: Declared trust exceeds the input floor
- **WHEN** a derived field declares a trust level more trusted than the least trusted material input
  in its closure
- **THEN** validation rejects it and names the input that set the floor

#### Scenario: Declared trust exceeds the transformation authority
- **WHEN** a downstream enrichment derives a field from inputs that are all `authoritative_server`
  and declares a trust level more trusted than `downstream_enrichment`
- **THEN** validation rejects it, because a transformation does not exceed its own authority

#### Scenario: Declared trust within both bounds
- **WHEN** a derived field declares a trust level no more trusted than either its input floor or its
  transformation ceiling
- **THEN** validation accepts the declaration

#### Scenario: Omitting a material low-trust input does not raise trust
- **WHEN** a material input of low trust is omitted from a provenance declaration
- **THEN** the semantics provide no path by which that omission raises the field's admissible trust,
  and the resulting event is invalid whenever the omission is detectable

### Requirement: Introducing and enforcing derived provenance is two contract version moves

Introducing derived-field provenance as an optional field SHALL be an additive change requiring a
minor canonical contract version move. Requiring it for every field carrying a derived trust level,
and enforcing the trust floor, SHALL be a breaking change requiring a major canonical contract
version move.

Each move SHALL carry an SDK package version step with it, because an SDK package version supports
exactly one canonical contract version across one indivisible compatibility surface. Neither move
SHALL be performed by the change that ratifies these semantics.

#### Scenario: Optional introduction is additive
- **WHEN** derived-field provenance is introduced as an optional field
- **THEN** the move is classified additive and requires a minor canonical contract version

#### Scenario: Mandatory enforcement is breaking
- **WHEN** derived-field provenance becomes mandatory for derived fields and the floor is enforced
- **THEN** the move is classified breaking and requires a major canonical contract version

#### Scenario: Ratification performs no version move
- **WHEN** these semantics are ratified
- **THEN** the canonical contract version is unchanged and no generated artifact moves

### Requirement: The decision is recorded with its provenance and its assurance limitation

This capability SHALL record its decision source verbatim as `decision_source = "delegated to Claude
by the owner, 2026-09-06; not a human owner decision"`, and SHALL state that it is a delegated
technical decision rather than a human owner sign-off. It SHALL NOT be cited as exact-commit owner
authorization for any implementation.

This capability SHALL record that it bounds what a declared input set implies and does not establish
that a producer enumerated its material inputs honestly or that a transformation is correct.

#### Scenario: Provenance is present and unaltered
- **WHEN** this capability is read
- **THEN** the decision source appears verbatim and is not paraphrased

#### Scenario: Ratification is not authorization
- **WHEN** an implementation change cites this capability
- **THEN** it does not thereby hold owner authorization, and its own authorization requirements are
  unchanged

#### Scenario: Honest enumeration is not claimed
- **WHEN** this capability is read as assurance evidence
- **THEN** it states that it does not establish honest enumeration of material inputs

### Requirement: Revisit conditions re-open the decision

The decision SHALL be re-opened when a trust level is added to or removed from the canonical
registry, when a derivation is authorized whose inputs are not resolvable within a single event, or
when enforcement is authorized. Enforcement SHALL NOT be relied upon until each rejection outcome
above carries a mechanical arm proven to fail on the defective input and to pass on its null control.

#### Scenario: Registry membership changes
- **WHEN** a trust level is added to or removed from the canonical registry
- **THEN** the total order is re-opened rather than extended by inference

#### Scenario: Cross-event derivation is proposed
- **WHEN** a derivation is proposed whose material inputs are not resolvable within one event
- **THEN** the closure rule is re-opened, because it resolves the closure within a single event

#### Scenario: Enforcement without proven arms
- **WHEN** enforcement is authorized but a rejection outcome has no arm proven to fail on the
  defective input and pass on its null control
- **THEN** that outcome is not relied upon as enforced
