# Archive Evidence — establish-design-pattern-governance

Discharges task 10.8 (R24): explicit archive-evidence validation. It does not rely on
`openspec validate --all --strict` alone; every item below is a separate check run or a
direct Git-object comparison, with its result recorded at the archive commit.

## Identities

| Binding | Value |
| --- | --- |
| Final technical commit T'''' | `e5b5814351f108053178a2515cc0c9be3484b2b0` |
| Signed governance record commit S'''' | `7e247487071e6d2d3264d892557979e373c4447e` |
| S'''' relation to T'''' | direct child; changes only `packages/security-audit-sdk-core/verification-lifecycle.json` |
| Merge commit M''' | `ea5cbc32288e74caaf7801d654ba1726139f0328` |
| M''' parents | `0b28c91b829e615e2588c58029e6e2eeea6160e6` (prior protected mainline), `7e247487071e6d2d3264d892557979e373c4447e` (exact S'''') — identity-preserving two-parent merge |
| T'''' reachable from M''' | yes (`git merge-base --is-ancestor`) |
| One-time activation A | `ee6fb3c` — unchanged historical boundary (R18); not rebuilt |

## Task completeness

98/98 tasks checked at the archive commit. The final three (10.8, 10.9, 10.10) are
discharged by this archive commit itself: this document is the 10.8 validation, this commit
is the separate governed archive commit (10.9), and the final-state report below is 10.10.

## Signed record authorizations (verified from S'''')

- **granted:** `store-governance-record-s-for-exact-technical-commit`,
  `governed-archive-movement-after-identity-preserving-merge`
- **withheld:** `identity-preserving-merge-of-pr-167` (the owner merged manually — the
  separate authorization the record required), `activation-record-rebuild`,
  `package-publication`, `production-deployment`, `production-collection`,
  `real-user-processing`, `framework-integration`, `delivery-infrastructure`

This archive movement is within the granted scope: it follows the identity-preserving merge
of exact T'''' and S'''' onto the protected mainline.

## Canonical capability materialization

- `openspec/specs/software-design-pattern-governance/spec.md` is present on the protected
  mainline, introduced by T' `d0b760b77e9f61cdc84bda60cd202dbcc38ca12a` and bound by the
  signed records since.
- Content: 24 requirements, 129 scenarios, byte-identical to the reviewed delta's
  requirement blocks (the delta's `## ADDED Requirements` operation header became the main
  spec's `## Requirements`).
- Blob on main: `0777db4d9fa093e88e4d06e43062607c3ed56894`, equal at M''' and at T' —
  unchanged since materialization. The reviewed content object bound by the signed records
  is the directory tree `dc63e732460692ce8f8af2a893feee6d2e9f598d`.

## Production / publication restrictions

Unchanged and still enforced by executable gates (all green on the archive commit):
`test:scope` (no production integration surface), `test:publication-path` (no publishable
manifest, script, automation, `.npmrc`, or publishConfig), and the withheld authorization
list above. No publication or deployment authorization exists anywhere in this cycle.

## Immutable archive contents, exact changed paths, byte identity

The relocation is a pure `git mv`; before this commit's reconciliation edits were applied,
9 of the 10 files at the active path under M''' were hash-compared against the moved copies:
identical (`.openspec.yaml`, `apply-authorization.md`, `architectural-review-remediation.md`,
`assessment.json`, `design.md`, `evidence-packet.md`, `hermes-allowed-tools-finding.md`,
`proposal.md`, `specs/software-design-pattern-governance/spec.md`). `tasks.md` differs by
exactly the 10.8–10.10 checkbox transition, nothing else.

This commit then applies exactly three final-reconciliation changes inside the moved
directory, and nothing else:

1. `tasks.md` — 10.8, 10.9, 10.10 marked complete (98/98).
2. `archive-evidence.md` — this document (new).
3. No other file is modified; no path outside
   `openspec/changes/archive/2026-08-16-establish-design-pattern-governance/` is touched.

Changed paths are exactly the active-directory removal and the dated-archive addition.

## Active enforcement verified

- Governance checker final phase on the pre-commit working tree fails closed with
  `signed-record-ambiguous` — the correct R15 behavior: relocation recognition resolves the
  archived artifact against committed HEAD, and the archive is not yet committed.
- Governance checker final phase at the archive commit passes with enforcement active. The
  archive directory is recognised through the byte-identical relocation of
  `proposal.md`/`assessment.json` — the association perimeter repair this change landed
  (`archive-relocation.mjs`, shared with review freshness) — so the relocation is owned
  work and the signed record does not dangle.
- `openspec validate --all --archived --strict` on the archive commit: 9/9 archived
  changes valid, including this one (task completeness across every archive).
- `openspec validate --all --strict` on the archive commit: 5/5 pass.
- Full SDK validation chain: green (112 runtime tests, 194 verification tests, all 19
  gates, including `test:governance-history` which verifies S'''' bindings, and the
  fixture-lifecycle-independent mutation suite landed by T'''').
- Complete governance suite: 196/196.
- Contract validation: 14/14.
- Required CI at the exact archive PR head: required-status contexts must be green before
  merge, including the required `design-pattern-governance` check; the live PR check state
  and the owner's merge decision are the external record of this step.

## Final lifecycle states (task 10.10)

Reported independently; evidence for one is not evidence for another.

| State | Status |
| --- | --- |
| Apply authorization | granted — groups 1–8 (historical record) |
| Technical verification | complete at T'''' |
| Signed governance review and decision | signed by the project owner at S'''', 2026-08-16 |
| Merge | M''' = `ea5cbc32288e74caaf7801d654ba1726139f0328`, identity-preserving |
| Activation | historical, one-time at A = `ee6fb3c`; enforcement active |
| Canonical capability | materialized at T', bound by S'''' |
| Archive | this commit — hash reported after storage, not self-bound |
| Production / publication | withheld, unchanged, gate-enforced |
