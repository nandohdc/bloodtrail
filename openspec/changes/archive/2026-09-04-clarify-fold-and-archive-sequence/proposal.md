## Why

Archiving an OpenSpec change that carries `specs/` deltas in the same pull request that folds those deltas into canonical specifications fails `design-pattern-governance` with `[openspec-association-unrelated]`. This occurs because `ownedPathsFor` in `perimeter.mjs` intentionally narrows a relocated change to its own archive directories, leaving any canonical spec writes in the same PR without an active owning change.

Currently, `CONTRIBUTING.md` line 26 lists folding and archiving as a single step and does not document the required two-PR sequence, the necessity of declaring canonical specification paths in `assessment.json` `owned_paths`, or the post-fold idempotence check. Documenting this sequence clearly prevents contributors and autonomous agents from attempting invalid single-PR folds and archives.

## What Changes

- Clarify in `CONTRIBUTING.md` line 26 that folding deltas into `specs/` and archiving the change are two separate steps across two separate PRs.
- Add a dedicated subsection in `CONTRIBUTING.md` explaining:
  1. The two-PR workflow (PR 1: fold delta into `openspec/specs/<capability>/spec.md` while the change is active; PR 2: archive relocation carrying no canonical writes).
  2. The `owned_paths` declaration requirement in `assessment.json` (must declare canonical `openspec/specs/<capability>/spec.md`).
  3. The idempotence verification check (`openspec archive` prints `Specs already in sync; no files changed`).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None. This change updates repository contributor guidance without altering canonical capability requirements (`skip_specs: true`).

## Impact

- `CONTRIBUTING.md`: Workflow instructions updated.
