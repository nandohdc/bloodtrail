## MODIFIED Requirements

### Requirement: Job ownership is one job per concern with stable context names

CI SHALL model each concern as one job fanning out over the declared package list, with one stable required context per concern. A job's context name SHALL NOT change when a package is added to the declared list: branch protection pins ten required contexts by hand, adding a job does not make it required, and only a repository-settings edit does. One stable context per concern means branch protection never changes as packages are added and a new package is covered the day it enters the list. A context name that moves with a trigger SHALL NOT be a gate, because the CodeScene App reports its check run as `CodeScene Code Health Review (main)` — the parenthetical is the base branch — so a PR against any other base renames the context and it silently stops being the thing that was pinned.

#### Scenario: Adding a package does not change any required context name
- **WHEN** a new package is added to the declared package list
- **THEN** every required context name stays byte-identical and no branch-protection edit is needed

#### Scenario: A new package is covered the day it enters the list
- **WHEN** a package appears in the declared list while its per-concern jobs run
- **THEN** that package is exercised by every per-concern job without any repository-settings change

#### Scenario: A moving context name is not a gate
- **WHEN** a check run renames its context per base branch, as the CodeScene App does
- **THEN** that check run is not eligible as a pinned required context, because the pinned name would silently stop matching

#### Scenario: Required contexts include coverage
- **WHEN** branch protection required status checks are evaluated
- **THEN** the required set contains exactly ten pinned contexts: `ci / lint`, `ci / test`, `ci / audit`, `sonar`, `sdk`, `contract`, `conventional-commits`, `codescene delta`, `design-pattern-governance`, and `coverage`

### Requirement: Every package carries the mandatory check set and CI fails closed

Each declared package SHALL carry the mandatory check set: build, typecheck, runtime tests, the production-only packed install, and at least one deterministic mutation control. Failure semantics SHALL fail closed: a missing required static validation is a failure, not a skip, and nothing MAY render that missing validation as a pass-shaped green. A test coverage execution SHALL enforce declared minimum line and branch coverage thresholds and SHALL fail closed when measured coverage falls below either threshold.

#### Scenario: The mandatory check set is present per package
- **WHEN** a declared package's check set is inspected
- **THEN** build, typecheck, runtime tests, the production-only packed install, and at least one deterministic mutation control are all present

#### Scenario: A package missing a mandatory member fails
- **WHEN** a declared package lacks any member of the mandatory check set
- **THEN** CI fails closed, naming the missing validation

#### Scenario: A missing required static validation is not a skip
- **WHEN** a required static validation does not run
- **THEN** the result is a failure, never a skip, and never a pass-shaped green

#### Scenario: Coverage threshold enforcement fails closed
- **WHEN** a package test coverage run drops below its declared minimum line or branch threshold
- **THEN** the coverage script exits with a non-zero failure status and fails the CI coverage job
