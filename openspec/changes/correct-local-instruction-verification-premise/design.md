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
