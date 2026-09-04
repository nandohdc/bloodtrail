# repository-topology Specification

## Purpose

Records the ratified Bloodtrail repository and package-manager topology: standalone per-package ownership with a declared four-package target, the measured undeclared-import visibility invariant, ADR 0009 materialization requirements, revisit conditions, and the scope boundary.

## Requirements

### Requirement: Repository topology is standalone per-package ownership

The repository SHALL follow the standalone package topology: no root `package.json` and no workspace manifest exist at the repository root. Each package in the ratified target set SHALL own its `package.json` and its `package-lock.json` inside its own package directory. A topology that requires a root manifest or a workspace manifest SHALL NOT be the ratified topology.

#### Scenario: Root manifest is absent
- **WHEN** the ratified topology is inspected at the repository root
- **THEN** no root `package.json` and no root workspace manifest is present

#### Scenario: Each package owns its manifests
- **WHEN** the ratified target set is inspected
- **THEN** each target package declares and owns its `package.json` and its `package-lock.json` in its own package directory

#### Scenario: Manifest-requiring topology is not ratified
- **WHEN** a candidate topology requires a root `package.json` or a workspace manifest
- **THEN** that candidate is not the ratified standalone topology

### Requirement: Target set is exactly four declared packages

The ratified topology decision SHALL be made against a target set of exactly four packages: `contracts/security-audit`, `packages/security-audit-sdk-core`, the planned Node binding (#87), and `research/browser-telemetry`. The browser (#124) and React Native (#131) evidence packages SHALL NOT be members of the target set while #117 is undecided.

#### Scenario: Four-package target is named
- **WHEN** the decision record names the target set
- **THEN** it lists exactly `contracts/security-audit`, `packages/security-audit-sdk-core`, the planned Node binding (#87), and `research/browser-telemetry`

#### Scenario: Contingent packages are excluded while #117 is undecided
- **WHEN** #117 has no recorded decision
- **THEN** the browser (#124) and React Native (#131) packages are not members of the ratified target set

### Requirement: Undeclared runtime imports remain detectable

The topology SHALL keep undeclared runtime dependencies detectable. Development resolution under a hoisting configuration MAY satisfy an undeclared runtime import, so development success SHALL NOT be treated as evidence that a package's runtime closure is declared. The production-only packed-consumer control SHALL install the packed tarball in a clean consumer directory outside any workspace root and import the package entry point; an undeclared runtime import SHALL fail that control with exit status 1 and the `ERR_MODULE_NOT_FOUND` diagnostic naming the missing package.

#### Scenario: Development resolution does not certify the runtime closure
- **WHEN** development resolution satisfies an import under a hoisting configuration
- **THEN** that development success does not establish that the import is declared

#### Scenario: Isolated packed consumer detects the undeclared import
- **WHEN** the production-only packed consumer imports a package entry point whose runtime closure contains an undeclared import
- **THEN** the control fails with exit status 1 and the `ERR_MODULE_NOT_FOUND` diagnostic naming the missing package

#### Scenario: Packed-consumer control runs outside any workspace root
- **WHEN** the packed-consumer control executes
- **THEN** the tarball install happens in a clean consumer directory outside any workspace root

### Requirement: Per-workspace engine ranges are preserved

The ratified topology SHALL NOT reconcile engine ranges at a root. Each package SHALL declare its own `engines` range: the SDK declares `>=24 <25 || >=26 <27`; the contract and research workspaces declare `>=26.5.0`. No root `engines` field SHALL be introduced.

#### Scenario: SDK keeps its Node 24 support
- **WHEN** the SDK manifest `engines` is inspected
- **THEN** the range `>=24 <25 || >=26 <27` is declared and the Node 24 matrix remains valid

#### Scenario: Contract and research keep their ranges
- **WHEN** the contract and research manifests are inspected
- **THEN** each declares `>=26.5.0`

#### Scenario: No root engines field exists
- **WHEN** the repository root is inspected
- **THEN** no root `engines` field is present

### Requirement: ADR 0009 materializes the decision with the measured evidence

The ratified decision SHALL be recorded in `docs/adr/0009-repository-and-package-manager-topology.md`. The ADR SHALL name the selection (standalone), the four-package target set, lockfile and package ownership, root-package presence, and a plan-only migration/rollback owned by #83. The ADR SHALL cite the measured prototype results exactly: for both measured configurations the null development arm printed `development:null` and the null packed consumer printed `packed-import:pass`; the mutated development arm printed `development:shared` with exit status 0; the mutated production-only packed consumer failed with exit status 1 and `ERR_MODULE_NOT_FOUND`; the measurement used Node `v26.8.1`, npm `11.19.0`, and disposable pnpm `10.17.0`.

#### Scenario: ADR exists at the exact path
- **WHEN** the decision record is inspected
- **THEN** `docs/adr/0009-repository-and-package-manager-topology.md` exists and records the accepted standalone decision

#### Scenario: Measurement is cited exactly
- **WHEN** the ADR describes the hoisting evidence
- **THEN** it states the null arms passed (`development:null`, `packed-import:pass`), the mutated development arm printed `development:shared` (exit status 0), and the mutated packed consumer failed with `ERR_MODULE_NOT_FOUND` (exit status 1), without claiming coverage beyond the two measured configurations

#### Scenario: Migration and rollback are a plan only
- **WHEN** the ADR describes migration and rollback
- **THEN** it records them as a plan executed by #83, not as steps performed by this change

### Requirement: Revisit conditions re-open the decision

The ratified decision SHALL be re-opened when either condition occurs: #117 returns GO (target becomes six packages), or any target package acquires a third-party runtime dependency that another target package also needs. When neither condition holds, the standalone ratification SHALL remain the recorded topology.

#### Scenario: GO re-opens against six packages
- **WHEN** #117 records GO
- **THEN** the topology decision is re-opened against a declared six-package target

#### Scenario: Shared third-party runtime dependency re-opens
- **WHEN** a target package acquires a third-party runtime dependency that another target package also needs
- **THEN** the topology decision is re-opened

#### Scenario: No revisit condition holds
- **WHEN** neither revisit condition holds
- **THEN** the standalone ratification remains the recorded topology

### Requirement: Scope boundary excludes restructuring and production integration

This change SHALL NOT restructure the repository, modify release configuration, change CI, or publish any package, and it SHALL NOT authorize production transports, exporters, collectors, or storage. It SHALL NOT modify `packages/security-audit-sdk-core/scripts/check-coherence.mjs` or `packages/security-audit-sdk-core/compatibility.json`; movement of a pinned constant belongs to #83.

#### Scenario: No pinned constants move
- **WHEN** the change range is inspected
- **THEN** `check-coherence.mjs` and `compatibility.json` are unchanged

#### Scenario: No restructuring happens
- **WHEN** the change range is inspected
- **THEN** no package directory, manifest, lockfile, or CI workflow is modified

#### Scenario: No production integration is authorized
- **WHEN** the change is read
- **THEN** it grants no authorization for production transports, exporters, collectors, or storage

### Requirement: Owner approval is bound to the merged commit

The topology decision SHALL be ratified only by the project owner. Technical review SHALL be evidence bound to the exact reviewed commit; it SHALL NOT constitute approval. Merge SHALL occur only after the owner's recorded approval is bound to the commit being merged and every required CI check has passed.

#### Scenario: Review is evidence, not approval
- **WHEN** a technical review passes
- **THEN** ratification remains outstanding until the owner records the decision

#### Scenario: Approval binds the merged commit
- **WHEN** merge is authorized
- **THEN** the owner's recorded approval is bound to the exact commit being merged

#### Scenario: CI gates merge
- **WHEN** a required CI check is pending, failing, or cancelled
- **THEN** the change is not merge-ready

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
