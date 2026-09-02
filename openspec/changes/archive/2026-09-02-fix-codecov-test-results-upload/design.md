## Context

See `proposal.md` for motivation. The coverage job emits LCOV and JUnit XML
reports for two independent workspaces, then invokes `codecov/codecov-action@v5`
once for coverage and once for test results. The action accepts
`report_type`, maps it to `CC_REPORT_TYPE`, and defaults to coverage when the
input is absent. Its file search remains enabled unless `disable_search` is
set.

## Goals / Non-Goals

**Goals:**

- Select Codecov's `test_results` report type using the action's exact input
  contract.
- Restrict the test-results invocation to the two declared JUnit XML files.
- Make the expected corrected CLI arguments directly verifiable in a follow-up
  Actions run.

**Non-Goals:**

- Change how tests or reports are generated.
- Change coverage upload behavior, Codecov flags, authentication, action
  versioning, or failure policy.
- Make Codecov availability a required merge gate.

## Decisions

### Use `report_type` on the existing unified Codecov action

Keep `codecov/codecov-action@v5` and replace the unsupported hyphenated key with
`report_type: test_results`. The action version resolved by the failing job
declares that input and passes it to the CLI; no action migration or new
dependency is necessary.

Using `codecov/test-results-action` was rejected because Codecov deprecates that
separate action in favor of the unified action. Calling the Codecov CLI directly
was rejected because it would duplicate the existing action's authentication,
binary verification, and CI metadata handling.

### Disable discovery only for the test-results invocation

Add `disable_search: true` beside the explicit JUnit `files` list. The failing
job demonstrated that the default search added both LCOV reports to this second
invocation, producing four files on the coverage path. Restricting discovery
keeps this upload deterministic and prevents unrelated reports from being
included.

The first coverage invocation remains unchanged: altering it is unnecessary to
correct Test Analytics and would expand the regression surface.

### Preserve non-blocking failure behavior

Keep `fail_ci_if_error: false`. This change corrects report classification; it
does not revise the repository's existing decision to treat Codecov upload
availability as advisory.

## Risks / Trade-offs

- **[Risk] A syntactically valid workflow may still diverge from Codecov's
  runtime contract** → Verify the next Actions log contains
  `CC_REPORT_TYPE: test_results`, `--report-type test_results`, and only the two
  JUnit paths in the test-results upload.
- **[Trade-off] Codecov failures remain non-blocking** → Preserve the current
  policy and rely on explicit log/UI verification for this corrective change.
- **[Risk] The floating `v5` action tag or downloaded latest CLI can change
  later** → Treat pinning as a separate governance change; it is not required
  for this input correction.

## Migration Plan

Merge the workflow edit and observe the first `main` coverage job. Rollback is
the inverse two-line workflow change if Codecov rejects the corrected input or
the JUnit reports. No stored data, runtime service, or package artifact requires
migration.
