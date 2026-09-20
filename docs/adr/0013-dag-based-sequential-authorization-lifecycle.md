# ADR 0013: DAG-based sequential authorization lifecycle

- Status: Accepted
- Date: 2026-09-19
- Decision owners: Project owner

## Context

All governed changes in this repository require cryptographically signed authorization records stored under `openspec/changes/*/governance/authorizations/`. Once signed by the project owner using their dedicated SSH key, an authorization record's exact byte content and Git blob SHA-256 are immutable.

Under the historical change authorization schema, an authorization record embedded a static `status: "CURRENT"` field. When an authorized change introduced accepted semantic debt or required follow-up corrections—such as workstream CB-018, where commit T3 (`1021b776331f9268578ea1fd21727521be353182`) was integrated into mainline with debt requiring post-merge test fixture repair—the repository had no mechanism to authorize the successor work without violating core governance invariants:

1. Modifying the predecessor authorization file in-place to reflect supersession would mutate signed historical bytes, destroying cryptographic SSH signature validity and invalidating the historical audit trail.
2. Relying on an external, mutable registry or index to record supersession would create out-of-band authority decoupled from Git commit lineage and provenance verification.
3. Rebasing or amending historical commits (such as T3 or its integration merge commit $M_{\text{int}}$) is strictly prohibited by repository immutability rules.

A mechanism was required to express sequential authorization lifecycles deterministically, preserving byte-for-byte historical immutability while strictly bounding the scope and temporal interval of successor authorizations.

## Decision

The repository adopts an in-memory Directed Acyclic Graph (DAG) sequential authorization engine integrated into `openspec/scripts/normative-precedence/sequential-authorization.mjs`, `authorization-discovery.mjs`, and `model.mjs`.

### 1. Cryptographic Predecessor Binding

A successor authorization record declares an optional `supersession` object in `change-authorization.schema.json` with `additionalProperties: false`, binding its exact predecessor:

- `predecessor_id`: The exact string identifier of the predecessor authorization record.
- `predecessor_path`: The repository-relative path to the predecessor authorization file.
- `predecessor_object`: The exact Git blob SHA-256 of the predecessor record bytes.
- `predecessor_introducing_commit`: The exact Git commit SHA-1 that introduced the predecessor record.
- `change_id`: The owning OpenSpec change identifier (must match the predecessor).
- `operation`: The lifecycle operation being authorized (must match the predecessor, e.g., `APPLY` or `IMPLEMENT`).

Any discrepancy between declared predecessor fields and the repository's immutable Git history causes the governance engine to fail closed.

### 2. Topological Invariants & Graph Resolution

The authorization engine constructs a directed adjacency graph for each `(change_id, operation)` pair, where directed edges point from predecessors to successors. The graph must strictly satisfy eleven topological invariants:

1. **Single-root invariant**: Exactly one root authorization record exists per `(change_id, operation)` with no `supersession` declaration.
2. **Exact predecessor existence**: The predecessor named by a successor must resolve to a valid historical record in Git.
3. **Self-supersession guard**: An authorization record cannot declare itself as its predecessor.
4. **Two-node cycle guard**: Mutual supersession between two records ($A \to B$ and $B \to A$) is rejected.
5. **$N$-node cycle guard**: Depth-first search traversal detects and rejects cycles of arbitrary length.
6. **Forking / branching guard**: An authorization record cannot be superseded by more than one successor (out-degree $\le 1$).
7. **Orphan successor guard**: Every successor must possess an unbroken directed path tracing back to the unique root.
8. **Linear chain invariant**: The authorization graph must resolve to a single linear chain of authority without splits or merges.
9. **Unique leaf resolution**: The sole node with out-degree zero is identified as the unique topological leaf holding effective authority.
10. **Revocation propagation**: If any authorization node in the lineage from root to leaf has `status: "REVOKED"`, revocation propagates to all downstream successors (poison-pill semantics), and effective authority drops to zero.
11. **Dedicated single-path commit**: Each authorization record must be introduced in a dedicated single-path Git commit ($C_A, C_B$), ensuring unambiguous commit-level provenance.

### 3. Discrete Commit Intervals

Authority is evaluated over discrete, non-overlapping half-open commit intervals:

- **Predecessor Interval**: $(C_A, P_B]$, spanning from the predecessor's introducing commit $C_A$ up to the successor's parent boundary anchor $P_B$. Commits in this interval are authorized strictly against predecessor scope.
- **Successor Interval**: $(C_B, \text{HEAD}]$, spanning from the successor's introducing commit $C_B$ up to the candidate HEAD. Commits in this interval are authorized strictly against successor scope.

Successors cannot retroactively authorize changes introduced in prior intervals, and predecessors cannot authorize changes past their parent boundary anchor. Commits occurring outside authorized intervals fail closed.

### 4. Path-Perimeter Attribution Immunity

To permit semantic debt retirement alongside implementation work, commits that modify exclusively debt-resolution paths (`RESOLVE_DEBT`, such as T3's debt retirement pin) are exempt from `IMPLEMENT` scope checking. This attribution immunity is strictly bounded: any commit touching both debt-resolution paths and other repository paths loses immunity and is subject to full scope verification.

### 5. Issuance-Time Status Semantics

The JSON property `status: "CURRENT"` is retained in authorization records as the author's issuance-time assertion. Effective runtime authority is never read from this static field; it is computed dynamically by traversing the authorization DAG and selecting the unique topological leaf. A predecessor record retaining `status: "CURRENT"` in its signed bytes does not conflict with a successor, because runtime leaf derivation supersedes the static assertion.

## Lifecycle Vocabulary

- **Sequential authorization**: An evidence-bearing lifecycle mechanism where a signed successor authorization supersedes an earlier authorization for the same operation without mutating historical bytes or cryptographic signatures.
- **Successor authorization record**: A dedicated, cryptographic-signature-bearing authorization record that explicitly binds an exact predecessor via Git blob SHA-256 and introducing commit SHA-1, superseding it within its own commit interval.
- **Predecessor binding**: The immutable relation in which a successor declares `predecessor_id`, `predecessor_path`, `predecessor_object`, and `predecessor_introducing_commit`. Any drift in these fields fails closed.
- **Effective authority leaf**: The unique topological leaf (out-degree zero) of the authorization DAG for a given `(change_id, operation)`. Only this leaf grants effective execution authority.
- **Discrete commit interval**: The half-open commit range $(C_{\text{intro}}, P_{\text{successor}}]$ or $(C_{\text{intro}}, \text{HEAD}]$ within which a specific authorization's scope is strictly evaluated.
- **Path-perimeter attribution immunity**: The governance rule under which commits modifying strictly debt-resolution paths (`RESOLVE_DEBT`) are exempt from implementation scope checking under an `IMPLEMENT` or `APPLY` authorization.
- **Issuance-time status**: The static JSON property `status: "CURRENT"` recorded at authorization creation time as the author's issuance assertion. Effective runtime status is derived dynamically from graph traversal.

## Consequences

- Historical signed authorization bytes remain permanently immutable; zero existing commits or signatures are invalidated when introducing a successor.
- Successor authorizations can be introduced at any point in Git history without rebasing, squashing, or amending past commits.
- Governance checks fail closed if any ambiguity, fork, cycle, broken binding, or unauthorized path modification is detected.
- Scope leakage across discrete intervals is prevented, eliminating retroactive authorization vulnerabilities.
- Adversarial mutation testing (via 14 dedicated sequential mutants `MUT-SEQ-001` through `MUT-SEQ-014` and 25 negative controls `NC-SEQ-001` through `NC-SEQ-025`) guarantees that every invariant arm fails closed upon mutation.

## Alternatives Considered

### In-place status edit in predecessor record
Rejected. Modifying `status: "CURRENT"` to `status: "SUPERSEDED"` in the predecessor file mutates signed bytes, breaks the owner's cryptographic SSH signature, and destroys historical auditability.

### External mutable index or registry
Rejected. Recording supersession in an external JSON index or database introduces out-of-band authority that is decoupled from Git commit lineage, cannot be verified by Git blob hashes, and is susceptible to race conditions.

### Separate transition record artifact
Rejected. Requiring a distinct third artifact (e.g. `transition.json`) between predecessor and successor creates redundant metadata without increasing identity evidence. The successor's dedicated introducing commit already binds its exact predecessor object and parent anchor.

### Git history rewriting (rebase / amend)
Rejected. Rewriting commits on protected lineages violates repository governance and destroys the unbroken ancestry required to prove mainline continuity from T3 to HEAD.
