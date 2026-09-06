## Context

R14 declares: WHEN candidate policy broadens an exempt or benign path class without acknowledgement THEN baseline verification SHALL reject the change. `openspec/governance/design-pattern-policy.json` classifies every tracked path through four classes — `governance_core`, `governance_record_only`, `governed_implementation`, `documentation_only` — by longest matching pattern. `documentation_only` is the exempt/benign class: it carries the fewest triggers and most exemptions, so moving a path into it (or growing its pattern set) lowers what future changes touching those paths must prove.

The checker already has the machinery this rule needs: a `--base` option, `blobAt` for reading a file at any ref, `trackedPaths` for the tracked-path universe, `classifyPath` for classification, and a precedent in `checkSchemaEvolution` for comparing a candidate artifact against its merge-base copy. The signed-record source (`packages/security-audit-sdk-core/verification-lifecycle.json`, `governanceRecords[]`) is read by both the review-freshness verifier and the dual check's acceptance resolution; its records carry camelCase fields (`reviewedCommit`, `boundCommits`, `mergeCommits`) and tolerate additive optional fields, which live records demonstrate.

## Goals / Non-Goals

**Goals:**

- An unacknowledged benign-class widening fails with a distinct named diagnostic (`path-class-widening-unacknowledged`), judged by the checker the trusted baseline runs.
- The same widening with a valid, exactly-bound acknowledgement passes.
- Narrowing a class, strengthening a path, or editing the policy without changing classification outcomes does not fire.
- Deterministic behavior: identical inputs, identical diagnostics, code-point ordering, no locale dependence.

**Non-Goals:**

- Re-litigating the classifications landed by #202.
- Changing what any path class requires.
- Detecting every conceivable weakening (for example, editing `governance_core_artifacts`, trigger lists, or record-only allowlists); R14's scenario is specifically the benign path-class widening, and those surfaces have their own controls.
- Adding mandatory fields to signed records: the acknowledgement stays optional and additive, so existing records and the policy's minor-version compatibility rules are unaffected.

## Decisions

### 1. What counts as a widening

Two event classes, both computed by comparing the candidate policy (working tree) against the baseline policy at the merge base:

- **Path reclassification.** For every tracked path, classification is computed under both policies. A path whose baseline classification was anything other than `documentation_only` (including `unclassified`, which fails closed and is therefore the strongest scrutiny) and whose candidate classification is `documentation_only` is a widening event, keyed by the path.
- **Benign pattern growth.** Every pattern present in the candidate's `documentation_only` class but absent from the baseline's is a widening event, keyed as `pattern:<pattern>`. This is not redundant with the path check: a new benign pattern may match no tracked path today, and the acknowledgement must be recorded at the moment the class broadens, not the first time a future path happens to match it.

Moves in the strengthening direction — out of `documentation_only`, into `governed_implementation` or `governance_core` — and lateral moves between non-benign classes produce no event. An unclassified candidate path is judged by the existing `path-unclassified` control, not this rule.

### 2. Where the acknowledgement is recorded

On the signed governance record, as an optional camelCase field, matching the record source's existing convention:

```json
"pathClassWideningAcknowledgement": {
  "acknowledged": true,
  "baselineCommit": "<40-hex merge-base the comparison ran against>",
  "reason": "<reviewer prose, at least 20 characters>",
  "paths": ["<widened path or pattern:<pattern> key>"]
}
```

The field is judged only when a widening is detected, so records for changes that do not widen carry nothing. A record carrying the field must satisfy every part exactly, mirroring the dual check's acceptance discipline: exactly one signed record may carry it; `acknowledged` must be true (recording the field while denying it is contradictory); `baselineCommit` must equal the actual comparison base; `reason` must be substantive; and `paths` must equal the detected event keys as an exact set — a superset cannot pre-approve widens nobody reviewed, and a subset leaves a widening unacknowledged.

The signed-governance-record schema file is deliberately not touched: record enforcement lives in `check-governance-history.mjs` and the review-freshness verifier, both of which validate required fields and tolerate additive optional fields. Adding an optional field is a minor, additive change under the policy's own compatibility rules, and no existing record changes.

### 3. Where the rule runs

Inside the checker, invoked from `checkPerimeter` after `checkSchemaEvolution`, so it runs in the same phases (implementation and final) that already compute a range base. The rule reads the baseline policy itself; the dual check passes the explicit `--base` into both its checker runs so the candidate and the materialised baseline checker compare against one named ref. When this change lands, the merge-base checker contains the rule, which is what makes the baseline the judge the scenario requires: a future change that edits the rule away is itself judged by the baseline copy that still has it.

### 4. Failure modes that must stay distinct

Each rejection gets its own diagnostic id so a mutation test can demand the exact one:

- `path-class-widening-unacknowledged` — one diagnostic per event key (path event at the widened path; pattern event at the policy path), naming what moved and where.
- `path-class-widening-acknowledgement-absent` — a widening was detected and no signed record carries the field.
- `path-class-widening-acknowledgement-ambiguous` — more than one signed record carries the field.
- `path-class-widening-acknowledgement-invalid` — the field fails its closed shape (unknown keys, wrong types, `acknowledged` false or absent, reason too short).
- `path-class-widening-acknowledgement-stale` — the declared `baselineCommit` is not the comparison base.
- `path-class-widening-acknowledgement-incomplete` — the declared paths are not exactly the detected event keys.

### 5. Alternatives compared

- **Third-party schema validation or a new runtime dependency.** Rejected: the repository permits no runtime dependency in this checker, and the closed-shape validation pattern already in the checker covers the field without one.
- **Recording the acknowledgement in the OpenSpec assessment instead of the signed record.** Rejected: the assessment is authored before implementation and before review; the acknowledgement is a reviewer act, and the signed record is the artifact that binds review to an exact commit.
- **Detecting widens only over changed paths rather than the full tracked universe.** Rejected: a pattern edit can reclassify paths the commit never touches, and the rule exists to catch exactly that.

## Verification

Governance test suite (`node --test openspec/tests/design-pattern-governance/*.test.mjs`) plus disposable-repository fixtures in `self-governance.test.mjs` mutating the policy in both directions, asserting the diagnostic id rather than exit status, plus the dual check exercised with an explicit base.
