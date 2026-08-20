# Archive Evidence — enforce-archive-relocation-completeness

This change added R25 and the control that enforces it: a range introducing a recognised archive
relocation may not leave the relocated objects at the change's active path at `HEAD`. Its own
archive is therefore the first live exercise of the control, and the completeness assertions below
are the ones R25 now checks mechanically rather than by prose.

## Identities

| Role | Commit |
| --- | --- |
| Proposal baseline | `232376b6ebc76ead6797ddc21470998d4f56a6a6` |
| Proposal (P) | `fd6320c` — `docs(openspec): propose enforcing archive relocation completeness` |
| Technical (T) | `3f872be` — `feat(governance): reject incomplete archive relocations` |
| Plan documents | `62e0975` — `feat(governance): add recovery and activation implementation plan` |
| Merge (M) of PR #187 | `9faf485f9b075da7308cf46a82e200dcc61ac447`, parents `232376b` and `62e0975` |
| Canonical fold | `2de6e07` — `docs(openspec): fold R25 into the canonical governance spec` |
| Merge of PR #188 | `61b0bb78cf784b0c21b4d62a177fd22930355f0a` |
| Archive (A) | this commit |

Both merges are identity-preserving two-parent merges performed by the project owner; neither
squashed, rebased, or amended the reviewed commits.

**Signed governance record: none, and none is required.** `run-governance-dual-check.mjs` fails only
on the self-approval signature — `exitCode()` returns non-zero when the candidate fails, or when the
baseline rejects what the candidate accepts. A strictly stricter candidate produces the opposite
shape, so no `baselineDisagreementAcceptance` and therefore no signed record is involved.
`verifySignedReviewFreshness` binds records that exist; a change that has never been signed is a
legitimate pre-signing technical state. No record was created, and none is claimed.

## Task completeness

13 of 13 tasks complete. Group 1 (control and tests), group 2 (documentation), and group 3
(verification and landing) each completed in order. Tasks 3.3 and 3.5 — owner merge and archive —
remained unchecked while the change was active and are discharged by the merges above and by this
commit.

## Canonical capability presence

R25 is present in `openspec/specs/software-design-pattern-governance/spec.md`, which now carries 25
requirements. The fold was made **while this change was still active**, in its own commit `2de6e07`,
merged as PR #188 before this archive was prepared.

That ordering is mandatory, not stylistic. `ownedPathsFor` (`perimeter.mjs:261-272`) drops
`openspec/specs/<capability>/` from a change's coverage the moment the change is relocated, and no
other active change declares `software-design-pattern-governance`. Folding inside this archive
commit would have put the relocation and the canonical spec edit in one range, collapsing coverage
to the archive directory and failing closed with `openspec-association-unrelated`; omitting the fold
would have passed and left R25 out of the canonical spec permanently.
`openspec/changes/archive/2026-08-18-cover-bundle-archive-spec-fold/` exists because of this same
ordering. Syncing while active avoided needing a keeper change at all.

Verified before archiving: R25's requirement body matches the delta wrap-insensitively, all three
scenarios are present, and no delta operation header (`## ADDED/MODIFIED/REMOVED/RENAMED
Requirements`) leaked into the main spec.

## Production / publication restrictions

No production or publication authorization is granted, implied, or inherited. This change added no
runtime code, no dependency, and no public API. `dependencies`, `peerDependencies`, and
`optionalDependencies` remain empty; the SDK remains unpublished and the authorization boundary is
unchanged. These exclusions are discharged by the gates that enforce them — `test:scope`,
`test:publication-path`, `test:dependencies`, `test:package` — all of which pass in the recorded
`validate` runs.

## Immutable archive contents, exact changed paths, byte identity

The relocation was staged with `git mv`, so the commit carries both the additions and the deletions.
Every relocation artifact moved byte-identical:

| Path | Blob | Across the move |
| --- | --- | --- |
| `.openspec.yaml` | `41c30bab8881` | identical |
| `assessment.json` | `67bfd1b2c99f` | identical |
| `proposal.md` | `76f19486d561` | identical |
| `design.md` | `22271b2b9ad3` | identical |
| `specs/software-design-pattern-governance/spec.md` | `423fa359426d` | identical |

Exactly two paths are not byte-identical, both intentionally: `tasks.md`, reconciled here to record
task 3.5, and `archive-evidence.md`, added here. The changed paths of this commit are exactly the
active-directory removal, the dated-archive addition, and those two — and unlike the assertion this
change exists because of, that claim is now checked mechanically by R25 rather than resting on this
sentence.

## Self-coverage of this relocation

While active, this change declared `software-design-pattern-governance` and owned the four
implementation paths named in its assessment. `carriesRelocatedArtifact` recognises this archive as a
genuine relocation because `assessment.json` and `proposal.md` are the exact objects history carried
at the active path, so `ownedPathsFor` grants the dated archive directory and the relocation covers
itself. No other change was needed to cover it.

## Active enforcement verified

The control was proven to fail on the defect that motivated it before being trusted. `057d457` — the
commit that archived `cover-local-instruction-control-paths` by addition only, `5 files changed, 246
insertions(+)` with no deletion line — is unreachable from every ref and survives only in one
workstation's reflog. It was captured as a patch and replayed onto its real parent `1b69590`, which
is on `main`. Against that identical tree:

| Checker | Result |
| --- | --- |
| Baseline from `main` | passed, exit 0 — the gap, reproduced |
| Candidate | failed, `archive-relocation-incomplete`, exit 1 |
| Candidate after staging the removal | passed, exit 0 |

The diagnostic is a `sink.fail`: it appears under `failures` with `warnings` empty and the process
exits non-zero. The durable proof is the fixture in
`openspec/tests/design-pattern-governance/archive-completeness.test.mjs`, which reproduces the same
committed end state without depending on any historical object; the replay depended on a commit that
will expire from that reflog.

Candidate and baseline produced identical diagnostics on all four `2026-08-19-*` archive commits
(`fd2ff14`, `71aa458`, `a34e6ad`, `3a581fa`), so no existing archive newly fails.

Gate results for this archive commit are recorded in the pull request. The dual check now reports the
same checker blob on both sides, because the control merged in PR #187 and the trusted baseline from
`main` contains it.

## Review findings acted on

An adversarial review of the implementation found a genuine correctness defect after the branch had
already passed every gate, and it was fixed before merge rather than deferred:

- **The range test alone did not hold the property it claimed.** A range whose `base` predates the
  archive can contain both a *completed* relocation and a legitimate re-opening of the same id;
  neither archive exists at `base`, so the control rejected correct work. A second condition now
  carries the distinction — a relocated artifact must still resolve to the same object at the active
  path — and a fifth test case covers the shape the original three missed.
- **The diagnostic message exceeded `DiagnosticSink`'s 240-character cap** for change ids this
  repository already has (measured 251 and 253) and was truncated mid-word.
- **The governance document stated a commit-scoped rule** the range-scoped control does not enforce.
- **No test asserted the diagnostic's path**, which the dual check compares as an id-and-path pair.
- **`tasks.md` had no spec-fold task**, the omission that would have left R25 out of the canonical
  spec.

## What is not verified

- **A relocation split across two ranges** escapes the second range, because `base` already carries
  an artifact at the archive path. Measured: the first range in that sequence is itself rejected, so
  the sequence cannot land through the gate.
- **An incomplete relocation that landed before this control existed** is never re-examined. Nothing
  is in that state: `git ls-tree HEAD openspec/changes/` lists only `archive`.
- **The working-tree fold stays.** `collectRangePaths` folds working-tree and untracked paths in
  every phase, so a local run and a CI run can disagree in both directions. Deliberately out of
  scope, and not the root cause: removing it would not have caught `057d457`, because CI ran with no
  working tree at all and passed anyway.
- **R25 is not proof of a well-formed archive.** It answers one question — did the commit contain
  both halves of the move. Byte identity, honest task reconciliation, and evidence matching the
  commit remain human obligations under R24.
- **AI-produced analysis informed this change and this document.** It is not review, approval, or
  assurance, and approval is not inferred from passing tests, checked tasks, PR state, or merged
  state.
