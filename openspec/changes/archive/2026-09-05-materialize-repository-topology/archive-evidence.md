# Archive Evidence — materialize-repository-topology

Explicit archive validation record (R24) for the archive relocation of the `materialize-repository-topology` change into `openspec/changes/archive/2026-09-05-materialize-repository-topology/`.

Archive validation is explicit and is not assumed from `openspec validate --all --strict` (R24).

## Task completeness

- **1.1–1.2** (Proposal) — checked. Proposal packet authored under `openspec/changes/materialize-repository-topology/`, verified with strict validation, reviewed independently (PR #282), and merged at commit `698921c`.
- **2.1–2.6** (Implementation) — checked. `docs/topology-materialization.md` authored naming current workspaces (`contracts/security-audit`, `packages/security-audit-sdk-core`, `research/browser-telemetry`), package-local `--prefix` commands, exact engine ranges, ADR 0009 migration/rollback plan, and recording all four evidence arms (clean-clone discovery, per-package lockfile install/validate, hoisting mutation with null control, existing validation green with output diff). Implementation PR #285 merged at commit `2e2e88b`.
- **3.1–3.2** (Review and governance) — checked. Independent technical review bound to the implementation commit, owner authorization recorded, merged identity-preservingly at commit `2e2e88b`.
- **4.1** (Canonical fold) — checked. Fold PR #287 merged into `openspec/specs/repository-topology/spec.md` at commit `73b7a47` while the change was still active. Delta requirements R1–R4 appended byte-faithfully, with each requirement heading appearing exactly once and all pre-existing requirements intact.
- **5.1** — checked upon merge of this archive relocation commit. Relocation preserves byte identity for proposal, design, assessment, delta spec, and metadata.
- **5.2** — unchecked at authoring time; will be closed upon archive PR merge by closing GitHub issue #83 and updating #132 Wave 2 checklist.

## Lifecycle bindings

| Phase | PR | Merged Commit | Notes |
| --- | --- | --- | --- |
| Proposal | #282 | `698921c` | `docs(openspec): propose materialize-repository-topology` |
| Implementation | #285 | `2e2e88b` | `docs(topology): materialize #83 topology documentation` |
| Canonical fold | #287 | `73b7a47` | `docs(openspec): fold materialize-repository-topology into repository-topology` |
| Archive | Pending PR | Pending | Byte-preserving archive relocation |

## Canonical capability materialization

`openspec/specs/repository-topology/spec.md` exists and carries all requirements from this change, materialized by fold PR #287 at commit `73b7a47`. This archive relocation commit does not touch `openspec/specs/**`.

## Production and publication restrictions

This archive commit touches no implementation, package manifest, CI workflow, release configuration, or generated artifact. It does not authorize package publication, production deployment, production collection, or real-user processing.

## Immutable archive contents

Byte-identical from the active change into the archive:

- `.openspec.yaml`
- `proposal.md`
- `assessment.json`
- `design.md`
- `specs/repository-topology/spec.md`

`tasks.md` was updated solely to check off completed tasks 1.1–4.1. `archive-evidence.md` is added.
