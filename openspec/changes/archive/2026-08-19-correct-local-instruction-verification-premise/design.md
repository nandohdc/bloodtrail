## Context

See `proposal.md` — Why, for the motivation and the CI evidence.

Two facts shape the approach:

The checker already emits machine-readable counts. `check-changed-paths.mjs` ends with a summary
line carrying a JSON object of classification counts, for example:

```
changed-path policy passed in active mode for remediate-security-audit-sdk-adversarial-review:
146 visible records; {"unrelated-history-or-worktree":87,"local-instruction-unrelated":1,
"active-remediation":7,"sdk-package":50,"unrelated-deletion":1}; ...
```

So a count is available without changing the checker's output contract or adding a flag.

The controls clone the live repository. `caseRepository()` produces a disposable clone of the real
repo, which is why live tracked state leaks into a control's premise. Any corrected assertion must
be stated relative to the clone it actually runs against, not against an assumed empty baseline.

## Goals / Non-Goals

**Goals:**

- State the control's assertion in terms of the file under test's *contribution*, so it is
  independent of whatever the live repository happens to track.
- Keep the control able to fail deterministically, and prove it, rather than asserting a condition
  that is merely true today.
- Cover the tracked case as well as the ignored case, so the correction cannot be mistaken for
  suppressing the classification.

**Non-Goals:**

- Changing `check-changed-paths.mjs` classification, the `CLAUDE.md` rule, the bucket name, or the
  summary-line format.
- Making `caseRepository()` produce an empty or synthetic repository. That would decouple the
  controls from real repository state and weaken every sibling control that depends on the clone.
- Deciding whether `CLAUDE.md` should be tracked. Out of scope; see `proposal.md` — Impact.

## Decisions

**D1 — Assert a baseline delta, not a global absence.**

Capture the `local-instruction-unrelated` count from the clone *before* creating the ignored file,
then assert the count is unchanged after. This is exactly the claim the test name makes.

Alternatives considered:

- *Assert the bucket contains no path equal to the ignored file's path.* Rejected: the summary line
  reports counts, not paths, so this would require widening the checker's output contract purely to
  serve a test — the checker deliberately reports aggregates.
- *Give `caseRepository()` an empty-repository mode.* Rejected as a Non-Goal above: it changes a
  helper shared by every control in the file, to fix one control's premise.
- *Delete the control.* Rejected: the ignore-semantics behavior is real and worth holding. Removing
  a control to make a change pass is the failure mode this repository's verification discipline
  exists to prevent.

**D2 — Parse the count from the existing summary line.**

Extract the JSON object from the checker's stdout and read the bucket's value, defaulting to zero
when the key is absent. No checker change, no new dependency, no new output mode.

Alternative: add a `--json` flag to the checker. Rejected as disproportionate — it expands a
governed script's interface to serve one assertion.

**D3 — Two mutations, not one.**

A corrected assertion that only ever sees "unchanged" is indistinguishable from an assertion that
cannot fail. The control is therefore paired with two deterministic mutations:

- *Ignore regression*: the local instruction file is tracked rather than ignored, so it **does**
  contribute a record. The delta assertion must fail.
- *Classification removal*: the `CLAUDE.md` classification rule is removed, so a tracked file is no
  longer reported. The tracked-case control must fail.

The second mutation is the one that matters most. Without it, a future change could satisfy the
suite by deleting the classification rule outright — the corrected control would still pass, because
zero equals zero. This mirrors the discipline the sibling `M-VP-*` mutations already apply.

**D5 — Land the controls in their own verification file.**

`mutations.test.mjs` is an existing CodeScene hotspot. Adding the corrected control, its
tracked-case counterpart, and two mutations to it declined the file's code health from 7.91 to 7.22
on *Lines of Code in a Single File* and *Number of Functions in a Single Module* — a file-level
finding about the host, not about the new code. The controls therefore live in
`tests/verification/local-instruction-classification.test.mjs`, and `mutations.test.mjs` loses the
eight lines the old control occupied.

This follows the convention the directory already uses: `f07`/`f08`/`f10`/`f11-mutations`,
`vp-reviewed-paths`, and `publication-path-mutations` are each a focused suite with its own small
disposable-clone harness. The new file's harness is modelled on `vp-reviewed-paths.test.mjs`: it
clones once into a control repository, clones per case from that, and runs the checker in its
naturally resolved mode rather than restoring an active-change fixture, which these controls do not
need.

Alternative considered: split `mutations.test.mjs` itself. Rejected as disproportionate — it would
move bytes across many controls unrelated to this change, for a finding that a 138-line focused file
resolves outright.

**D4 — Leave the classification rule untouched.**

The policy is correct: a local instruction file genuinely is unrelated to the governed change
surface, and `test:changed-paths` already passes with one tracked. Only the control's premise is
wrong, so only the control changes.

## Risks / Trade-offs

- **A baseline-delta assertion is weaker than an absolute one.** It cannot detect a pre-existing
  stray record in the clone. → Accepted, and mitigated by D3's tracked-case control, which asserts
  the classification still reports. The absolute form is not available anyway: it is false whenever
  the repository tracks a local instruction file, which is the state this change exists to permit.
- **The control now depends on the summary line's shape.** A future change to that line breaks it.
  → Accepted; the parse should fail loudly rather than silently returning zero, so a format change
  surfaces as a test failure rather than a vacuous pass.
- **Touching `tests/verification/` moves bytes inside the remediation candidate's reviewed
  surface.** → Mitigated by sequencing: see Migration Plan.

## Migration Plan

No runtime migration; the change is confined to repository verification controls.

**Sequencing is the constraint, not deployment.** `tests/verification/` is inside the surface bound
to the active remediation candidate. Applying this change before task 12.4's independent review
completes would modify reviewed bytes and invalidate the reviewer's exact-commit binding.

Apply only after `remediate-security-audit-sdk-adversarial-review` is archived — that is, after
tasks 12.4 through 12.10 are complete. Until then this change remains planning only. The blocker it
removes is not urgent: no live defect depends on it, and the present state, `CLAUDE.md` untracked
and git-ignored, is exactly what the existing control assumes.

Rollback is a revert of the control change; nothing else depends on it.

**Archive-time prerequisites, discovered while applying this change.** Two conditions must hold
before task 6.4 can archive it, and neither is satisfied by the archive commit itself.

*Spec-fold coverage.* Archiving folds this change's `## ADDED Requirements` delta into
`openspec/specs/security-audit-sdk-core/spec.md`. The design-pattern governance perimeter grants a
relocated change ownership of its active-dir and archive-dir prefixes only, and this change is
grandfathered with no `assessment.json`, so it declares no capability and its `bounded_paths` stop
short of `openspec/specs/`. The fold must therefore be owned by an *active* change declaring
`security-audit-sdk-core`, exactly as
`openspec/changes/archive/2026-08-18-cover-bundle-archive-spec-fold` established for
`bundle-validator-runtime-helpers`. Archiving without that keeper fails closed with
`openspec-association-unrelated`.

The same perimeter rule applies to the *implementation* commit, not only the archive: the two control
files are governed implementation paths and this change owns none of them. Both needs are met by one
keeper, `cover-local-instruction-control-paths`, created alongside the implementation. It declares
`security-audit-sdk-core`, names both control files in its `owned_paths`, and is intended to stay
active until this change archives.

*Fixture decoupling.* `tests/verification/mutations.test.mjs` uses this change's own active directory
as the fixture for the `archive-movement-unrelated-deletion` control, and it is currently the only
active change, so archiving it removes the fixture rather than merely moving it. The control must
first be repointed or made self-sufficient in a separate change, as
`e5b5814 fix(governance): decouple verification fixtures from the governance change lifecycle` did
when `establish-design-pattern-governance` archived.

Both are recorded here and in `tasks.md` rather than in `proposal.md`.
`openspec/governance/design-pattern-policy.json` pins this change's grandfathering to the proposal's
exact blob, and `openspec/scripts/design-pattern-governance/provenance.mjs` compares that pin against
`refs/heads/main`, so editing the proposal would turn the required `design-pattern-governance` check
red after merge, on this and every later pull request.
