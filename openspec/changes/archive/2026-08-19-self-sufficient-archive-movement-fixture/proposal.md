## Why

`mutations.test.mjs:213` uses `correct-local-instruction-verification-premise`'s active
directory as the `archive-movement-unrelated-deletion` fixture. `prepareControl()` clones
the live repository, so the control inherits whatever the repository's change lifecycle
happens to hold: archiving the correction removes its active directory from the clone,
deleting the fixture and breaking the suite. The control was already repointed once, by
`e5b5814 fix(governance): decouple verification fixtures from the governance change
lifecycle`, when `establish-design-pattern-governance` archived. Repointing again is
proven-temporary: the correction records the decoupling as its task 6.6, to be done in a
separate change first, and this is that change.

The decoupling cannot grow `mutations.test.mjs`. The file is a 1173-line CodeScene
hotspot, and the required `codescene delta` check applies file-level rules — lines of
code in a single file and functions in a single module — against `origin/main`. Adding
the seed helper and a null arm in place is the same move that previously failed that
check: it declined the file's code health 7.91 to 7.22, and no amount of tightening the
new functions clears file-level rules. The fix that worked before is the one used here:
give the control its own suite and let `mutations.test.mjs` shrink.

## What Changes

- Move the `archive-movement-unrelated-deletion` control out of `mutations.test.mjs`
  into a new dedicated suite,
  `packages/security-audit-sdk-core/tests/verification/archive-movement-unrelated-change.test.mjs`.
- The new suite seeds and commits its own synthetic unrelated active change inside the
  disposable clone, so the fixture exists whenever the suite runs, independent of which
  OpenSpec change is active. A tracked-at-HEAD guard makes a broken seed fail loudly
  instead of quietly turning the control into a no-op.
- Add a same-fixture null arm: the identical fixture with the synthetic deletion omitted
  reports no unrelated-change deletion, attributing the diagnostic to the deletion.
- `mutations.test.mjs` loses nine lines and one test — the shrink that keeps the
  required `codescene delta` check green.
- No specification content, no checker, no classification rule, and no policy file
  changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change modifies no requirement of `security-audit-sdk-core`; its
`.openspec.yaml` sets `skip_specs: true`. The assessment declares the capability solely
so the governance perimeter covers the two governed test paths this change touches.

## Impact

- **Scope**: the two named test files, both owned through this change's `owned_paths`.
  Nothing else.
- **Code**: none. No SDK source, generated artifact, or contract artifact changes.
- **Dependencies**: none.
- **Non-goals**: this change does not archive or modify the correction or the keeper
  change, does not change `scripts/check-changed-paths.mjs`, any classification rule, or
  any diagnostic id, adds no governance record, does not track a root
  `CLAUDE.md`/`AGENTS.md`, and grants no production or publication authorization.
