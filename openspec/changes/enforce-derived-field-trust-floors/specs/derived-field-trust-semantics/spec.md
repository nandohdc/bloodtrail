## ADDED Requirements

### Requirement: Enforcement re-opened the decision and resolved it for the current contract

Enforcement was authorized on 2026-09-10, which re-opened this decision under its own revisit
conditions. The re-opening SHALL be recorded with `decision_source = "delegated to Claude by the
owner, 2026-09-10; not a human owner decision"`, and SHALL NOT be cited as exact-commit owner
authorization. It resolves four points the ratification left to enforcement:

- an input's trust SHALL be the contract's own declaration for that path — its field-policy trust, or
  its extension namespace's trust — and SHALL NOT be read from the event instance;
- while the risk model is the contract's only provenance carrier, an input under `risk` SHALL be a
  cycle, so every other input's closure is itself and the closure rule is complete rather than
  approximate;
- any declared level no more trusted than both the floor and the transformation ceiling SHALL be
  admissible, not only the ceiling itself;
- provenance SHALL be mandatory for every event that carries `risk`.

A second provenance carrier, or a derivation whose inputs are not resolvable within one event, SHALL
re-open the closure point.

#### Scenario: Input trust comes from the contract
- **WHEN** the floor is evaluated for an input
- **THEN** it uses the contract's declared trust for that path and ignores any trust value the event
  instance carries

#### Scenario: A lower floor has a truthful declaration
- **WHEN** a derivation's least trusted input is `client_claim`
- **THEN** a `client_claim` declaration with those inputs listed is admissible

#### Scenario: A second carrier re-opens the closure
- **WHEN** a second field gains a provenance representation
- **THEN** the closure rule is re-opened rather than extended by inference
