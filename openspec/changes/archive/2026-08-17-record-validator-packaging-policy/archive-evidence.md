# Archive Evidence — record-validator-packaging-policy

Discharges task 1.7 (R24): explicit archive-evidence validation. It does not rely on
`openspec validate --all --strict` alone; every item below is a separate check run or a
direct Git-object comparison, with its result recorded at the archive commit.

## Identities

| Binding | Value |
| --- | --- |
| Proposal commit P | `bf96500cf2274a8d8d068da84156ae0d9532b9ef` |
| Assessment commit A | `ba2d5869b65e6f4cc63f9c05d7738bff589efed7` |
| Final technical commit T | `401f3ad812a000126c0458cf520c00ba4259c2d7` (`docs(sdk): record ADR-SDK-011 validator runtime packaging policy`) |
| Follow-up documentation commit | `3aedfec158b47beb56f0a5e38c7801e7bc3a323a` (`docs(openspec): mark evidenced decision-record tasks complete`, changes only the change's own `tasks.md`) |
| Merge commit M | `3003e73663daf0c8392063488b4b59826e9daf9c` |
| M parents | `ccc4b1495eb21fc42dac30a37c07bed8702c5ba3` (prior protected mainline), `3aedfec158b47beb56f0a5e38c7801e7bc3a323a` (branch tip) — identity-preserving two-parent merge of PR #170 |
| T reachable from M | yes (`git merge-base --is-ancestor 401f3ad… 3003e736…`) |
| Signed governance record S | **none — by design.** This is a doc-only change (`material_capability_modification: false`, `security_sensitive: false`, no governed normative paths; the only executable change is two literals in a verification script). Its chain legitimately contains no signed record, and `packages/security-audit-sdk-core/verification-lifecycle.json` `governanceRecords` holds records only for the three archived implementation changes. Review-freshness checks apply only to changes with records, so no S binding is discharged here. |

## Task completeness

7/7 tasks checked at the archive commit. The final two (1.6, 1.7) are discharged with
recorded evidence, not merely checked:

- 1.6 — PR #170 pushed and opened; owner merged with an identity-preserving merge commit
  `3003e73663da` (two parents: prior mainline `ccc4b149` + branch tip `3aedfec`).
- 1.7 — ADR-SDK-011 verified present at main (blob
  `576bf1907453ed4be6508b5181a655f9ddfbc69f`); issue #67 closed at
  2026-08-17T03:15:34Z with the evidence comment (owner-confirmed).

## Signed record authorizations

N/A by design: this change has no signed governance record (doc-only, as stated under
Identities). The archive-evidence contract's T/S-binding items are thereby explicitly
addressed as not applicable rather than silently omitted: there is no S to bind, no
granted/withheld list to re-state, and no record to dangle or stale. The three existing
signed records' withheld authorizations remain the standing production/publication
boundary and are unaffected by this archive.

## Canonical capability presence

- `.openspec.yaml` declares `skip_specs: true`; the change carries no `specs/` delta and
  `material_capability_modification: false`: nothing folds into
  `openspec/specs/security-audit-sdk-core/spec.md`.
- That spec's blob on main is `a0d845a0a246c330914048e6364c8ad82911b0aa`, unchanged by
  this change (the merged commits touched only the change dir, the ADR, and
  `check-coherence.mjs`).
- The archived `assessment.json` retains `capabilities: ["security-audit-sdk-core"]` —
  required by the association gate's capability filter for relocated changes — and its
  relocated ownership is the archive-dir prefix only (no `openspec/specs/` coverage).

## Production / publication restrictions

Unchanged and still enforced by executable gates (all green at the archive commit):
`test:scope` (no production integration surface), `test:publication-path` (no publishable
manifest, script, automation, `.npmrc`, or publishConfig), and the withheld authorization
lists of the existing signed records. No publication or deployment authorization exists
anywhere in this cycle.

## Immutable archive contents, exact changed paths, byte identity

The relocation is a pure `git mv`; before this commit's reconciliation edits were applied,
all 4 files at the active path under M were hash-compared against the moved copies:
identical.

| File | Blob (active path at M = moved copy) |
| --- | --- |
| `.openspec.yaml` | `72e4e47ee368d4142059699b556be525dcc63470` |
| `assessment.json` | `81380372ccd7b71f6ff34c31b171e53bf80b8120` |
| `proposal.md` | `30d42550dc73608329668a31b65c13c8580e2435` |
| `tasks.md` | `5e412eaf206bc6fc1f2403aea645e81393ffdc80` (pre-reconciliation) |

`proposal.md` and `assessment.json` remain byte-identical to their active-path content at
M — the dangling check's relocation recognition compares exactly these objects. This
commit then applies exactly two final-reconciliation changes inside the moved directory,
and nothing else:

1. `tasks.md` — 1.6 and 1.7 marked complete with the PR/merge and ADR/closure evidence
   (7/7).
2. `archive-evidence.md` — this document (new).

Changed paths are exactly the active-directory removal and the dated-archive addition; no
path outside `openspec/changes/archive/2026-08-17-record-validator-packaging-policy/` is
touched.

## Active enforcement verified

- Governance checker final phase on the pre-commit working tree fails closed with
  `openspec-association-unrelated` on the five archive paths — the correct uncommitted-state
  shape: relocation recognition resolves the archived artifacts against committed HEAD, and
  the archive is not yet committed at that point. At the committed archive HEAD — verified in
  a disposable-clone diagnostic commit `5bff690`, never committed on the archive branch, and
  re-verified with the final evidence bytes — the
  final phase passes: `design-pattern governance passed in final phase: enforcement active;
  inspected 1 commit(s) and 9 path(s) from origin/main`.
- `openspec validate --all --strict`: 5/5 pass.
- `openspec validate --all --archived --strict`: 10/10 pass, including this change in archived
  mode (task completeness across every archive).
- Full SDK validation chain: all 19 gates green with an empty index — 112 runtime tests and
  194/194 verification tests; `test:governance-history` (3 records; governed, bound, and merge
  commits resolve; 12 reviewed content objects bound), `test:archive-attestations` (2 declared,
  2 anchored, 13 archived files verified), `test:scope`, `test:publication-path`,
  `test:dependencies` (0 runtime), `test:package`, `test:coherence` (91/91 tasks),
  `test:changed-paths`, and `test:git` (index empty).
- Contract validation: 14/14.
- Governance dual check at the committed archive HEAD: candidate and baseline agree — both
  pass with checker blob `13cd54e26afa`.
- `git diff --check`: clean, no whitespace errors.
- Required CI at the exact archive PR head: required-status contexts must be green before
  merge, including the required `design-pattern-governance` check; the live PR check state
  and the owner's merge decision are the external record of this step. CI results are
  declared here as a pre-merge requirement — no CI outcome is claimed before it has run.

## Final lifecycle states (task 1.7)

Reported independently; evidence for one is not evidence for another.

| State | Status |
| --- | --- |
| Proposal | P = `bf96500cf2274a8d8d068da84156ae0d9532b9ef` |
| Assessment | A = `ba2d5869b65e6f4cc63f9c05d7738bff589efed7` (abbreviated, direct_implementation) |
| Technical verification | complete at T = `401f3ad812a000126c0458cf520c00ba4259c2d7` |
| Signed governance review | N/A — doc-only change, no record by design |
| Merge | M = `3003e73663daf0c8392063488b4b59826e9daf9c`, identity-preserving (PR #170) |
| Canonical capability | untouched — `skip_specs: true`, no delta, spec blob `a0d845a0…` unchanged |
| Archive | this commit — hash reported after storage, not self-bound |
| Issue #67 | closed 2026-08-17T03:15:34Z (owner, evidence comment); remaining criteria complete with this archive |
| Production / publication | withheld, unchanged, gate-enforced |
