## 1. Proposal, assessment, and RED baseline

- [x] 1.1 Create the design-pattern assessment (source + generated) for the exact owned-path allowlist; verify all 15 security dimensions are justified.
- [x] 1.2 Enumerate the exact current surface (61 value exports via the built module, 92 type-only exports via `src/index.ts`) as the frozen baseline; run `node scripts/check-exports.mjs` against the unmodified script and confirm it does not yet catch a mutation outside its original 3-symbol allowlist (RED).

## 2. Freeze the surface

- [x] 2.1 Extend `scripts/check-exports.mjs` with the two frozen literal arrays (value exports, type-only exports) and a Node-prefix denylist check, replacing the 3-symbol smoke check.
- [x] 2.2 Prove the gate can fail: mutate `src/index.ts` to add an unapproved export, confirm `check-exports.mjs` fails closed naming it; separately mutate to remove an existing export, confirm it fails closed naming the missing one; restore and confirm it passes (null control).
- [x] 2.3 Add `packages/security-audit-sdk-core/adr/012-frozen-public-api-surface.md` recording the decision, the exact evidence commit, and the boundary (does not freeze sdk-node).
- [x] 2.4 (Discovered during 3.1) `test:coherence` pinned the ADR count/sequence at exactly ADR-SDK-001–011; updated `scripts/check-coherence.mjs`'s `adr-count`/`adr-sequence` rules to 001–012 in the same change.

## 3. GREEN verification and governance

- [x] 3.1 Run `npm run validate --prefix packages/security-audit-sdk-core` fully green (this is the ~291s full gate chain, dominated by `test:verification`) — 282/282 tests pass.
- [x] 3.2 Run `npx --yes @fission-ai/openspec@latest validate --all --strict`, the assessment/implementation design-pattern-governance phases (with explicit `--base origin/main`), and `git diff --check`; resolve any failure before staging.
- [x] 3.3 Stage only `scripts/check-exports.mjs`, `scripts/check-coherence.mjs`, the new ADR, and this change's declared OpenSpec artifacts; commit with Conventional Commits (`feat(sdk-core): ...`, referencing #110).

## 4. Delivery, fold, archive, and closure

- [x] 4.1 Open the proposal PR (planning artifacts only); merge only when every required branch-protection context is green on the exact head. — PR #400, merged `b5dde92`.
- [x] 4.2 Open the implementation PR (section 2 + 3 changes); merge only when every required branch-protection context is green on the exact head. — PR #401, merged `8a91854` (required one amend: `sonar` failed on 4 bare `.sort()` calls added by this change; fixed by removing them, since the comparison is Set-based and never needed sorted input).
- [x] 4.3 Fold the `security-audit-sdk-core` delta into its canonical spec in a dedicated fold PR, proving the requirement block matches byte-for-byte and a second application is a no-op; merge only after its exact-head CI is green.
- [ ] 4.4 Archive the completed change with byte-preserving relocation and `archive-evidence.md`; verify strict OpenSpec validation and the repository's governance-gate chain (checked against the *committed* archive commit, not a staged-only move), then merge as a merge commit.
- [ ] 4.5 Close #110 with the mutation-test evidence, and note in #111's tracking (a separate issue) that this precedent exists but does not freeze its surface.
