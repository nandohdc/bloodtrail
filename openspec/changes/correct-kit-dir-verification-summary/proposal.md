## Why

The Node binding's kit gate, `scripts/check-evaluation-kit.mjs`, has two modes:

- **Run on its own,** it builds a kit from the working tree's tracked files and then rebuilds it, to prove
  that the kit's identity reproduces.
- **Run with `--kit-dir`,** it checks an existing kit as given and skips the rebuild.

Both modes print the same success line. That line says the kit was "built from tracked sources" and that its
identity was "reproduced with stale build output and untracked sources planted". With `--kit-dir`, none of
that happens. #664 verified the distributable kit v2 in this mode, and its comment had to disclaim the line by
hand (#697).

The gate was owned by `deliver-sdk-evaluation-kit-v2`, which is archived. An archived change owns no paths, so
this fix needs a change of its own.

## What Changes

- The gate's success line names only checks that ran. A `--kit-dir` run says the kit was checked as given and
  that its reproducibility was not checked. A run that builds its own kit prints the same line as before.
- `checkEvaluationKit` returns the success line, and the script's command-line entry point prints it.
- The kit controls gain a null control. An unmodified copy of the base kit, checked with `--kit-dir`, passes
  the gate, and its success line claims no rebuild.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. No requirement changes. The canonical Node binding spec requires the reproducibility check for kits
the gate builds, and says nothing about the success line. The change therefore opts out of spec deltas.

## Impact

- `packages/security-audit-sdk-node/scripts/check-evaluation-kit.mjs` and
  `packages/security-audit-sdk-node/scripts/check-evaluation-kit-controls.mjs`. Neither ships in the
  evaluation kit, and neither is a package export.
- Every gate check and every planted-defect control runs as before. The controls gain one passing gate run.
- No kit item, kit document, package source, runtime test, public API or spec changes.
