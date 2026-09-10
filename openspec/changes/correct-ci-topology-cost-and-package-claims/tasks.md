## 1. Governed planning and proposal delivery

- [ ] 1.1 Generate and validate the design-pattern assessment for this security-sensitive governance-core change; verify the `governance_core_path` trigger is matched for `CLAUDE.md`, `AGENTS.md`, `Makefile` and `.github/scripts/`, that the owned-path inventory is closed over those paths and the discovery test file, and that all fifteen security dimensions are justified.
- [ ] 1.2 Author the `ci-topology` delta as three whole replaced requirement blocks; verify by diffing each block against the ratified text that every existing scenario survives, that no obligation is dropped, and that the delta contains no `ADDED` or `REMOVED` section it does not intend.
- [ ] 1.3 Run `openspec validate correct-ci-topology-cost-and-package-claims --strict`, assessment-phase design-pattern governance, and `git diff --check`; commit only the OpenSpec proposal packet with a Conventional Commit and verify the staged allowlist and an empty index after commit.
- [ ] 1.4 Push and merge a dedicated proposal PR only after all ten required contexts report success on its exact head; verify `origin/main` carries the unchanged packet before implementation is committed.

## 2. Assert the claims that drifted

- [ ] 2.1 Add `assertPartialTargetDisclosure` to `.github/scripts/check-package-discovery.mjs`: for every non-covering `make` target, each declared workspace the recipe does not invoke SHALL be named in that target's messages; verify it fails closed in both directions by planting an undisclosed skipped workspace and a workspace named as skipped while actually invoked.
- [ ] 2.2 Compute coverage from a recipe's command lines and disclosure from its message lines, so naming a workspace in an `@echo` can no longer satisfy `assertMakefileCoverage`; verify with a control that a recipe mentioning a workspace only in a message is reported uncovered, and that the real `Makefile` still passes both assertions.
- [ ] 2.3 Assert that no bare `~<digits>s` cost literal appears in the `Makefile` outside its cost-variable block, so a hand-typed figure cannot reintroduce the `help`-versus-recipe divergence; verify the arm fails on a planted literal and passes on the real file.
- [ ] 2.4 Wire every new assertion into the executable entry point and `node --test .github/scripts/`, pairing each failing arm with the healthy input that must still pass; verify no arm passes with its mutation planted, recording any that does as vacuous rather than as proof.

## 3. Bring the command surface and the instructions into conformance

- [ ] 3.1 Define each target's cost once as a `make` variable and reference it from every statement of that cost, including `help`; verify `make help` and each recipe now expand to the same string and that the `~26s`/`~34s` and `~299s`/`~307s` divergences are gone by construction rather than by correction.
- [ ] 3.2 Correct the `sdk`, `contract` and `research` notices to name every declared workspace they do not invoke; verify each names `packages/security-audit-collector` and that `assertPartialTargetDisclosure` passes on the corrected file and failed on the previous one.
- [ ] 3.3 Restate every runtime figure in `CLAUDE.md`, `AGENTS.md` and the `Makefile` with the measurement it came from, and record the measurement method once; verify each figure names a CI run or a host and date, and that the recorded local figures match the measurement log rather than being rounded to a nicer number.
- [ ] 3.4 State in the instructions that these figures vary with host load and CI runner contention and are guidance rather than a threshold, citing the observed `test:verification` spread across seven consecutive green `main` runs and the two local runs; verify the cited numbers against the job logs rather than restating them from the issue.
- [ ] 3.5 Add the contract-version pin inventory to `CLAUDE.md`'s "Gates that will bite you", including that the CRA pin validates the reviewed baseline and so passes exactly once — for the version-move PR itself; verify every pin in the inventory by locating it in the working tree, and verify the inventory is complete by searching for the current contract version outside the generated artifacts.

## 4. Verify and deliver the implementation

- [ ] 4.1 Run `npm run check:generated --prefix packages/security-audit-sdk-core` before `validate`, then the full chain across all five workspaces, `openspec validate --all --strict`, final-phase design-pattern governance against a refreshed `main`, the governance dual check, the contract reuse assessment, `node --test .github/scripts/`, and `git diff --check`; verify all five workspaces and repository governance pass.
- [ ] 4.2 Mutate each new assertion independently — remove a workspace from a partial notice, move a workspace's only mention into an `@echo`, and plant a bare cost literal — and verify each control rejects its own planted change for its own reason; treat no self-authored test and no green CI run as independent review.
- [ ] 4.3 Push the verified commit sequence and open a focused PR using every required template section; record that `CLAUDE.md`, `AGENTS.md`, `Makefile` and `.github/scripts/` are `governance_core` while `openspec/scripts/check-design-pattern-governance.mjs` is untouched, so the baseline and candidate checker-result boxes are not applicable, and verify the live PR path set and exact head match the local candidate.
- [ ] 4.4 Merge with `--admin` only after rechecking the exact head, base, mergeability, ten-of-ten required contexts, and zero failing checks; verify the merge commit is reachable from `origin/main` before changing lifecycle artifacts.

## 5. Fold and close the lifecycle

- [ ] 5.1 Fold the `ci-topology` delta into `openspec/specs/ci-topology/spec.md` in its own PR, replacing each modified block whole rather than appending; verify by diff that no requirement is duplicated, that every scenario named in the delta is present exactly once, and that the package-set contradiction between the two requirements is gone.
- [ ] 5.2 Verify the folded spec against the implementation: the enumerated packages match `DECLARED_PACKAGES`, no ratified requirement pins an absolute gate runtime, and each new scenario has a corresponding control or a documented reason it is not mechanically assertable.
- [ ] 5.3 Archive the change by byte-preserving relocation in a dedicated PR, staging source deletions and destination additions together and confirming the archived `tasks.md` carries this group's ticks; validate the archive and exact-head CI, then merge only when all required contexts succeed and close #444, #424, #441 and #426 with final evidence.
