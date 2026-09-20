# Pull Request: CB-018 Sequential Authorization Lifecycle Correction & Post-T3 Fixture Repair

**Title**: `feat(governance): implement DAG-based sequential authorization lifecycle and repair post-T3 fixtures (#541, #533)`

**Linked Issues**:
- `Fixes #533` (Retire CB-018 semantic debt)
- `Fixes #541` (Implement sequential authorization mechanism)
- `Refs #539` (Sequential authorization proposal)
- `Refs #540` (Proposal PR merge)
- `Refs #542` (Phase 5D review evidence assembly & final PR readiness)

---

## What this changes

This pull request implements the immutable Directed Acyclic Graph (DAG) sequential authorization lifecycle mechanism for bloodtrail governance. It enables signed successor authorizations to supersede predecessor records without mutating historical signed bytes, invalidating cryptographic SSH signatures, or rewriting Git history.

The correction integrates cleanly with immutable ancestor commit T3 (`1021b776331f9268578ea1fd21727521be353182`) via a verified two-parent merge commit $M_{\text{int}}$ (`30dcaf7552cdd3a3b706ecb23e1367812d256c6d`). Dedicated successor authorization commit $C_B$ (`fc1d17ffaef0c88b7672f9eba89aadcfdf12019e`) carries the project owner cryptographic SSH signature and parent anchor to $M_{\text{int}}$, establishing the discrete successor commit interval $(C_B, \text{HEAD}]$. Within this interval, the two-file test fixture repair (`e1a16eadf31881a1d8a932118cf8957ef349dcb5`) resolves tests `CB018-T001` and `R3-T037`. Canonical architecture is permanently recorded in ADR-0013 (`95c3308`), with 100% green verification across the baseline-plus-candidate dual check, 47-mutant mutation campaign, and repository product test loop.

---

## OpenSpec change

- **Change**: `correct-sequential-authorization-lifecycle`
- **Capability**: `change-governance`
- **Task groups covered**: Tasks 1.1–1.4, 2.1–2.4, 3.1–3.4, 4.1–4.3 (Tickets 27–78)

---

## Design-pattern governance

- **Assessment level**: full
- **Decision**: `direct_implementation`
- **Selected pattern IDs**: none (direct implementation of DAG sequential authorization)
- **Alternative compared**:
  - `approach-mutable-status-or-index`: mutating predecessor status or using external indices (rejected: destroys signed byte immutability and creates unverified out-of-band authority).
  - `approach-separate-transition-record`: introducing a third separately signed transition artifact (rejected: redundant metadata; successor dedicated introducing commit already binds exact predecessor object and parent anchor).
- **Rejection reasons cite forces**: yes
- **Invariants bound and their evidence**:
  - `implementation-immutable-sequential-authorization`: `SEQ-T001` proves one exact signed successor becomes sole effective leaf while predecessor remains byte-identical.
  - `implementation-historical-authorization-integrity`: `SEQ-T007`, `SEQ-T008`, `SEQ-T013`, and `NC-SEQ-022` reject edited, status-tampered, unsigned, or non-dedicated historical records.
  - `implementation-interval-bounded-authorization-scope`: `SEQ-T011`, `SEQ-T012`, `SEQ-T014`, `NC-SEQ-017`, and `NC-SEQ-018` enforce discrete intervals $(C_A, P_B]$ and $(C_B, \text{HEAD}]$ and reject cross-interval scope leakage.
  - `implementation-authorization-graph-fail-closed`: `SEQ-T002`–`SEQ-T010` and `NC-SEQ-001`–`NC-SEQ-025` reject missing predecessors, self-supersession, 2-node cycles, $N$-node cycles, branching/forks, or multiple leaves.
  - `implementation-sequential-mutation-assurance`: 14 mutants `MUT-SEQ-001`–`MUT-SEQ-014` killed with clean null controls and byte-identical file restoration.
- **Assessment precedes the earliest governed implementation commit**: yes (`proposal_baseline_commit`: `e1cc9f770160bb1f3d6c8e41b40260cab8fea3ad`)

---

## Security classification

- **`security_sensitive`**: true
- **15 Security Dimension Justifications**:
  1. **`audit_integrity`**: Signed authorization records and git blob hashes are permanent and immutable. Predecessor records retain exact signed bytes and hashes.
  2. **`authentication_or_authorization`**: Introduces DAG-based authority derivation where only the unique topological leaf grants effective execution authority.
  3. **`authority_provenance`**: Successor authorizations carry cryptographic SSH signatures and parent boundary anchors verified against Git ancestry.
  4. **`concurrency`**: Pure functional in-memory DAG construction and interval evaluation with zero shared state or race conditions.
  5. **`confidentiality`**: Operates purely on public git repository metadata and authorization JSON records; handles no secrets.
  6. **`cryptography`**: Enforces Git blob SHA-256 and commit SHA-1 matching for predecessor bindings and validates SSH signature presence.
  7. **`error_disclosure`**: Emits exact, descriptive fail-closed diagnostics without exposing system internals or secrets.
  8. **`external_security_integration`**: Independent dependency-free implementation using Node.js built-ins.
  9. **`fail_posture`**: Fails closed upon missing predecessors, cycles, forks, multiple leaves, scope leakage, or unauthorized path touches.
  10. **`lifecycle`**: Formally binds authority to discrete half-open commit intervals $(C_A, P_B]$ and $(C_B, \text{HEAD}]$.
  11. **`mutation_ownership`**: 47-mutant mutation campaign enforces 100% kill rate and byte-identical file restoration.
  12. **`privacy_transformation`**: Operates strictly on repository source and metadata; does not handle user data.
  13. **`resource_retention`**: Retains no persistent memory buffers or file handles outside execution.
  14. **`retry_or_redelivery`**: Idempotent and deterministic; identical Git history produces identical authorization graphs and diagnostics.
  15. **`trust_boundary`**: Strictly enforces trust boundaries between predecessor and successor commit intervals.

---

## Behavioural classification

- [x] No implementation behaviour is hidden in tests, build files, scripts, or configuration
- [x] No public API change is labelled internal-only
- [x] No concurrency is introduced under a performance-only label
- [x] No material change is split across commits to lower its classification
- [x] No path in this change is unclassified

---

## Governance-core changes

- [x] Full assessment
- [x] Security-sensitive analysis
- [x] Explicit reviewer acknowledgement
- [x] **Trusted baseline** checker result recorded: `passed — checker blob 57a7075c6e1f from origin/main`
- [x] **Candidate** checker result recorded separately: `passed — checker blob 57a7075c6e1f from candidate (working tree)`

---

## Authorization

- [x] This PR does not authorize package publication, production deployment, production collection, real-user processing, framework integration, or delivery infrastructure.
- [x] Scope exclusions are discharged by citing the gates that enforce them:
  - `packages/security-audit-sdk-core/scripts/check-scope.mjs`
  - `packages/security-audit-sdk-node/scripts/check-scope.mjs`
  - `packages/security-audit-collector/scripts/check-scope.mjs`
  - `openspec/scripts/check-design-pattern-governance.mjs`

---

## Verification Results

| Verification Seam | Command | Result |
| :--- | :--- | :--- |
| **Governance Dual-Check** | `node openspec/scripts/run-governance-dual-check.mjs --base origin/main` | **PASS**: Candidate & Baseline exit code 0 |
| **Design Pattern Checker** | `node openspec/scripts/check-design-pattern-governance.mjs` | **PASS**: 19 commits, 38 paths inspected |
| **47-Mutant Campaign** | `node --test openspec/tests/design-pattern-governance/mutation-assurance.test.mjs` | **PASS**: 87/87 tests passed, 47/47 mutants killed |
| **Sequential Unit Suite** | `node --test openspec/tests/design-pattern-governance/normative-precedence-sequential-authorization-controls.mjs openspec/tests/design-pattern-governance/schema-compatibility.test.mjs` | **PASS**: 43/43 tests passed (14 SEQ, 25 NC, 5 SCHEMA) |
| **Debt Retirement Suite** | `node --test openspec/tests/design-pattern-governance/normative-precedence-debt-retirement-controls.mjs` | **PASS**: 11/11 tests passed (CB018-T001 .. CB018-T011) |
| **Product Test Loop** | `make test` | **PASS**: 5 declared workspaces green (~45s) |
| **Contract Reuse Assessment** | `node openspec/scripts/contract-reuse/check.mjs --change correct-sequential-authorization-lifecycle` | **PASS**: Approved skip confirmed |
| **OpenSpec Strict Validation** | `npx --yes @fission-ai/openspec@latest validate --all --strict` | **PASS**: 16/16 passed, 0 failed |
| **Whitespace & Syntax** | `git diff --check` | **PASS**: Clean, 0 whitespace warnings |

---

## Lineage & Commit Attribution Table

| Commit | Subject | Classification / Attribution |
| :--- | :--- | :--- |
| `1021b77` | `chore(governance): retire CB-018 semantic debt (#533)` | Immutable ancestor T3 (Parent 1 of $M_{\text{int}}$) |
| `d3df67e` | `feat(governance): extend change-authorization schema for sequential supersession (#541)` | Mechanism: Schema supersession property |
| `3c704a2` | `feat(governance): implement core sequential authorization graph traversal and invariants (#541)` | Mechanism: Core DAG engine |
| `a18e004` | `feat(governance): integrate sequential authorization discovery and interval scope attribution (#541)` | Mechanism: Discovery & interval scoping |
| `aad70f3` | `test(governance): implement sequential negative controls NC-SEQ-001 through NC-SEQ-025 (#541)` | Mechanism: 25 negative controls |
| `971cf7f` | `test(governance): add sequential mutants MUT-SEQ-001 through MUT-SEQ-014 (#541)` | Mechanism: 14 sequential mutants |
| `478cd43` | `test(governance): verify 100% kill rate across sequential mutation assurance campaign (#541)` | Mechanism: Mechanism head freeze |
| `30dcaf7` | `chore(governance): merge sequential authorization mechanism into T3 lineage (#541)` | Integration merge $M_{\text{int}}$ (`P1=T3`, `P2=478cd43`) |
| `fc1d17f` | `docs(governance): authorize CB-018 post-T3 test fixture repair (#541)` | Successor authorization $C_B$ (SSH signed, bound to $M_{\text{int}}$) |
| `ca204e2` | `fix(governance): refine sequential discovery filtering and delta inheritance (#541)` | Mechanism refinement: Discovery filtering (Issue #541) |
| `e1a16ea` | `test(governance): repair post-T3 debt retirement test fixtures (#541)` | CB-018 repair: 2-file fixture repair in $(C_B, \text{HEAD}]$ |
| `c2b9c9c` | `docs(governance): register schema compatibility test in sequential authorization assessment (#542)` | Governance remediation: Owned path declaration |
| `95c3308` | `docs(adr): record ADR-0013 DAG-based sequential authorization lifecycle (#542)` | Documentation: Canonical ADR-0013 & glossary |

---

## Merge Guidance

Under repository governance rules, this pull request **MUST NOT** be rebased or squashed into `main`. It must be merged via an identity-preserving two-parent merge commit:

```bash
git checkout main
git pull origin main
git merge --no-ff feat/cb-018-r3-implementation -m "Merge pull request #543 from nandohdc/feat/cb-018-r3-implementation"
```
