# Archive evidence: delegate-collector-deduplication-to-storage

## Completion record

The proposal and fix landed together through PR #482: proposal commit `c0d9822` followed by the fix
`e866fa2c0807ff661986be79ccec7ffcd39aad66`, squash-merged as `93e4f490b733ab17d7375df2b4c67be9e0eda6e9`.
All ten required contexts were green on that exact head before the administrative merge.

The canonical-spec fold landed through PR #493 (head `d59c152`), merged as the two-parent merge commit
`d2436819cbc2155e7ca4e9779eecdbce17725def`. Four requirement blocks of
`openspec/specs/security-audit-collector/spec.md` were replaced whole, three scenarios were added and
none dropped, and `openspec validate --specs --strict` passed.

## What the fix was for, and what proved it

The #116 pilot's first run found the defect: with storage configured, the collector's in-memory
deduplication ledger admitted 32 identities per 300 seconds and the run stopped on its deadline.
After this change, pilot run 2 at `93e4f49` persisted and read back 616 distinct identities inside one
window with zero capacity rejections. The evidence is in
`openspec/changes/run-non-production-delivery-pilot/harness/evidence.md`, merged through PR #494.

## Closing the issue

#478 closed on #482's merge, because that PR's description used a closing keyword while fold and
archive were still owed. The lifecycle record is posted on #478 after this archive merges.

## Provenance

The design choice carries `decision_source = "delegated to Claude by the owner, 2026-09-10; not a
human owner decision"`. The fold and this archive were done under the owner's 2026-09-11 instruction.
No human reviewed any PR in this lifecycle, and nothing here authorizes production.

## Relocation integrity

Every active-change artifact is relocated byte-for-byte except `tasks.md`, which is reconciled only by
checking delivery task 4.2. This evidence file is new.

| Relocated artifact | Pre-archive blob |
| --- | --- |
| `.openspec.yaml` | `e8cda9e50ea0cab62490e3e8f3e824b831aca6f0` |
| `assessment.json` | `24c3d5c152a4b42c1d2373789b3dd3261e029fb5` |
| `assessment.source.json` | `80fcdd889b242e7285116f561a31f21443b0ebf0` |
| `design.md` | `81ff316057bfbf828898d2592bf0da017d5fb935` |
| `proposal.md` | `8a2fc375d7300f395f44a9b5d06fca44bbb42939` |
| `specs/security-audit-collector/spec.md` | `1e5175c6fae9d9c372850384ea7a6ef54de06944` |
| `tasks.md` | `268d5812908f8b03448c31c64d1a8cf9ea9fc702` (before reconciliation) |

Canonical specifications are already folded on `main`; this archive writes no canonical specification.
