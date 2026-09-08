## Why

The assessment generator currently derives an omitted proposal baseline from the checkout's `HEAD`. A pull-request artifact can therefore pass on its exact head and fail immediately after merge, because the merge commit changes that fallback without changing the authored assessment source.

## What Changes

- Make generated assessment ordering deterministic across pull-request merge commits by requiring an authored proposal baseline rather than deriving it from the current checkout.
- Reject an assessment source that omits the ordering baseline with a bounded, actionable diagnostic.
- Add a regression test proving that a generated assessment remains byte-identical when the checker runs at a descendant merge commit.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `software-design-pattern-governance`: assessment generation and validation retain stable ordering evidence across merge boundaries.

## Impact

- `openspec/scripts/design-pattern-governance/assessment-generation.mjs` and its generation entry point.
- Governance regression tests under `openspec/tests/design-pattern-governance/`.
- The new change's OpenSpec artifacts and the canonical governance specification.
