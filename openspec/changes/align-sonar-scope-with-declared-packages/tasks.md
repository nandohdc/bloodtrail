## 1. Governed planning and proposal delivery

- [ ] 1.1 Generate and validate the design-pattern assessment for this security-sensitive governance-core change; verify the `governance_core_path` trigger is matched for `sonar-project.properties` and `.github/scripts/`, that the owned-path inventory is closed over both plus the discovery test file and the fold target, and that all fifteen security dimensions are justified.
- [ ] 1.2 Author the `ci-topology` delta as one ADDED requirement; verify it introduces no `MODIFIED` or `REMOVED` section, that its requirement name does not already exist in the ratified spec, and that each scenario states a condition a reader could check.
- [ ] 1.3 Run `openspec validate align-sonar-scope-with-declared-packages --strict`, assessment-phase design-pattern governance, and `git diff --check`; commit only the OpenSpec proposal packet with a Conventional Commit and verify the staged allowlist and an empty index after commit.
- [ ] 1.4 Push and merge a dedicated proposal PR only after all ten required contexts report success on its exact head; verify `origin/main` carries the unchanged packet before implementation is committed.

## 2. Establish the blast radius before moving the scope

- [ ] 2.1 Measure the widened scope with the analyser itself rather than file by file: the implementation PR's own `sonar` run analyses exactly the widened set against the live quality profile and gate, so it is the authoritative measurement and it happens before merge. Record from that run the indexed file count, the quality-gate result, and every condition's actual value; record any finding as a result on the change rather than as a reason to abandon it. Sample at least the largest added file through the analyser beforehand so a catastrophic surprise is caught before the push, and record the sample as a sample, never as coverage of the set.
- [ ] 2.2 Record the quality gate's own conditions from the server rather than from memory, and state why pre-existing findings cannot red it: all three `Sonar way` conditions are new-code only. Verify the two workspaces' coverage reports exist and are produced by the `coverage` job before claiming they can be supplied.
- [ ] 2.3 Record what the widening does **not** cover and why — `openspec/scripts/` and `.github/scripts/` have no coverage report, so under `new_coverage` they would fail the next PR that edits them — so the exclusion is a recorded decision rather than a repetition of the omission this change fixes.

## 3. Widen the scope and assert it

- [ ] 3.1 Add both declared workspaces to `sonar.sources` and `sonar.tests`, their coverage reports to `sonar.javascript.lcov.reportPaths`, their `tsconfig.json` to `sonar.typescript.tsconfigPaths`, and the collector's `src/generated/**` to `sonar.exclusions`; verify each added path exists on disk and that no threshold, quality profile, or project key changes.
- [ ] 3.2 Correct the header comment so it states what is actually scanned, including the recorded exclusions; verify no other claim in the file asserts a completeness it does not have.
- [ ] 3.3 Add `assertSonarScopeCoversDeclaredPackages` to `.github/scripts/check-package-discovery.mjs`, failing closed in both directions, with recorded exceptions named explicitly rather than inferred; wire it into the executable entry point.
- [ ] 3.4 Cover it in `.github/scripts/check-package-discovery.test.mjs`: a declared workspace absent from the scope fails, a scope entry under no declared package fails, adding a sixth package without adding it to the scope fails, and the real file passes. Pair every failing arm with the healthy input that must still pass.

## 4. Verify and deliver the implementation

- [ ] 4.1 Run `npm run check:generated --prefix packages/security-audit-sdk-core` before `validate`, then the full chain across all five workspaces, `openspec validate --all --strict`, final-phase design-pattern governance against a refreshed `main`, the governance dual check, the contract reuse assessment, `node --test .github/scripts/`, `cs delta`, and `git diff --check`; verify all five workspaces and repository governance pass.
- [ ] 4.2 Mutate the new assertion independently — remove a declared workspace from `sonar.sources`, and plant a scope entry under no declared package — and verify each control rejects its own planted change for its own reason, recording any arm that passes with a mutation planted as vacuous rather than as proof; treat no self-authored test and no green CI run as independent review.
- [ ] 4.3 Push the verified commit sequence and open a focused PR using every required template section; record that `sonar-project.properties` and `.github/scripts/` are `governance_core` while `openspec/scripts/check-design-pattern-governance.mjs` is untouched, so the baseline and candidate checker-result boxes are not applicable, and verify the live PR path set and exact head match the local candidate.
- [ ] 4.4 Verify on this change's own CI run that the `sonar` job indexes more files than before and names both newly added workspaces in its log, that the quality gate still reports on the same project key, and that no required context regressed; record the before and after indexed counts from named runs.
- [ ] 4.5 Merge with `--admin` only after rechecking the exact head, base, mergeability, ten-of-ten required contexts, and zero failing checks; verify the merge commit is reachable from `origin/main` before changing lifecycle artifacts.

## 5. Fold and close the lifecycle

- [ ] 5.1 Fold the `ci-topology` delta into `openspec/specs/ci-topology/spec.md` in its own PR, adding the requirement once rather than appending a duplicate; verify by diff that the requirement and each scenario occur exactly once and that no `## ADDED` header survives into the canonical file.
- [ ] 5.2 Verify the folded requirement against the implementation: the scope matches `DECLARED_PACKAGES`, generated output is excluded while its generator is not, both coverage reports are supplied, and the tooling exclusion is recorded with its reason.
- [ ] 5.3 Archive the change by byte-preserving relocation in a dedicated PR, staging source deletions and destination additions together and confirming the archived `tasks.md` carries this group's ticks; validate the archive and exact-head CI, then merge only when all required contexts succeed and close #452 with final evidence.
