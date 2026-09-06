## Why

R14's scenario "Path classification is silently widened" — candidate policy broadens an exempt or benign path class without acknowledgement, baseline verification SHALL reject — is specified but unimplemented: no rule in `openspec/scripts/` detects a widening, and no acknowledgement field exists anywhere in the signed-record shape (#203). Today an unacknowledged weakening of path classifications is caught only by a human noticing. Widening is the cheap direction: moving a path into `documentation_only` lowers what governance demands of every future change touching it, which is precisely the weakening R14 exists to catch.

## What Changes

- Implement the R14 scenario mechanically in the governance checker as a named rule with a distinct diagnostic id: `path-class-widening-unacknowledged`.
- Define what counts as a widening, with the comparison basis stated explicitly: the candidate policy in the working tree compared against the baseline policy at the merge base, over the tracked-path universe.
- Add an optional, additive field `pathClassWideningAcknowledgement` to the signed governance record shape (camelCase, matching the record source's existing convention), so a reviewer can record the acknowledgement the rule demands. The field is optional: records that do not widen carry nothing.
- Evaluate the rule inside the checker that the trusted baseline runs, not only the candidate: the dual check already materialises the merge-base checker against the candidate's data, and this change additionally passes the explicit `--base` into both checker runs so the comparison basis is one named ref for both.
- Add mutation controls: an unacknowledged widening fails with the named diagnostic, an acknowledged one passes, a narrowing is unaffected, and an unrelated policy edit is unaffected.

## Capabilities

### New Capabilities

None. This implements an already-specified R14 scenario without changing spec-level behavior; the change opts out of specification deltas (`skip_specs: true`).

### Modified Capabilities

None. The assessment declares `software-design-pattern-governance` solely so the governance perimeter associates these governance-core checker, test, and documentation edits with their owning change.

## Impact

- `openspec/scripts/design-pattern-governance/path-widening.mjs` (new rule module)
- `openspec/scripts/check-design-pattern-governance.mjs` (call site)
- `openspec/scripts/run-governance-dual-check.mjs` (passes the explicit base into both checker runs)
- `openspec/tests/design-pattern-governance/self-governance.test.mjs` (mutation controls)
- `docs/design-pattern-governance.md` (actor-neutral description of the new diagnostic and acknowledgement field)
- `openspec/changes/enforce-r14-path-widening/`

No runtime code, no public API, no generated contract artifacts, no dependency versions, no policy path-class edits, and no existing signed records are altered.
