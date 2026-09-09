# Archive evidence: freeze-sdk-core-api-surface

## Completion record

The proposal (planning artifacts only) landed through PR #400 (`590de5e94fbc64e75985c6b8229fdfc2942d082f`), merged as the two-parent merge commit `b5dde92d4169440c9d00166b1090afe00ac7d106`.

The implementation landed through PR #401 (`b665c73ef5d497b3d81b3c414dc9fe71f0427347`), merged as the two-parent merge commit `8a91854f4e7b19a17a77c95e2effc645368366c7`. `check-exports.mjs` extended from a 3-symbol smoke check to freeze the package's complete public surface (61 value exports, 92 type-only exports), mutation-tested against both an added unapproved export and a removed export. This PR required one amendment: `sonar` failed on 4 bare `.sort()` calls the new code introduced; fixed by removing them, since `diffExportSets` compares via `Set`/`filter` and never needed sorted input.

The fold landed through PR #402 (`3ecd5d45780db63d0a1c3086e75b9c5b594b043c`), merged as the two-parent merge commit `0f6039985e99da18b3293220d6cfac6ce34eb9b1`. This PR required one correction after its first push: the original design modified the package's *founding* (2026-07-31) requirement "SDK package has an explicit supported runtime and public surface" in place, which trips `check-coherence.mjs`'s `original-capability-requirement-modified` rule — that rule requires every originally-ratified requirement to stay byte-identical to the archived 2026-07-31 delta forever, with no "amend in place" path. Fixed by reverting that requirement to its exact original text and adding the freeze language as a new, separate requirement, "The public export surface is frozen after vertical-slice evidence," instead.

Every required check (`ci / lint`, `ci / test`, `ci / audit`, `sonar`, `sdk`, `contract`, `conventional-commits`, `codescene delta`, `design-pattern-governance`, `coverage`) was green on the exact head of each PR before its authorized administrative merge.

Issue #110 is closed with the mutation-test evidence after this archive merges, per task 4.5, noting in #111's tracking that this precedent exists (the same pattern, without the founding-requirement pitfall) but does not itself freeze `security-audit-sdk-node`'s surface.

## Governance and validation

All three PR heads passed the assessment or implementation design-pattern-governance phase for this change (`node openspec/scripts/check-design-pattern-governance.mjs --phase assessment|implementation --change freeze-sdk-core-api-surface --base origin/main` — the explicit `--base` matters here; omitting it let the auto-detected base pick up unrelated already-archived history once during this change's work). The change's `ordering.proposal_baseline_commit` in `assessment.source.json` is `cbbd044c4533fc0483d6e8bbdb4f7eb62a0575bc` (the `main` tip at proposal time) and remained stable across every merge in this lifecycle.

`security_sensitive` is declared `true` with all 15 dimensions justified in `assessment.source.json`, since this change touches a canonical capability requirement and the package's public-surface guarantees. No check requested a signed owner decision bound to an exact commit; none was invented.

This work does not cross the repository's authorization boundary and authorizes no production deployment: it freezes what already exists and ships today (61 value exports, 92 type-only exports), adding no new export and removing none. The staged archive candidate passes `npx --yes @fission-ai/openspec@latest validate --all --strict` and `git diff --check`.

## Relocation integrity

The following active-change artifacts are relocated byte-for-byte. `tasks.md` is reconciled only by checking the remaining tasks (4.4, 4.5); this evidence file is newly added for the archive.

| Relocated artifact | Pre-archive blob |
| --- | --- |
| `.openspec.yaml` | `7a8e2be6f1ac81fa8cffa1a2dc35a75fc0642617` |
| `assessment.json` | `7856dc7be54e709b84c90df5a90c7bba020955ee` |
| `assessment.source.json` | `3fff9d013cdd8dcf39175896c823b01cec54d135` |
| `design.md` | `a8a583c4ed6651832bdd03e0cbbabf71094c3383` |
| `proposal.md` | `c5e5acf4f8a7b75f0f825883f4e372139a091fc9` |
| `specs/security-audit-sdk-core/spec.md` | `b515d711cfad854dbdc506763b61ca56ffeec310` |

The staged archive commit verifies those identities and reports the unchanged artifacts as 100% similar renames. The canonical specification is already folded on `main`; this archive changes no canonical specification.
