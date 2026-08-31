## 1. Correct the two documents

- [x] 1.1 Rewrite the `CLAUDE.md` CI paragraph to name all nine required contexts and state the count; verify the backquoted names in that sentence equal `required_status_checks.contexts` from `gh api repos/nandohdc/bloodtrail/branches/main/protection` as a set, with nothing missing and nothing extra.
- [x] 1.2 Add the `design-pattern-governance` row to the `README.md` CI table; verify the set of checks its table marks `yes` equals the same branch-protection set exactly.
- [x] 1.3 Verify no other repository document states a required-check list that the correction leaves stale, and that `CONTRIBUTING.md`'s existing description of `design-pattern-governance` as required is now consistent with both.

## 2. Verification

- [x] 2.1 Run `node openspec/scripts/check-design-pattern-governance.mjs --phase final` and verify it passes, with this change's `owned_paths` covering `CLAUDE.md` — the `governance_core` class is selected by `governedPatterns` alongside `governed_implementation`, so the edit requires association.
- [x] 2.2 Run `node openspec/scripts/run-governance-dual-check.mjs --base <main>` and record the trusted-baseline and candidate results separately; verify both pass and neither substitutes for the other.
- [x] 2.3 Run `openspec validate correct-required-check-list --strict`, `openspec validate --all --strict`, `npm run test:changed-paths --prefix packages/security-audit-sdk-core`, and `npm run test:git --prefix packages/security-audit-sdk-core`; verify all pass and the index is empty.

## 3. Delivery

- [x] 3.1 Commit the proposal artifacts and the document correction as two separate allowlisted commits, proposal first; verify the assessment precedes the earliest governed implementation commit.
- [x] 3.2 Open the pull request, verify every context required by branch protection reports and passes, and confirm no required check is missing rather than merely not failing; leave this task unchecked while the change is active.
