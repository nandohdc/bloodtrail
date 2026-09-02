# Tasks

## 1. Implementation

- [x] 1.1 Add `contract.toolchainExemptions` to `verification-lifecycle.json`, listing
      exactly `contracts/security-audit/package-lock.json`.
- [x] 1.2 Honour the exemption at the protected-prefix rule in
      `check-changed-paths.mjs`, leaving the path classified rather than hidden.
- [x] 1.3 Validate every exemption entry: exact file path, inside a protected prefix,
      and absent from every path `contract-provenance.json` declares.

## 2. Remediation

- [x] 2.1 Move `fast-uri` to 3.1.7 in both workspace lockfiles with
      `npm audit fix --package-lock-only`, leaving both manifests untouched.

## 3. Verification

- [x] 3.1 A modified `contracts/security-audit/package-lock.json` passes
      `test:changed-paths` and is still reported under the event-contract
      classification.
- [x] 3.2 An exemption naming a path `contract-provenance.json` declares is rejected,
      including a path beneath a declared directory.
- [x] 3.3 An exemption that is a directory, a glob, a traversal or an absolute path is
      rejected.
- [x] 3.4 An exemption outside every protected prefix is rejected.
- [x] 3.5 A modified contract path that is *not* exempted still fails, so the rule is
      known to bite.

## 4. Gates

- [x] 4.1 `npm run check:generated` then `npm run validate` pass in
      `packages/security-audit-sdk-core`.
- [x] 4.2 `npm audit --audit-level=low` passes in `packages/security-audit-sdk-core`.
- [x] 4.3 `npm run validate` and `npm audit --audit-level=high` pass in
      `contracts/security-audit`.
- [x] 4.4 The design-pattern-governance checker and both governance test suites pass.

## 5. Canonical capability fold

- [x] 5.1 Fold the delta's added requirement into
      `openspec/specs/security-audit-sdk-core/spec.md` while the change remains active,
      so the archive relocation carries no canonical write of its own — done in this
      commit: the requirement heading and all five scenario headings each occur exactly
      once in the canonical capability, the canonical file carries no
      `## ADDED Requirements` or other delta operation header, and the active change
      directory remains in place for the later archive relocation.
- [x] 5.2 Declare `openspec/specs/security-audit-sdk-core/spec.md` in `owned_paths` so the
      canonical write is associated with the change that produces it — done in this
      commit: the proposal declared every delta and implementation path but omitted the
      canonical capability the delta folds into, which left the fold unassociated.
