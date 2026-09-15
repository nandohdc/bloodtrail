## ADDED Requirements

### Requirement: Contract semantics and authored representation have an explicit delegation boundary

Applicable current canonical capability requirements SHALL own activated contract semantics. An
apply-authorized active candidate delta MAY supply proposed semantic intent only within its exact
candidate scope and SHALL NOT become activated semantics by implementation, merge, fold, archive,
or test success alone.

`contracts/security-audit/source/contract.source.json` SHALL remain the complete authored concrete
representation and sole input to contract generation. It MAY select concrete values or structures
only where a governed requirement-ownership entry delegates that choice from an applicable current
capability or apply-authorized active candidate delta. A source property that is not covered by
exactly one applicable ownership entry SHALL fail closed.

A representation detail SHALL be limited to formatting, serialization, deterministic ordering where
order has no declared meaning, or a machine encoding that preserves the same accepted states,
rejected states, meanings, authorities, and compatibility effect. Requiredness, conditional
requiredness, authority, trust, privacy, retention, delivery, compatibility, extension ownership,
interoperability mappings, derivation semantics, lifecycle, and validation or rejection behavior
SHALL be semantic dimensions. An unclassified or ambiguous dimension SHALL be semantic by default
and SHALL NOT be introduced by the authored source until a governed owner and delegation exist.

#### Scenario: Delegated representation detail is authored
- **WHEN** the source changes only a representation detail covered by one applicable ownership and
  delegation entry, without changing any semantic dimension
- **THEN** governance verification permits the source to carry that concrete representation

#### Scenario: Source adds an undelegated semantic obligation
- **WHEN** the source adds a behavioral, security, authority, privacy, retention, compatibility,
  interoperability, lifecycle, trust, or validation obligation that no applicable capability or
  apply-authorized active delta owns
- **THEN** governance verification rejects the source-only semantic addition

#### Scenario: Classification is ambiguous
- **WHEN** reviewers or tooling cannot determine whether a source change is a representation detail
  or a semantic requirement from the governed mapping
- **THEN** governance verification classifies it as semantic and blocks it until governance records
  an unambiguous owner and delegation

### Requirement: Derived contract surfaces conform without becoming semantic authority

Generated schemas, catalogs, registries, field policies, documentation, fixtures, SDK contract
projections, and standalone validators SHALL be binding derived conformance surfaces. They SHALL
conform exactly to their declared controlling inputs within each projection's stated responsibility,
but SHALL NOT define missing semantics, override an applicable capability or authored source, or
settle a normative conflict. A divergence SHALL make the derived state invalid and SHALL block its
merge, activation, and release boundary as applicable.

Implementation behavior and tests SHALL provide conformance evidence only. Passing execution SHALL
NOT establish semantics absent from the applicable capability and authored-source relationship.

#### Scenario: Generated schema conflicts with source
- **WHEN** generated schema semantics differ from the authored source semantics they project
- **THEN** the generated schema is invalid and governance rejects the divergence without treating
  the schema as a competing source of truth

#### Scenario: Implementation selects one side of a normative conflict
- **WHEN** implementation or tests embody one interpretation while applicable normative sources
  remain contradictory
- **THEN** the contradiction remains unresolved and governance blocks progression rather than
  adopting the executable interpretation

