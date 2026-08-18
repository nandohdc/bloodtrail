# Archive Evidence — cover-bundle-archive-spec-fold

Discharges task 2.2 (R24): explicit archive-evidence validation. It does not rely on
`openspec validate --all --strict` alone; every item below is a separate check run or a
direct Git-object comparison, with its result recorded at the archive commit.

## Identities

| Binding | Value |
| --- | --- |
| Proposal commit P | `c654b99242f2ea050ba4a6a266d108f9eaa268fe` (`docs(openspec): propose spec-fold coverage keeper for the bundle archive`) |
| Assessment commit A | `78b62316561c3cea61d7bbbb26c2c06d68d95897` (`docs(governance): assess spec-fold coverage keeper`) |
| Final technical commit T | **none — by design.** This change carries no implementation. Its entire substance is the planning artifacts introduced by P and A; it changed no code, no generated artifact, no contract, and no policy file. |
| Covered sibling archive | `9e9d518d9f159ccc038d5390797823d759ec6935` (`docs(openspec): archive bundle-validator-runtime-helpers`) — the spec fold this change existed to cover |
| Merge commit M | `f94b34f00e2a0423a2175fd6482c00294f111c90` |
| M parents | `6056ded9bfcf6e945ae21491a5cb71ac85c3e622` (prior protected mainline), `9e9d518d9f159ccc038d5390797823d759ec6935` (branch tip) — identity-preserving two-parent merge of PR #176, authored by the project owner |
| P, A, and the covered archive reachable from M | yes (`git merge-base --is-ancestor` for each) |
| Signed governance record S | **none — by design.** This is a doc-only change (`material_capability_modification: false`, `security_sensitive: false`, `assessment_level: abbreviated`, `decision: direct_implementation`) with no executable surface at all. Its chain legitimately contains no signed record, and `packages/security-audit-sdk-core/verification-lifecycle.json` `governanceRecords` holds records only for the four archived implementation changes. Review-freshness checks apply only to changes with records, so no S binding is discharged here. |

## Task completeness

4/4 tasks checked at the archive commit, each discharged with recorded evidence rather
than merely checked:

- 1.1 — the coverage basis, the single reproduced `openspec-association-unrelated`
  diagnostic at `6056ded9bfcf6e945ae21491a5cb71ac85c3e622`, and the keeper remedy are
  recorded in `proposal.md`.
- 1.2 — the `security-audit-sdk-core` declaration stayed active through
  `9e9d518d9f159ccc038d5390797823d759ec6935`, which folded the ADDED requirement into
  `openspec/specs/security-audit-sdk-core/spec.md` under this change's coverage.
- 2.1 — owner identity-preserving merge `f94b34f00e2a` (two parents: `6056ded9bfcf` +
  `9e9d518d9f15`), PR #176.
- 2.2 — this commit; the pure relocation evidenced throughout this document.

## Signed record authorizations

N/A by design: this change has no signed governance record (doc-only, as stated under
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
- That spec's blob is `1f0c7450b704c8776074f3c539c42aacdba6db70` at both M and this
  archive commit — byte-identical, confirming no fold occurred here. The requirement it
  carries entered through the `bundle-validator-runtime-helpers` archive alone, exactly
  as proposed and reviewed there.
- The archived `assessment.json` retains `capabilities: ["security-audit-sdk-core"]` —
  required by the association gate's capability filter for relocated changes — and its
  relocated ownership is the active-dir and archive-dir prefixes only, with no
  `openspec/specs/` coverage. This is the property that makes the relocation self-covering
  and stops the coverage obligation from recursing into a further keeper.

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

The relocation is a pure move. Before this commit's reconciliation edits were applied, all
4 files at the active path under M were hash-compared against the moved copies: identical.

| File | Blob (active path at M = moved copy) |
| --- | --- |
| `.openspec.yaml` | `6e2b4b6b01b85557053229e5463cf2b145c0678f` |
| `assessment.json` | `48d055caf5708519ee650b1168be42461eeeaf5c` |
| `proposal.md` | `326f631603f920cdb76b2a64f109a4f5529f28bb` |
| `tasks.md` | `6d80c3b34065378dc76860348c485102a6dae541` (pre-reconciliation) |

`assessment.json` and `proposal.md` remain byte-identical to their active-path content at
M — verified at this commit with `git rev-parse HEAD:<archived>` against
`git rev-parse f94b34f:<active>`. Relocation recognition
(`openspec/scripts/design-pattern-governance/archive-relocation.mjs`) compares exactly
these two objects; had either drifted, the archive would not be recognised as a genuine
relocation and both change-dir prefixes would fail closed as
`openspec-association-unrelated`. This commit then applies exactly two changes inside the
moved directory, and nothing else:

1. `tasks.md` — 1.1, 1.2, 2.1 and 2.2 marked complete with their recorded evidence (4/4).
2. `archive-evidence.md` — this document (new).

Changed paths are exactly the active-directory removal and the dated-archive addition — 9
paths, as the governance checker independently reports. No path outside
`openspec/changes/cover-bundle-archive-spec-fold/` and
`openspec/changes/archive/2026-08-18-cover-bundle-archive-spec-fold/` is touched, and in
particular no `openspec/specs/` path, no contract path, and no package path.

## Active enforcement verified

- Design-pattern governance final phase at the committed archive HEAD: passes —
  `design-pattern governance passed in final phase: enforcement active; inspected 1
  commit(s) and 9 path(s) from f94b34f00e2a`. A non-empty inspected range is what makes
  this result load-bearing: the archive-dir paths are governed, and they are covered only
  because relocation recognition grants them to this change.
- Governance dual check: candidate and baseline agree — both pass with checker blob
  `13cd54e26afa`, baseline taken from `f94b34f00e2a0423a2175fd6482c00294f111c90`.
- Governance test suite: 196/196 pass across 44 suites.
- `openspec validate --all --strict`: 5/5 pass.
- `openspec validate --all --archived --strict`: 12/12 pass, including this change in
  archived mode (task completeness across every archive).
- Full SDK validation chain: every gate green with an empty index — 199/199 verification
  tests; `test:governance-history` (4 records; 50 governed commits resolve; 6 bound commits
  are ancestors of HEAD; 10 declared merge commits carry their expected parent count; 17
  reviewed content objects bound; 3 candidate root trees resolve),
  `test:archive-attestations` (2 declared, 2 anchored, 0 pending, 13 archived files
  verified — this archive declares none, consistent with every archive since the mechanism
  was introduced), `test:coherence` (archived mode, 91/91 tasks, contract 1.0.0, 24 catalog
  events/24 named APIs, 0 runtime dependencies), `test:changed-paths` (archived mode, 254
  visible records, archive-movement baseline re-derived from the attested revision),
  `test:package` (80 intentional files), and `test:git` (index empty).
- Contract validation: 14/14.
- `git diff --check`: clean, no whitespace errors.
- Required CI at the exact archive PR head: required-status contexts must be green before
  merge, including the required `design-pattern-governance` check; the live PR check state
  and the owner's merge decision are the external record of this step. CI results are
  declared here as a pre-merge requirement — no CI outcome is claimed before it has run.

## Final lifecycle states (task 2.2)

Reported independently; evidence for one is not evidence for another.

| State | Status |
| --- | --- |
| Proposal | P = `c654b99242f2ea050ba4a6a266d108f9eaa268fe` |
| Assessment | A = `78b62316561c3cea61d7bbbb26c2c06d68d95897` (abbreviated, direct_implementation) |
| Technical verification | N/A — no implementation commit exists for this change |
| Signed governance review | N/A — doc-only change, no record by design |
| Merge | M = `f94b34f00e2a0423a2175fd6482c00294f111c90`, identity-preserving (PR #176) |
| Coverage obligation | discharged — the `bundle-validator-runtime-helpers` spec fold landed at `9e9d518d9f15` under this change's active declaration |
| Canonical capability | untouched — `skip_specs: true`, no delta, spec blob `1f0c7450b704` unchanged at M and at this commit |
| Archive | this commit — hash reported after storage, not self-bound |
| Production / publication | withheld, unchanged, gate-enforced |
