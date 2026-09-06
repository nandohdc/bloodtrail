## ADDED Requirements

### Requirement: The sanctioned merge path is versioned and its decisions are executable

The path by which a pull request is merged into the protected branch SHALL be versioned in this
repository under a classified path, and its merge decision SHALL be expressed as functions over
supplied evidence that reach no network and spawn no process. Collection of that evidence and
judgment of it SHALL be separable, so that judgment can be exercised against fixed inputs.

Every arm of the merge decision SHALL be exercised by a test that runs behind a required check, and
each arm SHALL be proven both to refuse a defective input and to allow the corresponding healthy
input. A merge decision that no check exercises SHALL NOT be treated as gated.

Test discovery for repository scripts SHALL enumerate the tests present rather than name a subset:
a hand-maintained list of test files fails by omission, and an omitted test is indistinguishable
from a passing one.

#### Scenario: Merge decision is exercised by a required check
- **WHEN** the required governance check runs
- **THEN** every test file beside a repository script is executed, including the merge gate's arms

#### Scenario: Gate arm has a null control
- **WHEN** a merge gate arm is asserted to refuse a defective input
- **THEN** the corresponding healthy input is asserted to be allowed by the same arm

#### Scenario: Test file added beside a repository script is discovered
- **WHEN** a test file is added beside a repository script without any check being edited
- **THEN** the required governance check executes it

### Requirement: Required-context presence is judged against branch protection

The merge gate SHALL determine the set of contexts that must pass by reading the protected branch's
required status checks, and SHALL require every such context to be both present in the reported
checks and passing. A required context that never reported SHALL fail the gate and SHALL be named,
distinctly from a context that reported a failure.

The gate SHALL fail closed when the branch protection response cannot be read or reports no required
contexts, and SHALL fail closed when no check has reported at all. Absence of evidence SHALL NOT be
evidence that a merge is permitted.

#### Scenario: Required context never started
- **WHEN** every reported check is passing but a context the protected branch requires never reported
- **THEN** the gate refuses the merge and names the absent context

#### Scenario: Every required context reported and passing
- **WHEN** every context the protected branch requires has reported and is passing
- **THEN** the gate allows the merge

#### Scenario: Branch protection cannot be read
- **WHEN** the protected branch's required-context list cannot be read or is empty
- **THEN** the gate refuses the merge rather than proceeding on the reported checks alone

#### Scenario: Reported check is failing
- **WHEN** a context the protected branch requires has reported a non-passing result
- **THEN** the gate refuses the merge and reports it distinctly from a context that never reported

### Requirement: Every merged pull request preserves the commits a record may bind

Every pull request SHALL land as a merge commit. The merge method SHALL NOT be selected by
inspecting the pull request's contents, so that misclassifying a pull request cannot select a
method that orphans a commit.

An archive pull request SHALL additionally record that a merge commit keeps the pre-archive state
reachable for archive-movement re-derivation, without that classification determining the method.
A pull request reporting no changed paths SHALL fail the gate.

#### Scenario: Non-archive pull request
- **WHEN** a pull request changes no path under the archive root
- **THEN** the gate selects a merge commit and states that it keeps the commit reachable for any
  governance record that binds it

#### Scenario: Archive pull request
- **WHEN** a pull request relocates a change under the archive root
- **THEN** the gate selects a merge commit and states the movement re-derivation reason

#### Scenario: Pull request reports no changed paths
- **WHEN** a pull request reports no changed paths
- **THEN** the gate refuses the merge rather than selecting a method
