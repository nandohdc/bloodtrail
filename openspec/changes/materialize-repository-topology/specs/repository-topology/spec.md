## ADDED Requirements

### Requirement: Materialization documentation names each workspace, its package-local commands, and its engine range

`docs/topology-materialization.md` SHALL name each current workspace — `contracts/security-audit`, `packages/security-audit-sdk-core`, and `research/browser-telemetry` — and SHALL document each workspace's package-local commands in `--prefix` form (or `cd` into the package directory), with no root-level command form. The documentation SHALL state each workspace's declared `engines` range exactly: `>=24 <25 || >=26 <27` for the SDK; `>=26.5.0` for the contract and research workspaces.

#### Scenario: Every current workspace is named
- **WHEN** the materialization documentation is read
- **THEN** it names exactly `contracts/security-audit`, `packages/security-audit-sdk-core`, and `research/browser-telemetry`

#### Scenario: Commands are package-local
- **WHEN** a workspace's commands are documented
- **THEN** every command is given in `--prefix` form or `cd` form and no root-level command form appears

#### Scenario: Engine ranges are stated exactly
- **WHEN** the documentation states engine ranges
- **THEN** the SDK range `>=24 <25 || >=26 <27` and the contract and research range `>=26.5.0` appear exactly

### Requirement: Materialization records the migration and rollback plan deferred by ADR 0009

The materialization documentation SHALL record the migration and rollback plan ADR 0009 deferred to #83: the standalone baseline needs no migration; rollback for any #83 movement SHALL be the revert of #83's own documentary commits; a future migration away from the standalone topology SHALL be its own governed change and SHALL NOT be executed by this change. The documentation SHALL state that the packed-install control keeps running a production-only install of the packed tarball in a clean consumer directory outside any workspace root.

#### Scenario: Standalone baseline needs no migration
- **WHEN** the migration section is read
- **THEN** it states the standalone baseline needs no migration

#### Scenario: Rollback reverts only #83's documentary commits
- **WHEN** rollback for any #83 movement is described
- **THEN** it is the revert of #83's own documentary commits, not of any other change

#### Scenario: Future migration is its own governed change
- **WHEN** a future migration away from the standalone topology is described
- **THEN** it is recorded as its own governed change and is not executed here

#### Scenario: Packed-install control stays outside any workspace root
- **WHEN** the documentation describes the packed-install control
- **THEN** it states the control keeps running in a clean consumer directory outside any workspace root

### Requirement: Materialization performs no restructuring

Materialization SHALL perform no restructuring: no root `package.json`, no `workspaces` field, no `pnpm-workspace.yaml`, no root lockfile, and no root `engines` field SHALL be introduced. Each package SHALL retain ownership of its own `package.json` and `package-lock.json`. `packages/security-audit-sdk-core/scripts/check-coherence.mjs` and `packages/security-audit-sdk-core/compatibility.json` SHALL remain unchanged.

#### Scenario: No root or workspace manifest is introduced
- **WHEN** the change range is inspected
- **THEN** no root manifest, workspace manifest, root lockfile, or root `engines` field is added

#### Scenario: Packages keep their manifests
- **WHEN** each package directory is inspected after the change
- **THEN** each retains its own `package.json` and `package-lock.json`

#### Scenario: Pinned-constant files are untouched
- **WHEN** the change range is inspected
- **THEN** `check-coherence.mjs` and `compatibility.json` are unchanged

### Requirement: Materialization records the four evidence arms with heads, versions, exit codes, and output

The materialization SHALL record the four acceptance-criteria evidence arms, each named: (a) package discovery from a clean clone; (b) per-package lockfile install and validation; (c) the hoisting mutation with its null control against the packed-install control run in a clean consumer directory outside any workspace root; (d) existing contract and SDK validation green with the output diff against the pre-change head recorded. For each arm the record SHALL state the exact head SHA at which the arm was measured, the tool versions used, the exit codes observed, and the key output lines.

#### Scenario: All four arms are named
- **WHEN** the evidence record is read
- **THEN** each of the four arms — clean-clone discovery, per-package lockfile install/validate, hoisting mutation with null control, and existing validation green with output diff — is named

#### Scenario: Each arm states its measurement facts
- **WHEN** an arm's record is read
- **THEN** the exact head SHA, tool versions, exit codes, and key output lines are stated

#### Scenario: Hoisting arm keeps the packed-install control isolated
- **WHEN** the hoisting arm's record is read
- **THEN** it records both the mutation and the null control and locates the packed-install control in a clean consumer directory outside any workspace root

#### Scenario: Validation arm records the output diff
- **WHEN** the validation arm's record is read
- **THEN** it states the contract and SDK validation ran green at the recorded head and records the output diff against the pre-change head
