# Archive Evidence — fix-assessment-baseline-merge-drift

Explicit archive validation record (R24) for relocation of
`fix-assessment-baseline-merge-drift` to
`openspec/changes/archive/2026-09-08-fix-assessment-baseline-merge-drift/`.

## Completion record

- PR #372 implemented stable, authored assessment proposal baselines at head
  `3129c5bdc6c1675f51cf051a05976d886c0df721` and merged it as
  `6b9b94f0b2603dc12417eb766e2568aa771652a4` after its exact-head CI had no
  failures.
- PR #375 folded the completed R10 delta into the canonical
  `software-design-pattern-governance` specification at head
  `ceae51c31339338c5c3861d1bb501bef202b5b2a`, merged as
  `be08f4b5967b02268494dacbf84488944a2d3759`. It preserved the existing seven
  R10 scenarios and materialized the two merge-boundary scenarios. Task 3.2
  was completed there after #372's exact-head green merge.

## Canonical specification state

The archived MODIFIED R10 block, excluding only its operation heading, is
byte-identical to the block in
`openspec/specs/software-design-pattern-governance/spec.md`. This archive does
not alter `openspec/specs/**` or repeat the completed canonical fold.

## Archive geometry and byte identity

The seven artifacts below are relocated byte-for-byte from archive base
`77ba03724a563f48760b58ab1c9514bb582d994e`; this evidence file is the only
new archive content.

| Relocated file | Archive-base blob |
| --- | --- |
| `.openspec.yaml` | `7a8e2be6f1ac81fa8cffa1a2dc35a75fc0642617` |
| `assessment.json` | `ff761517601714a664a8795e449479a7b11d62d6` |
| `assessment.source.json` | `e18b62f4445bca93e6a55f52b90dc990b1d2c610` |
| `design.md` | `8a86a64d452cdda64af8abe5d0a1f172bce92b5b` |
| `proposal.md` | `3ef0d446ea414ec968519e89ec5dc419122e5b21` |
| `specs/software-design-pattern-governance/spec.md` | `1b0f300af16dd2d41550bfe58257ed0f1afe0b89` |
| `tasks.md` | `fa17e46ecfd6655e82102db4eed5162a75cad61b` |

The relocation removes the active change directory, adds the dated archive
directory, and changes no implementation, test, generated artifact, CI
workflow, or canonical specification.

## Validation and authorization boundary

Strict OpenSpec validation, whitespace checks, archive identity checks, and
the final governance perimeter are run for this archive candidate. The archive
PR's exact-head checks are the final external record before merge. This record
does not authorize package publication, production deployment, production
collection, real-user processing, framework integration, or delivery
infrastructure. It is evidence, not approval or additional authorization.
