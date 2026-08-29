# Archive Evidence — ratify-contract-version-support-policy

This archive records the completed lifecycle for the sdk-core contract-version support policy. The SDK already enforced one exact contract version, but the canonical capability did not make that cardinality an enduring requirement and `MIGRATION.md` still instructed every future contract adaptation to re-decide whether one package version could support two contract versions. The owner selected `EXACT_ONE` on 2026-08-23; the proposal and authored documentation landed in PR #212, the canonical requirement was folded and signed while the change was active in PR #213, and this commit performs the complete active-to-archive relocation.

## Identities

| Role | Commit |
| --- | --- |
| Proposal baseline | `e49931cececf21770b0819799aa379d07ac179cd` — the `ordering.proposal_baseline_commit` recorded in `assessment.json` |
| Proposal P | `a984ff6b541e700ca54cae5b920babd8f764dc75` — `docs(openspec): propose contract version support policy ratification` |
| Authored documentation A | `afa0acc976469b3cb869eb543f66c44111d860e0` — `docs(sdk): ratify exact-one contract support policy` |
| Documentation merge M1, PR #212 | `22647aefef17e889bcf106fa1f9b0a58bd154f7a` |
| Canonical fold T | `83a19020d4d1e255c573acc32f083c36c86dcf94` — `docs(openspec): fold exact-one contract support into the canonical SDK spec` |
| Inventory registration T2 | `a7473d4e8041c58797279415dc6bc08930d40be9` — `test(sdk): register the contract-version-policy governance record inventory` |
| Signed governance record S | `fca88653d96ae5952990363307422cda64bbc96e` — `docs(sdk): store the signed governance record for the contract-version policy` |
| Fold and signing merge M2, PR #213 | `14ccbc6889f37922b21e62cfc764186b2c5e8388` |
| Archive A | this commit |

M1 is an identity-preserving two-parent owner merge of prior main `e49931cececf21770b0819799aa379d07ac179cd` and exact documentation head `afa0acc976469b3cb869eb543f66c44111d860e0`. M2 is an identity-preserving two-parent owner merge of prior main M1 and exact signing head `fca88653d96ae5952990363307422cda64bbc96e`; both resolve to tree `3a00e120eaf7cf1b0e40a5566f14823bc2537ef0`. `83a1902`, `a7473d4` and `fca8865` are each ancestors of `main`.

## Signed governance record, and why it binds T2 rather than T

**A signed governance record exists** for this change, stored by `fca88653d96ae5952990363307422cda64bbc96e` in `packages/security-audit-sdk-core/verification-lifecycle.json`. It binds exact technical commit `a7473d4e8041c58797279415dc6bc08930d40be9` and candidate content object `a36c7bf6c7849f66d8bf84c2177e02e7e804d26a` over five reviewed subtrees: `openspec/changes/ratify-contract-version-support-policy`, `openspec/specs/security-audit-sdk-core`, `packages/security-audit-sdk-core/adr`, `packages/security-audit-sdk-core/tests/verification`, and `docs/adr`.

The canonical fold `83a1902` was planned to be the final normative technical commit and the record's binding. It could not be. The governance-history mutation suite carries an independent record inventory — `EXPECTED_RECORD_IDS` and `MINIMUM_REVIEWED_PATHS` in `packages/security-audit-sdk-core/tests/verification/governance-history-mutations.test.mjs` — which is deliberately not derived from the manifest and asserts set equality, so a record cannot be stored until an explicit reviewed edit admits it. This was proved rather than assumed: adding a record without registering it made the suite fail. Registering it is itself a normative commit, so making the record storable necessarily created T2 after T, and R15 freshness requires the record to bind the last normative commit. T2 therefore contains T's canonical fold unchanged plus the inventory registration and the assessment owned-path extension.

**Two limitations are recorded in the record's `assuranceLimitations` rather than argued away.** First, the owner instruction that authorized signing named exact fold commit `83a1902`; it could not name T2, which did not yet exist, so confirmation of the T2 binding rests on the owner's merge of PR #213 carrying T, T2 and S together. Second, `packages/security-audit-sdk-core/CONTEXT.md` and `packages/security-audit-sdk-core/MIGRATION.md` share the package root with the record itself, so no non-self-referential tree entry can cover them; they are bound by exact technical commit `afa0acc` named in `governedCommits`, not by a content object.

AI-produced analysis informed this lifecycle and is not review, approval, or assurance. Green checks, PR state, mergeability, and merged state are not human or organizational approval, certification, or assurance.

## Task completeness

All 15 of 15 tasks are complete. Groups 1 and 2 completed in `afa0acc`; group 3 across `83a1902`, `a7473d4`, `fca8865` and the owner merge `14ccbc6`; group 4 entirely on GitHub with no repository commit, as the design's migration plan requires; group 5 in this commit. Task 5.2 is self-referential in the established archive convention: this commit contains the complete relocation, while its own hash is reported after storage rather than bound inside itself.

## Readiness, reported separately

- **Technical readiness** was established at `a7473d4` and `fca8865`: strict OpenSpec validation of all eight items, both repository validation chains, the 213-test governance suite, and `git diff --check`, each run read-only with an empty index.
- **Merge readiness** was established at `14ccbc6`: a two-parent identity-preserving owner merge whose second parent and tree are exactly the signing head.
- **Archive readiness** is established by this commit alone. It revalidates neither of the other two, and neither substitutes for it.

## Canonical capability presence

`Contract-version support is exact-one per SDK package version` is present exactly once in `openspec/specs/security-audit-sdk-core/spec.md`, with all seven scenarios. That file contains 51 requirement headers and zero `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`, or `## RENAMED Requirements` operation headers. The delta body of `specs/security-audit-sdk-core/spec.md` below its `## ADDED Requirements` header occurs verbatim exactly once in the canonical text, so a second semantic application of the delta replaces that block with itself.

T folded the requirement while the change was active, and M2 merged that fold before this archive was prepared. This sequencing is mandatory: once relocated, the change no longer receives canonical capability-spec coverage from `ownedPathsFor`. This archive commit therefore does not touch `openspec/specs/**` and does not repeat the fold.

## Production / publication restrictions

No production or publication authorization is granted, implied, or inherited. The record's `withheld` list retains all six mandatory entries: package publication, production deployment, production collection, real-user processing, framework integration, and delivery infrastructure. This lifecycle added no transport, exporter, collector, broker, queue, outbox, storage, SIEM integration, analytics, detection, browser telemetry, audit-log chaining, real-user processing, publication path, runtime dependency, contract change, generated artifact, npm script, or public API authorization.

`git diff --name-status e49931c HEAD` names fourteen paths. Five sit under `packages/security-audit-sdk-core/`: `CONTEXT.md`, `MIGRATION.md`, `adr/009-package-contract-compatibility.md`, `tests/verification/governance-history-mutations.test.mjs`, and `verification-lifecycle.json` — documentation, the record inventory, and the record itself. **No path under `src/`, `package.json`, `package-lock.json`, `compatibility.json`, or `contracts/` changed at all.** The frozen `1.0.0` contract and every runtime and generated artifact are untouched byte for byte, and the package remains private, `UNLICENSED`, and at candidate version `0.1.0`.

Ratifying `EXACT_ONE` fixes what the SDK *would* accept if another canonical contract version existed. It does not create one, does not unfreeze the contract, and does not make any two contract versions interoperable. Bloodtrail remains canonical; OCSF remains export-only, OpenTelemetry transport-only, and CloudEvents envelope-only.

## Immutable archive contents, exact changed paths, byte identity

The six active artifacts were resolved at M2 and compared with the moved filesystem bytes:

| Path | M2 blob | Blob in this commit | Relation |
| --- | --- | --- | --- |
| `.openspec.yaml` | `44f55ffeea7bd59fa51a01da1ea59fd62a4e7dbd` | `44f55ffeea7bd59fa51a01da1ea59fd62a4e7dbd` | byte-identical to M2 |
| `assessment.json` | `da9f57d98a5a611bd81e16df4fb6a65d2b30e788` | `da9f57d98a5a611bd81e16df4fb6a65d2b30e788` | byte-identical to M2 |
| `design.md` | `558268d58d4c0942eb209a6dec96caed5475c4e5` | `558268d58d4c0942eb209a6dec96caed5475c4e5` | byte-identical to M2 |
| `proposal.md` | `caad074ccc40ad09e80bab9cf4451e60aabb0be3` | `caad074ccc40ad09e80bab9cf4451e60aabb0be3` | byte-identical to M2 |
| `specs/security-audit-sdk-core/spec.md` | `9143c1083dcade3f02075ea0d83ed3da7b932cbd` | `9143c1083dcade3f02075ea0d83ed3da7b932cbd` | byte-identical to M2 |
| `tasks.md` | `c2cf999fd49747d09026c1df9d8e1c2b9d44c97d` | `9177c7cae4c0f8574f49d7f06f12d691f671f806` | reconciled in this commit for tasks 3.3, 3.4, 4.1, 4.2, 4.3, 5.1 and 5.2 |

`tasks.md` is the only moved artifact this commit modifies. `archive-evidence.md` is added. Seven additions and six deletions are staged together, so the removal is committed rather than left in the working tree.

## Issue outcomes

#75 closed as completed with comment 5463430910, naming `EXACT_ONE`, the commit identities above, both ADR paths, and the canonical requirement. #76 closed as completed with comment 5463427747, as already-implemented against evidence re-verified at `main@14ccbc6`, with `needs-info` removed. #132's Wave 2 checklist ticks both. #102, #107 and #122 were notified. `PLAN-053` — a collector authenticating producers and validating the approved version set during migration — is explicitly **not** discharged by this lifecycle and remains with #107, which is unauthorized until a collector is separately authorized.
