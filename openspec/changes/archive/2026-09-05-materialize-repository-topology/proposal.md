## Why

GitHub #83 requires the approved standalone repository topology to be materialized. ADR 0009 (Status: Accepted, 2026-08-23, decision owner: Project owner) ratified the standalone package topology and explicitly deferred to #83 both the materialization ("No repository change is performed by this decision; #83 owns materialization, migration, and rollback") and the migration/rollback plan ("rollback for any #83 movement is defined there, not here"). Package-local commands and per-workspace engine ranges exist only implicitly in the package manifests today, with no single documentary source. The issue's four acceptance criteria — package discovery from a clean clone, per-package lockfile install/validation, hoisting not masking undeclared imports, and existing validation staying green — are evidence to PRODUCE and RECORD, not restructuring to perform: the ratified decision performs no move. This change records the materialization contract: the sole implementation deliverable, the evidence protocol, and the hard boundaries the materialization must respect.

## What Changes

- Amend the `repository-topology` capability with four requirements: (R1) the materialization documentation names each current workspace, its package-local `--prefix` command forms, and its exact `engines` range; (R2) the migration and rollback plan ADR 0009 deferred to #83 is recorded, including the packed-install control staying outside any workspace root; (R3) materialization performs no restructuring and leaves `packages/security-audit-sdk-core/scripts/check-coherence.mjs` and `packages/security-audit-sdk-core/compatibility.json` unchanged; (R4) the four acceptance-criteria evidence arms are recorded with named arms, exact head SHA, tool versions, exit codes, and key output lines.
- Sole implementation deliverable (stage 2, a later change step): the new file `docs/topology-materialization.md` (path class `documentation_only`). No other implementation files.
- Encode the orchestrator-settled decisions verbatim: no root `package.json`, no `workspaces` field, no `pnpm-workspace.yaml`, no root lockfile, and no root `engines` are introduced; no writes under `contracts/security-audit/`; no new files under `packages/*/src/`; no edits to `CLAUDE.md`, `.hermes.md`, `AGENTS.md`, or `CONTRIBUTING.md` (governance_core); no CI, release, publication, or transport changes.
- Record explicitly that the ADR 0009 clause "moving a pinned constant belongs to #83" is vacuous for this change: the ratified topology performs no move, so no pinned constant moves and the two pinned-constant files are not modified.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `repository-topology`: Adds the materialization requirements — documentation of package-local commands and engine ranges, the deferred migration/rollback plan with the packed-install control outside any workspace root, the no-restructuring boundary including the vacuous pinned-constant statement, and the recorded four-arm evidence protocol.

## Impact

This change adds OpenSpec planning artifacts under `openspec/changes/materialize-repository-topology/` and, in a later stage, one documentation file at `docs/topology-materialization.md`. No package manifest, lockfile, script, generated artifact, CI workflow, release configuration, or publication path changes. Planning is not authorization: independent exact-commit technical review, required CI green at the exact head, owner authorization bound to the merged commit, and archive remain separately governed steps.

## Out of scope

Verbatim from #83: "No semantic refactor, sdk-node, release config, CI, publication, or production integration." Additionally out of scope and prohibited: any root or workspace manifest, root lockfile, or root `engines` field; any write under `contracts/security-audit/`; any new file under `packages/*/src/`; any edit to the governance_core files (`CLAUDE.md`, `.hermes.md`, `AGENTS.md`, `CONTRIBUTING.md`); and any modification of `check-coherence.mjs` or `compatibility.json`.
