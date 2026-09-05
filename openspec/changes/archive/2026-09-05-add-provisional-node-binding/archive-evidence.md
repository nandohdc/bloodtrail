# Archive Evidence — add-provisional-node-binding

Explicit archive validation record (R24) for the archive relocation of the `add-provisional-node-binding` change into `openspec/changes/archive/2026-09-05-add-provisional-node-binding/`.

Archive validation is explicit and is not assumed from `openspec validate --all --strict` (R24).

## Task completeness

- **1.1–1.2** (Proposal) — checked. Proposal packet authored under `openspec/changes/add-provisional-node-binding/`, verified with strict validation, reviewed independently, and merged in PR #332 at commit `e44ac60`.
- **2.1–2.2** (Review and authorization) — checked. Independent exact-commit review recorded, owner authorization recorded.
- **3.1–3.9** (Standalone package and Node SPI implementations) — checked. Standalone `@bloodtrail/security-audit-sdk-node` initialized with own manifests/lockfiles/tsconfig (3.1), implemented identifiers (3.2), clock (3.3), byteLength (3.4), timers (3.5), context provider (3.6), schema runtime (3.7), platform provider bundle & SDK factory (3.8), and compatibility.json / README marking API explicitly provisional (3.9). Merged in PR #333 at commit `6a3565b`.
- **4.1–4.5** (Verification and equivalence proof) — checked. Unit and equivalence tests verify Node providers reproduce pre-split behavior (4.1), child-process context isolation tests verify concurrent async isolation (4.2), child-process shutdown tests verify prompt exit without signal handlers (4.3), check-dependencies verifies zero third-party runtime deps (4.4), and check-package-contents verifies packed tarball installs and imports cleanly across Node 24.2.0 and Node 26.5.0 (4.5).
- **5.1** (Canonical fold) — checked. Fold PR #334 merged canonical capability spec into `openspec/specs/security-audit-sdk-node/spec.md` with all 4 requirements at commit `a0b3852` while the change was still active.
- **5.2** (Archive change) — checked. Byte-preserving archive relocation commit into `openspec/changes/archive/2026-09-05-add-provisional-node-binding/`.
- Issue #87 closed upon implementation and archive completion.

## Lifecycle bindings

| Phase | PR | Merged Commit | Notes |
| --- | --- | --- | --- |
| Proposal | #332 | `e44ac60` | `docs(openspec): propose add-provisional-node-binding (#87)` |
| Implementation | #333 | `6a3565b` | `feat(sdk): add provisional node binding (#87)` |
| Canonical fold | #334 | `a0b3852` | `docs(openspec): fold add-provisional-node-binding into security-audit-sdk-node (#87)` |
| Archive | Pending PR | Pending | Byte-preserving archive relocation |

## Canonical capability materialization

`openspec/specs/security-audit-sdk-node/spec.md` exists and carries all 4 requirements from this change, materialized by fold PR #334 at commit `a0b3852`. This archive relocation commit does not touch `openspec/specs/**`.

## Production and publication restrictions

This archive commit touches no implementation, package manifest, CI workflow, release configuration, or generated artifact. It does not authorize package publication, production deployment, production collection, or real-user processing.

## Immutable archive contents

Byte-identical from the active change into the archive:

- `.openspec.yaml`
- `proposal.md`
- `assessment.json`
- `assessment.source.json`
- `design.md`
- `specs/security-audit-sdk-node/spec.md`

`tasks.md` was updated solely to check off completed tasks 5.1 and 5.2. `archive-evidence.md` is added.
