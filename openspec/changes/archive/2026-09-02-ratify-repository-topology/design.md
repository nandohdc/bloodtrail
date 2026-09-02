# Design: Ratify the standalone repository topology

## Context

GitHub #80 requires one recorded topology decision with lockfile and package ownership, root-package presence, and migration/rollback documented. The repository operates as three standalone workspaces with no root manifest and no recorded decision. The project owner adopted the standalone topology on 2026-08-23 against a declared four-package target (issue #80 decision comment). This design fixes the content of ADR 0009 at `docs/adr/0009-repository-and-package-manager-topology.md` and the capability delta; it performs no restructuring.

## Epistemic labels

- **Source fact (measured):** the controlled hoisting prototype results recorded by Hermes task t_8e144256 against `origin/main` `1c55a9c408ca4e2bf48c4d5a06a629201b7bf918`; tools Node `v26.8.1`, npm `11.19.0`, disposable pnpm `10.17.0`.
- **Project decision:** the owner's standalone ratification and its four-package target set, adopted 2026-08-23.
- **Assumption:** at four packages, cross-package install coordination is still cheaper than the undeclared-import visibility a hoisting topology costs.
- **Unresolved blocker:** owner approval bound to the commit being merged; #117's GO/NO-GO decision.

## The decision

Standalone packages. No root `package.json`, no `workspaces` field, no `pnpm-workspace.yaml`. Each package owns its `package.json` and `package-lock.json`. Target set: `contracts/security-audit`, `packages/security-audit-sdk-core`, the planned Node binding (#87), and `research/browser-telemetry`. Browser (#124) and React Native (#131) packages are excluded while #117 is undecided.

## Measured evidence, cited exactly

The prototype built a disposable root with `workspaces: ["packages/*"]` (pnpm additionally with `pnpm-workspace.yaml` and `--config.node-linker=hoisted`), a root development dependency making a sibling reachable, and an app package declaring no dependency. The sole mutation was `import { value } from '@harness/shared'` at the app entry point. Each arm carried a null control exporting a literal.

| arm | null development | null packed consumer | mutated development | mutated packed consumer |
| --- | --- | --- | --- | --- |
| npm workspaces | pass: `development:null` | pass: `packed-import:pass` | pass: `development:shared` (exit 0) | fail: exit 1, `ERR_MODULE_NOT_FOUND` for `@harness/shared` |
| pnpm workspaces, `node-linker=hoisted` | pass: `development:null` | pass: `packed-import:pass` | pass: `development:shared` (exit 0) | fail: exit 1, same `ERR_MODULE_NOT_FOUND` |

Both null controls passed, so the mutated failures are not pre-existing harness noise. All eight disposable roots and consumers were removed after measurement.

## The hoisting claim, narrowed

Hoisting does not hide undeclared imports from `check-scope.mjs` (it reads source) or `check-dependencies.mjs` (it reads shipped artifacts). What the measurement establishes, for the two measured configurations only: development resolution can satisfy an undeclared runtime import, and the isolated production-only packed consumer still detects it at entry-point import. Therefore development success never certifies the runtime closure, and the packed-install control is the surviving gate and must keep running in a clean consumer directory outside any workspace root. The consumer path is a traceable reduced equivalent of the current packed-completeness import path, not a claim that the full SDK checker ran unchanged.

## Engine, lockfile, and root ownership

Standalone retains one `package.json` and one `package-lock.json` per package, with no root manifest or lockfile and no engines reconciliation. The SDK keeps `>=24 <25 || >=26 <27` and its Node 24 matrix; contract and research keep `>=26.5.0`. npm or pnpm workspaces would require a root manifest declaring membership plus a root-owned consolidated lockfile; a single root `engines` would be omitted or intersect to `>=26.5.0 <27`, losing SDK Node 24 support. pnpm additionally requires the pnpm binary and `pnpm-workspace.yaml`.

## Rejected alternatives

- **npm workspaces.** Rejected because hoisting by default makes development the weakest visibility point, a root manifest and consolidated lockfile change ownership and install workflow, and a root `engines` field must be omitted or intersect the divergent per-workspace ranges.
- **pnpm workspaces.** Rejected because it introduces a new required tool (pnpm binary plus `pnpm-workspace.yaml`) into a repository that deliberately keeps its tool inventory minimal, and it still requires root membership, a consolidated lockfile, and engines reconciliation; its measured hoisted mode shares npm's development-masking behavior.

## Migration and rollback: plan only

This change performs no migration. ADR 0009 records the migration and rollback as a plan executed by #83: the standalone baseline needs no migration; a future migration away from standalone would be its own governed change. Rollback for any #83 movement is defined there, not here.

## Revisit conditions

The decision is re-opened when #117 returns GO (declared six-package target) or when any target package acquires a third-party runtime dependency that another target package also needs.

## Security implications

The invariant protects the dependency gates that keep undeclared runtime imports detectable. A topology change that moved the packed-install control inside a workspace root would silently defeat gate 3; keeping the control outside any workspace root is what makes a future migration safe. The evidence neither approves nor authorizes any topology change.

## Non-goals and scope boundary

No restructuring, no release-configuration change, no CI change, no publication, and no production transports, exporters, collectors, or storage. `check-coherence.mjs` and `compatibility.json` are not modified; moving a pinned constant belongs to #83. Review is evidence, not approval; the owner decision is not authored by this change.

## Approval blockers before merge

- Independent exact-commit technical review of the proposal commit and of the materialization commit.
- Owner approval bound to the commit being merged.
- Required CI green on both PRs.
