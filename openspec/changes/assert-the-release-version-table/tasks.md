## 1. Governed planning and proposal delivery

- [ ] 1.1 Generate and validate the design-pattern assessment for this security-sensitive governance-core change; verify the `governance_core_path` trigger is matched for `RELEASING.md` and `.github/scripts/`, that the owned-path inventory is closed over the document, the checker, its test, the change packet and the fold target, and that all fifteen security dimensions are justified.
- [ ] 1.2 Author the `release-versioning-tag-model` delta as two `MODIFIED` requirements and one `ADDED`; verify every existing scenario in both modified blocks is carried through, that no requirement is removed, and that each new scenario states a condition a reader could check.
- [ ] 1.3 Run `openspec validate assert-the-release-version-table --strict`, assessment-phase design-pattern governance, and `git diff --check`; commit only the OpenSpec proposal packet with a Conventional Commit and verify the staged allowlist and an empty index after commit.
- [ ] 1.4 Push and merge a dedicated proposal PR only after all ten required contexts report success on its exact head; verify `origin/main` carries the unchanged packet before implementation is committed.

## 2. Establish what is stale before changing any of it

- [ ] 2.1 Read every version from its own artifact rather than from prose: each declared workspace's `package.json`, each `compatibility.json` `package.version`, and the `expected.packageVersion` constant in `check-coherence.mjs`. Record which agree and which do not.
- [ ] 2.2 Enumerate every candidate-version literal in `openspec/specs/release-versioning-tag-model/spec.md` and classify each as a stale current-tense assertion or a legitimate reference. Verify the contract row's `1.0.0` against `contracts/security-audit/package.json` rather than assuming it shares the schema version.
- [ ] 2.3 Record why correcting `RELEASING.md` alone would be wrong — the ratified spec asserts the same stale value, so the document would become non-conformant — and record it on #462 so the enlarged shape is visible before the implementation lands.

## 3. Restate the ratified text against the pin

- [ ] 3.1 Restate *Version ownership is explicit per artifact* so it names no candidate version literal, pinning conformance to each candidate's `compatibility.json` `package.version` and the `package-version` coherence rule; verify every existing scenario is carried through and that the contract and research literals are unchanged.
- [ ] 3.2 Restate *The repository and SDK package version namespaces stay independent* on the same basis; verify its three scenarios are carried through with only the stale literal replaced.
- [ ] 3.3 Add the scenario that asserts the capability's ratified text names no candidate version literal, so this cannot recur silently.
- [ ] 3.4 Verify by diff against the pre-change canonical file that no requirement and no scenario is dropped, and that the only semantic change is the removal of the candidate literals.

## 4. Correct the table and assert it

- [ ] 4.1 Correct `packages/security-audit-sdk-core` to the version its `package.json` carries, and add rows for `packages/security-audit-sdk-node` and `packages/security-audit-collector` with what governs each; verify the contract and research rows stay byte-identical and that no release mechanism, precondition or bump rule changes.
- [ ] 4.2 Add `assertReleaseVersionTableCoversDeclaredPackages` to `.github/scripts/check-package-discovery.mjs`: coverage against `DECLARED_PACKAGES` failing closed in both directions, and each row's version compared against that workspace's own `package.json`; verify no version literal and no workspace list is restated in the checker.
- [ ] 4.3 Parse the rows structurally and fail on a row that cannot be parsed, rather than skipping it; verify an unparseable row is a failure and not a silent pass.
- [ ] 4.4 Wire it into the executable entry point beside the existing assertions.

## 5. Control the controls

- [ ] 5.1 Cover it in `.github/scripts/check-package-discovery.test.mjs`, each failing arm paired with the healthy input that must still pass: a declared workspace absent from the table fails, a row under no declared workspace fails, a row whose version differs from its `package.json` fails, an unparseable row fails, adding a sixth declared package without a row fails, and the real document passes.
- [ ] 5.2 Mutate the assertion independently — drop the coverage direction, drop the stray-row direction, and compare the version against a constant instead of the manifest — and verify each control rejects its own planted change; record any arm that passes with a mutation planted as vacuous rather than as proof.
- [ ] 5.3 Plant the original stale table back and verify the assertion rejects it, so the gate is shown to catch the defect it was built for.

## 6. Verify and deliver the implementation

- [ ] 6.1 Run `npm run check:generated --prefix packages/security-audit-sdk-core` before the workspace chains, the matrix-safe product loop and every targeted sdk-core gate, both bindings' and the contract's `validate`, `openspec validate --all --strict`, final-phase design-pattern governance against a refreshed `main`, `node --test .github/scripts/*.test.mjs`, `cs delta --error-on-warnings`, and `git diff --check`; record any chain step the host cannot run rather than claiming it.
- [ ] 6.2 Push the verified commit sequence and open a focused PR using every required template section; record that `RELEASING.md` and `.github/scripts/` are `governance_core` while `openspec/scripts/check-design-pattern-governance.mjs` is untouched, so the baseline and candidate checker-result boxes are not applicable.
- [ ] 6.3 Verify on this change's own CI run that the new assertion passes and that no required context regressed; record the step's output from the named job log rather than from a local run.
- [ ] 6.4 Merge with `--admin` only after rechecking the exact head, base, mergeability, ten-of-ten required contexts, and zero failing checks; verify the merge commit is reachable from `origin/main`.

## 7. Fold and close the lifecycle

- [ ] 7.1 Fold the `release-versioning-tag-model` delta into its canonical spec in its own PR, replacing both modified requirement blocks in place and adding the new requirement once; verify by diff that no requirement or scenario is duplicated and that no `## MODIFIED` or `## ADDED` header survives into the canonical file.
- [ ] 7.2 Verify the folded requirements against the implementation: no candidate version literal remains in the capability, the table covers every declared package, and each row's version is checked against its own manifest.
- [ ] 7.3 Archive the change by byte-preserving relocation in a dedicated PR, staging source deletions and destination additions together and confirming the archived `tasks.md` carries every group's ticks; validate the archive and exact-head CI, then merge only when all required contexts succeed and close #462 with final evidence.
