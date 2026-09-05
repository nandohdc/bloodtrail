## Why

The repository's developer and agent instructions never state that the product test loop takes roughly eighteen seconds across all three workspaces, so developers and agents routinely run the full SDK `validate` command which takes nearly five minutes (#304).

`CLAUDE.md` and `AGENTS.md` present `npm run validate` under the heading "Full gate chains — run both before pushing", and present `test:matrix` merely as the "matrix-safe subset ... use when running across Node majors". While `test:matrix` is indeed matrix-safe, it is also the fast development product loop (~15s), whereas SDK `validate` takes ~291s. Crucially, over 250s of that 291s is `test:verification` — the mutation testing suite asserting that governance gates fail closed, which asserts nothing about whether SDK runtime code functions correctly.

Furthermore, ADR 0011 contradicts itself regarding the branch protection required-context count: line 20 states ten contexts (including `coverage` added under #271), while lines 71, 77, 93, 101, and 127 still refer to nine contexts, creating ambiguity for readers and automated agents.

Both edits are documentation and governance corrections batched deliberately under the governance batching convention established in #301 / PR #310 to avoid paying multiple full governance assessment cycles.

## What Changes

- Clarify development and contributor instructions in `CLAUDE.md` and `AGENTS.md`:
  - Clearly distinguish the fast product test loop (~18s total across all workspaces: ~15s SDK `test:matrix`, ~1.5s contract `validate`, ~15s research `lint` + `test`) from full governance-gate chains.
  - State explicitly that SDK `validate` is a governance-gate chain whose dominant runtime (~254s out of ~291s) is `test:verification` (mutation testing of governance enforcement), not product test assertions.
  - Preserve the documented matrix-safe purpose of `test:matrix`.
  - Provide clear guidance on when to run the product loop (during active development iterations) versus when to run full gate validation (pre-push / PR verification).
- Reconcile ADR 0011 (`docs/adr/0011-ci-topology.md`) context counts:
  - Update all references from nine to ten required contexts throughout the document (lines 71, 77, 93, 101, 127), and include `coverage` in the required-context mapping table.
  - Ensure ADR 0011 is completely consistent with `openspec/specs/ci-topology/spec.md` and `CLAUDE.md`.
- Update `openspec/specs/ci-topology/spec.md` to specify that development instructions must distinguish the product test loop from governance chains with reproducible measured runtimes.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `ci-topology`: Adds requirement that development and contributor instructions distinguish the fast product test loop from full governance-gate chains, stating measured runtimes and identifying gate mutation testing (`test:verification`) as the dominant cost of `validate` rather than product verification.

## Impact

- `CLAUDE.md`: Documents the fast development loop vs governance chains with measured times.
- `AGENTS.md`: Highlights the ~18s product loop vs full gate validation.
- `docs/adr/0011-ci-topology.md`: Reconciles the required-context count to 10 throughout.
- `openspec/specs/ci-topology/spec.md`: Delta spec for instruction clarity on product vs governance loops.
- Governance assessment: As this touches `governance_core` paths (`CLAUDE.md`, `AGENTS.md`), it undergoes a full assessment, intentionally batching both documentation updates in accordance with the batching rule.
