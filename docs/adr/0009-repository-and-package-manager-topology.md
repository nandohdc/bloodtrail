# ADR 0009: Ratify the standalone repository and package-manager topology

- Status: Accepted
- Date: 2026-08-23
- Decision owners: Project owner

## Context

GitHub #80 requires exactly one recorded repository and package-manager topology decision, with lockfile and package ownership, root-package presence, and migration/rollback documented. The repository has operated as three standalone workspaces — `contracts/security-audit`, `packages/security-audit-sdk-core`, and `research/browser-telemetry` — with no root manifest and no recorded decision. #80's hard acceptance constraint is that undeclared imports remain visible. Three gates protect that property: `check-scope.mjs` reads source, `check-dependencies.mjs` reads shipped artifacts, and `check-package-contents.mjs` with `packed-completeness.mjs` performs a production-only install of the packed tarball.

The project owner adopted the standalone topology on 2026-08-23 against a declared four-package target (issue #80 decision comment). This ADR materializes that decision record under the governed OpenSpec change `ratify-repository-topology`; it performs no restructuring and does not pre-empt #83's materialization.

The missing measured evidence was produced by Hermes task t_8e144256, a read-only controlled prototype run in disposable directories outside the repository against `origin/main` `1c55a9c408ca4e2bf48c4d5a06a629201b7bf918`, with Node `v26.8.1`, npm `11.19.0`, and disposable pnpm `10.17.0` (invoked as `npx --yes pnpm@10.17.0`; no global pnpm).

## Decision

Ratify the standalone package topology. There is no root `package.json`, no `workspaces` field, and no `pnpm-workspace.yaml`; there is no root package and none is introduced. Each package owns its `package.json` and its `package-lock.json` inside its own package directory.

The decision is made against a declared target set of exactly four packages:

- `contracts/security-audit`;
- `packages/security-audit-sdk-core` (Core, after the #86 split);
- the planned Node binding (#87);
- `research/browser-telemetry` (stays in this repository, resolved 2026-08-23).

The browser (#124) and React Native (#131) evidence packages are not members of the target set while #117 is undecided.

### Measured evidence, cited exactly

The prototype built a disposable root with `workspaces: ["packages/*"]` (the pnpm arm additionally with `pnpm-workspace.yaml` and `--config.node-linker=hoisted`), a root development dependency making a sibling reachable, and an app package declaring no dependency. The sole mutation was `import { value } from '@harness/shared'` at the app entry point. Each arm carried a null control exporting a literal. The packed consumer installed the packed tarball with a scripts-disabled, offline `npm install <tarball> --omit=dev` in a clean consumer directory outside the workspace root, then imported the app entry point.

| arm | null development | null packed consumer | mutated development | mutated packed consumer |
| --- | --- | --- | --- | --- |
| npm workspaces | exit 0, `development:null` | exit 0, `packed-import:pass` | exit 0, `development:shared` | exit 1, `ERR_MODULE_NOT_FOUND` for `@harness/shared` |
| pnpm workspaces, `node-linker=hoisted` | exit 0, `development:null` | exit 0, `packed-import:pass` | exit 0, `development:shared` | exit 1, same `ERR_MODULE_NOT_FOUND` |

Both null controls passed, so the mutated failures are not pre-existing harness noise. All eight disposable roots and consumers were removed after measurement.

The prototype's recorded conclusion, cited verbatim: "For the two measured configurations only, workspace-root availability can mask an undeclared runtime import during development, while the isolated packed-tarball consumer still detects it at entry-point import. Both null controls passed, so the mutation-specific failures are not pre-existing harness noise. The consumer path is a traceable reduced equivalent of the current SDK packed-completeness import path, not a claim the complete SDK checker ran unchanged."

The prototype's recorded scope caveats, carried over in substance: pnpm's default isolated linking was not measured (only its deliberately hoisted `node-linker` mode, to exercise the masking condition); no conclusion is asserted for other npm/pnpm versions, other link modes or package managers, or the full SDK checker; and the evidence neither approves nor authorizes topology changes.

### The hoisting claim, narrowed

Hoisting does not hide undeclared imports from `check-scope.mjs` (it reads source) or `check-dependencies.mjs` (it reads shipped artifacts). What the measurement establishes, for the two measured configurations only: development resolution can satisfy an undeclared runtime import, and the isolated production-only packed consumer still detects it at entry-point import. Therefore development success never certifies the runtime closure, and the packed-install control is the surviving gate and must keep running in a clean consumer directory outside any workspace root.

### Engine, lockfile, and root ownership

Standalone retains one `package.json` and one `package-lock.json` per package, with no root manifest or lockfile and no engines reconciliation. The SDK keeps `>=24 <25 || >=26 <27` and its Node 24 matrix; the contract and research workspaces keep `>=26.5.0`. npm or pnpm workspaces would require a root manifest declaring membership plus a root-owned consolidated lockfile; a single root `engines` field would either be omitted or intersect to `>=26.5.0 <27`, losing SDK Node 24 support. pnpm additionally requires the pnpm binary and `pnpm-workspace.yaml`. No root `engines` field is introduced.

### Migration and rollback: plan only

This decision performs no migration. Migration and rollback are recorded here only as a plan executed by #83: the standalone baseline needs no migration, a future migration away from standalone would be its own governed change, and rollback for any #83 movement is defined there, not here.

### Revisit conditions

The decision is re-opened when #117 returns GO (declared six-package target), or when any target package acquires a third-party runtime dependency that another target package also needs. When neither condition holds, the standalone ratification remains the recorded topology.

### Security implications

The invariant protects the dependency gates that keep undeclared runtime imports detectable. A topology change that moved the packed-install control inside a workspace root would silently defeat gate 3; keeping the control outside any workspace root is what makes a future migration safe. The evidence neither approves nor authorizes any topology change.

### Non-goals and scope boundary

No restructuring, no release-configuration change, no CI change, no publication, and no production transports, exporters, collectors, or storage. `packages/security-audit-sdk-core/scripts/check-coherence.mjs` and `packages/security-audit-sdk-core/compatibility.json` are not modified; moving a pinned constant belongs to #83. Technical review is evidence, not approval; the owner's approval is recorded separately and bound to the exact commit being merged.

## Consequences

- Lockfile and package ownership, root-package presence, and the migration/rollback plan are now recorded and verifiable against the repository.
- The packed-install control must keep running outside any workspace root; stating this is what makes a future migration safe rather than silently defeating gate 3.
- Per-workspace engine ranges stay per-workspace: the SDK keeps `>=24 <25 || >=26 <27` and its Node 24 matrix; the contract and research workspaces keep `>=26.5.0`; no root `engines` field exists or is introduced.
- #81 and #82 can open their gates once this decision record is merged.
- No repository change is performed by this decision; #83 owns materialization, migration, and rollback.
- The decision is re-opened only under the two revisit conditions.

## Alternatives considered

### npm workspaces

Rejected. Hoisting by default makes development the weakest visibility point: the measurement shows development resolving an undeclared import while only the outside-the-root packed consumer detects it. A root manifest and consolidated lockfile change ownership and install workflow, and a root `engines` field must be omitted or intersected to `>=26.5.0 <27`, dropping the SDK Node 24 matrix that per-workspace ranges preserve.

### pnpm workspaces

Rejected. It introduces a new required tool (the pnpm binary plus `pnpm-workspace.yaml`) into a repository that deliberately keeps its tool inventory minimal, and it still requires root membership, a consolidated lockfile, and engines reconciliation. Its measured hoisted mode shares npm's development-masking behavior, and its default isolated linking was not part of the measurement.
