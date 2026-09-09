# Archive Evidence — reconcile-tracker-and-workspace-docs

Explicit archive validation record (R24) for relocation of
`reconcile-tracker-and-workspace-docs` to
`openspec/changes/archive/2026-09-09-reconcile-tracker-and-workspace-docs/`.

Archive validation is explicit and is not implied by strict OpenSpec validation
alone.

## Completion record

- **1.1–5.3** were completed in the governed sequence. The documentation
  reconciliation, the Makefile correction, and the coverage gate with its five
  failing arms landed through PR #414 at implementation head
  `4596049e3e9b3d1cf87a03d90f9b6c72b1dd1e0d`, merged as
  `4bc0e7e41a2dad40b30a5e093f1f32ef1e9dd718`.
- **6.1** is completed: the canonical fold, PR #416, merged as
  `a424c2660031a2074e400f2a8a8a4b4558ddf3df`. It materialized three ADDED
  requirements and seven scenarios in
  `openspec/specs/change-governance/spec.md`, and **replaced** two MODIFIED
  requirements in `openspec/specs/ci-topology/spec.md`.

## The MODIFIED fold, recorded because it is the risky half

An appended amendment leaves two contradictory `SHALL`s standing and no gate
detects it. Both `ci-topology` requirement blocks were therefore replaced whole,
and the withdrawn text was verified **absent** rather than merely superseded:

| Withdrawn text | Absent after fold |
| --- | --- |
| `across all four workspaces (`packages/security-audit-sdk-core`, …)` | yes |
| `roughly 18 seconds across all three workspaces` | yes |

Both requirement names occur exactly once in the canonical specification
afterwards, and all four scenarios the canonical requirements already carried
were preserved verbatim: _Targets delegate to existing workspace scripts_,
_Root command surface is classified as governance_core_, _test:matrix retains
its matrix-safe purpose_, and _Dominant validate cost is attributed to gate
mutation testing_.

Strict OpenSpec validation refused the first fold attempt for omitting two of
those scenarios, which is how they were found. That refusal is the mechanism
that makes a MODIFIED fold safe; it is recorded here because the failure mode it
prevents is silent.

## Why this change existed

Three agent-facing claims were measured and found false: the tracker named
canonical had recorded 1 of 114 merged pull requests over five days while moving
one card; the triage mapping told agents not to create four GitHub labels that
already existed and carried 82 applications; and `make` ran four of five declared
workspaces while printing a count consistent with the recipe rather than the
repository.

The third is the one that could hide a defect rather than merely mislead: CI
covered `packages/security-audit-collector` throughout, so a green local `make`
certified code it had never run.

## Decision provenance

The tracker statement is `decision_source = "delegated to Claude by the owner,
2026-09-09; not a human owner decision"`, recorded in
`docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md` together with
the measurements that withdrew the previous statement and the exact reversal
path. It is not exact-commit owner authorization, and reopening #308 is the
route if Hermes Kanban is meant to remain canonical.

## Archive geometry and byte identity

The following files are moved byte-for-byte from the active change at archive
base `a424c2660031a2074e400f2a8a8a4b4558ddf3df`; `archive-evidence.md` is the
only newly authored archive file. `tasks.md` was already fully checked by the
separate canonical-fold PR, so this relocation changes no task text.

| Relocated file | Archive-base blob |
| --- | --- |
| `.openspec.yaml` | `1ea7e36f49a4d8fd7e0a757a1df1a234cd8e6bdc` |
| `assessment.json` | `98acb5732e29b71af7938abba9dff4dd8fdc1562` |
| `assessment.source.json` | `1fd04e7dc2539f35276f25cbea6b39fed4fa0c10` |
| `design.md` | `b5ebd3b5b3fd8040b63783515e779ff86eff21c9` |
| `proposal.md` | `0c7980a7db46197197b0d8e79ebd66d890e38dc2` |
| `specs/change-governance/spec.md` | `51c56357169b867b4f255307f8e320f3632b3552` |
| `specs/ci-topology/spec.md` | `22c9593170c302da858c518d44de9ba0e6c78321` |
| `tasks.md` | `8c9ca63e8212bee180559472142a180b3cdffe36` |

## Boundary at archive

This change added no package, no contract artifact, and no CI workflow. The new
coverage assertion runs inside the existing `design-pattern-governance` job,
which already executed `check-package-discovery.mjs` and
`node --test .github/scripts/*.test.mjs`.

Closing #308 and #412 authorizes nothing. Every authorization boundary stands
where it did before: `storage`, `outbox`, `queue`, `transport`, and `collector`
remain forbidden filename, import, and export tokens in every package's scope
gate, and the canonical contract stays frozen at `1.0.0`.
