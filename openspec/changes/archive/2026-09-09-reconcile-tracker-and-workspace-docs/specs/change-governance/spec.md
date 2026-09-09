## ADDED Requirements

### Requirement: Every declared workspace is exercised by the repository's own command surface

Each `make` target that claims to run the repository's workspaces SHALL invoke every declared
package, and that coverage SHALL be asserted by an executable gate rather than by the recipe's own
success message.

A workspace count reported to the operator SHALL NOT be a hand-maintained literal that can disagree
with the set actually run. Adding a package without adding it to a covering target SHALL fail a
check rather than passing quietly.

#### Scenario: A covering target skips a declared workspace
- **WHEN** a `make` target that claims repository-wide coverage does not invoke a declared package
- **THEN** the package-discovery gate fails and names the target and the uncovered package

#### Scenario: A covering target is absent
- **WHEN** a target the gate expects to provide coverage is not declared in the Makefile at all
- **THEN** the gate fails rather than treating the absent target as vacuously covering

#### Scenario: A newly declared package is uncovered until the recipe runs it
- **WHEN** a package is added to the declared list and no covering target invokes it
- **THEN** the gate fails, so the omission cannot reach a green local loop

### Requirement: Agent-facing documentation states the tracker that carries execution state

Documentation that directs an agent to a tracker SHALL name the tracker in which execution state is
actually recorded, and SHALL state plainly which trackers are not authoritative for that state.

Where a tracker is retained without being authoritative, the documentation SHALL say what it may
still be used for and SHALL forbid inferring completion from it.

A statement of this kind that is withdrawn SHALL record the evidence that withdrew it and the
reversal path, so that restoring the previous arrangement is an edit rather than a rediscovery.

#### Scenario: A retained tracker is not authoritative
- **WHEN** documentation names a tracker that is retained but does not carry execution state
- **THEN** it states that completion may not be inferred from it, and names where completion is
  recorded instead

#### Scenario: A withdrawn statement carries its evidence
- **WHEN** an agent-facing tracker statement is withdrawn
- **THEN** the documentation records the measurements that withdrew it and the steps that would
  restore it

### Requirement: A documented triage vocabulary resolves against the tracker actually in use

Where documentation maps canonical triage roles onto a concrete mechanism, that mapping SHALL resolve
against the tracker that carries execution state, and SHALL NOT instruct an agent to avoid creating a
label that already exists and is in use.

Each canonical role SHALL remain distinguishable from every other role under the mapping, so that no
two roles collapse into one indistinguishable state.

#### Scenario: The mapping targets the tracker in use
- **WHEN** a skill applies a canonical triage role
- **THEN** the mapping resolves to a state in the tracker that carries execution state

#### Scenario: Roles stay distinguishable
- **WHEN** two canonical roles both express waiting on a human
- **THEN** the mapping keeps them distinguishable rather than collapsing them into one state
