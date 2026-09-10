## 1. Governed planning and proposal delivery

- [ ] 1.1 Generate and validate the design-pattern assessment for this security-sensitive CI and gate change; verify the `governance_core_path` trigger is matched for `.github/workflows/ci.yml`, the owned-path inventory is closed over the workflow, the coherence rule, and its controls, and all fifteen security dimensions are justified.
- [ ] 1.2 Run `openspec validate pin-sonar-node-and-reject-floating-majors --strict`, assessment-phase design-pattern governance, and `git diff --check`; commit only the OpenSpec proposal packet with a Conventional Commit and verify the staged allowlist and an empty index after commit.
- [ ] 1.3 Push and merge a dedicated proposal PR only after all ten required contexts report success on its exact head; verify `origin/main` carries the unchanged packet before implementation is committed.

## 2. Bring the analyser job into conformance

- [ ] 2.1 Record from a named CI run both the analyser's own statement of its recommended minimum and the drifted version it resolved, and quote the ratified `ci-topology` requirement the job violates, so the pin is evidenced rather than asserted.
- [ ] 2.2 Change the `sonar` job's `node-version` from the floating `"22"` to the declared release `24.2.0`; verify no other `node-version` in the workflow changes, that `24.2.0` is present in `compatibility.json` `node.ciVersions`, and that no package manifest or dependency file is touched.
- [ ] 2.3 Verify on this change's own CI run that the analyser emits no version-recommendation warning, that `npm ci` in the `sonar` job emits no `EBADENGINE` for `@bloodtrail/security-audit-sdk-core`, and that the quality gate reports on the same project key with no analysis coverage lost.

## 3. Close the gap the drift passed through

- [ ] 3.1 Generalise the floating-tag coherence rule from the literal `26` to any `node-version: "<major>"` and rename its diagnostic to match; verify all six existing exact pins still pass and that the pattern cannot match a dotted release.
- [ ] 3.2 Add a control arm planting a floating `"22"`, the shape the previous rule never named, and retarget the existing floating-`"26"` arm to the new diagnostic; verify the `"22"` arm fails under the widened rule and passes under the old one, so it evidences the widening rather than restating a case already covered.
- [ ] 3.3 Run `npm run validate --prefix packages/security-audit-sdk-core`, `make`, `make governance-gates`, `openspec validate --all --strict`, final-phase design-pattern governance, the governance dual check, the contract reuse assessment, and `git diff --check`; verify all five workspaces and repository governance pass.
- [ ] 3.4 Mutate the pin and the rule independently — restore the floating tag, and narrow the rule back to the literal `26` — and verify each control rejects its own planted change for its own reason, recording any arm that passes with a mutation planted as vacuous rather than as proof; treat no self-authored test and no green CI run as independent review.

## 4. Governed delivery and lifecycle closure

- [ ] 4.1 Push the verified commit sequence and open a focused PR using every required template section; record that `.github/workflows/ci.yml` is `governance_core` while the package-local checker is not, so the baseline and candidate checker-result boxes are not applicable, and verify the live PR path set and exact head match the local candidate.
- [ ] 4.2 Merge with `--admin` only after rechecking the exact head, base, mergeability, ten-of-ten required contexts, and zero failing checks; verify the merge commit is reachable from `origin/main` before changing lifecycle artifacts.
- [ ] 4.3 Archive the change by byte-preserving relocation in a dedicated PR, staging source deletions and destination additions together and confirming the archived `tasks.md` carries this group's ticks; validate the archive and exact-head CI, then merge only when all required contexts succeed and close #434 with final evidence.
