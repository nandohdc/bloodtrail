## 1. Establish the governed implementation baseline

- [x] 1.1 Record the design-pattern assessment and run the trusted-baseline
  governance check before editing the lockfile; verify the security-sensitive,
  skip-specs change is associated and the assessment precedes implementation.

## 2. Refresh the vulnerable transitive dependency

- [x] 2.1 Update only the `node_modules/fast-uri` lockfile resolution from
  3.1.5 to 3.1.7 and verify the focused diff contains the expected version,
  registry URL, and integrity changes with no direct dependency edit.

## 3. Verify installation, SDK behavior, and governance

- [x] 3.1 Run `npm ci`, the complete SDK `validate` chain, and
  `npm audit --audit-level=low` in `packages/security-audit-sdk-core`; verify
  installation and validation pass and the audit reports zero vulnerabilities.
- [x] 3.2 Run strict OpenSpec validation, final design-pattern governance, and
  `git diff --check`; verify the security refresh, skip-specs classification,
  assessment ordering, and patch whitespace all pass.

## 4. Deliver the CI repair

- [ ] 4.1 Commit and push the focused repair to pull request #257, update its
  description to disclose the added security refresh, and verify the remote PR
  head matches the local commit and all required CI checks reach a passing
  terminal state.
