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

## 4. Initial verification

- [x] 4.1 Run the full canonical verification and record the result, including the runtime used and whether it is exact-matrix.

## 5. Remediation: repository-wide publication-path exclusion

- [ ] 5.1 Add differential controls proving the gate accepts a publication command reached indirectly: a tracked non-private manifest whose script publishes, a workflow invoking it through `npm run`, and local `.github` automation carrying a publication command. Confirm each fails against the current implementation without ever executing a publication command.
- [ ] 5.2 Extend the gate to scan every tracked package manifest's script bodies and `private` flag, every tracked file under the automation directory, and every local path a workflow references, failing closed on content it cannot read. Preserve the existing command, credential, registry, `.npmrc`, `publishConfig`, comment-stripping, and empty-scan controls unchanged.
- [ ] 5.3 Add a non-vacuity control proving the rejection comes from the manifest-script scan, and a false-positive control proving documentation and lockfile references still pass.

## 6. Remediation: exact reviewed-content binding

- [ ] 6.1 Add differential controls proving a signed record is accepted while claiming one reviewed path and supplying an unrelated path's tree, and for malformed paths, wrong object types, and a path that cannot be resolved under the bound candidate tree.
- [ ] 6.2 Implement the binding: resolve each declared path within the candidate root tree and compare it to the declared object, require every reviewed object to be carried at its path by history reachable from `HEAD`, and reject a reviewed path that contains the governance record itself. Report a candidate root tree that no longer resolves rather than skipping it silently.
- [ ] 6.3 Add a non-vacuity control proving the path/object comparison is what rejects the substitution, and reconcile the governance-record form so the owner's instructions produce exactly the objects the gate compares.

## 7. Remediation: archive-movement attestation anchoring

- [ ] 7.1 Add differential controls proving that an archived file rewritten together with its recorded object passes when the attested source revision is unavailable, and that the attestation for `2026-08-11-attest-archive-movement` is read by no gate.
- [ ] 7.2 Implement the anchor gate: derive the comparison anchor from the commit history shows introduced each archived path, compare both the working-tree archive and the declared inventory against it, verify every declared attestation and its declared anchoring commit, validate archive-path/inventory/mode/object coherence, and report a pending anchor for an archive not yet in history.
- [ ] 7.3 Wire the gate into `validate` and `verify`, migrate the existing attestations by declaring their anchoring commits without rewriting any archived artifact, and replace the `NOT YET ENFORCED` policy text with what is now enforced.
- [ ] 7.4 Add a non-vacuity control proving the anchor comparison is what rejects the coordinated rewrite, and record the residual that a history-derived anchor does not withstand rewriting its own history.

## 8. Re-verification and landing

- [ ] 8.1 Run the full validation chain and strict OpenSpec validation on the revised candidate and record the result, including the runtime used.
- [ ] 8.2 Record the single signed governance record for this change — reviewer, reviewed content object, assurance limitations, authorizations granted and withheld — using the shape this change introduces.
- [ ] 8.3 Archive the change and validate in strict archived mode.
