## ADDED Requirements

### Requirement: Required CI executes every active change harness self-test suite

The required repository governance context SHALL execute the self-tests of every immediate, non-archive change directory containing a harness. It SHALL fail on a missing, unreadable or empty suite, discovery failure, or failing test. Harness discovery SHALL NOT silently filter out malformed change metadata. This check SHALL keep the existing required context names.

#### Scenario: Active harness tests execute
- **WHEN** two active changes contain harness self-tests
- **THEN** both suites execute and their paths are reported

#### Scenario: A missing suite fails closed
- **WHEN** an active harness has no readable nonempty self-test suite
- **THEN** the required context fails and names the harness

#### Scenario: A planted failing self-test fails the context
- **WHEN** a discovered fixture self-test fails
- **THEN** the runner exits nonzero and the required context fails

#### Scenario: Archives do not execute
- **WHEN** an archived change contains harness tests
- **THEN** those tests are excluded explicitly

#### Scenario: No active harness is visibly not applicable
- **WHEN** no active change contains a harness
- **THEN** the check reports not applicable explicitly and succeeds

#### Scenario: Malformed change metadata cannot hide a harness
- **WHEN** a non-archive change directory contains a harness but lacks expected metadata
- **THEN** discovery still requires its test suite and does not silently skip the directory

### Requirement: CI self-tests do not execute approval-gated probes

Active harness CI self-tests SHALL use fixtures rather than executing the packed kit, SDK or collector, or claiming an approved probe run. Fixture tests MAY use temporary files, subprocesses and loopback sockets. A planted failure and a passing null control SHALL demonstrate the runner's failure propagation.

#### Scenario: Fixture tests need no run authorization
- **WHEN** CI runs active harness self-tests
- **THEN** no Stage 2 approval or run number is consumed

#### Scenario: The passing null control succeeds
- **WHEN** every discovered fixture self-test passes
- **THEN** the runner succeeds and reports the tested suites
