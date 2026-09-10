## Context

`sonar` is one of the ten required merge contexts. It consumes four lcov reports produced by the
`coverage` job, and on every run it prints:

```
WARN  Could not resolve 4 file paths in [.../packages/security-audit-collector/coverage/lcov.info,
      .../packages/security-audit-sdk-node/coverage/lcov.info,
      .../packages/security-audit-sdk-core/coverage/lcov.info,
      .../research/browser-telemetry/coverage/lcov.info]
WARN  First unresolved path: packages/security-audit-sdk-core/dist/generated/schema-validator.generated.cjs
```

Observed on `main` run `34518902152`, `sonar` job `103011798005`. The listed reports are every report
the scan was given, not the ones with problems, so the line alone does not say where the four records
are. The four were identified by regenerating all four reports locally and evaluating each `SF:` path
against the scope in `sonar-project.properties`.

## Goals / Non-Goals

**Goals.** No unexplained unresolved-path warning on a green `sonar` run. A record that cannot be
attributed fails the job that *produces* the report, with the path named, rather than warning in the
job that consumes it. The coverage figures of analysed components are unchanged, verified against the
same project key rather than asserted.

**Non-Goals.** Changing what is analysed, changing any coverage threshold, changing the quality gate
or its conditions, or changing what Codecov receives. Re-deciding whether one package's report should
carry records for another package's sources — see D4.

## Decisions

### D1 — Filter the report, do not widen the scope or silence the warning

Three shapes were available. Silencing the warning by adding the excluded paths back to
`sonar.sources` would analyse generated and built output, which #452 had just finished excluding for
the reason that a finding there is not actionable — the fix belongs in the generator. Accepting the
warning and asserting its count keeps a report that describes files the analysis has excluded, and
pins a magic number that changes for a legitimate reason (adding a package that executes built
output) as readily as for a defect.

Filtering the report is the only one of the three that makes the two artefacts agree: after it, the
report describes exactly the components the analyser indexes, and *any* unresolved path is a defect
rather than a known quantity. That is what converts the signal from saturated to meaningful, which is
the point of #442 — the warning itself was never measuring anything wrongly.

### D2 — Derive the scope from `sonar-project.properties`, never restate it

The workflow's existing rewrite step carries a hand-maintained list of four report/prefix pairs. That
is the fifth copy of the declared-package set in this repository, and the previous four each went
stale: the `make` recipes (#412), their notices (#441), the ratified package enumeration (#441), and
`sonar.sources` itself (#452). A filter that carried its own copy of the exclusion globs would be the
sixth.

So the script reads `sonar.javascript.lcov.reportPaths`, `sonar.sources`, `sonar.tests` and
`sonar.exclusions` from `sonar-project.properties` and derives everything else. Each report's package
root is the report path with its trailing `coverage/lcov.info` removed, so the prefix list disappears
entirely rather than being moved. Adding a fifth report to `sonar-project.properties` needs no edit
here; **not** adding one is already a failure of the assertion #452 added.

### D3 — Resolve `..` rather than rely on the analyser resolving it

The Node binding's report reaches sdk-core through `../security-audit-sdk-core/...`. Prefixing that
with the package root produces `packages/security-audit-sdk-node/../security-audit-sdk-core/...`,
which is only equal to `packages/security-audit-sdk-core/...` after normalisation.

Sonar does normalise it. That is not an assumption: if it did not, all seventeen of the Node
binding's cross-package records would be unresolvable and the warning would read `19`. It reads `4`,
which is exactly the two excluded generated files in each of the two reports that carry them. The
script normalises anyway, because the classification decision — analysed component or not — must be
made on the real path, and because a normalised report is what lets the existence check in D5 mean
anything.

### D4 — Drop only what carries no figure, so figures cannot move

The filter drops a record only when its normalised path is outside every `sonar.sources` and
`sonar.tests` root, or is matched by a `sonar.exclusions` glob. Such a file is not an indexed
component, so it holds no coverage measure to change. A record that resolves to an analysed component
is kept even when it was reached across a workspace boundary.

That is what keeps #442's second acceptance criterion satisfiable. The Node binding's report carries
seventeen records for sdk-core sources; Sonar's LCOV parser unions hit counts across reports, so
removing them could lower a component's measured coverage. Whether a package's Sonar coverage figure
ought to be the union of every report that executed it is a genuine question with a genuine answer,
and answering it here would make this change unable to demonstrate the criterion it was filed under.
It is left in place and named as out of scope.

Measured baseline for that verification, read from the server before the change: project `coverage`
94.5, `lines_to_cover` 4590, `uncovered_lines` 152, on project key
`nandohdc_bloodtrail_e3ef77af-1937-442c-b4f1-4fea5eeada74`.

### D5 — Fail closed on the thing the warning was hiding

Filtering alone would remove today's four records and leave the next regression just as quiet: a
rewrite that produced `packages/security-audit-sdk-node/src/clock.ts` when the file had moved would
simply be filtered out as "not an analysed component", and the coverage would vanish silently. That
is a worse failure than the warning.

So the script checks that every rewritten path exists on disk *before* classifying it, and fails
naming the path when it does not. It also fails when a declared report is missing, and when filtering
would leave a report with no records at all. A dropped record is reported on stdout with its reason,
so the step's log states what was removed rather than leaving it to be inferred.

The check is possible only because the script runs in the `coverage` job, where the working tree is
built: `dist/generated/schema-validator.generated.cjs` exists there and is dropped for being excluded,
not for being absent. The `sonar` job, which re-checks out without building, could not distinguish
those two cases.

## Risks / Trade-offs

- **A build artefact that legitimately vanishes fails the job.** If a package stops emitting a file
  its tests executed, the existence check fails rather than filtering the record away. That is the
  intended direction: the alternative is the state this change is fixing.
- **The script parses a `.properties` file with a small reader rather than a library.** The
  repository has zero runtime dependencies and its scripts follow suit. The reader handles the two
  forms this file uses — `key=value` and comments — and fails on a missing key rather than defaulting,
  so a renamed property is a failure and not a silently empty scope.
- **Glob support is deliberately partial.** `**`, `*` and `?` are supported because that is what
  `sonar.exclusions` uses. A pattern form the matcher does not implement would be matched too
  narrowly, so the matcher rejects any pattern containing a construct it does not implement rather
  than quietly under-matching.
- **The `coverage` job gains a failure mode it did not have.** It is a required context, so a defect
  in the script blocks merges. Its controls cover each failing arm against a healthy input that must
  still pass, and the script is exercised on the repository's own four reports.
