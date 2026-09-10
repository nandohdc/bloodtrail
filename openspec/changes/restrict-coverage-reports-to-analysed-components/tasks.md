## 1. Governed planning and proposal delivery

- [ ] 1.1 Generate and validate the design-pattern assessment for this security-sensitive governance-core change; verify the `governance_core_path` trigger is matched for `.github/workflows/ci.yml`, `.github/scripts/` and `sonar-project.properties`, that the owned-path inventory is closed over the new script, its test, the workflow, the properties file and the fold target, and that all fifteen security dimensions are justified.
- [ ] 1.2 Author the `ci-topology` delta as one ADDED requirement; verify it introduces no `MODIFIED` or `REMOVED` section, that its requirement name does not already exist in the ratified spec, and that each scenario states a condition a reader could check.
- [ ] 1.3 Run `openspec validate restrict-coverage-reports-to-analysed-components --strict`, assessment-phase design-pattern governance, and `git diff --check`; commit only the OpenSpec proposal packet with a Conventional Commit and verify the staged allowlist and an empty index after commit.
- [ ] 1.4 Push and merge a dedicated proposal PR only after all ten required contexts report success on its exact head; verify `origin/main` carries the unchanged packet before implementation is committed.

## 2. Establish the ground truth before changing the reports

- [ ] 2.1 Identify every unresolvable record from the reports themselves rather than from the warning line, which names every supplied report and not the ones at fault. Regenerate all four reports locally, evaluate each `SF:` path against the declared scope, and record the exact set with the exclusion that matches each. Record the observed count from a named `sonar` job so the before state is a measurement.
- [ ] 2.2 Establish whether the analyser normalises parent-directory segments, and record the evidence rather than the assumption: derive it from the observed count against the count that would follow if it did not. Record the consequence for the Node binding's seventeen cross-package records.
- [ ] 2.3 Record the coverage baseline from the server, not from a local report — project `coverage`, `lines_to_cover` and `uncovered_lines` on the project key — so acceptance criterion 2 can be verified against the same project key afterwards rather than asserted.

## 3. Normalise and filter the reports

- [ ] 3.1 Add `.github/scripts/normalize-coverage-reports.mjs`. It SHALL read `sonar.javascript.lcov.reportPaths`, `sonar.sources`, `sonar.tests` and `sonar.exclusions` from `sonar-project.properties`, fail on a missing key rather than defaulting to an empty scope, and derive each report's package root from the report path; verify no source root, exclusion glob, report path or package prefix is restated in the script.
- [ ] 3.2 Rewrite each record's path to a normalised repository-relative path with parent-directory segments resolved, then retain it only when it lies under a declared source or test root and is matched by no exclusion; verify a cross-package record resolving to an analysed component is retained and an excluded one is dropped.
- [ ] 3.3 Fail closed: a missing declared report, a rewritten path that does not exist on disk, and a report left with no records all fail and name what failed. Verify the existence check runs before classification, so an excluded-but-present file is dropped for being excluded and an absent file fails for being absent.
- [ ] 3.4 Support only the glob constructs `sonar.exclusions` uses (`**`, `*`, `?`) and reject a pattern containing any other construct rather than under-matching it; verify rejection is a failure and not a silent pass.
- [ ] 3.5 Report every dropped record with its reason and a per-report kept/dropped summary on stdout, so the step's log states what was removed.
- [ ] 3.6 Replace the `coverage` job's inline `node -e` rewrite with the script, in the same position, deleting the hand-maintained report/prefix pair list rather than correcting it; verify no job, threshold, artifact name, dependency edge or step ordering changes, and record that the Codecov uploads consume the normalised reports because the step they already followed is the one being replaced.
- [ ] 3.7 Record in `sonar-project.properties`, beside the report declaration, why reports legitimately carry records for excluded built and generated output and that the normalizer strips them; verify no scope, threshold, quality profile or project key value changes in that edit.

## 4. Control the controls

- [ ] 4.1 Add `.github/scripts/normalize-coverage-reports.test.mjs` covering, each against a healthy input that must still pass: an excluded record dropped, a record outside every root dropped, an analysed cross-package record retained, a parent-directory path normalised before classification, a non-existent path failing, a missing report failing, an emptied report failing, an unsupported glob construct rejected, and a report of only analysed records passing through byte-identically.
- [ ] 4.2 Mutate the script independently — remove the exclusion check, remove the existence check, and hard-code one source root — and verify each control rejects its own planted change for its own reason; record any arm that passes with a mutation planted as vacuous rather than as proof.
- [ ] 4.3 Run the script against the repository's own four regenerated reports and verify it drops exactly the four records identified in task 2.1 and retains every other record byte-identically.

## 5. Verify and deliver the implementation

- [ ] 5.1 Run `npm run check:generated --prefix packages/security-audit-sdk-core` before `validate`, then the full chain across all five workspaces, `openspec validate --all --strict`, final-phase design-pattern governance against a refreshed `main`, the governance dual check, the contract reuse assessment, `node --test .github/scripts/*.test.mjs`, `cs delta --error-on-warnings`, and `git diff --check`; verify all five workspaces and repository governance pass.
- [ ] 5.2 Push the verified commit sequence and open a focused PR using every required template section; record that `.github/workflows/ci.yml`, `.github/scripts/` and `sonar-project.properties` are `governance_core` while `openspec/scripts/check-design-pattern-governance.mjs` is untouched, so the baseline and candidate checker-result boxes are not applicable.
- [ ] 5.3 Verify on this change's own CI run that the `sonar` job emits no `Could not resolve` warning, and that the `coverage` job's normalisation step reports the expected drops; record both from the named job logs, not from a local run. Record the four Codecov contexts' states as well, since Codecov consumes the filtered reports: verify from `codecov.yml` that every status is `informational: true` rather than relying on the observed state alone.
- [ ] 5.4 Verify acceptance criterion 2 against the server on the same project key: project `coverage`, `lines_to_cover` and `uncovered_lines` after the change match the task 2.3 baseline. Record the values rather than asserting equality.
- [ ] 5.5 Merge with `--admin` only after rechecking the exact head, base, mergeability, ten-of-ten required contexts, and zero failing checks; verify the merge commit is reachable from `origin/main`.

## 6. Fold and close the lifecycle

- [ ] 6.1 Fold the `ci-topology` delta into `openspec/specs/ci-topology/spec.md` in its own PR, adding the requirement once rather than appending a duplicate; verify by diff that the requirement and each scenario occur exactly once and that no `## ADDED` header survives into the canonical file.
- [ ] 6.2 Verify the folded requirement against the implementation: the scope is read rather than restated, an unresolvable record fails the producing job, and analysed components' figures are unchanged.
- [ ] 6.3 Archive the change by byte-preserving relocation in a dedicated PR, staging source deletions and destination additions together and confirming the archived `tasks.md` carries every group's ticks; validate the archive and exact-head CI, then merge only when all required contexts succeed and close #442 with final evidence.
