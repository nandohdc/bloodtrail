# Archive Evidence — cover-local-instruction-control-paths

Discharges task 2.2: the keeper's archive as a pure relocation. It does not rely on
`openspec validate --all --strict` alone; every item below is a separate check run or a direct
Git-object comparison, with its result recorded at the archive commit.

## Identities

| Binding | Value |
| --- | --- |
| Proposal/assessment commit K | `716e35b4f10d07ecc9c33c3e4fdb94fb395f1255` (in merge M, PR #178) |
| Merge commit M | `2b9b2297e3665b6f513eb9f85b522f556e61f24b` |
| M parents | `72a39e54001079434f3b7ad9f518287d59369ff0` (prior protected mainline), `6fab5f9a6f7fc9bd6a63c1727fbc96fbac2890d3` (the correction's technical commit T) — identity-preserving two-parent merge of PR #178, authored by the project owner |
| K reachable from M | yes (`git merge-base --is-ancestor`) |
| Signed governance record S | **none — by design.** This change is planning-only (`assessment_level: abbreviated`, `decision: direct_implementation`, `material_capability_modification: false`, `security_sensitive: false`); its entire substance is holding a capability declaration open. Review-freshness checks apply only to changes with records, so no S binding is discharged here — the same pattern as the archived fixture change. |

## Task completeness

4/4 tasks checked at the archive commit, each discharged with recorded evidence:

- 1.1 — already checked at proposal time: the coverage basis and the reproduced
  `openspec-association-unrelated` failure recorded in `proposal.md`.
- 1.2 — discharged: this change stayed active, declaring `security-audit-sdk-core` and owning the
  two control paths, through the correction's merge (`2b9b2297…`, PR #178) and its archive
  (`fd2ff14…`, PR #184, merged at `1b69590c…`); the correction's `archive-evidence.md` records the
  keeper as active at the fold (its task 6.5).
- 2.1 — recorded, not re-done: owner identity-preserving merge of PR #178 at `2b9b2297…`.
- 2.2 — this archive commit.

## Canonical capability presence

- `.openspec.yaml` declares `skip_specs: true`; the change carries no `specs/` delta and
  `material_capability_modification: false`. Nothing folds into `openspec/specs/`.
- The spec's blob is unchanged between the pre-archive head `1b69590cd913866830bdd092f6443728d6045346`
  (which already carries the correction's fold, PR #184) and this archive commit — byte-identical,
  confirming no fold occurs in this archive. The only spec change in this cycle belongs to the
  correction's archive and happened before this change moved.
- The archived `assessment.json` retains `capabilities: ["security-audit-sdk-core"]` — required by
  the association gate's capability filter for relocated changes — with its `owned_paths` naming
  the two governed test files.

## Production / publication restrictions

Unchanged and still enforced by executable gates (all green at the archive commit): `test:scope`,
`test:publication-path`, `test:dependencies` (0 runtime dependencies), and the withheld
authorization lists of the existing signed records. No publication or deployment authorization
exists anywhere in this cycle.

## Immutable archive contents, exact changed paths, byte identity

The relocation is a pure move. Before this commit's reconciliation edits, all 4 files at the
active path under M were hash-compared against the moved copies: identical. The keeper directory
was untouched by every commit between M and this archive (`git diff 2b9b2297..HEAD --
openspec/changes/cover-local-instruction-control-paths/` is empty before this commit).

| File | Blob (active path at M = moved copy) |
| --- | --- |
| `.openspec.yaml` | `6e2b4b6b01b85557053229e5463cf2b145c0678f` |
| `assessment.json` | `997e2a6313a4d53115dbfc2cfa216a8bc07c71ff` |
| `proposal.md` | `c5ca70fb0791151ea63764a7b879889ba3068dfb` |
| `tasks.md` | `1a180aca09b9e9a5ddb36b7e41d77a4e27772cf4` (pre-reconciliation) |

Both relocation-recognition artifacts — `assessment.json` and `proposal.md` — remain
byte-identical to their active-path content at M, so recognition is doubly satisfied. This commit
then applies exactly two changes inside the moved directory, and nothing else:

1. `tasks.md` — all 4 tasks marked complete with their recorded evidence (4/4).
2. `archive-evidence.md` — this document (new).

Changed paths are exactly the active-directory removal and the dated-archive addition — no path
outside `openspec/changes/cover-local-instruction-control-paths/` and
`openspec/changes/archive/2026-08-19-cover-local-instruction-control-paths/` is touched, and in
particular no `openspec/specs/` path, no contract path, no package path, no checker, and no
`verification-lifecycle.json`.

## Active enforcement verified

- Design-pattern governance final phase at the archive HEAD: passes with enforcement active and a
  non-null inspected range.
- Governance dual check: candidate and baseline agree on the checker blob.
- Governance test suite: all pass.
- `openspec validate --all --strict` and `openspec validate --all --archived --strict`: all pass,
  including this change in archived mode.
- Full SDK validation chain: every gate green with an empty index; contract validation: all pass.
- `git diff --check`: clean, no whitespace errors.
- Required CI at the exact archive PR head: required-status contexts must be green before merge,
  including the required `design-pattern-governance` check; the live PR check state and the
  owner's merge decision are the external record of this step. CI results are declared here as a
  pre-merge requirement — no CI outcome is claimed before it has run.

## Final lifecycle states (task 2.2)

Reported independently; evidence for one is not evidence for another.

| State | Status |
| --- | --- |
| Proposal | K = `716e35b4f10d07ecc9c33c3e4fdb94fb395f1255` (in M) |
| Assessment | `997e2a6313a4d53115dbfc2cfa216a8bc07c71ff` (abbreviated, direct_implementation) |
| Merge | M = `2b9b2297e3665b6f513eb9f85b522f556e61f24b`, identity-preserving (PR #178), authored by the project owner |
| Coverage obligation | held through the correction's archive (`fd2ff14…`, PR #184); discharged at that merge |
| Canonical capability | untouched — spec blob identical at M and at this commit |
| Archive | this commit — hash reported after storage, not self-bound |
| Production / publication | withheld, unchanged, gate-enforced |
