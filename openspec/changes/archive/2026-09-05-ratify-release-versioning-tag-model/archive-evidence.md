# Archive Evidence — ratify-release-versioning-tag-model

Explicit archive validation record (R24) for the archive relocation of the `ratify-release-versioning-tag-model` change into `openspec/changes/archive/2026-09-05-ratify-release-versioning-tag-model/`.

Archive validation is explicit and is not assumed from `openspec validate --all --strict` (R24).

## Task completeness

- **1.1–1.2** (Proposal) — checked. Proposal packet authored under `openspec/changes/ratify-release-versioning-tag-model/`, verified with strict validation, reviewed independently, and merged in PR #278 at commit `4fef7b0`.
- **2.1–2.2** (Review and authorization) — checked. Independent exact-commit review recorded, owner authorization recorded, and decision provenance noted verbatim (`decision_source = "delegated to Claude by the owner, 2026-09-03; not a human owner decision"`).
- **3.1–3.2** (Downstream implementation) — checked. Materialized decision record `docs/adr/0012-release-versioning-and-tag-model.md` merged in PR #284 at commit `3285b34`.
- **4.1** (Canonical fold) — checked. Fold PR #326 merged canonical capability spec into `openspec/specs/release-versioning-tag-model/spec.md` with all 8 requirements at commit `21213aa` while the change was still active.
- **4.2** (Archive) — checked upon merge of this archive relocation commit. Preserves byte identity for proposal, design, assessment, delta spec, and metadata.
- Issue #81 closed upon archive PR merge; #81 ticked in #132 Wave 2 checklist.

## Lifecycle bindings

| Phase | PR | Merged Commit | Notes |
| --- | --- | --- | --- |
| Proposal | #278 | `4fef7b0` | `docs(openspec): propose ratify-release-versioning-tag-model` |
| ADR 0012 | #284 | `3285b34` | `docs(adr): record release versioning and tag model decision` |
| Canonical fold | #326 | `21213aa` | `docs(openspec): fold ratify-release-versioning-tag-model into release-versioning-tag-model` |
| Archive | Pending PR | Pending | Byte-preserving archive relocation |

## Canonical capability materialization

`openspec/specs/release-versioning-tag-model/spec.md` exists and carries all 8 requirements from this change, materialized by fold PR #326 at commit `21213aa`. This archive relocation commit does not touch `openspec/specs/**`.

## Production and publication restrictions

This archive commit touches no implementation, package manifest, CI workflow, release configuration, or generated artifact. It does not authorize package publication, production deployment, production collection, or real-user processing.

## Immutable archive contents

Byte-identical from the active change into the archive:

- `.openspec.yaml`
- `proposal.md`
- `assessment.json`
- `design.md`
- `specs/release-versioning-tag-model/spec.md`

`tasks.md` was updated solely to check off completed tasks 1.1–4.1. `archive-evidence.md` is added.
