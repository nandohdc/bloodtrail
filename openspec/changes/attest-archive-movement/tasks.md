## 1. Record the attestation

- [ ] 1.1 Add a movement attestation block to `verification-lifecycle.json`: the attested source revision, and for every archived path its expected file mode and blob object.
- [ ] 1.2 Populate it for the 2026-08-11 archive against source revision `f03d98b`, verifying each recorded blob matches both that revision's active change and the current archive before recording it.

## 2. Two-path movement resolution

- [ ] 2.1 Extend `resolveMovementSource` to consult the attested source revision, re-deriving from history when it is resolvable and still contains the active change.
- [ ] 2.2 Implement the attested comparison path for an unreachable source revision, comparing archived mode and blob object per path, and preserving the existing `tasks.md` transition rule.
- [ ] 2.3 Ensure fallback is triggered only by an unresolvable source revision, never by a content mismatch, so tampering cannot downgrade the check.
- [ ] 2.4 Report the resolution path used, and on the attested path the source revision that could not be reached.
- [ ] 2.5 Fail an archive that has no recorded attestation.

## 3. Differential controls

- [ ] 3.1 Add controls proving the gate fails on an altered archived file, a changed file mode, an added archived path, and a removed archived path — exercised under both resolution paths.
- [ ] 3.2 Add a control proving an archived `tasks.md` differing by more than the permitted merge-and-archive transitions fails under both paths.
- [ ] 3.3 Add a control proving a resolvable source revision whose content differs from the archive fails rather than falling back.
- [ ] 3.4 Add a control proving an archive with no attestation fails.
- [ ] 3.5 Confirm each control fails before its fix and passes after, so no control is vacuous.

## 4. Documentation and landing

- [ ] 4.1 Record in `CONTRIBUTING.md` that an archive pull request is merged with a merge commit where practical, noting it preserves the stronger re-derived path and is complementary to, not a substitute for, the attestation.
- [ ] 4.2 Run the full canonical verification on `main` and confirm the `sdk` job is green again, recording the runtime used and whether it is exact-matrix.
- [ ] 4.3 Archive the change and validate in strict archived mode, recording its own movement attestation as the new process requires.
