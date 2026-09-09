# Archive evidence: fix-collector-dedup-retry-conflict

## Completion record

The proposal (planning artifacts only) landed through PR #392 (`5bf5367842fbaf0287b941b2f808a1ef8fbc38fc`), merged as the two-parent merge commit `8da049011b541262ca3dcb3edfc7ab17a41cc752`.

The implementation landed through PR #394 (`f36a5da5845cad31a0596b2ff95ad9836560c800`), merged as the two-parent merge commit `ee595a8d541b5b143caaafe23a8bd4e7a66c79b1`. `CollectorIngress` now derives a canonical deduplication key (excluding `correlation.retry_attempt`) instead of comparing the raw byte-exact body; `DeduplicationLedger` is unchanged. Regression test D9 and its null control (existing D2) both pass; the full package `validate` suite is 45/45 green.

The canonical-spec fold landed through PR #395 (`02b349ff1b7b699e5993e68a08e6d925a9bbea64`), merged as the two-parent merge commit `4855cffd43709e0265d485d24fd35ee41dc8b1f8`. The fold proved the three modified requirement blocks (`Ingress order is fixed and every stage fails closed`, `Collector-local duplicate identity and retention are bounded`, `Duplicate and conflicting reuse have distinct deterministic outcomes`) were byte-identical to the delta after merging, and that reapplication is a no-op.

Every required check (`ci / lint`, `ci / test`, `ci / audit`, `sonar`, `sdk`, `contract`, `conventional-commits`, `codescene delta`, `design-pattern-governance`, `coverage`) was green on the exact head of each PR before its authorized administrative merge; branch protection's full required-context list was checked directly against each PR's reported checks, not inferred from `gh pr checks --required` alone.

Issue #391 is closed with the regression-test and null-control evidence after this archive merges, per task 4.5, which also notes in #109's tracking that this blocker is resolved.

## Governance and validation

Each of the three PR heads passed the assessment or implementation design-pattern-governance phase for this change (`node openspec/scripts/check-design-pattern-governance.mjs --phase assessment|implementation --change fix-collector-dedup-retry-conflict`). The change's `ordering.proposal_baseline_commit` in `assessment.source.json` is `128680cfe5c533e19e502c372240b3db8c8b0048` (the `main` tip at proposal time) and remained stable across every merge in this lifecycle; the generated `assessment.json` is byte-identical to regeneration at the relocation point.

`security_sensitive` is declared `true` with all 15 dimensions justified in `assessment.source.json`, since the fix touches the collector's duplicate-vs-conflict security boundary. No fingerprint or hash was introduced — the fix narrows the excluded-field set to exactly `correlation.retry_attempt`, the only field the delivery-conformance-contract names as attempt-scoped, preserving #108's prior rejection of a fingerprint approach for its collision risk. No check requested a signed owner decision bound to an exact commit; none was invented.

This work does not cross the repository's authorization boundary: the collector is already-authorized, already-merged Wave 4 work (#107/#108). It corrects the implementation to match the delivery-conformance-contract's own already-ratified dedup intent and adds no new transport, storage, or production capability. The staged archive candidate passes `npx --yes @fission-ai/openspec@latest validate --all --strict` and `git diff --check`.

## Relocation integrity

The following active-change artifacts are relocated byte-for-byte. `tasks.md` is reconciled only by checking the remaining task (4.4); this evidence file is newly added for the archive.

| Relocated artifact | Pre-archive blob |
| --- | --- |
| `.openspec.yaml` | `7a8e2be6f1ac81fa8cffa1a2dc35a75fc0642617` |
| `assessment.json` | `deacbc97463484e177fc3d2e09af05fc828469e6` |
| `assessment.source.json` | `9d04ed3230a290ed2e7233eb5c60bd4432622309` |
| `design.md` | `b4e570b97653e8be145ed4ab17a7eec5fcef2521` |
| `proposal.md` | `006dead62c13ae7c968a8b0d65645c992503493c` |
| `specs/security-audit-collector/spec.md` | `7c956208213cd93baf2f1424cacb726109cb876d` |

The staged archive commit verifies those identities and reports the unchanged artifacts as 100% similar renames. The canonical specification is already folded on `main`; this archive changes no canonical specification.
