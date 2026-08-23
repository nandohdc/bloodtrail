## 1. Governance evidence and planning

- [ ] 1.1 Record the full #191 assessment, including the governance-core, security-sensitive, and canonical-capability triggers plus all fifteen security-dimension justifications; verify `node openspec/scripts/check-design-pattern-governance.mjs --change distinguish-empty-governance-range --phase assessment --base <proposal-baseline>` accepts it.
- [ ] 1.2 Validate the proposal, design, delta specification, task plan, and assessment are coherent; verify `openspec validate distinguish-empty-governance-range --strict` passes before implementation begins.

## 2. Regression-first implementation

- [ ] 2.1 Add a focused perimeter regression test for an explicit full-SHA baseline equal to the fixture `HEAD`; verify the test asserts a successful result, that baseline, and exactly zero inspected commits and paths.
- [ ] 2.2 Run the new regression test against the unmodified checker and verify it fails because the empty-range summary is absent rather than because of test setup or an unrelated diagnostic.
- [ ] 2.3 Materialize the resolved baseline and zero inspected commit/path counts in the existing semantic-empty-range branch; verify the focused regression test passes without removing the successful short-circuit.
- [ ] 2.4 Preserve a separate untracked-path null control for the non-identical-ref spelling; verify it still fails closed with `path-unclassified` and reports an inspected path rather than treating that arm as empty.

## 3. Verification

- [ ] 3.1 Run the complete design-pattern-governance test suite; verify every test passes and the targeted regression is included.
- [ ] 3.2 Reproduce both #191 arms in a disposable worktree at the proposal baseline plus candidate overlay; verify `--base <HEAD SHA>` succeeds with the resolved baseline and `0`/`0` counts while `--base origin/main` with one probe fails closed.
- [ ] 3.3 Run strict OpenSpec validation and both trusted-baseline and candidate governance checks; verify the candidate is not its own sole judge and no scope/authorization boundary changed.
- [ ] 3.4 Inspect the final changed-path set and package scope; verify the patch is limited to the checker, perimeter test, active change artifacts, and capability delta with no SDK transport, storage, telemetry, browser, or production integration surface.

## 4. Review and delivery

- [ ] 4.1 Complete read-only technical verification against the exact final technical commit and prepare the required governance record without fabricating human approval; verify the record binds the reviewed commit and content object.
- [ ] 4.2 Obtain an explicit owner decision and required review bound to that exact reviewed commit; verify the evidence is authored by the named owner/reviewer and does not claim independent assurance for self-review.
- [ ] 4.3 Create and verify a focused pull request for #191 after the approved technical/governance commits are pushed; verify its head SHA, changed paths, and all required CI checks are green before any merge action.
- [ ] 4.4 Archive only after identity-preserving merge and authoritative spec fold; verify archive relocation is byte-preserving and does not repeat the canonical spec synchronization.
