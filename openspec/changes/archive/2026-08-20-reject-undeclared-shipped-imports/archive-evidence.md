# Archive Evidence — reject-undeclared-shipped-imports

This archive records the completed lifecycle for shipped-artifact module-import verification. The capability requirement was folded while the change was active, issue #69 was closed with exact-commit evidence after that fold merged, and this commit performs the complete active-to-archive relocation.

## Identities

| Role | Commit |
| --- | --- |
| Proposal | `088f37f54f3517dd35eed6ac9969a333abcdbf55` — `docs(openspec): propose rejecting undeclared shipped imports` |
| Initial implementation | `ede4453099054c9eb7c1f2eda7e6303ec44933d5` — `feat(sdk): reject undeclared runtime imports in the dependency gate` |
| Policy simplification | `1bb07e6848485e38258d0c7ec57432dca1575863` — `fix(sdk): simplify shipped-import policy conditionals` |
| Verified command reuse | `50efcb0725a3266fefe0349d36c400896ff78d9f` — `fix(sdk): reuse verified package command runner` |
| Inventory option grouping | `fc41366f0e9a6340b2cb8793fd6df8a7a66335a9` — `fix(sdk): group package inventory options` |
| Parser-assurance alignment | `86e5d1fe388818d911bdf1fcfcbc9e6a04c897fe` — `docs(openspec): align shipped-import parser assurance` |
| Exact implementation head | `d4085cb89290ba3f8cddbd47966494fc337e32e4` — `style(sdk): use String.raw in the dependency gate escape helper` |
| Implementation merge M1, PR #190 | `c98132c89e928f8b59562a1344c342facbde465d` |
| Canonical fold F | `69e0cd84a9043d75ce03379d2ae765e4e14b5e1f` |
| Canonical fold merge M2, PR #192 | `3284aba5ddc3eddf616a278c85ab87c911a09dd6` |
| Archive A | this commit |

M1 is an identity-preserving two-parent owner merge of prior main `c08c45bd32473c767393c40b4a13507598fd3e6b` and exact implementation head `d4085cb89290ba3f8cddbd47966494fc337e32e4`; both resolve to tree `c03fc95bbdd4fa52ec06eb29ab7cc993287ae3e6`. M2 is an identity-preserving two-parent owner merge of prior main M1 and exact fold head F; both resolve to tree `2107cd59b43ad67c18aae8e66b0ad7ff14b4b410`.

**Signed governance record: none.** No signed governance record exists for this change, none is required by its established unsigned lifecycle state, and none is inferred. AI review, green checks, PR assignment, mergeability, and merged state are not human or organizational approval, certification, or assurance.

## Task completeness

All 13 of 13 tasks are complete. Tasks 3.1 and 3.2 were reconciled in F before M2. Issue #69 was then closed as `COMPLETED` at `2026-08-20T20:52:18Z`, with evidence binding M1 and M2, before this archive candidate was built. That ordering permits this commit to carry a complete 13/13 relocation rather than archiving an incomplete ledger or requiring a later reconciliation commit.

Task 3.3 is self-referential in the established archive convention: this commit contains the complete relocation, while its commit hash is reported after storage rather than bound inside itself.

## Canonical capability presence

`Dependency verification inspects module imports in shipped artifacts` is present exactly once in `openspec/specs/security-audit-sdk-core/spec.md`, with all seven scenarios. The canonical SDK specification contains 48 requirement headers and zero `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`, or `## RENAMED Requirements` operation headers.

F folded the requirement while the change was active, and M2 merged that fold before this archive was prepared. This sequencing is mandatory: once relocated, the change no longer receives canonical capability-spec coverage from `ownedPathsFor`. Therefore this archive commit does not touch `openspec/specs/**` and does not repeat the sync.

## Production / publication restrictions

No production or publication authorization is granted, implied, or inherited. This lifecycle added no production transport, exporter, collector, broker, queue, outbox, storage, SIEM integration, analytics, detection, browser telemetry, audit-log chaining, real-user processing, publication path, runtime dependency, contract change, generated contract artifact, or public API authorization. Bloodtrail remains canonical; OCSF remains export-only, OpenTelemetry transport-only, and CloudEvents envelope-only.

## Immutable archive contents, exact changed paths, byte identity

Before relocation, all six active artifacts were resolved at M2 and compared with the moved filesystem bytes. All six matched before reconciliation:

| Path | M2 blob | Before archive edits |
| --- | --- | --- |
| `.openspec.yaml` | `f774115be73dd8f01a23e4a77304e2ce5c0e136c` | identical |
| `assessment.json` | `ba1023265ae321b0a32496bcb5b4f6cfa3527c1f` | identical |
| `design.md` | `425362c3adb6318461e7e06fbcba07850aaf898c` | identical |
| `proposal.md` | `225a2c8c952a023d2faf729f504a5af9a5ef723d` | identical |
| `specs/security-audit-sdk-core/spec.md` | `27a6a77a6f267846003e4e17afa58fbaa760c377` | identical |
| `tasks.md` | `2938e0bb025fcaee3f6340fe433babc1f9a3535e` | identical before final reconciliation |

The first five artifacts remain byte-identical to M2 in this commit. `tasks.md` is the only moved artifact modified, solely to reconcile tasks 3.3 and 3.4, and `archive-evidence.md` is the only new artifact. The committed geometry is seven archive additions and six active-path deletions under `git show --name-status --no-renames`; no active change path remains.

## Self-coverage of this relocation

`carriesRelocatedArtifact` recognises this archive because `assessment.json` and `proposal.md` are the exact objects history carried at the active path. `ownedPathsFor` therefore grants this dated archive directory to the relocation itself. No keeper change is needed: unlike `bundle-validator-runtime-helpers`, this change folded its canonical capability requirement in a separate range while still active.

## Active enforcement verified

The control was proven RED before implementation: task 2.1 records 17 focused failures when the policy module was absent and when the prior dependency gate failed to name the mutated shipped artifact and AJV module. The completed verification matrix then covered approved live output, bundled and declared dependencies, role-scoped and unprefixed built-ins, self-references, all supported static positions, dynamic forms, aliased and computed `require`, unreadable and unknown-role artifacts, empty inventory, deterministic ordering, bounded diagnostics, and the undeclared-AJV package-copy mutation.

The exact implementation candidate passed the full SDK 19-gate chain with 223 verification tests, the contract chain with 14 tests, the 201-test governance suite, strict active and archived OpenSpec validation, final-phase governance, and the candidate/baseline dual check before M1. The exact fold candidate F independently passed the same full local chains, and all required PR #192 contexts passed at exact F before M2.

R25 checks the committed-tree property that a recognised archive relocation removes the complete active directory in the same commit. Post-commit verification of A must show seven `A` entries and six `D` entries under `git show --name-status --no-renames`, no active path at `HEAD`, and no `archive-relocation-incomplete` diagnostic.

## What is not verified

- Declaration and bundling consistency is not dependency safety.
- Relative-module closure is not established by this control; runtime, examples, packed-consumer closure, and package-content checks independently cover adjacent properties.
- TypeScript parsing is error-tolerant. A returned syntax tree does not establish syntax validity; build, typecheck, and runtime gates retain that responsibility.
- R25 proves committed-tree removal completeness, not archive well-formedness, byte identity, honest task reconciliation, or correctness of this evidence.
- AI-produced analysis is not review, approval, certification, or assurance, and no such status is inferred from checked tasks, passing gates, PR state, or merge state.
