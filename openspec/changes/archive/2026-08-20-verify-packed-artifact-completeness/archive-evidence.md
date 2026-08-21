# Archive Evidence — verify-packed-artifact-completeness

This archive records the completed lifecycle for packed artifact completeness verification. The capability requirement was folded while the change was active, issue #70 was closed with exact-commit evidence after that fold merged, and this commit performs the complete active-to-archive relocation.

## Identities

| Role | Commit |
| --- | --- |
| Proposal | `3e3d885926c490394be340ab52a4d6b96d463dae` — `docs(openspec): propose packed artifact completeness verification` |
| Initial implementation | `836a2bd88811ffa0bcf63e3164041540d900417e` — `feat(sdk): verify packed artifact completeness in the package gate` |
| Control complexity reduction | `f64b1d0df978a56e6c7bf460c46891099a340f29` — `fix(sdk): reduce packed completeness control complexity` |
| Package gate exit handling | `70b6cd65329e916ad46cf5a49df54a6c356cbaf8` — `fix(sdk): avoid explicit process exit in package gate` |
| Exact implementation head | `6cbcbff55f9f53efaf2363af0a17f02f201ddfe1` — `fix(sdk): satisfy Sonar packed diagnostics rules` |
| Implementation merge M1, PR #195 | `becfa3660e9b4b7586292661aa6de011854ab17e` |
| Canonical fold F | `6d3e39b53dd81ac43c4bb1336fff2808e1e58aa0` — `docs(openspec): fold packed artifact completeness into the canonical SDK spec` |
| Canonical fold merge M2, PR #196 | `534ae9d8b6843706da86bfe9107e7ef65ebef605` |
| Archive A | this commit |

M1 is an identity-preserving two-parent owner merge of prior main `cc41eff686d52c645e5d88203bdc75b4badd288f` and exact implementation head `6cbcbff55f9f53efaf2363af0a17f02f201ddfe1`; both resolve to tree `feb7cb2b03149340f1440a9111b0c48b817a56ac`. M2 is an identity-preserving two-parent owner merge of prior main M1 and exact fold head F; both resolve to tree `96d0ceb1841b4c6061c52fd1174c1e5ee2d0d54c`.

**Signed governance record: none.** No signed governance record exists for this change, none is required by its established unsigned lifecycle state, and none is inferred. AI review, green checks, PR assignment, mergeability, and merged state are not human or organizational approval, certification, or assurance.

## Task completeness

All 17 of 17 tasks are complete. Task 4.1 was reconciled in F before M2. Issue #70 was then closed as `COMPLETED` at `2026-08-21T02:17:09Z`, with evidence binding M1 and M2 and reconciling all nine acceptance criteria of the authoritative agent brief, before this archive candidate was built. That ordering permits this commit to carry a complete 17/17 relocation rather than archiving an incomplete ledger or requiring a later reconciliation commit.

Task 4.3 is self-referential in the established archive convention: this commit contains the complete relocation, while its commit hash is reported after storage rather than bound inside itself.

## Canonical capability presence

`Package verification proves the packed artifact is complete and fails on an incomplete one` is present exactly once in `openspec/specs/security-audit-sdk-core/spec.md`, with all five scenarios. The canonical SDK specification contains 49 requirement headers and zero `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`, or `## RENAMED Requirements` operation headers.

F folded the requirement while the change was active, and M2 merged that fold before this archive was prepared. This sequencing is mandatory: once relocated, the change no longer receives canonical capability-spec coverage from `ownedPathsFor`. Therefore this archive commit does not touch `openspec/specs/**` and does not repeat the sync.

## Production / publication restrictions

No production or publication authorization is granted, implied, or inherited. This lifecycle added no production transport, exporter, collector, broker, queue, outbox, storage, SIEM integration, analytics, detection, browser telemetry, audit-log chaining, real-user processing, publication path, runtime dependency, contract change, generated contract artifact, npm script, or public API authorization. The package remains `private` and `UNLICENSED`, and `dependencies` remains empty. Bloodtrail remains canonical; OCSF remains export-only, OpenTelemetry transport-only, and CloudEvents envelope-only.

## Immutable archive contents, exact changed paths, byte identity

Before relocation, all six active artifacts were resolved at M2 and compared with the moved filesystem bytes. All six matched before reconciliation:

| Path | M2 blob | Before archive edits |
| --- | --- | --- |
| `.openspec.yaml` | `f774115be73dd8f01a23e4a77304e2ce5c0e136c` | identical |
| `assessment.json` | `5af5e271bf85c2b16edf240a083702dc21fcfc70` | identical |
| `design.md` | `922ac5b5a25e1ee6b8793c64d7279f3d31bbc8f6` | identical |
| `proposal.md` | `2ea074354e18b8ef7e30c11a98494cfbd3365622` | identical |
| `specs/security-audit-sdk-core/spec.md` | `a7872845d2377e28b9f842d112612817cb979e11` | identical |
| `tasks.md` | `81482dd9259ab9a2180cb92b7e822b14587a8237` | identical before final reconciliation |

The first five artifacts remain byte-identical to M2 in this commit. `tasks.md` is the only moved artifact modified, solely to reconcile tasks 4.2 and 4.3, and `archive-evidence.md` is the only new artifact. The committed geometry is seven archive additions and six active-path deletions under `git show --name-status --no-renames`; no active change path remains.

The delta spec was confirmed byte-identical to the folded canonical text before relocation: `specs/security-audit-sdk-core/spec.md` lines 3–48 and `openspec/specs/security-audit-sdk-core/spec.md` lines 894–939 at M2 differ in nothing. That is why this commit performs no sync.

## Self-coverage of this relocation

`carriesRelocatedArtifact` recognises this archive because `assessment.json` and `proposal.md` are the exact objects history carried at the active path. `ownedPathsFor` therefore grants this dated archive directory to the relocation itself. No keeper change is needed: like `reject-undeclared-shipped-imports`, and unlike `bundle-validator-runtime-helpers`, this change folded its canonical capability requirement in a separate range while still active.

## Active enforcement verified

The control was proven RED before it was wired: task 2.5 records that the null control and all three mutations pass 4/4 against the wired gate and fail 4/4 against the baseline gate, because the baseline neither executed completeness nor emitted its diagnostics. Each failure class the requirement names has a deterministic failing mutation applied to a package copy rather than to the working tree — an inventory omitting `dist/validation/`, a packed artifact rebinding the bundled `ucs2length` helper to an undefined identifier, and an entry point resolving from an external decoy outside the disposable consumer — alongside an unmutated control that passes in the same harness. The provenance mutation is deterministic, so the change's conditional carve-out for PLAN-091 was not used.

The exact implementation candidate `6cbcbff` passed the full SDK 19-gate chain with 228 verification tests, the contract chain with 14 tests, the 201-test governance suite, strict active and archived OpenSpec validation, final-phase governance across 5 commits and 14 paths, and the candidate/baseline dual check before M1. All required PR #195 contexts passed at that exact head. The exact fold candidate F independently passed the same full local chains, and all required PR #196 contexts passed at exact F before M2.

## What is not verified

- This gate proves that the packed artifact loads and validates through its declared entry points. It does not prove the absence of unexercised broken paths inside the package.
- Completeness is not self-containment and neither is dependency safety; `check-dependencies.mjs` and the shipped-import policy from #69 independently cover adjacent properties.
- Entry-point coverage is bounded by the package export map. A module reachable only through a path the export map does not declare is never imported by this control.
- The canonical-event check validates one positive fixture through the installed artifact; it is not a validation conformance suite.
- Archive relocation checks prove committed-tree removal completeness, not archive well-formedness, byte identity, honest task reconciliation, or correctness of this evidence.
- AI-produced analysis is not review, approval, certification, or assurance, and no such status is inferred from checked tasks, passing gates, PR state, or merge state.
