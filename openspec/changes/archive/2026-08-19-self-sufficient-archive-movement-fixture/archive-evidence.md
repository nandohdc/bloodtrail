# Archive Evidence — self-sufficient-archive-movement-fixture

Discharges task 5.1 (R24): explicit archive-evidence validation. It does not rely on
`openspec validate --all --strict` alone; every item below is a separate check run or a
direct Git-object comparison, with its result recorded at the archive commit.

## Identities

| Binding | Value |
| --- | --- |
| Proposal commit P | `5a84789f63c0a45626001960df3264ff6ac47d52` (`docs(openspec): propose self-sufficient archive movement fixture`) |
| Technical commit T | `c944fed04d7373a2b7545f4f404cffe57dbd5fad` (`test(verification): self-seed the unrelated active change fixture`) |
| Merge commit M | `0aee52270089b8e5c803ffebfb8f238a62e79abc` |
| M parents | `2b9b2297e3665b6f513eb9f85b522f556e61f24b` (prior protected mainline), `c944fed04d7373a2b7545f4f404cffe57dbd5fad` (branch tip) — identity-preserving two-parent merge of PR #179, authored by the project owner |
| P and T reachable from M | yes (`git merge-base --is-ancestor` for each) |
| Signed governance record S | **none — by design.** This is a test-only change (`material_capability_modification: false`, `security_sensitive: false`, `assessment_level: abbreviated`, `decision: direct_implementation`) whose entire substance is one relocated verification control plus its fixture. Its chain legitimately contains no signed record, and `packages/security-audit-sdk-core/verification-lifecycle.json` `governanceRecords` holds records only for the four archived implementation changes. Review-freshness checks apply only to changes with records, so no S binding is discharged here — the same pattern as `2026-08-17-record-validator-packaging-policy` and `2026-08-18-cover-bundle-archive-spec-fold`. |

## Task completeness

9/9 tasks checked at the archive commit, each discharged with recorded evidence rather
than merely checked:

- 1.1 — the two causes (borrowed fixture, file-level `codescene delta` rules) are
  recorded in `proposal.md`; assessment-phase governance and strict OpenSpec validation
  passed before proposal commit P.
- 2.1 — T adds `tests/verification/archive-movement-unrelated-change.test.mjs` with the
  self-seeding fixture, tracked-at-HEAD guard, and null arm; both arms pass in the full
  verification suite.
- 2.2 — T removes ten lines (nine-line control plus separator blank) from
  `mutations.test.mjs`; the suite passes 74/74 with the neighbours untouched.
- 2.3 — T's diff touches only the two test files; no checker, classification rule, or
  diagnostic id changed, and no reference to the correction's directory remains under
  `packages/security-audit-sdk-core/` or `openspec/tests/`.
- 3.1 — SDK `validate` 20/20 gates green with an empty index (verification 203/203,
  including both new arms); contract `validate` 14/14; `openspec validate --all --strict`
  7/7; governance final phase green, dual check agreeing at checker blob `13cd54e26afa`,
  governance suite 196/196; required CI on PR #179 all green including `codescene delta`.
- 4.1 — the owner reviewed and manually merged PR #179 at T; GitHub records no separate
  review object, consistent with PRs #176 and #178 in this repository.
- 4.2 — the owner's merge of PR #179 is the recorded decision on exact commit T.
- 4.3 — owner identity-preserving merge M, parents verified above, all required CI green.
- 5.1 — this commit; the pure relocation evidenced throughout this document.

## Signed record authorizations

N/A by design: this change has no signed governance record (test-only, as stated under
Identities). The archive-evidence contract's T/S-binding items are thereby explicitly
addressed as not applicable rather than silently omitted: there is no S to bind, no
granted/withheld list to re-state, and no record to dangle or stale. The four existing
signed records' withheld authorizations remain the standing production/publication
boundary and are unaffected by this archive.

## Canonical capability presence

- `.openspec.yaml` declares `skip_specs: true`; the change carries no `specs/` delta and
  `material_capability_modification: false`. `openspec status` reports
  `artifactPaths.specs.existingOutputPaths` as empty, so nothing folds into
  `openspec/specs/security-audit-sdk-core/spec.md`.
- The spec's blob is unchanged between M and this archive commit — byte-identical,
  confirming no fold occurred here.
- The archived `assessment.json` retains `capabilities: ["security-audit-sdk-core"]` —
  required by the association gate's capability filter for relocated changes — with its
  `owned_paths` naming the two governed test files.

## Production / publication restrictions

Unchanged and still enforced by executable gates (all green at the archive commit):
`test:scope` (17 SDK source files, only `node:async_hooks`/`node:crypto` external runtime
imports, no production integration surface), `test:publication-path` (3 workflow/4
automation files, 0 local automation references, 3 private tracked manifests and 43
scripts carrying no publish command, registry configuration, or credential),
`test:dependencies` (0 runtime dependencies), and the withheld authorization lists of the
existing signed records. No publication or deployment authorization exists anywhere in
this cycle.

## Immutable archive contents, exact changed paths, byte identity

The relocation is a pure move. Before this commit's reconciliation edits were applied,
all 4 files at the active path under M were hash-compared against the moved copies:
identical.

| File | Blob (active path at M = moved copy) |
| --- | --- |
| `.openspec.yaml` | `4ea27766c762fc7ae9063860e026b4e71e25384e` |
| `assessment.json` | `c582df0f8ea27904098cd437c9e78406d4a698b3` |
| `proposal.md` | `0e0f276b07efffed56c90562307159b5a75eef30` |
| `tasks.md` | `86ee12146b436fc4acccb1c1bf01a9343630e3ae` (pre-reconciliation) |

`assessment.json` and `proposal.md` remain byte-identical to their active-path content at
M — verified at this commit with `git rev-parse HEAD:<archived>` against
`git rev-parse 0aee5227:<active>`. Relocation recognition
(`openspec/scripts/design-pattern-governance/archive-relocation.mjs`) compares exactly
these two objects; had either drifted, the archive would not be recognised as a genuine
relocation and both change-dir prefixes would fail closed as
`openspec-association-unrelated`. This commit then applies exactly two changes inside the
moved directory, and nothing else:

1. `tasks.md` — all 9 tasks marked complete with their recorded evidence (9/9).
2. `archive-evidence.md` — this document (new).

Changed paths are exactly the active-directory removal and the dated-archive addition —
no path outside `openspec/changes/self-sufficient-archive-movement-fixture/` and
`openspec/changes/archive/2026-08-19-self-sufficient-archive-movement-fixture/` is
touched, and in particular no `openspec/specs/` path, no contract path, no package path,
no checker, and no `verification-lifecycle.json`.

## Active enforcement verified

- Design-pattern governance final phase at the archive HEAD: passes, with relocation
  recognition covering the archive-dir paths.
- Governance dual check: candidate and baseline agree on the checker blob.
- Governance test suite: all pass.
- `openspec validate --all --strict` and `openspec validate --all --archived --strict`:
  all pass, including this change in archived mode (task completeness across every
  archive).
- Full SDK validation chain: every gate green with an empty index.
- Contract validation: all pass.
- `git diff --check`: clean, no whitespace errors.
- Required CI at the exact archive PR head: required-status contexts must be green before
  merge, including the required `design-pattern-governance` check; the live PR check state
  and the owner's merge decision are the external record of this step. CI results are
  declared here as a pre-merge requirement — no CI outcome is claimed before it has run.

## Final lifecycle states (task 5.1)

Reported independently; evidence for one is not evidence for another.

| State | Status |
| --- | --- |
| Proposal | P = `5a84789f63c0a45626001960df3264ff6ac47d52` |
| Assessment | A = `c582df0f8ea27904098cd437c9e78406d4a698b3` (abbreviated, direct_implementation) |
| Technical verification | T = `c944fed04d7373a2b7545f4f404cffe57dbd5fad` — full chain green pre-commit; required CI green on PR #179 |
| Signed governance review | N/A — test-only change, no record by design |
| Merge | M = `0aee52270089b8e5c803ffebfb8f238a62e79abc`, identity-preserving (PR #179), authored by the project owner |
| Coverage obligation | N/A — `skip_specs: true`, no delta, nothing folds into `openspec/specs/` |
| Canonical capability | untouched — spec blob identical at M and at this commit |
| Archive | this commit — hash reported after storage, not self-bound |
| Production / publication | withheld, unchanged, gate-enforced |
