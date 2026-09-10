## Why

`sonar-project.properties` opens by saying it "scans every workspace". It does not. `sonar.sources`
and `sonar.tests` are hand-maintained explicit lists, and two of the five declared workspaces —
`packages/security-audit-sdk-node` and `packages/security-audit-collector` — appear in neither.
`sonar` is one of the ten required merge contexts, so a required gate reports on a little over half
the authored code while its own header asserts otherwise (#452).

Confirmed against the analyser's output rather than by reading the config: the `sonar` job of run
`34485622198` contains **zero** occurrences of either workspace name in its entire log and reports
`96 files indexed`. Tracked source files in those two workspaces total 43 — the Node binding's
delivery classes, HTTP handoff, retry, backpressure and shutdown, and the collector's whole ingress
pipeline including its authentication and deduplication stages.

The same omission runs through `sonar.javascript.lcov.reportPaths`, which names only the sdk-core and
research reports: the `coverage` job produces and path-rewrites reports for both missing workspaces,
and Sonar never reads them. Their coverage is computed, uploaded, and discarded.

This is the shape #82's decision brief named and #412 and #441 proved twice over — an explicit list
with nothing asserting it. `.github/scripts/check-package-discovery.mjs` already holds
`DECLARED_PACKAGES` and already asserts that both covering `make` targets invoke every declared
workspace. Nothing yet asserts the same of the analysis scope of a required gate.

## What Changes

- **Add both missing declared workspaces to the analysis scope.** `sonar.sources` and `sonar.tests`
  gain their `src`, `scripts` and `tests` directories, mirroring how `packages/security-audit-sdk-core`
  is already configured; `sonar.javascript.lcov.reportPaths` gains their existing coverage reports;
  `sonar.typescript.tsconfigPaths` gains their `tsconfig.json` so type-aware analysis reaches them;
  and `sonar.exclusions` gains the collector's `src/generated/**`, because generated output is not
  hand-editable and a finding there is not actionable — the same reason sdk-core's is excluded.
- **Assert it.** `assertSonarScopeCoversDeclaredPackages` in
  `.github/scripts/check-package-discovery.mjs` requires every declared workspace to appear in
  `sonar.sources`, and fails closed in both directions: an unlisted declared workspace is a failure,
  and a listed path under no declared workspace is a failure. Adding a sixth workspace without adding
  it to the analysis scope then fails the same way as forgetting the `Makefile`.
- **Correct the header comment**, which is what made this invisible: it asserts complete coverage, so
  nobody re-reads the list.
- **Resolve the measured onboarding findings at their source.** The widened scan found sixteen
  violations in the newly analysed packages, so their package-gate parsers and the two affected
  delivery implementations are repaired without removing them from `sonar.sources`. The separately
  measured duplication is confined to intentionally repeated standalone-package gate scripts; only
  `packages/*/scripts/**` is excluded from CPD, while those scripts remain analysed for findings.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

`ci-topology` gains one requirement: the required quality gate's analysis scope covers every declared
package, asserted mechanically rather than maintained by hand, with an equally narrow assertion for
the intentional standalone-package CPD boundary. It sits beside the existing package-discovery and
root-command-surface requirements, which already ratify exactly this property for the CI package list
and for `make`. No existing requirement is modified.

## Impact

- `sonar-project.properties` — `governance_core`; the scope lists, the report paths, the tsconfig
  paths, the generated-output exclusion, and the header comment.
- `.github/scripts/check-package-discovery.mjs` and `.github/scripts/check-package-discovery.test.mjs`
  — `governance_core`; the scope and CPD-boundary assertions and their controls.
- `packages/security-audit-sdk-node/{src,scripts}/` and
  `packages/security-audit-collector/scripts/` — source-level repairs for findings surfaced by the
  newly widened required gate; no public API changes.
- `openspec/specs/ci-topology/spec.md` — the fold target for the added requirement.

## Out of scope

`openspec/scripts/` (23 files, including the design-pattern governance checker) and `.github/scripts/`
(7 files, including the merge gate) are also outside the analysis scope, and are **not** added here.
They are repository tooling rather than declared packages, and neither has a coverage report — the
`coverage` job runs `npm run test:coverage` in the four packages only. The quality gate's
`new_coverage >= 80` condition is evaluated on new code, so analysing them would make the next pull
request that edits a line in the governance checker report 0% coverage on that line and fail a
required context. That needs a coverage story first and is its own change.

No package, dependency, API, or contract artifact changes. No workspace's declared Node support
changes, no source tree is removed from `sonar.sources`, and no gate threshold moves.
