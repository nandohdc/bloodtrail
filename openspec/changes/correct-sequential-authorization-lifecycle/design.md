# Design: Sequential Authorization Lifecycle Correction (R5)

## Context

Bloodtrail enforces immutable governance on repository changes through cryptographically signed
change authorizations. Currently, authorization discovery searches for records with `status: "CURRENT"`.
When a bounded change requires a subsequent authorization for the same change and operation (e.g. to
adjust scope or introduce a follow-on phase such as post-T3 fixture repair), placing a second record
with `status: "CURRENT"` causes an immediate fail-closed conflict: `authorization-current-conflict`.
Because existing authorizations are cryptographically signed and immutable, mutating an earlier record's
status in git history is prohibited by tamper-detection controls.

Revision 5 (R5) supersedes the failed R4 planning revision and establishes a fully governed,
mathematically closed sequential authorization lifecycle.

This design is bound to external evidence package set:
- `PACKAGE_SET_SHA256`: `19fcf60430d37aa13d752620cf17b8b17533037bbc257db7795b5c05000ae128`
- `MANIFEST_SHA256`: `d5378b6e60319dfb5103edae70e17aa26cb15f121e59f22969fb6bfe0d809c2e`
under `bloodtrail-assurance/candidate-b-remediation-program/cb-018-planning-package-r5/`.

## Architecture & Goals

### High-Level Architecture

The sequential authorization lifecycle moves from flat record scanning to a directed acyclic graph
(DAG) model where authorization records form immutable lineage chains:

```text
[ Root Authorization C_A ]
       │
       │ (supersedes: A.id, A.path, A.blob_sha256, A.commit_sha)
       │ (boundary_parent: P_B)
       ▼
[ Successor Authorization C_B ]
       │
       ▼
[ Derived Effective Authority: Unique Leaf B ]
```

1. **Immutable Records**: Every authorization record remains immutable and signed with its issuance-time
   status (`CURRENT`). No historical record is ever modified.
2. **Topological Derivation**: The effective authorization is dynamically derived in memory by building
   a DAG of valid authorizations and finding the unique terminal leaf.
3. **Explicit Supersession Binding**: A successor explicitly binds its predecessor by record ID, file path,
   canonical blob SHA-256, and introducing commit SHA-1.
4. **Dedicated Introducing Commits**: Authorization introducing commits ($C_A, C_B$) must touch strictly
   one path (their own authorization file). They are validated for cryptographic signatures, not scope.
5. **Discrete Scope Intervals**: Scope enforcement is segmented into half-open commit intervals:
   $(C_A, P_B]$ for the predecessor, and $(C_B, \text{HEAD}]$ for the successor.
6. **Operation-Aware Attribution**: Governed operations are attributed per commit. Commits authorized under
   `RESOLVE_DEBT` (such as T3) are immune from `IMPLEMENT` scope checking.
7. **Clean T3 Integration Topology**: Lineage integrates with T3 via a two-parent merge commit ($M_{\text{int}}$)
   where `Parent 1 = T3` and `Parent 2 = Mechanism Head`, ensuring T3 mainline continuity.

## Core Invariants & State Machine

### Five Graph Invariants

1. **Single Root Invariant**: For a given `(change, operation)` pair, exactly one authorization must be
   a root (`supersession: null`).
2. **Acyclic Chain Invariant**: The lineage must form a strict directed tree with no cycles, self-supersessions,
   or forks. Every non-root must point to a valid predecessor.
3. **Unique Leaf Invariant**: Exactly one active leaf must exist. Multiple un-superseded leaves result in
   `authorization-multiple-leaves` fail-closed termination.
4. **Provenance Completeness Invariant**: Every record in the lineage (predecessors and leaf) must pass full
   schema validation and SSH cryptographic signature verification.
5. **Dedicated Introducing Commit Invariant**: Every authorization introducing commit must modify exactly
   one path: its own authorization file.

### Lifecycle States

| State | Definition | Effective Authority |
|---|---|---|
| `ISSUED_CURRENT` | Schema status at issuance; valid historical or current record | No (unless verified as leaf) |
| `SUPERSEDED` | Valid historical record with exactly one valid successor leaf | No |
| `REVOKED` | Record with valid revocation or revoked predecessor | No |
| `TERMINAL` | Valid unique leaf in DAG with no successor | **YES** |

### 11 Supersession Preconditions

A successor authorization $B$ validly supersedes predecessor $A$ if and only if all 11 preconditions hold:
1. `SAME_CHANGE`: Both records declare identical `change` string.
2. `SAME_OPERATION`: Both records declare identical `operation` string.
3. `PREDECESSOR_EXISTS`: Predecessor $A$ exists and is schema-valid.
4. `PREDECESSOR_SIGNATURE_VALID`: Predecessor $A$ has a valid cryptographic signature.
5. `SUCCESSOR_SIGNATURE_VALID`: Successor $B$ has a valid cryptographic signature.
6. `EXACT_ID_MATCH`: `supersession.predecessor_id` matches $A$'s `id`.
7. `EXACT_PATH_MATCH`: `supersession.predecessor_path` matches $A$'s repository relative path.
8. `EXACT_BLOB_MATCH`: `supersession.predecessor_blob_sha256` matches $A$'s exact git blob hash.
9. `EXACT_COMMIT_MATCH`: `supersession.predecessor_commit` matches $A$'s introducing commit SHA-1.
10. `DEDICATED_COMMITS`: Introducing commits $C_A$ and $C_B$ each touch exactly 1 path.
11. `BOUNDARY_PARENT_VALID`: $B$'s `boundary_parent` equals $P_B$, which is an ancestor of $C_B$ and descendant of $C_A$.

## Discrete Commit Sets & Boundary Anchors

To prevent scope creep across lifecycle transitions, commit attribution is partitioned:

```text
──[C_A]──( C_A, P_B ]──[P_B]──[C_B]──( C_B, HEAD ]──[HEAD]
  ▲         ▲            ▲      ▲         ▲
  │         │            │      │         └─ Successor implementation commits
  │         │            │      └─ Dedicated successor authorization commit (1 path)
  │         │            └─ Boundary anchor: parent of C_B
  │         └─ Predecessor implementation commits
  └─ Dedicated root authorization commit (1 path)
```

- **Interval 1 (Predecessor Scope)**: $(C_A, P_B] = \{ c \in \text{Ancestors}(P_B) \setminus \text{Ancestors}(C_A) \}$.
  Every commit in this interval must only touch paths declared in $A$'s `scope_paths`.
- **Interval 2 (Successor Scope)**: $(C_B, \text{HEAD}] = \{ c \in \text{Ancestors}(\text{HEAD}) \setminus \text{Ancestors}(C_B) \}$.
  Every commit in this interval must only touch paths declared in $B$'s `scope_paths`.
- **Dedicated Commits**: $C_A$ and $C_B$ are checked strictly for single-path modification and cryptographic
  signature validity; they are exempt from standard implementation `scope_paths` checks.

## Governance Taxonomy & Operation-Aware Attribution

### Closed 7-Operation Taxonomy

Bloodtrail recognizes exactly seven governed operations:
1. `PROPOSE`: OpenSpec change proposal, design, and delta specs.
2. `IMPLEMENT`: Production codebase modifications fulfilling a change.
3. `VERIFY`: Verification suites, negative controls, and mutation assurance.
4. `RESOLVE_DEBT`: Pre-fold normative precedence pin updates and debt retirement.
5. `FOLD`: Folding change delta specs into canonical specs.
6. `ACTIVATE`: Activating governed capability records.
7. `RELEASE`: Publishing versioned release artifacts.

### Operation-Aware Commit Attribution (T3 Debt Scope Immunity)

Under R4, checking `IMPLEMENT` scope over the entire range caused a false-positive violation on commit
`1021b776331f9268578ea1fd21727521be353182` (T3), which modified `openspec/governance/normative-precedence-pins/current-pre-fold-cb-018.json`.
In R5:
- Commits touching `openspec/governance/normative-precedence-pins/**` are attributed to `RESOLVE_DEBT`.
- Scope checking for `IMPLEMENT` authorization specifically filters and evaluates only commits attributed
  to `IMPLEMENT`.
- `RESOLVE_DEBT` commits are formally immune from `IMPLEMENT` scope checking.

## T3 Integration Topology

To maintain unbroken lineage with T3 while introducing the mechanism, the repository employs a clean
two-parent merge topology ($M_{\text{int}}$):

```text
... ──[T2]──[T3]───────────────────────────[M_int]──[Post-T3 Repair]──>
              \                             /
               ──[Mech C1]──...──[Mech Cn]──
```

- `Parent 1`: T3 commit `1021b776331f9268578ea1fd21727521be353182` (mainline continuity).
- `Parent 2`: Mechanism branch tip commit.
- Tree at $M_{\text{int}}$ contains the union of T3 debt state and the mechanism implementation.
- This preserves T3 as a direct first-parent ancestor and avoids rebasing or amending T3.

## Locked Implementation Paths (8 Paths)

Mechanism implementation is strictly confined to eight paths:

1. `openspec/governance/schemas/change-authorization.schema.json` (Schema definition for supersession binding)
2. `openspec/scripts/normative-precedence/sequential-authorization.mjs` (Dedicated sequential authorization lifecycle engine)
3. `openspec/scripts/normative-precedence/authorization-discovery.mjs` (Discovery integration and leaf selection)
4. `openspec/scripts/normative-precedence/model.mjs` (Governed-range scope and operation attribution)
5. `openspec/tests/design-pattern-governance/normative-precedence-sequential-authorization-controls.mjs` (14 repository tests & 25 negative controls)
6. `openspec/tests/design-pattern-governance/mutation-assurance.test.mjs` (Mutation runner integration)
7. `openspec/tests/design-pattern-governance/fixtures/normative-precedence/revision-3-negative-controls.json` (Negative control fixture catalog)
8. `openspec/tests/design-pattern-governance/fixtures/normative-precedence/revision-3-mutants.json` (Mutation fixture catalog)

## Repository Tests (14 Tests)

| ID | Expected | Description |
|---|---|---|
| `SEQ-T001` | PASS | Valid predecessor-to-successor chain resolves unique leaf |
| `SEQ-T002` | FAIL | Multiple active roots or leaves fail closed (`authorization-multiple-leaves`) |
| `SEQ-T003` | FAIL | Successor lacks required supersession binding (`missing-supersession-binding`) |
| `SEQ-T004` | FAIL | Successor is unsigned or signature invalid (`invalid-signature`) |
| `SEQ-T005` | FAIL | Predecessor exact binding mismatch (id/path/blob/commit) (`predecessor-binding-mismatch`) |
| `SEQ-T006` | FAIL | Boundary anchor mismatch or invalid parent tree (`boundary-anchor-mismatch`) |
| `SEQ-T007` | FAIL | Historical predecessor record bytes modified (`historical-record-tampered`) |
| `SEQ-T008` | FAIL | Historical record status edited from CURRENT to SUPERSEDED (`historical-status-mutation`) |
| `SEQ-T009` | FAIL | Self-supersession detected (`self-supersession`) |
| `SEQ-T010` | FAIL | Cyclic supersession graph detected (`cyclic-supersession`) |
| `SEQ-T011` | FAIL | Successor path touched prior to boundary parent $P_B$ (`retroactive-scope-violation`) |
| `SEQ-T012` | FAIL | Path outside successor scope touched after $C_B$ (`successor-scope-violation`) |
| `SEQ-T013` | FAIL | Historical inactive predecessor fails cryptographic verification (`historical-signature-invalid`) |
| `SEQ-T014` | PASS | Discrete commit intervals $(C_A, P_B]$ and $(C_B, \text{HEAD}]$ validate independently |

## Negative Controls (25 Disaggregated Controls)

To ensure granular, non-aggregated diagnostics, 25 negative controls (`NC-SEQ-001` to `NC-SEQ-025`)
are established, testing:
- Missing/malformed `supersession` fields (`NC-SEQ-001` to `005`)
- Mismatched predecessor attributes: ID, path, blob hash, commit SHA (`NC-SEQ-006` to `009`)
- Cross-change or cross-operation supersession attempts (`NC-SEQ-010` to `011`)
- Graph violations: self-supersession, 2-cycles, 3-cycles, forks, disconnected roots (`NC-SEQ-012` to `016`)
- Boundary violations: non-ancestor parent, non-descendant parent, dirty tree (`NC-SEQ-017` to `019`)
- Interval scope leaks: predecessor path in successor interval, successor path in predecessor interval (`NC-SEQ-020` to `021`)
- Non-dedicated introducing commits (touching > 1 path) (`NC-SEQ-022` to `023`)
- Tampered historical blobs or invalid historical signatures (`NC-SEQ-024` to `025`)

## Mutation Assurance (14 Mutants, 47 Total Campaign)

14 new mutants (`MUT-SEQ-001` to `MUT-SEQ-014`) verify that the mechanism fails closed if any check is weakened:
- `MUT-SEQ-001`: Bypass predecessor blob SHA-256 verification (killed by `NC-SEQ-008`, `SEQ-T005`)
- `MUT-SEQ-002`: Bypass boundary anchor parent verification (killed by `NC-SEQ-017`, `SEQ-T006`)
- `MUT-SEQ-003`: Permit non-dedicated introducing commit (killed by `NC-SEQ-022`, `SEQ-T004`)
- `MUT-SEQ-004`: Skip signature verification on superseded historical records (killed by `NC-SEQ-025`, `SEQ-T013`)
- `MUT-SEQ-005`: Trust embedded status without topological derivation (killed by `NC-SEQ-016`, `SEQ-T002`)
- `MUT-SEQ-006`: Allow cross-operation supersession (killed by `NC-SEQ-011`, `SEQ-T005`)
- `MUT-SEQ-007`: Disable cycle detection in DAG traversal (killed by `NC-SEQ-013`, `SEQ-T010`)
- `MUT-SEQ-008`: Disable self-supersession check (killed by `NC-SEQ-012`, `SEQ-T009`)
- `MUT-SEQ-009`: Allow multiple active leaves (killed by `NC-SEQ-015`, `SEQ-T002`)
- `MUT-SEQ-010`: Evaluate scope as union across intervals instead of discrete intervals (killed by `NC-SEQ-020`, `SEQ-T011`)
- `MUT-SEQ-011`: Bypass predecessor introducing commit match (killed by `NC-SEQ-009`, `SEQ-T005`)
- `MUT-SEQ-012`: Bypass predecessor path match (killed by `NC-SEQ-007`, `SEQ-T005`)
- `MUT-SEQ-013`: Permit `RESOLVE_DEBT` commits to be checked under `IMPLEMENT` scope (killed by `07-t3-debt-immunity`)
- `MUT-SEQ-014`: Accept unverified leaf if graph traversal reaches terminal node (killed by `NC-SEQ-024`, `SEQ-T007`)

Total mutation campaign: 33 baseline mutants + 14 sequential authorization mutants = 47 mutants.
Required result: `EXPECTED=47`, `APPLIED=47`, `KILLED=47`, `SURVIVED=0`.

## Legacy Compatibility & Bootstrap Proof

1. **Zero Byte Rewriting**: All existing historical root authorizations remain schema-valid and unaltered.
   The `supersession` field is optional (`type: ["object", "null"]`, default `null`).
2. **Bootstrap Proof**: Pre-R5 discovery scans authorizations within change directories. The new change
   `correct-sequential-authorization-lifecycle` contains exactly one root authorization during its
   planning phase, evaluating cleanly at cardinality 1 under pre-R5 discovery.

## Resolution of R4 Review Findings

| Finding ID | Severity | R5 Resolution in Design |
|---|---|---|
| `R4-B01` | BLOCKING | Deterministic package set hashing using POSIX `LC_ALL=C` sort and 2-space checksums |
| `R4-B02` | BLOCKING | Operation-aware commit attribution granting `RESOLVE_DEBT` (T3) immunity from `IMPLEMENT` scope |
| `R4-B03` | BLOCKING | Two-parent clean merge topology ($M_{\text{int}}$) preserving T3 as unbroken first parent |
| `R4-B04` | BLOCKING | Discrete half-open intervals $(C_A, P_B]$ and $(C_B, \text{HEAD}]$ with dedicated 1-path commits |
| `R4-B05` | BLOCKING | In-memory topological leaf derivation with 11 preconditions and fail-closed diagnostics |
| `R4-B06` | BLOCKING | Disaggregated test matrix: 25 negative controls and 14 dedicated mutants (47 total) |
| `R4-H01` | HIGH | Formal bootstrap proof confirming clean discovery under pre-R5 code |
| `R4-M01` | MEDIUM | Locked 8 implementation paths introducing `sequential-authorization.mjs` |

## Migration & Rollout Plan

1. **Phase R5 (Current)**: Complete and freeze the R5 planning evidence package and OpenSpec change proposal.
   Submit freeze report for owner review. No mechanism implementation, no signing.
2. **Phase M1 (Mechanism Implementation)**: Upon receiving signed owner authorization, implement the 8 locked
   paths, 14 repository tests, 25 negative controls, and 14 mutants.
3. **Phase M2 (Verification & Review)**: Run full test loop, strict OpenSpec validation, and 47-mutant campaign.
   Obtain exact-byte review of mechanism commit.
4. **Phase M3 (T3 Integration)**: Create clean two-parent merge commit $M_{\text{int}}$.
5. **Phase M4 (Post-T3 Repair)**: Draft newly bound successor authorization for CB-018, obtain owner signature,
   and apply the 2-file fixture repair in the successor interval.
