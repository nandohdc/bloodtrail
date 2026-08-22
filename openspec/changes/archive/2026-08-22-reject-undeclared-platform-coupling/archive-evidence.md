# Archive Evidence — reject-undeclared-platform-coupling

This archive records the completed lifecycle for platform coupling classification at the scope gate. The capability requirement was folded while the change was active, issue #71 was closed with exact-commit evidence after that fold merged, and this commit performs the complete active-to-archive relocation.

## Identities

| Role | Commit |
| --- | --- |
| Proposal | `c7e543f` — `docs(openspec): propose undeclared platform coupling rejection` |
| Initial implementation | `261657e` — `feat(sdk): reject undeclared platform coupling in the scope gate` |
| Analyser follow-ups | 26 commits from `1df6ff4` to `88de99f`, reconciling CodeScene code health with Sonar method and complexity limits over the AST walker |
| Exact implementation head | `88de99fdefe1a96d953ac6855fb4794f8252a50c` — `refactor(sdk): flatten walkPatternDefaults for the code health gate` |
| Implementation merge M1, PR #198 | `48b8a16d89e6fb60685469858601d4c568dccfa3` |
| Canonical fold F | `3bf03320473099cdf90cbe080722ee41f6e83c42` — `docs(openspec): fold platform coupling verification into the canonical SDK spec` |
| Canonical fold merge M2, PR #199 | `45c6227647007fa32e6974dd34d7800a05b1c80b` |
| Archive A | this commit |

M1 is an identity-preserving two-parent owner merge of prior main `39506dbfcd697da4b85f96dfab5e6b30fa06b07c` and exact implementation head `88de99fdefe1a96d953ac6855fb4794f8252a50c`; both resolve to tree `0582c2fd6b3c51a64d02c0fe34305161ea14b0ad`. M2 is an identity-preserving two-parent owner merge of prior main M1 and exact fold head F; both resolve to tree `9e31caacf7a525c1858cb37132dcb951ca1869cd`.

**Signed governance record: none.** No signed governance record exists for this change, none is required by its established unsigned lifecycle state, and none is inferred. `verification-lifecycle.json` was not edited by this lifecycle. AI review, green checks, PR assignment, mergeability, and merged state are not human or organizational approval, certification, or assurance.

## Task completeness

All 30 of 30 tasks are complete. Task 3.5 and task 4.1 were reconciled in F before M2. Issue #71 was then closed as `COMPLETED` at `2026-08-22T14:51:21Z`, with evidence binding M1 and M2 and reconciling all eleven acceptance criteria of the authoritative agent brief, before this archive candidate was built. That ordering permits this commit to carry a complete 30/30 relocation rather than archiving an incomplete ledger or requiring a later reconciliation commit.

Task 4.3 is self-referential in the established archive convention: this commit contains the complete relocation, while its commit hash is reported after storage rather than bound inside itself.

## Canonical capability presence

`Scope verification classifies every platform coupling against a declared policy` is present exactly once in `openspec/specs/security-audit-sdk-core/spec.md`, with all eleven scenarios. The canonical SDK specification contains 50 requirement headers and zero `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`, or `## RENAMED Requirements` operation headers.

F folded the requirement while the change was active, and M2 merged that fold before this archive was prepared. This sequencing is mandatory: once relocated, the change no longer receives canonical capability-spec coverage from `ownedPathsFor`. Therefore this archive commit does not touch `openspec/specs/**` and does not repeat the sync.

## Production / publication restrictions

No production or publication authorization is granted, implied, or inherited. This lifecycle added no production transport, exporter, collector, broker, queue, outbox, storage, SIEM integration, analytics, detection, browser telemetry, audit-log chaining, real-user processing, publication path, runtime dependency, contract change, generated contract artifact, npm script, or public API authorization. `packages/security-audit-sdk-core/package.json` and `compatibility.json` are byte-identical between prior main `39506db` and M2, and no file under `packages/security-audit-sdk-core/src/` was changed, so `files`, the export map, and `engines` are untouched and contract `1.0.0` is unaffected. The package remains `private` and `UNLICENSED`, and `dependencies` remains empty. Declaring a platform coupling records that it exists; it authorizes nothing. Bloodtrail remains canonical; OCSF remains export-only, OpenTelemetry transport-only, and CloudEvents envelope-only.

## Immutable archive contents, exact changed paths, byte identity

Before relocation, all six active artifacts were resolved at M2 and compared with the moved filesystem bytes. All six matched before reconciliation:

| Path | M2 blob | Before archive edits |
| --- | --- | --- |
| `.openspec.yaml` | `d160e09cf5e88ce54164ccf9b7f2b16b4ce78d65` | identical |
| `assessment.json` | `9e9731c3becb55a5628b2f186acc29436fbb7ef5` | identical |
| `design.md` | `c8efa698bfd9b285db90fe2fd7270a1de20bed1b` | identical |
| `proposal.md` | `b024de7e17f07090257b0e6f85ef068ce0c2e433` | identical |
| `specs/security-audit-sdk-core/spec.md` | `87d573b030f2df11d1f22bb73204e0b78ba8c47a` | identical |
| `tasks.md` | `765f49c001984d5aef94e9caa3df9366bd163410` | identical before final reconciliation |

The first five artifacts remain byte-identical to M2 in this commit. `tasks.md` is the only moved artifact modified, solely to reconcile tasks 4.2 and 4.3, and `archive-evidence.md` is the only new artifact. The committed geometry is seven archive additions and six active-path deletions under `git show --name-status --no-renames`; no active change path remains.

The delta spec was confirmed byte-identical to the folded canonical text before relocation: `specs/security-audit-sdk-core/spec.md` lines 3–81 and `openspec/specs/security-audit-sdk-core/spec.md` lines 941–1019 at M2 differ in nothing. That is why this commit performs no sync.

## Self-coverage of this relocation

`carriesRelocatedArtifact` recognises this archive because `assessment.json` and `proposal.md` are the exact objects history carried at the active path. `ownedPathsFor` therefore grants this dated archive directory to the relocation itself. No keeper change is needed: like `reject-undeclared-shipped-imports` and `verify-packed-artifact-completeness`, and unlike `bundle-validator-runtime-helpers`, this change folded its canonical capability requirement in a separate range while still active.

## Active enforcement verified

The control was proven RED before it was wired: task 2.8 records that every added arm fails on the pre-hardening gate and passes on the hardened gate, so no control passes for the wrong reason, and task 2.5 records deterministic pass and fail signals against the wired gate. Each failure class the requirement names has a deterministic failing mutation applied to a package copy rather than to the working tree — an undeclared host global in authored source, the same class in generated source for a global declared only for the authored role, an undeclared module specifier in the generated CommonJS validator, string-concatenation and `eval`/`Function` evasion, loop headers, destructuring defaults, computed member names, dynamic specifiers, an unparseable artifact, an unreadable artifact, an unreadable directory, a symlinked entry, and an empty inspection set — alongside five negative controls and one unmutated null control that pass in the same harness. Exit status alone is never the assertion: every failing arm asserts the diagnostic class, the artifact, and the detail, requires the planted source marker absent, and requires total output under 4096 bytes. The two `chmod`-based arms confirm the mode actually denies the running process before asserting, so they skip rather than pass spuriously when CI runs as root.

Measured at M2: `npm run test:scope` exits 0 reporting `17 SDK source files` and `platform coupling inventory: authored: 16 artifacts, 110 references, host couplings: [Buffer (2 sites)]; generated: 3 artifacts, 7 references, host couplings: [module (1 site)]`, and `platform-coupling-mutations.test.mjs` passes 11 of 11 tests with none skipped.

All required and external PR #198 contexts — eighteen in total — passed at exact implementation head `88de99f`, and all eighteen passed again at exact fold head F before M2. The fold candidate independently passed the full local chains with an empty index: SDK validation with 239 verification tests, contract validation 14 of 14, strict OpenSpec across 4 specs, 5 active items and 19 archives, the 201-test governance suite, and post-commit final-phase governance over 1 commit and 2 paths with a passing candidate/baseline dual check on the same checker blob.

## What is not verified

- **Node 24.** `test:scope` is in `test:matrix`, but every SDK job in `.github/workflows/ci.yml` pins `node-version: "26"`, and only Node v26.7.0 was available on the workstation. The AST pass has never executed on the other supported major, on any machine.
- The gate bounds **which** host capabilities the sources use, not **where** they are used. A new call site of an already-declared coupling passes; a new coupling does not.
- Host-object **member** access is not detected. `timer.unref()` is recorded as an uninspected coupling in the policy data and is not mechanically enforced, so the reported inventory is a lower bound on the tree's real host coupling.
- The gate's pre-existing source-content regexes are unchanged and remain both false-positive-prone and false-negative-prone. Replacing them would change what `test:scope` rejects and is separate work.
- Inventorying coupling does not establish that the SDK would run on a non-Node runtime, and it makes no claim about post-split neutrality if a Core extraction is ever authorized.
- Archive relocation checks prove committed-tree removal completeness, not archive well-formedness, byte identity, honest task reconciliation, or correctness of this evidence.
- AI-produced analysis is not review, approval, certification, or assurance, and no such status is inferred from checked tasks, passing gates, PR state, or merge state.
