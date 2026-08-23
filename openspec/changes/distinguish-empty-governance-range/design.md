## Context

`checkPerimeter` resolves `HEAD` before comparing it with an explicit baseline. When an explicit full SHA equals that resolved `HEAD`, the current early return preserves the intended successful empty-range verdict but leaves every range-summary field unset. The #191 disposable-worktree reproduction confirms the distinction: an untracked probe with `--base origin/main` fails closed as an inspected one-path range, while `--base <HEAD SHA>` succeeds with null range fields.

The checker, policy, and perimeter tests are governance-core paths. This change therefore retains the existing fail-closed model and adds only the missing evidence for the already-successful empty case.

## Goals / Non-Goals

**Goals:**

- Make an explicitly selected empty range observable in JSON and human-readable success output.
- Preserve the success exit status and avoid checking working-tree paths in the semantic-empty branch.
- Prove the fix with a regression test and the existing untracked-path null control.

**Non-Goals:**

- Do not remove the empty-range short-circuit.
- Do not expand perimeter scope to inspect untracked paths when the baseline resolves to `HEAD`.
- Do not change policy classifications, activation behavior, accepted CLI arguments, production SDK behavior, or any transport/storage/telemetry surface.

## Decisions

### Preserve the short-circuit and materialize an explicit zero-range summary

Before returning for a baseline that resolves to `HEAD`, record the resolved baseline and set inspected commit and path counts to zero. Existing summary formatting will then expose the result in both JSON and the successful text output without inventing a failure or a new checker phase.

**Alternative considered: remove the short-circuit.** This would make an empty committed range inspect the working tree and could turn an existing success into an unclassified-path failure. That changes the perimeter's scope, contradicts the approved Option A boundary, and remains deferred.

### Keep non-empty range behavior unchanged

The normal `collectRangePaths` path remains responsible for path discovery, classification, hidden-implementation checks, OpenSpec association, provenance, and schema evolution. The change supplies deterministic zero values only for the branch that already returns before those steps.

**Alternative considered: synthesize an empty range and execute every normal check.** That would enlarge the patch and create new behavior in controls unrelated to the missing summary. The existing successful semantics do not require it.

### Make the test assert the result contract, not an internal return

Add a perimeter regression test that uses the disposable repository harness to invoke the checker with its head SHA as the explicit base. Assert success plus a resolved baseline and zero counts. Keep a separate untracked-path control using a non-identical ref spelling so it continues to demonstrate a genuinely inspected, fail-closed range.

**Alternative considered: assert only the human-readable message.** JSON carries the machine-readable evidence contract; the text check will be a supplementary assertion rather than the sole proof.

## Risks / Trade-offs

- [A caller expected `null` to mean empty range] → `null` was ambiguous and contradicted observability; consumers gain a stable explicit zero representation.
- [A refactor could accidentally remove the short-circuit] → The regression test separately proves the empty success and the untracked control still fails closed.
- [Governance-core patch changes its own checker] → Full assessment, trusted-baseline/candidate verification, and exact-commit governance remain required before merge.

## Migration Plan

1. Add the failing regression test and prove the current checker leaves zero-range fields absent.
2. Materialize the resolved baseline and zero counts in the existing empty-range branch.
3. Run targeted and full design-pattern-governance tests, strict OpenSpec validation, and the trusted/candidate governance checks.
4. Do not migrate persisted data or alter user-facing SDK APIs. Reverting the bounded checker/test patch restores the previous ambiguous summary behavior if necessary.
