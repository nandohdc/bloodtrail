## 1. Proposal, assessment, and RED baseline

- [ ] 1.1 Create the design-pattern assessment (source + generated) for the exact owned-path allowlist; verify all 15 security dimensions are justified.
- [ ] 1.2 Enumerate the exact current surface (13 value exports via the built module, 24 type-only exports via `src/index.ts`, parsed from mixed inline-`type` export blocks) as the frozen baseline; confirm zero name collision with sdk-core's own frozen surface (already frozen in the archived `freeze-sdk-core-api-surface` change).

## 2. Freeze the surface

- [ ] 2.1 Write `scripts/check-exports.mjs` (new file) with the two frozen literal arrays (value exports, type-only exports) and a core-collision check, following #110's proven pattern.
- [ ] 2.2 Add `test:exports` to `package.json`, wired into `validate`.
- [ ] 2.3 Prove the gate can fail: mutate `src/index.ts` to add an unapproved export, confirm `check-exports.mjs` fails closed naming it; separately mutate to remove an existing export, confirm it fails closed naming the missing one; restore and confirm it passes (null control).
- [ ] 2.4 Add `packages/security-audit-sdk-node/adr/001-frozen-public-api-surface.md` (new file, new `adr/` directory) recording the decision, the exact evidence commit, and the boundary (does not freeze browser/React Native adapters).
- [ ] 2.5 Update `compatibility.json`: `apiFrozen` → `true`, `apiStability` → `"frozen"`, `package.status` → `"frozen-not-published"`, add `freezeRecord` naming the issue, ADR, evidence commit/path, and frozen export counts.

## 3. GREEN verification and governance

- [ ] 3.1 Run `npm run validate --prefix packages/security-audit-sdk-node` fully green.
- [ ] 3.2 Run `npx --yes @fission-ai/openspec@latest validate --all --strict`, the assessment/implementation design-pattern-governance phases (with explicit `--base origin/main`), and `git diff --check`; resolve any failure before staging.
- [ ] 3.3 Stage only `scripts/check-exports.mjs`, `package.json`, the new `adr/` file, `compatibility.json`, and this change's declared OpenSpec artifacts; commit with Conventional Commits (`feat(sdk-node): ...`, referencing #111).

## 4. Delivery, fold, archive, and closure

- [ ] 4.1 Open the proposal PR (planning artifacts only); merge only when every required branch-protection context is green on the exact head.
- [ ] 4.2 Open the implementation PR (section 2 + 3 changes); merge only when every required branch-protection context is green on the exact head.
- [ ] 4.3 Fold the `security-audit-sdk-node` delta into its canonical spec in a dedicated fold PR — this is an ADDED requirement, so no existing requirement is touched; prove the requirement block matches byte-for-byte and a second application is a no-op; merge only after its exact-head CI is green.
- [ ] 4.4 Archive the completed change with byte-preserving relocation and `archive-evidence.md`; verify strict OpenSpec validation and the repository's governance-gate chain (checked against the *committed* archive commit, not a staged-only move), then merge as a merge commit.
- [ ] 4.5 Close #111 with the mutation-test and no-collision evidence.
