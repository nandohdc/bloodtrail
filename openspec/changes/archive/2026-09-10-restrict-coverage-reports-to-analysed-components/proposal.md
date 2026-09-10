## Why

Every `sonar` run emits `WARN Could not resolve N file paths`, and has done for as long as the
repository-wide scan has existed (#442). The number is not noise — it is a **saturated signal**. A
warning that is always present is a warning nobody reads, so the day a real source file stops
resolving — a moved directory, a renamed workspace, a regressed path rewrite in the `coverage` job —
the line reads `5` instead of `4` and nothing anywhere fails. A coverage report that silently stopped
covering the SDK would look exactly like the line the job prints today.

The cause is now established from the reports themselves rather than inferred. The `coverage` job
hands Sonar four lcov reports, and four of their records name files the analyser was explicitly told
not to index:

| Report | Record | Why it cannot resolve |
|---|---|---|
| `packages/security-audit-sdk-core/coverage/lcov.info` | `dist/generated/schema-validator.generated.cjs` | matched by `sonar.exclusions` `**/dist/**` |
| `packages/security-audit-sdk-core/coverage/lcov.info` | `src/generated/contract.generated.ts` | matched by `sonar.exclusions` `packages/security-audit-sdk-core/src/generated/**` |
| `packages/security-audit-sdk-node/coverage/lcov.info` | `../security-audit-sdk-core/dist/generated/schema-validator.generated.cjs` | same, reached across the workspace boundary |
| `packages/security-audit-sdk-node/coverage/lcov.info` | `../security-audit-sdk-core/src/generated/contract.generated.ts` | same |

The records are legitimate: the SDK's runtime tests execute built output, and the generated Ajv
validator is a `.cjs` file that exists only under `dist/` with no source map, so `--enable-source-maps`
cannot map it back to a `src` path the way it maps every other record. Nothing is measured wrongly —
an excluded file was never going to carry a coverage figure. What is wrong is that the analyser is
handed records it was told to ignore and can only complain into a log.

The count also confirms what the scan does with the paths it is given. Before #452 widened the scope
the warning read `2`; it now reads `4`. Had Sonar not normalised the `..` segments in the Node
binding's report, all seventeen of its cross-package records would have been unresolvable and the
count would read `19`. It reads `4`, so exactly the two excluded files are unresolvable in each of
the two reports that carry them.

## What Changes

- **Normalise and filter the reports before they are handed over.** The `coverage` job's inline
  `node -e` path rewrite becomes `.github/scripts/normalize-coverage-reports.mjs`, which rewrites each
  `SF:` path to a normalised repository-relative path — resolving `..` segments rather than leaving
  them for the analyser — and then drops every record whose path is not an analysed component under
  the scope declared in `sonar-project.properties`. Coverage figures for analysed components are
  unchanged by construction: an excluded file carries no figure, and a record that resolves to an
  analysed component is never dropped, including one reached across a workspace boundary.
- **Read the scope rather than restate it.** The script derives the report list, the source and test
  roots, and the exclusion globs from `sonar-project.properties`, and derives each report's package
  root from the report path itself. The workflow's hand-maintained list of four report/prefix pairs —
  a fifth copy of the declared-package set — is deleted rather than corrected.
- **Turn the saturated warning into a tripwire.** The script fails closed when a report is missing,
  when a report would be left with no records at all, and — the arm that matters — when a rewritten
  path does not exist on disk. A regressed rewrite currently produces a larger number in a warning
  nobody reads; it will produce a failed `coverage` job that names the path.
- **Write down why the records are there.** `sonar-project.properties` records, beside the report
  paths themselves, that reports legitimately carry records for excluded built and generated output
  and that the normalizer strips them, so the next reader does not rediscover this from a log.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

`ci-topology` gains one requirement: coverage reports supplied to the required quality gate describe
only analysed components, with an unresolvable record failing the job that produces the report rather
than warning in the job that consumes it. It sits beside the requirement added by #452, which
ratified that every declared package is in the analysis scope; this one ratifies that what is handed
to that scope matches it. No existing requirement is modified.

## Impact

- `.github/workflows/ci.yml` — `governance_core`; the `coverage` job's rewrite step becomes a script
  invocation. No job, threshold, artifact name, or dependency edge changes.
- `.github/scripts/normalize-coverage-reports.mjs` and its test — `governance_core`; new.
- `sonar-project.properties` — `governance_core`; comment only. No scope, threshold, quality profile,
  or project key changes.
- `openspec/specs/ci-topology/spec.md` — the fold target for the added requirement.

## Out of scope

**The Node binding's report carries seventeen records for sdk-core sources.** Its tests exercise the
core through the workspace link, so `--enable-source-maps` attributes those lines to
`../security-audit-sdk-core/src/*.ts`. Sonar's LCOV parser unions hit counts across reports, so this
can only raise a component's measured coverage, never lower it — and #442's acceptance criteria
require the coverage figures of analysed components to be *unchanged* by this fix. Dropping those
records would change them. Whether a package's coverage figure should be the union of every report
that touched it is a real question and it is not this one; it needs its own measurement, and this
change deliberately leaves the records in place.

**Codecov receives the filtered reports too, and that is deliberate.** The normalisation step sits
where the existing path rewrite sits, before both the artifact upload the `sonar` job consumes and the
Codecov upload, so Codecov's records for built and generated output disappear with the rest. No check
can change state as a result: every Codecov status in `codecov.yml` is `informational: true`, project
and patch, default rules and per-component alike, and none of the four Codecov contexts is among the
ten required to merge. The effect on the reported figure is that generated output stops counting
towards it, which is the same judgement `sonar.exclusions` already makes. Task 5.3 records the
Codecov contexts' states on the change's own run rather than predicting them here.

Nothing is added to or removed from `sonar.sources`, `sonar.tests`, `sonar.exclusions`, or
`sonar.javascript.lcov.reportPaths`. No coverage threshold moves and no package's `test:coverage`
script changes — the per-package thresholds are enforced by `node --test` before any report is
normalised, so a package's own coverage gate is unaffected by what is later filtered out of its
report.
