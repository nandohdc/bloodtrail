# Archive evidence: implement-collector-idempotency-and-deduplication

## Completion record

The implementation landed through PR #368 (`5771f66b4001d89451e4d9c3a5d6ab68919d6351`), merged as the two-parent merge commit `b06a7e9584e608a36137d158d60db55431ff254e`. Its required checks were all successful on that exact head before the authorized administrative merge.

The canonical-spec fold landed through PR #370 (`5180305a60f38ba6526d18c0c4d0e4ac748a97dd`), merged as the two-parent merge commit `4be6b2070a3df484b00ed671fbae3e84377fa7e9`. The fold proved that the collector requirement blocks were byte-identical after replacing the delta heading with the canonical `Requirements` heading, and that reapplication was a no-op. The fold completion was recorded through PR #371 (`6180947cfd2c23f17e3bab3108669519cccc7237`), merged as the two-parent merge commit `4a24ada926bd92dc270e8d6bacadee4c8d450a4c`.

Issue #108 is closed with an owner closure comment naming PR #368 and the merged canonical specification. Its Wave 4 checklist entry in #132 is checked after this archive merges, per task 4.4.

## Governance and validation

The implementation, fold, and record heads each passed the final design-pattern-governance phase and the candidate/baseline dual check. The change's `ordering.proposal_baseline_commit` is authored in `assessment.source.json` and remained stable across every merge in this lifecycle, per the machinery ratified in #372; the generated `assessment.json` is byte-identical to regeneration at the relocation point. The archive relocation is intentionally verified only after its commit exists: R15 resolves its relocation artifacts from committed `HEAD`, so the same final-phase command correctly rejects a staged-only move as uncovered rather than treating uncommitted archive files as governed. The archive commit's final-phase and dual-check results are therefore recorded by its PR check state before merge. No check requested a signed owner decision bound to an exact commit; none was invented. The staged archive candidate passed `npx --yes @fission-ai/openspec@latest validate --all --strict` and `git diff --check`.

The PR bodies for #368, #370, and #371 state that AI verification is evidence rather than approval and that this work conveys no production authority. The implementation stays a synthetic, non-production library: the ledger is instance-local and in-memory only, bounded at 32 records for 300 seconds with lazy expiry, and creates no listener, deployment, credential, storage, queue, delivery, durability, retention-policy, or exactly-once claim.

## Relocation integrity

The following active-change artifacts are relocated byte-for-byte. `tasks.md` is reconciled only by checking the two remaining delivery tasks (4.3, 4.4); this evidence file is newly added for the archive.

| Relocated artifact | Pre-archive blob |
| --- | --- |
| `.openspec.yaml` | `2e24cfa4fa110d84d9fd4e07124f8709f5e01eba` |
| `assessment.json` | `3b4dc81b2e99f824e4f9a7f168ea40ce83354f30` |
| `assessment.source.json` | `63e0c256bd74bef7e498b52252e27df5916b2cfb` |
| `design.md` | `19f5c5ad3f0ef942637ccd2ba9dabe26eccfc16a` |
| `proposal.md` | `1cc9dcaecb194876d8823986ecb1c0c549ea5ab8` |
| `specs/security-audit-collector/spec.md` | `b8d14c6f73ae48cb95a20eb581384a6d36801b52` |

The staged archive commit verifies those identities and reports the unchanged artifacts as 100% similar renames. Canonical specifications are already folded on `main`; this archive changes no canonical specification.
