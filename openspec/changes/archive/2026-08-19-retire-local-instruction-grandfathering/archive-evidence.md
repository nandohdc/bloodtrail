# Archive Evidence — retire-local-instruction-grandfathering

Discharges task 2.3: this change's archive as a pure relocation. It does not rely on
`openspec validate --all --strict` alone; every item below is a separate check run or a direct
Git-object comparison, with its result recorded at the archive commit.

## Identities

| Binding | Value |
| --- | --- |
| Proposal commit P | `68fb9680c578aed2b8abf6d90e28e22d3455c0e2` (PR #181) |
| Proposal merge | `029f8fb613e81c6282b1643194c8df15acebfeb9`, parents `e176bce9164addbecac863e1491d46e50f6b58bd` (prior protected mainline) and `68fb9680c578aed2b8abf6d90e28e22d3455c0e2` — identity-preserving two-parent merge authored by the project owner |
| Implementation commit T | `19afaa73fe01a734a6371b94b274ec9f2466c5d4` (PR #183) — `grandfathering` set to `[]` in `openspec/governance/design-pattern-policy.json`, plus task 1.2 checked; 2 files, no other path |
| Implementation merge | `6ea3b5c1e3492c1db5d834e7b75499f1add84569`, parents `029f8fb613e81c6282b1643194c8df15acebfeb9` and `19afaa73fe01a734a6371b94b274ec9f2466c5d4` — identity-preserving two-parent merge authored by the project owner |
| P and T reachable from HEAD | yes (`git merge-base --is-ancestor`, both) |
| Signed governance record S | **none — by design.** This change carries no specification content and no code: `.openspec.yaml` sets `skip_specs: true`, `material_capability_modification: false`, `security_sensitive: false`. Its entire substance is one governance-core policy edit plus holding association coverage open. Review-freshness checks apply only to changes with records, so no S binding is discharged here — the same pattern as the keeper change archived at PR #185. |

## Task completeness

5/5 tasks checked at the archive commit, each discharged with recorded evidence:

- 1.1 — already checked at proposal time: the retirement basis and the reproduced failure are
  recorded in `proposal.md` (disposable-clone dry run at `e176bce9…`, 10 diagnostics: five
  `grandfathered-scope-expanded` and five `openspec-association-unrelated`, one of each per file
  under the correction's dated archive directory).
- 1.2 — already checked at the implementation commit `19afaa73…`: `grandfathering` set to `[]`.
- 2.1 — recorded, not re-done: owner identity-preserving merges of the proposal PR #181 at
  `029f8fb613e81c6282b1643194c8df15acebfeb9` and the implementation PR #183 at
  `6ea3b5c1e3492c1db5d834e7b75499f1add84569`.
- 2.2 — discharged: this change stayed active, declaring `software-design-pattern-governance` and
  owning `openspec/governance/design-pattern-policy.json` and
  `openspec/changes/archive/2026-08-19-correct-local-instruction-verification-premise/`, until the
  correction's archive merged at `1b69590cd913866830bdd092f6443728d6045346` (PR #184, commit
  `fd2ff14467bd5d138bc58446bac4b71258179b34`).
- 2.3 — this archive commit.

## The coverage role this change played

Retiring the entry and covering what the retirement enabled are two obligations, and this change
held both:

- **The policy file.** `openspec/governance/` is a `governance_core_artifacts` prefix and
  `governedPatterns()` selects `governance_core` as well as `governed_implementation`, so the edit
  at `19afaa73…` needed association coverage from an active change's `owned_paths`. This change
  supplied it, and — because `governance_core_path` is a `full_assessment_triggers` entry — did so
  honestly, with `assessment_level: "full"` and `triggers_matched: ["governance_core_path"]` rather
  than an abbreviated assessment carrying a false absence proof.
- **The correction's dated archive directory.** The correction is grandfathered and carries no
  assessment, so it declares no capabilities and contributes no coverage — not even of its own
  relocation. This change owned
  `openspec/changes/archive/2026-08-19-correct-local-instruction-verification-premise/` through the
  archive commit that created it.

Both obligations are discharged: the policy edit and the correction's archive are in the protected
mainline, so neither path appears in this archive's range and neither needs coverage from an active
change any longer.

## Canonical capability presence

- `.openspec.yaml` declares `skip_specs: true`; the change carries no `specs/` delta and
  `material_capability_modification: false`. Nothing folds into `openspec/specs/`.
- The `openspec/specs/security-audit-sdk-core/spec.md` blob is unchanged between the pre-archive
  head `bfd742249edaa14c802f176c97217d9a67802042` (the merge of PR #185) and this archive commit —
  byte-identical at `fd303b8f141d7d15bf86c38e2d8acfb176dc9b76`, confirming no fold occurs in this
  archive. The only spec change in this cycle belongs to the correction's archive (PR #184) and
  happened before this change moved.
- The archived `assessment.json` retains `applicability.capabilities:
  ["software-design-pattern-governance"]` — required by the association gate's capability filter for
  relocated changes.

## Production / publication restrictions

Unchanged and still enforced by executable gates (all green at the archive commit): `test:scope`,
`test:publication-path`, `test:dependencies` (0 runtime dependencies), and the withheld
authorization lists of the existing signed records. No publication or deployment authorization
exists anywhere in this cycle. Retiring a grandfathering entry removes a provenance exemption; it
grants nothing.

## Immutable archive contents, exact changed paths, byte identity

The relocation is a pure move. Before this commit's reconciliation edits, all 4 files at the active
path under the implementation merge `6ea3b5c1…` were hash-compared against the moved copies:
identical. The change directory was untouched by every commit between `6ea3b5c1…` and the
pre-archive head `bfd742249…`: `git diff 6ea3b5c1..HEAD --
openspec/changes/retire-local-instruction-grandfathering/` is empty before this commit.

| File | Blob (active path at `6ea3b5c1…` = moved copy) |
| --- | --- |
| `.openspec.yaml` | `4ea27766c762fc7ae9063860e026b4e71e25384e` |
| `assessment.json` | `0f6f2f7869179b05ff0ef0a45fb0637624fb607d` |
| `proposal.md` | `e666dcc8532fd34d8b1368f9589cc4ba0e724640` |
| `tasks.md` | `4365eb52c13c47ba733895d24c484c4181b8e56b` (pre-reconciliation) |

Both relocation-recognition artifacts — `assessment.json` and `proposal.md`, the exact pair in
`RELOCATION_ARTIFACTS` — remain byte-identical to their active-path content, so recognition is
doubly satisfied. `.openspec.yaml` also moves unchanged, but it is **not** a relocation artifact and
plays no part in recognition. This commit then applies exactly two changes inside the moved
directory, and nothing else:

1. `tasks.md` — all 5 tasks marked complete with their recorded evidence (5/5).
2. `archive-evidence.md` — this document (new).

Changed paths are exactly the active-directory removal and the dated-archive addition — verified
against the commit tree, not the working tree — and no path outside
`openspec/changes/retire-local-instruction-grandfathering/` and
`openspec/changes/archive/2026-08-19-retire-local-instruction-grandfathering/` is touched. In
particular no `openspec/specs/` path, no `openspec/governance/` path, no contract path, no package
path, no checker, and no `verification-lifecycle.json`.

## Self-coverage of this relocation

Unlike the correction, this change covers its own archive. `collectRelocatedChangeIds` recognises
the dated archive directory as a genuine relocation because it carries the exact objects history
carried at the active path, and `ownedPathsFor` grants that directory to the relocated change.
The association's capability filter — `changes.filter((change) => change.capabilities.length > 0)`
— is satisfied because the archived `assessment.json` declares a non-empty
`applicability.capabilities`. This is precisely what the correction could not do, and precisely why
this change had to exist.

## Active enforcement verified

- Design-pattern governance final phase at the archive HEAD: passes with enforcement active and a
  non-null inspected range.
- Governance dual check: candidate and baseline agree on the checker blob `13cd54e26afa`.
- Governance test suite: 196/196 pass.
- `openspec validate --all --strict` and `openspec validate --all --archived --strict`: all pass,
  including this change in archived mode.
- Full SDK validation chain: every gate green with an empty index; contract validation: all pass.
- `git diff --check`: clean, no whitespace errors.
- Commit-tree verification: `git ls-tree --name-only HEAD openspec/changes/` lists only `archive`,
  confirming the move is in the commit and not merely in the working tree.
- Required CI at the exact archive PR head: required-status contexts must be green before merge,
  including the required `design-pattern-governance` check; the live PR check state and the owner's
  merge decision are the external record of this step. CI results are declared here as a pre-merge
  requirement — no CI outcome is claimed before it has run.

## Final lifecycle states (task 2.3)

Reported independently; evidence for one is not evidence for another.

| State | Status |
| --- | --- |
| Proposal | P = `68fb9680c578aed2b8abf6d90e28e22d3455c0e2`, merged `029f8fb613e81c6282b1643194c8df15acebfeb9` (PR #181) |
| Assessment | `0f6f2f7869179b05ff0ef0a45fb0637624fb607d` (full, direct_implementation, `triggers_matched: ["governance_core_path"]`) |
| Implementation | T = `19afaa73fe01a734a6371b94b274ec9f2466c5d4`, merged `6ea3b5c1e3492c1db5d834e7b75499f1add84569` (PR #183), identity-preserving, authored by the project owner |
| Coverage obligation | held through the correction's archive (`fd2ff14…`, PR #184, merged `1b69590c…`); discharged at that merge |
| Canonical capability | untouched — spec blob identical at the pre-archive head and at this commit |
| Archive | this commit — hash reported after storage, not self-bound |
| Production / publication | withheld, unchanged, gate-enforced |
