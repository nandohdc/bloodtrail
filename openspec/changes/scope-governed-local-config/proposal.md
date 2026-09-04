## Why

`mutations.test.mjs` in `packages/security-audit-sdk-core` asserts in `test.after()` that `governedLocalConfig()` remains identical before and after the test suite. Because `governedLocalConfig()` currently compares the raw local git configuration across all keys, any concurrent write to `.git/config`—most commonly `git push -u` or branch deletion in sibling worktrees or checkouts—mutates `branch.<name>.*` keys and falsely fails the mutation suite. Scoping the assertion to exclude `branch.*` keys eliminates concurrency flakes while preserving strict detection of test-leaked configuration mutations such as `commit.gpgsign`.

## What Changes

- Scope `governedLocalConfig()` in `packages/security-audit-sdk-core/tests/verification/mutations.test.mjs` to parse null-delimited entries from `git config --local --null --list`, filter out any keys starting with `branch.`, and sort deterministically.
- Add workflow guidance to `CLAUDE.md` directing developers and agents not to run `git push -u` from the primary checkout while test suites are active.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None. This change refines test harness isolation and workflow documentation without altering canonical capability requirements (`skip_specs: true`).

## Impact

- `packages/security-audit-sdk-core/tests/verification/mutations.test.mjs`: `governedLocalConfig()` helper updated to filter `branch.*` keys.
- `CLAUDE.md`: Updated with upstream push guidance.
