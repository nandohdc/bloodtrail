## Why

GitHub #80 requires exactly one recorded repository and package-manager topology decision. The repository has operated as three standalone workspaces with no root manifest and no recorded decision, so lockfile and package ownership, root-package presence, and migration/rollback documentation are all absent. The project owner adopted the standalone topology against a declared four-package target on 2026-08-23; this change records that ratification as a governed capability carrying the measured undeclared-import evidence, so that #81 and #82 can open their gates.

## What Changes

- Introduce the `repository-topology` capability recording the ratified standalone topology: no root `package.json` and no workspace manifest; each package owns its own `package.json` and `package-lock.json`; the declared target set is exactly four packages.
- Record the undeclared-import visibility invariant with the measured evidence: under the two measured hoisting configurations, development resolved a deliberately undeclared sibling import while the isolated production-only packed consumer still rejected it, so the packed-install control remains the surviving gate and must run outside any workspace root.
- Require ADR 0009 materialization at `docs/adr/0009-repository-and-package-manager-topology.md` in a separate governed commit, citing the measured evidence exactly, the engine/lockfile/root ownership analysis, a plan-only migration/rollback, revisit conditions, and non-goals.
- Preserve per-workspace engine ranges: SDK `>=24 <25 || >=26 <27`; contract and research `>=26.5.0`; no root `engines` reconciliation exists or is introduced.
- Exclude the browser (#124) and React Native (#131) packages from the target set while #117 is undecided; the decision is re-opened only when #117 returns GO (six packages) or a shared third-party runtime dependency appears.
- Change no package layout, release configuration, CI workflow, or publication path. `packages/security-audit-sdk-core/scripts/check-coherence.mjs` and `packages/security-audit-sdk-core/compatibility.json` are not modified; moving a pinned constant belongs to #83.

## Capabilities

### New Capabilities
- `repository-topology`: Records the ratified standalone package topology, the four-package target set, lockfile/engine/root ownership, the measured undeclared-import visibility invariant, ADR 0009 materialization requirements, revisit conditions, and the scope boundary.

### Modified Capabilities
- None.

## Impact

This proposal adds OpenSpec planning artifacts under `openspec/changes/ratify-repository-topology/` and, in a later governed commit, the ADR at `docs/adr/0009-repository-and-package-manager-topology.md`. It changes no implementation, package manifest, CI workflow, release configuration, or generated artifact. Planning is not authorization: technical review is evidence, and human approval bound to the exact merged commit, CI, and archive remain independently required.
