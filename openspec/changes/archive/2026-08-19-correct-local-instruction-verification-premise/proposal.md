## Why

A verification control in `packages/security-audit-sdk-core/tests/verification/mutations.test.mjs`
asserts a stronger condition than its own name claims, and the difference blocks the repository
from ever tracking a shared agent-guidance file.

The test is named *"an ignored local CLAUDE.md is excluded by standard Git semantics"*. It appends
`CLAUDE.md` to `.git/info/exclude`, writes the file, runs the changed-path checker, and then
asserts:

```js
assert.doesNotMatch(result.stdout, /local-instruction-unrelated/);
```

That assertion says *no `local-instruction-unrelated` record may exist anywhere*, not *the ignored
copy contributed no record*. Because the test's `caseRepository()` helper clones the **live**
repository, a tracked root `CLAUDE.md` appears in every clone, the classifier emits the bucket, and
the assertion fails regardless of the ignored file the test just created.

The policy and the control disagree. `scripts/check-changed-paths.mjs:402` deliberately classifies
`CLAUDE.md` as `local-instruction-unrelated` — an allowed, non-violating bucket — and
`npm run test:changed-paths` **passes** with a tracked `CLAUDE.md`. Only the mutation test's premise
breaks.

This is not theoretical. PR #133's first CI run failed the required `sdk` check for exactly this
reason: commit `5addd56` tracked a root `CLAUDE.md`. Splitting that commit out made `sdk` pass on
the byte-identical packet commit. The repository currently cannot adopt tracked agent guidance
without failing a required check, and the failure names a bucket rather than the real cause, so the
diagnosis costs a full CI cycle.

## What Changes

- Correct the verification control so it asserts what its name claims: that a **git-ignored**
  `CLAUDE.md` contributes no `local-instruction-unrelated` record. Compare a baseline record count
  captured before the ignored file is created against the count after, rather than asserting the
  bucket is globally absent.
- Preserve a deterministic negative control proving the corrected assertion still fails if
  git-ignore semantics regress — that is, if the ignored copy *did* produce a record. A control
  that can no longer fail is not a control.
- Add a positive control proving a **tracked** local-instruction file is classified and reported,
  so the correction cannot be mistaken for suppressing the bucket entirely.

Explicitly **not** changed:

- `scripts/check-changed-paths.mjs` classification logic, including the `CLAUDE.md` rule and the
  `local-instruction-unrelated` bucket name. The policy is correct; only the control's premise is
  wrong.
- Any SDK source file, generated artifact, contract artifact, or public API.
- This change does **not** add `CLAUDE.md` to the repository. It removes the mechanical blocker so
  that adoption can be decided separately, on its own merits.

**Not breaking.** No consumer-visible behavior changes; the affected code is a repository
verification control.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-core`: adds a requirement stating that changed-path verification distinguishes
  git-ignored local instruction files from tracked ones, and that tracked local instruction files
  are reported as unrelated rather than failing verification. This changes the set of repository
  states that pass a governed gate, which is spec-level behavior rather than an implementation
  detail.

## Impact

**Affected code**

- `packages/security-audit-sdk-core/tests/verification/mutations.test.mjs` — the corrected control
  and its positive/negative counterparts.
- Possibly a small local helper to count occurrences of a classification bucket in checker output.
  No new dependency; the package remains at zero runtime dependencies.

**Affected verification**

- `npm run test:verification` and therefore `npm run validate` and the required `sdk` CI check.
  The corrected control must pass both with and without a tracked `CLAUDE.md` present.

**Unblocks**

- A separate, independently decided proposal to track `CLAUDE.md` and `AGENTS.md` as shared
  repository agent guidance. That decision is deliberately out of scope here.

**Relationship to the active remediation lifecycle**

`remediate-security-audit-sdk-adversarial-review` is still active at 84/91 tasks, with 12.4–12.10
open. Tasks 12.4 (independent technical review) and 12.5 (owner exact-commit decision) are
human-only and cannot be discharged by this or any other change.

This change touches `tests/verification/`, which is inside that remediation candidate's reviewed
surface. Applying it before 12.4 completes would modify bytes under review and invalidate the
reviewer's binding to the exact candidate commit. **This proposal therefore records planning only;
its apply phase is sequenced after the remediation change is archived.** The blocker it removes is
not urgent — no live defect depends on it, and the workaround (leaving `CLAUDE.md` untracked and
git-ignored) is the state the repository is in today and is what the existing control already
assumes.
