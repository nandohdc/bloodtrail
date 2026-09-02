## Why

The Codecov test-results step passes the unsupported `report-type` input to
`codecov/codecov-action@v5`. GitHub ignores that input, leaving the report type
empty and causing JUnit XML files to be sent through Codecov's default coverage
upload path instead of the Test Analytics path.

## What Changes

- Use the action's supported `report_type: test_results` input.
- Disable automatic report discovery for the test-results upload so the step
  sends only the two explicitly listed JUnit XML reports.
- Preserve the existing non-blocking Codecov upload policy, workspace flags,
  authentication, coverage upload, and report-generation commands.

## Capabilities

### New Capabilities

None. This corrects CI integration configuration and does not add product
behavior; the change opts out of specification deltas.

### Modified Capabilities

None. The assessment declares `software-design-pattern-governance` solely so
the governance perimeter associates this governance-core workflow edit with
its owning change. That declaration does not claim a requirement modification,
and `.openspec.yaml` therefore continues to declare `skip_specs: true`.

## Impact

- `.github/workflows/ci.yml`
- `openspec/changes/fix-codecov-test-results-upload/`
- Codecov Test Analytics ingestion for the SDK core and browser-telemetry JUnit
  reports

No runtime code, package API, generated artifact, dependency, coverage report,
test command, or branch-protection policy changes.
