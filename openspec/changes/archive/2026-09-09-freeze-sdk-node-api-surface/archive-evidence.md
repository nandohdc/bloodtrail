# Archive evidence: freeze-sdk-node-api-surface

## Completion record

The proposal (planning artifacts only) landed through PR #404 (`4c3ca209f5a2b534ed69dc1a0de74399205ef56f`), merged via squash as `da29fd048ea92626d7a34fb49a8a4f41e6e2cff5`.

The implementation landed through PR #405 (`056261095807024d7b2af02817fbb1c5602bd722`), merged via squash as `54f4eec1260fcb4a53c3aa009477e23b1dd5a4cf`. `scripts/check-exports.mjs` (new file — this package had no prior export-surface check) freezes the package's complete public surface (13 value exports, 24 type-only exports parsed from mixed inline-`type` export blocks), mutation-tested against both an added unapproved export (`unapprovedMutationProbe`) and a removed export (`nodeClock`), both failing closed and naming the export, with a restored-original null control passing. The copied `CORE_VALUE_EXPORTS`/`CORE_TYPE_EXPORTS` collision lists were verified byte-for-byte against sdk-core's own frozen arrays (61 value + 92 type-only, zero drift) before committing.

The fold landed through PR #406 (`6e956e2e3ea3528f306ea14859e76a26e6ff2bbf`), merged as the two-parent merge commit `7522c724a9caebc179dee59a2ef2ecf77b70913b`. This PR required one correction discovered during fold review, not caught at proposal time: the existing requirement "Package boundaries enforce standalone topology and zero third-party dependencies" hardcoded a scenario asserting the package's API surface is "explicitly marked provisional and unfrozen" — a claim this change makes false. Unlike sdk-core (#110), this package has no `check-coherence.mjs`-style founding-requirement immutability gate, so nothing would have caught the resulting contradiction mechanically; it would have shipped as two contradictory `SHALL` statements in the same spec. Fixed by adding a MODIFIED Requirements section to the delta: the requirement and its scenario no longer assert a fixed provisional/unfrozen state, but instead require the declared stability state to match whatever the new frozen-surface requirement's conditions actually are. The requirement's other two scenarios (dependency inspection, packed-install) were carried forward unchanged, per the sync rule that a MODIFIED block carries the whole requirement.

Every required check (`ci / lint`, `ci / test`, `ci / audit`, `sonar`, `sdk`, `contract`, `conventional-commits`, `codescene delta`, `design-pattern-governance`, `coverage`) was green on the exact head of each PR before its authorized administrative merge.

Issue #111 is closed with the mutation-test and no-collision evidence after this archive merges, per task 4.5.

## Governance and validation

All three PR heads passed the design-pattern-governance implementation phase for this change (`node openspec/scripts/check-design-pattern-governance.mjs --phase implementation --change freeze-sdk-node-api-surface --base origin/main` — the explicit `--base` matters, per the same lesson #110 established). The change's `ordering.proposal_baseline_commit` in `assessment.source.json` is `0f6039985e99da18b3293220d6cfac6ce34eb9b1` (the `main` tip at proposal time) and remained stable across every merge in this lifecycle.

`security_sensitive` is declared `false` in `assessment.source.json` with all 15 dimensions justified: this change freezes which symbols are exported, not what they do, introduces no new authority, transport, or cryptographic surface, and its failure mode (an unapproved export mutation) fails closed by construction.

This work does not cross the repository's authorization boundary and authorizes no production deployment or package publication: it freezes what already exists and ships today (13 value exports, 24 type-only exports), adding no new export and removing none. It does not freeze browser or React Native adapter APIs (deferred, tier 10, not authorized) and does not re-freeze sdk-core's own surface (#110, already done separately). The staged archive candidate passes `npx --yes @fission-ai/openspec@latest validate --all --strict` and `git diff --check`.

## Relocation integrity

The following active-change artifacts are relocated byte-for-byte. `tasks.md` is reconciled only by checking the remaining tasks (4.4, 4.5) and annotating 4.1–4.3 with their merged PR/commit references; this evidence file is newly added for the archive.

| Relocated artifact | Pre-archive blob |
| --- | --- |
| `.openspec.yaml` | `1ea7e36f49a4d8fd7e0a757a1df1a234cd8e6bdc` |
| `assessment.json` | `7f1bc4031330a6862c0ce7ed54691e096a247540` |
| `assessment.source.json` | `3b8647df8d3b5ec4a6a4fedcccce50760beb801c` |
| `design.md` | `a7123e2a72f4e6b15f59cfc7078978bd5d1b453e` |
| `proposal.md` | `d768d1a5343f208ac87c92dc0ed0ded57c40f06c` |
| `specs/security-audit-sdk-node/spec.md` | `0aec1ed39c147602b63ffa012795055e6db331ce` |

The staged archive commit verifies those identities and reports the unchanged artifacts as 100% similar renames. The canonical specification is already folded on `main`; this archive changes no canonical specification.
