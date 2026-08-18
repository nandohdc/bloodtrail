## Why

`bundle-validator-runtime-helpers` is merged (PR #171, PR #175) and owes an archive that folds its `## ADDED Requirements` delta into `openspec/specs/security-audit-sdk-core/spec.md`. That fold is a governed path edit. The design-pattern governance perimeter grants a relocated change ownership of only its active-dir and archive-dir prefixes — the archived assessment's capability declaration deliberately stops covering `openspec/specs/<capability>/` after relocation, so the fold must be owned by an *active* change declaring the same capability.

`record-validator-packaging-policy` provided that coverage, but it was archived first (`docs(openspec): archive record-validator-packaging-policy`, merged via PR #172). The only other active change, `correct-local-instruction-verification-premise`, carries no assessment and therefore declares no capabilities for coverage purposes. Reproduced in a disposable worktree at `6056ded9bfcf6e945ae21491a5cb71ac85c3e622`: archiving `bundle-validator-runtime-helpers` and running the final governance phase against that base fails closed with exactly one diagnostic — `openspec-association-unrelated` on `openspec/specs/security-audit-sdk-core/spec.md`. The same simulation with an active doc-only change declaring `security-audit-sdk-core` passes the final phase and `openspec validate --all --strict`.

## What Changes

- Hold the `security-audit-sdk-core` capability declaration active through this doc-only change until the `bundle-validator-runtime-helpers` archive merges. The archive then folds the spec delta under this change's coverage.
- After that archive merges, this change is itself archived as a pure relocation: it carries no `specs/` delta, so its own archive needs no spec-fold coverage and creates no recursion.
- No specification content, no code, no checker, and no policy file changes. The canonical spec requirement enters `openspec/specs/security-audit-sdk-core/spec.md` only through the `bundle-validator-runtime-helpers` archive, exactly as proposed and reviewed there.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change modifies no requirement of `security-audit-sdk-core`; its `.openspec.yaml` sets `skip_specs: true`. The assessment declares the `security-audit-sdk-core` capability solely so the governance perimeter covers the sibling archive's spec fold while this change is active.

## Impact

- **Scope**: `openspec/changes/cover-bundle-archive-spec-fold/`. Nothing else.
- **Code**: none.
- **Dependencies**: none.
- **Non-goals**: this change does not author or alter any spec requirement, does not amend the governance perimeter or any checker (the rejected alternative), does not archive `bundle-validator-runtime-helpers` itself, and grants no production or publication authorization.
