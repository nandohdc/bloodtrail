## 1. Governed planning and proposal delivery

- [ ] 1.1 Generate and validate the design-pattern assessment for this security-sensitive governance-core change; verify the `governance_core_path` trigger is matched for `CLAUDE.md`, `README.md`, `SECURITY.md`, `.github/workflows/ci.yml` and `.github/scripts/`, that the owned-path inventory is closed over every corrected file, the new checker, its test and the fold target, and that all fifteen security dimensions are justified.
- [ ] 1.2 Author the `ci-topology` delta as one ADDED requirement; verify it introduces no `MODIFIED` or `REMOVED` section, that its requirement name does not already exist in the ratified spec, and that each scenario states a condition a reader could check.
- [ ] 1.3 Run `openspec validate assert-contract-version-currency --strict`, assessment-phase design-pattern governance, and `git diff --check`; commit only the OpenSpec proposal packet with a Conventional Commit and verify the staged allowlist and an empty index after commit.
- [ ] 1.4 Push and merge a dedicated proposal PR only after all ten required contexts report success on its exact head; verify `origin/main` carries the unchanged packet before implementation is committed.

## 2. Establish the whole set before correcting any of it

- [ ] 2.1 Enumerate every occurrence of a superseded canonical contract version in the scan set, across all five declared packages and the repository documents, rather than working from the three the issue names. Record the file, line and asserted claim for each, and record the enumeration on the issue so the correction can be checked against it.
- [ ] 2.2 Classify each occurrence as current-tense or historical, and record the reason for every one left unchanged. Verify each claimed historical reference against the artifact it describes rather than from its wording — in particular that `contracts/security-audit/package.json` really is `1.0.0` and is deliberately independent of the canonical schema version, so the `RELEASING.md` and `docs/adr/0012` rows are correct as written.
- [ ] 2.3 Verify the collector README's claim against running behaviour, not against prose: read `SUPPORTED_CONTRACT_VERSIONS` from the generated bounds and from `scripts/check-package-contents.mjs`, and record that the README contradicts both.
- [ ] 2.4 Record why `check-coherence.mjs`'s `adr-contract` rule cannot hold this property: it asserts presence across concatenated ADRs, never absence, and is sdk-core-scoped. Verify the sdk-core-scoped claim from the script rather than assuming it.

## 3. Assert currency, deriving both versions

- [ ] 3.1 Add `.github/scripts/check-contract-version-currency.mjs`. It SHALL read the current version from `contracts/security-audit/source/contract.source.json` and the superseded set from the `contract` enum in `openspec/governance/schemas/contract-reuse.schema.json`, minus the current version; verify neither version literal is restated in the checker.
- [ ] 3.2 Fail when the current canonical version is absent from that enum, so a version move that updates the contract and not the record fails rather than validating against an incomplete superseded set; verify the arm rejects a planted enum missing the current version.
- [ ] 3.3 Derive the per-package scan roots from `DECLARED_PACKAGES` — top-level `*.md`, `adr/*.md` and `src/**` — and verify a sixth declared package is covered with no further edit.
- [ ] 3.4 Name the non-package repository documents explicitly and assert each exists; verify a renamed document fails rather than silently reducing the checked set.
- [ ] 3.5 Record every excluded tree with its reason in the checker — ratified specs, the protected contract tree, archived changes, agent plans, tests, examples and generated output — and verify no exclusion is present without one.
- [ ] 3.6 Implement `RECORDED_HISTORICAL_REFERENCES` with `path`, optional `quote` and `reason`, failing closed in both directions; verify an occurrence matching no entry fails and an entry matching no occurrence fails.
- [ ] 3.7 Add the invocation to the `design-pattern-governance` job beside the existing package-discovery step; verify no job, threshold, artifact name or dependency edge changes, and record that the required enforcement already holds through `node --test .github/scripts/*.test.mjs` independently of that step.

## 4. Correct the statements, and nothing else

- [ ] 4.1 Correct the seven package statements: `packages/security-audit-sdk-core/{SECURITY.md,adr/008-privacy-extensions.md,src/sdk.ts}` (two occurrences in `sdk.ts`), `packages/security-audit-sdk-node/src/{delivery-retry.ts,http-handoff.ts}`, and `packages/security-audit-collector/README.md`; verify each edit changes prose or a comment only, and that no runtime behaviour, public API, export or generated artifact changes.
- [ ] 4.2 Correct the four repository-document statements in `README.md`, `SECURITY.md` and `CLAUDE.md` (two occurrences), and verify the surrounding claims remain true after the edit — in particular whether "frozen" still holds of a contract that has moved once under governance.
- [ ] 4.3 Correct the `CLAUDE.md` contract-version pin inventory entry that names `adr-contract` as the gate for consumer docs, so it names the gate that actually holds the property; verify no other pin in that table changes.
- [ ] 4.4 Leave every recorded historical reference byte-identical; verify by diff that no file outside the eleven corrected statements and the pin inventory entry changes.

## 5. Control the controls

- [ ] 5.1 Add `.github/scripts/check-contract-version-currency.test.mjs` covering, each against a healthy input that must still pass: a stale current-tense occurrence failing, a recorded exception passing, a stale exception failing, a file-scope exception, the current version absent from the enum failing, a missing named document failing, a newly declared package being covered, and the real repository passing.
- [ ] 5.2 Mutate the checker independently — accept an unrecorded occurrence, drop the stale-exception arm, hard-code the current version, and drop one declared package from the scan roots — and verify each control rejects its own planted change for its own reason; record any arm that passes with a mutation planted as vacuous rather than as proof.
- [ ] 5.3 Plant each of the eleven corrections back in turn and verify the checker rejects it, so the gate is shown to catch the defects it was built for rather than only synthetic ones.

## 6. Verify and deliver the implementation

- [ ] 6.1 Run `npm run check:generated --prefix packages/security-audit-sdk-core` before `validate`, then the full chain across all five workspaces, `openspec validate --all --strict`, final-phase design-pattern governance against a refreshed `main`, the governance dual check, the contract reuse assessment, `node --test .github/scripts/*.test.mjs`, `cs delta --error-on-warnings`, and `git diff --check`; verify all five workspaces and repository governance pass, and that `test:coherence` still passes with `adr-contract` unchanged.
- [ ] 6.2 Push the verified commit sequence and open a focused PR using every required template section; record that `CLAUDE.md`, `README.md`, `SECURITY.md`, `.github/workflows/ci.yml` and `.github/scripts/` are `governance_core` while `openspec/scripts/check-design-pattern-governance.mjs` is untouched, so the baseline and candidate checker-result boxes are not applicable.
- [ ] 6.3 Verify on this change's own CI run that the new step passes and that no required context regressed; record the step's output from the named job log rather than from a local run.
- [ ] 6.4 Merge with `--admin` only after rechecking the exact head, base, mergeability, ten-of-ten required contexts, and zero failing checks; verify the merge commit is reachable from `origin/main`.

## 7. Fold and close the lifecycle

- [ ] 7.1 Fold the `ci-topology` delta into `openspec/specs/ci-topology/spec.md` in its own PR, adding the requirement once rather than appending a duplicate; verify by diff that the requirement and each scenario occur exactly once and that no `## ADDED` header survives into the canonical file.
- [ ] 7.2 Verify the folded requirement against the implementation: both versions are derived, the scan set follows the declared packages, exceptions fail closed in both directions, and every exclusion carries its reason.
- [ ] 7.3 Archive the change by byte-preserving relocation in a dedicated PR, staging source deletions and destination additions together and confirming the archived `tasks.md` carries every group's ticks; validate the archive and exact-head CI, then merge only when all required contexts succeed and close #453 with final evidence.
