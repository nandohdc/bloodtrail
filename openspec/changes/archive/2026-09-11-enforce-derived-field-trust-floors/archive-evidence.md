# Archive evidence: enforce-derived-field-trust-floors

## Completion record

The proposal landed through PR #476 (head `dc937576a62997ec9a7c1b11ccd3bdb24a9830e5`), merged as the two-parent merge commit `57814810a902538003e2df46e3e30bc02b73633b`. All ten required contexts were green on that exact head before the administrative merge.

The implementation landed through PR #479 (head `6393cbfbe6d57afccef2866e224baa21f32dbca8`), merged as the two-parent merge commit `e143b26f88ee36294f76345d7f767f8407ebb3dd`. All ten required contexts were green on that exact head before the administrative merge.

The canonical-spec fold landed through PR #484 (head `8e6e7f4affeddfe15a0d0dee6d11c245d22ac11c`), merged as the two-parent merge commit `8be9d5ed70c1d410ec62a4b0d177cb447f4ffd1b`. Every delta requirement block occurred verbatim exactly once in its canonical specification, the governed candidate was rebound to the fold commit, and the CRA pin was advanced to `security-audit@2.0.0` with all 73 tests passing.

#96 closes after this archive merges, and its Wave 4 entry in #132 is ticked then, per task 5.2.

## Provenance

The owner's 2026-09-10 instruction authorized implementing #96. Every enforcement choice, rule boundary, and version transition carries `decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner decision"`. No human reviewed any PR in this lifecycle, and nothing here authorizes production, publication, or deployment.

## Relocation integrity

Every active-change artifact is relocated byte-for-byte except `tasks.md`, which is reconciled only by checking delivery tasks 5.1 and 5.2. This evidence file is new.

| Relocated artifact | Pre-archive blob |
| --- | --- |
| `.openspec.yaml` | `e8cda9e50ea0cab62490e3e8f3e824b831aca6f0` |
| `assessment.json` | `5e1296cdf37db41ae0589a857b8943b32a619ee1` |
| `assessment.source.json` | `2f0f15da22a339e186b3246462bb118045a832c3` |
| `contract-reuse.json` | `a533d7343bdeb1b8d95d5f1e2721f418cf25f742` |
| `design.md` | `55d9f5084096fd54cc417ba2d213d03101a90f97` |
| `proposal.md` | `a370d4afe2488478805715f19718b2d7d1103487` |
| `specs/derived-field-trust-semantics/spec.md` | `dac1d6db2a60e67282ad0bdd6a3fb2b2355d7124` |
| `specs/security-audit-event-contract/spec.md` | `d18c5f373102bc3c4bc01456788a280e9ff860e0` |
| `specs/security-audit-sdk-core/spec.md` | `79fd860cdef5d07ba3420a3fc22da91eacd42ade` |
| `specs/security-audit-sdk-node/spec.md` | `5495158523dcf9955fd02085688ce8af9f485f50` |
| `tasks.md` | `a3914c0aa91baf52d4db6a245e1c11734dfb7b15` (before reconciliation) |

Canonical specifications are already folded on `main`; this archive writes no canonical specification.
