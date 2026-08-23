# Archive Evidence — classify-unclassified-governance-paths

This archive records the completed lifecycle for repository-wide path classification completeness. Nine tracked paths matched no declared classification pattern, so any commit touching one failed closed with `[path-unclassified]` regardless of what it did; the classifications and the completeness control landed together in PR #204, the canonical requirement was folded while the change was active in PR #205, and this commit performs the complete active-to-archive relocation.

## Identities

| Role | Commit |
| --- | --- |
| Proposal baseline | `b8a54e8fe8dbdb0902f94f9f7d7d7b2addd9809d` — the `ordering.proposal_baseline_commit` recorded in `assessment.json` |
| Proposal and implementation | `e12a3c5b8c15ced1f96a7d9dafd0e75c4a254451` — `feat(governance): classify every tracked repository path` |
| Exact implementation head | `5dbe523b434a8422339348c98b3e2ee1f81c3036` — `docs(openspec): record post-commit verification evidence for task 3.6` |
| Implementation merge M1, PR #204 | `6e9adb5d10957b36bec015ddfb0e96c2cb5d700b` |
| Canonical fold F | `fadb4e940fe976ba17e610c12e504854811c51bd` — `docs(openspec): fold path classification completeness into the canonical spec` |
| Exact fold head | `bad7d81fd4782800eb21e431f7c29e395ab67fdf` — `docs(openspec): record the release PR governance result for task 4.2` |
| Canonical fold merge M2, PR #205 | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Task 3.2 acknowledgement | `d283e2d30ece70814cf0efb39603be396cfab62d` — `docs(openspec): acknowledge the documentation_only widening in the assessment` |
| Archive A | this commit |

M1 is an identity-preserving two-parent owner merge of prior main `b8a54e8fe8dbdb0902f94f9f7d7d7b2addd9809d` and exact implementation head `5dbe523b434a8422339348c98b3e2ee1f81c3036`; both resolve to tree `e9ff6d53bf74ca4c04fe49cc2b1e45da532f24b6`. M2 is an identity-preserving two-parent owner merge of prior main M1 and exact fold head `bad7d81fd4782800eb21e431f7c29e395ab67fdf`; both resolve to tree `3e0c524ea7cf889aa2247c7459d3d7a87e79fb88`.

The task 3.2 acknowledgement and this relocation are two separate commits of the same pull request, in that order, so no normative artifact edit is mixed into the archive commit.

**Signed governance record: none.** No signed governance record exists for this change, none is required by its established unsigned lifecycle state, and none is inferred. `verification-lifecycle.json` was not edited by this lifecycle. AI review, green checks, PR assignment, mergeability, and merged state are not human or organizational approval, certification, or assurance.

**Ordering, stated exactly.** `proposal.md`, `design.md`, `assessment.json`, `tasks.md`, and the implementation landed together in `e12a3c5`; there was no separate proposal commit. `assessment.json` records only `ordering.proposal_baseline_commit`, leaving `assessment_commit` and `earliest_governed_implementation_commit` unset, so no assessment-before-implementation ordering was claimed by this change and none was mechanically verified.

## R14 acknowledgement and its gap

Moving `version.txt` and `.release-please-manifest.json` into `documentation_only` broadens a benign path class. R14's "Path classification is silently widened" scenario says baseline verification SHALL reject such a broadening without acknowledgement.

The widening is acknowledged in `proposal.md`, in `design.md` D5, in `docs/adr/0005-classify-every-tracked-repository-path.md`, and — since `d283e2d` — in `assessment.json` as a sixth force naming both paths. **No gate implements that scenario.** A search of `openspec/scripts/` and `openspec/governance/schemas/` finds no rule enforcing it and no acknowledgement field; the assessment schema is closed, which is why the acknowledgement is carried as a force rather than as a dedicated field, and why no candidate approach lists it under `forces_addressed`. The acknowledgement is therefore procedural, and this lifecycle does not claim a gate verified it. Closing that gap is tracked as issue #203 and is deliberately not folded in here, because implementing an R14 rule changes what governance rejects for every future change.

## Task completeness

All 26 of 26 tasks are complete. Task 3.2 was completed in `d283e2d`, the first commit of this pull request, after the fold merged. Task 4.3 is self-referential in the established archive convention: this commit contains the complete relocation, while its commit hash is reported after storage rather than bound inside itself.

Issue #202, which this lifecycle refs, is left open deliberately: no task in this change closes it, and closing it is the owner's call.

## Canonical capability presence

`R26 — Path classification is complete over the tracked repository` is present exactly once in `openspec/specs/software-design-pattern-governance/spec.md`, with all six scenarios. The canonical governance specification contains 26 requirement headers and zero `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`, or `## RENAMED Requirements` operation headers. The delta body of `specs/software-design-pattern-governance/spec.md` below its `## ADDED Requirements` header occurs verbatim exactly once in the canonical text.

F folded the requirement while the change was active, and M2 merged that fold before this archive was prepared. This sequencing is mandatory: once relocated, the change no longer receives canonical capability-spec coverage from `ownedPathsFor`. Therefore this archive commit does not touch `openspec/specs/**` and does not repeat the sync.

## Production / publication restrictions

No production or publication authorization is granted, implied, or inherited. This lifecycle added no production transport, exporter, collector, broker, queue, outbox, storage, SIEM integration, analytics, detection, browser telemetry, audit-log chaining, real-user processing, publication path, runtime dependency, contract change, generated contract artifact, npm script, or public API authorization. `git diff --name-status b8a54e8 HEAD` names fourteen paths, none of them under `packages/` or `contracts/`: the SDK and the frozen `1.0.0` contract are untouched, byte for byte. Classifying `version.txt` and `.release-please-manifest.json` records what class those paths carry; it authorizes no release and no publication, and a `vX.Y.Z` tag still lifts no authorization boundary. Bloodtrail remains canonical; OCSF remains export-only, OpenTelemetry transport-only, and CloudEvents envelope-only.

## Immutable archive contents, exact changed paths, byte identity

The six active artifacts were resolved at M2 and at `d283e2d` and compared with the moved filesystem bytes:

| Path | M2 blob | Blob in this commit | Relation |
| --- | --- | --- | --- |
| `.openspec.yaml` | `6529e830bb22daa9e47d1e74bcfcfb603b7bcb63` | `6529e830bb22daa9e47d1e74bcfcfb603b7bcb63` | byte-identical to M2 |
| `assessment.json` | `12a95c9776945f294e5b8b7af3fdbdaeae0f8fac` | `5b1c1b6b00edebf5b2270c640569e3d3fc13ce96` | changed by `d283e2d` for task 3.2, then moved unmodified |
| `design.md` | `eeaa300c54a52ecfdd4f01845b8eed4e26a3cb4e` | `eeaa300c54a52ecfdd4f01845b8eed4e26a3cb4e` | byte-identical to M2 |
| `proposal.md` | `137980010cb6eb8ca54b37dca7c8c704becfef2a` | `137980010cb6eb8ca54b37dca7c8c704becfef2a` | byte-identical to M2 |
| `specs/software-design-pattern-governance/spec.md` | `58e9b3ea50692e61b39ba052c18420368d11e33e` | `58e9b3ea50692e61b39ba052c18420368d11e33e` | byte-identical to M2 |
| `tasks.md` | `4d7c1b17f31f9bbde9f0f3a08252df57cb4141f7` | reconciled in this commit | changed by `d283e2d` for task 3.2, then by this commit for task 4.3 |

Four of the six artifacts are byte-identical to M2 and were moved unmodified. `assessment.json` carries exactly the one-force addition committed in `d283e2d` and is moved unmodified by this commit. `tasks.md` is the only moved artifact this commit modifies, solely to reconcile task 4.3, and `archive-evidence.md` is the only new artifact. The committed geometry is seven archive additions and six active-path deletions under `git show --name-status --no-renames`; no active change path remains, and `openspec/changes/` contains only `archive/`.

## Self-coverage of this relocation

`carriesRelocatedArtifact` recognises this archive on both relocation artifacts. `proposal.md` blob `137980010cb6eb8ca54b37dca7c8c704becfef2a` is the exact object history carried at `openspec/changes/classify-unclassified-governance-paths/proposal.md` from `e12a3c5` onward, and `assessment.json` blob `5b1c1b6b00edebf5b2270c640569e3d3fc13ce96` is the exact object `d283e2d` carried at that active path. `ownedPathsFor` therefore grants this dated archive directory to the relocation itself, and no keeper change is needed: like `reject-undeclared-platform-coupling`, this change folded its canonical capability requirement in a separate range while still active.

R25 relocation completeness holds: the range introduced this archive directory, and no relocated artifact remains at the active path at `HEAD`, because the deletions are staged alongside the additions rather than left in the working tree.

## Active enforcement verified

The control was proven RED before it was wired. Task 1.10 records that 8 of the 10 arms fail against the pre-change checker and all 10 pass against the candidate; the two that pass in both — `M-CL-D` and `M-CL-E` — are negative controls, which must pass either way. Every arm runs the real checker against a disposable clone, never the live tree.

The arms cover each failure class the requirement names: a tracked path matching no pattern (`M-CL-A`, asserting the diagnostic path list equals exactly that path), two such paths (`M-CL-B`, asserting both are named in code-point order, so one edit fixes the whole gap), coverage withdrawn by deleting a pattern (`M-CL-C`), a path added together with its classification (`M-CL-D`, exit 0), untracked and git-ignored files (`M-CL-E`, no obligation), unreadable tracked-path enumeration (`M-CL-F`, requiring `tracked-paths-unavailable` and asserting the count is not reported as zero), and an R21 emergency record offered as completeness evidence (`M-CL-G`, requiring `path-classification-incomplete` while `path-unclassified` is absent). The unmutated null control asserts `classifiedPaths` equals the fixture's own `git ls-files` count and is greater than zero, so an enumeration failure cannot read as trivially complete.

Exit status alone is never the assertion. Task 1.9 records that with 80 uncovered paths the planted content marker is absent from stdout and stderr, every message stays within 240 characters, and no reported path carries a control character.

Task 2.3 records that classifying all 485 tracked paths under the previous and the candidate policy yields exactly 9 differences, every one `unclassified ->` its new class, with no already-classified path reclassified. Task 2.6 records `classifiedPaths: 485` with no failures and no warnings, matching `git ls-files | wc -l`.

All eighteen required and external PR contexts passed at exact implementation head `5dbe523b434a8422339348c98b3e2ee1f81c3036` on PR #204, and all eighteen passed again at exact fold head `bad7d81fd4782800eb21e431f7c29e395ab67fdf` on PR #205, including `sdk`, `contract`, `sonar`, `conventional-commits`, `codescene delta`, and `design-pattern-governance`.

This archive candidate was verified locally with an empty Git index before staging: `openspec validate --strict`, the 211-test governance suite, `test:changed-paths`, and `test:git` all pass, and the post-commit final-phase governance result over this commit — together with the candidate/baseline dual check against M2 — is reported on the pull request rather than inside the artifact it measures.

## What is not verified

- **The R14 widening acknowledgement is not mechanically enforced.** No rule implements the scenario and the assessment schema has no acknowledgement field; the acknowledgement is procedural. Tracked as issue #203.
- **Completeness proves coverage, not correctness.** The control proves every tracked path matches some declared pattern. It does not and cannot judge whether the class assigned is the right one — that `.gitignore` belongs in `governance_core` rather than `documentation_only` is a human decision recorded in ADR 0005, not a verified property.
- **The bound is tracked paths.** Untracked and git-ignored files impose no obligation by design, so a file that exists in a working tree or a CI checkout without being tracked is outside the requirement entirely.
- **The classification of `.github/scripts/` covers `path_classes` only.** `governance_core_artifacts` and `normative_paths` are separate lists and were deliberately not widened; what R14 demands of a future change that edits those scripts is therefore unchanged by this lifecycle.
- **The completeness rule runs inside a change-scoped gate.** A pull request can fail for a path it never touched. That is intended, and it means a green run on one branch is not evidence that an unrelated branch is complete.
- Archive relocation checks prove committed-tree removal completeness, not archive well-formedness, byte identity, honest task reconciliation, or the correctness of this evidence.
- AI-produced analysis is not review, approval, certification, or assurance, and no such status is inferred from checked tasks, passing gates, PR state, or merge state.
