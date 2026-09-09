# Archive Evidence — ratify-collector-storage-semantics

Explicit archive validation record (R24) for relocation of
`ratify-collector-storage-semantics` to
`openspec/changes/archive/2026-09-09-ratify-collector-storage-semantics/`.

Archive validation is explicit and is not implied by strict OpenSpec validation
alone.

## Completion record

- **1.1–3.3** were completed in the governed sequence. The decision packet —
  `proposal.md`, `design.md`, the `collector-storage-semantics` delta,
  `tasks.md`, `assessment.source.json` and its generated `assessment.json` —
  landed through PR #408 at implementation head
  `6bf5c39a8faaf86230831695be45ba322b398d1f` and merged as
  `2f2fa2007c076f76dec808f22ed2ec4d0bef0018`.
- **1.1** is completed: PR #408's exact head passed all ten required contexts
  before the authorized administrative merge. The diff modified only paths under
  `openspec/changes/ratify-collector-storage-semantics/` — no `contracts/` path,
  no `packages/` path, no generated artifact, no workflow.
- **4.1** is completed: the canonical fold, PR #410 at head
  `555355ac8b1ae67b0b381006a031c5024cffcca3`, merged as
  `c52b44238980f55623e3904ab2c6ad093f138fba`. It materialized all eleven delta
  requirements and twenty-seven scenarios in
  `openspec/specs/collector-storage-semantics/spec.md` while this change was
  active, and recorded task completion.

## Merge posture

Neither PR carried a completed reviewer run bound to its head. No Hermes
reviewer fleet ran in the session that produced them, and no reviewer run was
fabricated to satisfy the merge gate's review arm — doing so would have
falsified the exact evidence that arm exists to produce. Both merges rest on the
owner's away-window authorization of 2026-09-09 (`--admin` once CI has no
failures) together with green required checks, and on nothing else. Each PR
carries a comment recording the gate's verdict arm by arm, including the failing
review arm.

**Neither merge is evidence that an independent review occurred.**

## Canonical specification state

The archive base is the #410 merge commit. Comparing the delta after removing
only its `## ADDED Requirements` operation heading finds all eleven requirement
blocks and all twenty-seven scenario blocks byte-for-byte in
`openspec/specs/collector-storage-semantics/spec.md`. This archive does not
modify `openspec/specs/**` and does not repeat that fold.

## Archive geometry and byte identity

The following files are moved byte-for-byte from the active change at archive
base `c52b44238980f55623e3904ab2c6ad093f138fba`; `archive-evidence.md` is the
only newly authored archive file. `tasks.md` was already fully checked by the
separate canonical-fold PR, so this relocation changes no task text.

| Relocated file | Archive-base blob |
| --- | --- |
| `.openspec.yaml` | `1ea7e36f49a4d8fd7e0a757a1df1a234cd8e6bdc` |
| `assessment.json` | `89cf3952c9255d778336274fd9f30ba8e2cc3f0c` |
| `assessment.source.json` | `e175db217228f077ffe3ef2370f808a05242fff4` |
| `design.md` | `2e4a2e7db5555db922bf19c0304a2f40b6b116b4` |
| `proposal.md` | `5de9df9408391f95820c9f3a256ce44bedd018f8` |
| `specs/collector-storage-semantics/spec.md` | `4470ca87866be316ff1b534f1d1580877b745ab1` |
| `tasks.md` | `e98bd558e27755dbc859beda34d169e5991ff4c0` |

## Boundary at archive

Archiving #114's decision lifts nothing. `storage` remains a forbidden filename,
import, and export token in every package's `check-scope.mjs`, the canonical
contract stays frozen at `1.0.0`, and no storage implementation exists.

The capability records `decision_source = "delegated to Claude by the owner,
2026-09-09; not a human owner decision"` and states in its own text that it
authorizes no implementation. It is not exact-commit owner authorization.

**#115 remains blocked** on owner authorization and a backend selection.
**#116 remains blocked** on #115 and on a written owner authorization naming
environment, exact versions, data classification, duration, owners, and stop and
rollback criteria testable before execution.
