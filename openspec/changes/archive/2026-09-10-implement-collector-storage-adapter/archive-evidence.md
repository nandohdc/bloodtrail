# Archive evidence: implement-collector-storage-adapter

## Completion record

The proposal and implementation landed together through PR #475: proposal commit `9f712e0` followed by
implementation commit `77d1fd4f6e2a2d7889ce2a2f6db9045ff6065652`, merged as the two-parent merge commit
`d4bd9b6a63399cfdccbc7083474cb1dc8a76f067`. All ten required contexts were green on that exact head
before the administrative merge.

The canonical-spec fold landed through PR #477 (head `e60d388`), merged as the two-parent merge commit
`b2f44804b6ff7c477a3a68a3afe7fedd95f3833c`. Every delta requirement block occurred verbatim exactly
once in its canonical specification, no delta header survived, and `openspec validate --specs --strict`
passed.

#115 closes after this archive merges, and its Wave 4 entry in #132 is ticked then, per task 4.4.

## Provenance

The owner's 2026-09-10 instruction authorized implementing #115. The backend selection, the candidate
retention durations, and the scope derivation carry
`decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner decision"`. No human
reviewed any PR in this lifecycle, and nothing here authorizes production, real-user data, or a
retention policy for real evidence.

## What happened next

The #116 non-production pilot's first run measured a throughput ceiling this change introduced: with
storage configured, the in-memory deduplication ledger admitted 32 distinct identities per 300 seconds.
That finding is #478, and its fix is a separate governed change, `delegate-collector-deduplication-to-storage`.
This archive records the change as it landed; it does not claim the ceiling was absent.

## Relocation integrity

Every active-change artifact is relocated byte-for-byte except `tasks.md`, which is reconciled only by
checking delivery tasks 4.2, 4.3, and 4.4. This evidence file is new.

| Relocated artifact | Pre-archive blob |
| --- | --- |
| `.openspec.yaml` | `e8cda9e50ea0cab62490e3e8f3e824b831aca6f0` |
| `assessment.json` | `88eedd433cb0ea66e2519a166ac9104783e5e246` |
| `assessment.source.json` | `bf2c3de4c2f646fb7030c74f57d5a19fe6ecbd6a` |
| `design.md` | `aa2437bb6a4ca9a117ca4f71ec9628c83d9a6aec` |
| `proposal.md` | `6205221527cf4806feaa9ef35e580338b81cc9d3` |
| `specs/collector-storage-semantics/spec.md` | `d356ec32a256a978f20e53011a87606a3aba5a19` |
| `specs/security-audit-collector/spec.md` | `5a82996e5625f970b75ef31b70e85c53e46345e8` |
| `tasks.md` | `cb0336a065b83e4fddcc3778dde6d6a40136de07` (before reconciliation) |

Canonical specifications are already folded on `main`; this archive writes no canonical specification.
