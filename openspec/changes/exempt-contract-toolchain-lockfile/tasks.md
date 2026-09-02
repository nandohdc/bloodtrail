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
