## 1. Merge and history integrity gate

- [x] 1.1 Define the governance manifest shape — reviewed subtree, reviewed commit, declared merge commits with expected parent counts, and withheld authorizations — and settle the design's open question by choosing whether it lives per change or as a generalization of `verification-lifecycle.json`.
- [x] 1.2 Implement the gate: verify each declared merge commit's actual parent count against its declared expectation, that every bound commit is an ancestor of `HEAD`, and that every declared governed commit resolves. Fail with the specific property and the actual value.
- [x] 1.3 Add differential mutation controls proving the gate fails on a squash merge declared as a merge commit, on a bound commit that is not an ancestor, and on an unresolvable commit. Confirm each control fails before the fix and passes after.
- [x] 1.4 Wire the gate into `validate` and `verify`, and confirm it detects the historical `71dbd953` squash when that commit is declared as a merge commit.

## 2. Publication-path exclusion gate

- [x] 2.1 Implement the check asserting no workflow contains `npm publish`, a registry reference, or a publication token, so the "no publication path exists" claim is enforced rather than hand-verified.
- [x] 2.2 Add a differential control proving the check fails when a publish step is introduced into a workflow.
- [x] 2.3 Wire the check into `validate` and `verify`.

## 3. Capability and documentation

- [x] 3.1 Land the `change-governance` capability delta.
- [x] 3.2 Update `CONTRIBUTING.md`: the proportionate governance path, citing gates instead of restating exclusions, content-object binding, superseding in version control rather than in-document, and guidance that a task must change the repository rather than assert something.
- [x] 3.3 Update the `README.md` validation gate table with the two new gates.

## 4. Verification and landing

- [x] 4.1 Run the full canonical verification and record the result, including the runtime used and whether it is exact-matrix.
- [ ] 4.2 Record the single signed governance record for this change — reviewer, reviewed content object, assurance limitations, authorizations granted and withheld — using the shape this change introduces.
- [ ] 4.3 Archive the change and validate in strict archived mode.
