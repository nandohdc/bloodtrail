## Why

Branch protection on `main` requires nine status checks. `CLAUDE.md` listed eight, omitting `design-pattern-governance`. `README.md`'s CI table omitted it entirely — not as required, not as reporting-only, simply absent — which is the worse failure, because that table reads as a complete enumeration.

Both contradicted `CONTRIBUTING.md`, which already calls `design-pattern-governance` "the required ... CI check". An agent trusting either document would have concluded that a governance failure does not block a merge.

## What Changes

- Correct the `CLAUDE.md` CI paragraph to name all nine required contexts, and state the count so completeness is checkable against branch protection rather than by eye.
- Add the missing `design-pattern-governance` row to the `README.md` CI table.
- Record why the count matters: `gh pr checks --required` lists only contexts that have reported, so a check that never started is invisible there and an empty pending list reads as green. `sonar` demonstrates this in practice — it declares `needs` on `ci`, `sdk`, `contract` and `coverage`, so it registers no context at all until those finish.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This corrects a factual statement about branch-protection configuration in two agent-facing documents. It changes no requirement, no gate, and no workflow. `.openspec.yaml` therefore declares `skip_specs: true`.

## Impact

- `CLAUDE.md`
- `README.md`
- `openspec/changes/correct-required-check-list/`

`CLAUDE.md` is a `governance_core` path, and `governedPatterns` in the checker selects both `governed_implementation` and `governance_core`, so this change exists to carry the association that edit requires. `README.md` is `documentation_only` and needs no association; it is owned here because the same defect spans both files and splitting them would leave a known-wrong document standing.

No workflow, policy, checker, schema, catalog, contract, generated artifact, runtime, package metadata, dependency, or publication-path change. The branch-protection configuration itself is not modified: these documents are being corrected to match it, not the reverse.
