# Design: Materialize the ratified repository topology

## Context

GitHub #83 materializes the decision ADR 0009 ratified under the archived governed change `ratify-repository-topology`: the standalone package topology. ADR 0009 explicitly deferred to #83 the materialization and the migration/rollback plan. The orchestrator brief on the #83 card is unambiguous: this change materializes a decision NOT to restructure. The issue's four acceptance criteria are evidence to PRODUCE and RECORD, not restructuring to perform. This design fixes the shape of the sole implementation deliverable (`docs/topology-materialization.md`), the evidence protocol, and the capability delta.

Orchestrator-settled decisions, encoded verbatim and not re-decided here:

- D1. OpenSpec change id `materialize-repository-topology`; the delta AMENDS the existing capability `repository-topology` (`openspec/specs/repository-topology/spec.md`); no new capability.
- D2. Materialization is documentary + evidence production, NOT restructuring. ADR 0009 ratified standalone: no root `package.json`, no `workspaces` field, no `pnpm-workspace.yaml`, no root lockfile, no root `engines`. The change SHALL NOT introduce any of them.
- D3. Sole implementation deliverable (stage 2): the new file `docs/topology-materialization.md` (path class `documentation_only`). No other implementation files.
- D4. The "moving a pinned constant belongs to #83" clause from ADR 0009 is VACUOUS: the ratified topology performs no move, so no pinned constant moves. The change SHALL NOT modify `packages/security-audit-sdk-core/scripts/check-coherence.mjs` or `packages/security-audit-sdk-core/compatibility.json`.
- D5. Hard prohibitions: no writes under `contracts/security-audit/`; no new files under `packages/*/src/`; no edits to `CLAUDE.md`/`.hermes.md`/`AGENTS.md`/`CONTRIBUTING.md` (governance_core); no CI/release/publication/transport changes. Out-of-scope verbatim from the issue: "No semantic refactor, sdk-node, release config, CI, publication, or production integration."

## Epistemic labels

- **Source fact (ratified decision):** ADR 0009, `docs/adr/0009-repository-and-package-manager-topology.md` (Status: Accepted, 2026-08-23, decision owner: Project owner), folded into the canonical capability `repository-topology` by the archived change `ratify-repository-topology`.
- **Source fact (deferred obligations):** ADR 0009's "Migration and rollback: plan only" and "Consequences" sections name #83 as the owner of materialization, migration, and rollback.
- **Orchestrator-settled decision:** the five decisions D1-D5 above, set by the #83 orchestrator card and quoted verbatim, not re-derived here.
- **Unresolved blocker:** owner authorization bound to the exact commit being merged (a later governed step, not a proposal-time artifact).

## Why no root manifest can appear

ADR 0009's accepted decision: "There is no root `package.json`, no `workspaces` field, and no `pnpm-workspace.yaml`; there is no root package and none is introduced. Each package owns its `package.json` and its `package-lock.json` inside its own package directory." The issue's "Add selected root/package-manager metadata" bullet is stale relative to the ADR; the ADR wins. Independent of the decision, the engines arithmetic forbids a root manifest: the SDK declares `>=24 <25 || >=26 <27` while the contract and research workspaces declare `>=26.5.0`, and a single root `engines` field would either be omitted or intersect to `>=26.5.0 <27`, losing the SDK Node 24 matrix that `test:coherence` pins. `test:coherence` pins those engine ranges, so any engines edit would force a `compatibility.json` update in the same change — which D4 forbids. The materialization therefore records the standalone invariant; it introduces no manifest of any kind.

## The four acceptance-criteria arms (evidence protocol)

The four arms are the issue's acceptance criteria read as evidence obligations. Each arm SHALL be produced and recorded in `docs/topology-materialization.md` with its name, the exact head SHA it was measured at, the tool versions used, the exit codes observed, and the key output lines. Arm (d) additionally records the output diff against the pre-change head.

- **Arm (a) — clean-clone discovery.** Produce a disposable clean clone of the repository at the recorded head; discover packages by their package directories and manifests (`contracts/security-audit`, `packages/security-audit-sdk-core`, `research/browser-telemetry`); record that discovery succeeds under the standalone layout with no root manifest.
- **Arm (b) — per-package lockfile install/validate.** For each current workspace, run the package-local install against its own lockfile and its package-local validation, recording tool versions, exit codes, and key output lines per package.
- **Arm (c) — hoisting mutation + null control against the packed-install control.** Exercise the hoisting-visibility invariant exactly as ADR 0009's measurement did: a development mutation that an undeclared import would mask, its null control, and the production-only packed-install consumer — run in a clean consumer directory OUTSIDE any workspace root — as the surviving gate that detects the undeclared runtime import. This arm does not re-perform topology prototyping; it re-verifies the invariant at the materialization head. The control SHALL NOT be relocated inside any workspace root.
- **Arm (d) — existing validation green with output diff.** Run the existing contract and SDK validation chains at the recorded head, record them green, and record the output diff against the pre-change head (expected empty: a documentary change changes no validation output).

## Migration and rollback plan content

The documentation SHALL record the plan ADR 0009 deferred, in substance: the standalone baseline needs no migration (the ratified decision performs no move, and materialization moves nothing); rollback for any #83 movement is the revert of #83's own documentary commits (the proposal, the documentation, the fold, the archive — each revertible without touching package state); and any future migration away from the standalone topology is its own governed change, not executable here. The packed-install control SHALL keep running in a clean consumer directory outside any workspace root — stating this is what keeps gate 3 from being silently defeated by any future topology change.

## The vacuous pinned-constant statement

ADR 0009's scope boundary contains: "`packages/security-audit-sdk-core/scripts/check-coherence.mjs` and `packages/security-audit-sdk-core/compatibility.json` are not modified; moving a pinned constant belongs to #83." For this change the clause is VACUOUS: the ratified topology performs no move, so no pinned constant moves under #83 either. This change SHALL NOT modify `check-coherence.mjs` or `compatibility.json`, and the materialization documentation SHALL record the vacuity explicitly so the deferred clause closes rather than lingering as an open obligation.

## Document file layout (`docs/topology-materialization.md`)

- **Materialization record.** What #83 materialized, at which head, citing ADR 0009 and the canonical `repository-topology` capability.
- **Workspace inventory.** The three current workspaces (`contracts/security-audit`, `packages/security-audit-sdk-core`, `research/browser-telemetry`), each with its package-local `--prefix` command forms (install, validate, and any targeted gates) and its declared `engines` range (`>=24 <25 || >=26 <27` for the SDK; `>=26.5.0` for contract and research).
- **Migration and rollback plan.** The deferred plan recorded above, including the packed-install control staying outside any workspace root.
- **No-restructuring boundary.** The no root manifest / no workspace manifest / no root lockfile / no root `engines` invariants; the vacuous pinned-constant statement naming `check-coherence.mjs` and `compatibility.json` as unchanged.
- **Evidence protocol.** The four named arms with, per arm, exact head SHA, tool versions, exit codes, and key output lines.

## Rejected alternatives

- **Read the issue's "Add selected root/package-manager metadata" literally** and introduce a root manifest with a `workspaces` field, a root lockfile, and a root `engines` field. Rejected: it contradicts the accepted ADR 0009, which wins over stale issue text, and the engines intersection to `>=26.5.0 <27` loses the SDK Node 24 matrix.
- **Document without evidence.** Record commands and migration/rollback without producing the four acceptance arms. Rejected: #83's acceptance criteria are evidence obligations; an unrecorded arm leaves the materialization unverifiable, and the packed-install control's outside-any-workspace-root position is the surviving gate that must be demonstrated, not asserted.

## Security implications

The materialization strengthens the dependency-visibility invariant by recording it: the packed-install control keeps running in a clean consumer directory outside any workspace root, and arm (c) re-verifies the hoisting behavior with its null control at the materialization head. The change introduces no new execution path, no new dependency, and no new attack surface; it is documentation plus recorded evidence only.

## Non-goals and scope boundary

No restructuring, no root or workspace manifest, no root lockfile, no root `engines`, no write under `contracts/security-audit/`, no new file under `packages/*/src/`, no governance_core edit, no CI/release/publication/transport change, and no modification of `check-coherence.mjs` or `compatibility.json`. Review is evidence, not approval; owner authorization bound to the merged commit remains a separately governed step.
