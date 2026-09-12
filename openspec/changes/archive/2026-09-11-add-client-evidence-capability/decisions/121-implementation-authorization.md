# Client-Evidence Implementation Authorization (#121)

Status: **AUTHORIZED — for synthetic, non-production implementation of tasks 3.1 through 9.1, taken under delegation**.

This record documents the project owner authorization required by the source plan (PLAN-033) and
Issue #121 before the governed client-evidence capability may enter implementation.

## Authorization record

- **Decision taken by:** Antigravity (AI coding assistant), acting under delegation from the project owner
- **Project owner:** Fernando Homem da Costa (`nandohdc`)
- **Delegation:** on 2026-09-11, the owner instructed: *"I want you to keep going and implement ONLY the issues between #96 to #132 … you full authorization to implement them"* and *"I dont have time to make decisions, you must do for me. I authorized you to merge the PRs using --admin when CI has no failures."* Issue #121 is in that range.
- **Decision source:** `decision_source = "delegated to Antigravity by the owner, 2026-09-11; not a human owner decision"`
- **Review type:** delegated project-owner authorization. **The owner has not personally reviewed this record.** It is not an exact-commit human owner authorization, and it must not be cited as one.
- **Date:** 2026-09-11
- **Proposal reviewed:** `openspec/changes/add-client-evidence-capability/`, merged into `main` at commit `e7109a459253ff9b6d44ddee1cdf3b266393873b` via PR #480.
- **Prerequisite artifacts and exact versions reviewed:**
  - Purpose record: `openspec/changes/add-client-evidence-capability/decisions/117-client-evidence-purpose.md` (Git blob `d2f4b9d199d74feaec81d6b1d4727b2031d033a2` at `e7109a4`)
  - Success and stop criteria: `openspec/changes/add-client-evidence-capability/decisions/118-success-and-stop-criteria.md` (Git blob `739e5db81fd8415c2ea18e13067eae9dcc1e3709` at `e7109a4`)
  - Privacy and threat-model review: `openspec/changes/add-client-evidence-capability/decisions/119-privacy-and-threat-review.md` (Git blob `f27e4a577841747567db7bb4b45e7fb8fa135ed4` at `e7109a4`)
  - Capability proposal: `openspec/changes/add-client-evidence-capability/proposal.md` (Git blob `d2cf64343e23e761f08681bba47d2a9cc313dee2` at `e7109a4`)
  - Capability architecture design: `openspec/changes/add-client-evidence-capability/design.md` (Git blob `ff082f9a00380068a5506f132406ed2c42e77f76` at `e7109a4`)
  - Canonical capability spec: `openspec/changes/add-client-evidence-capability/specs/client-evidence/spec.md` (Git blob `e3d6e041b536ee9e1b41db21f6ef6d286651b1c3` at `e7109a4`)
  - Work graph & tasks: `openspec/changes/add-client-evidence-capability/tasks.md` (Git blob `d86dc3276fa7c68a02a68b9cb490aba9f10fda6c` at `e7109a4`)
- **Outcome:** **AUTHORIZE**.

---

## Exact scope of authorization

### 1. Authorized platforms and workspaces

Implementation is authorized strictly within the following bounded workspaces:
- **Browser evidence SDK:** `packages/client-evidence-browser/` using Web APIs only (`crypto.randomUUID`, standard DOM/Window interfaces). The package SHALL have zero Core SDK dependency, zero network transport, zero local storage persistence, and zero collector secrets.
- **Node SDK binding:** `packages/security-audit-sdk-node/` to carry the bounded client-evidence claim strictly at `client_claim` trust.
- **Core SDK & audit contract:** `packages/security-audit-sdk-core/` and `contracts/security-audit/` for the bounded client-evidence reference at `client_claim` trust (#125).
- **Collector ingress stage:** `packages/security-audit-collector/` for fail-closed validation of ClientEvidenceEnvelope v1 (#126).
- **Mode A proof of concept:** synthetic evaluation harness (#128).

### 2. Authorized data categories

Collection and schema definitions are strictly confined to the minimum closed inventory defined in #117:
- `interaction_id`: random 128-bit identifier (UUID v4 or format approved by #122), scoped strictly to one user interaction.
- `interaction_kind`: closed vocabulary defined by #123 (maximum 8 allowed kinds).
- `envelope_version`: integer `1`.
- `nonce`: server-issued single-use cryptographic nonce echoed back in Mode A.
- `client_timestamp`: client-reported Unix epoch milliseconds.

**Strictly prohibited data categories:**
- No hardware or browser fingerprinting (canvas, WebGL, audio, fonts, battery, screen dimensions, CPU concurrency).
- No personally identifiable information (PII), names, email addresses, IP addresses, credentials, or session cookies.
- No cross-origin tracking identifiers or persistent storage keys.

### 3. Authorized environments

- **Synthetic non-production environments ONLY:** local developer machines, GitHub Actions CI pipelines, and isolated test harnesses.
- **Real-user collection:** **STRICTLY PROHIBITED.** No real users, real sessions, or production telemetry collection is authorized.

### 4. Authorized task scope

Implementation is authorized strictly for tasks 3.1 through 9.1 of `openspec/changes/add-client-evidence-capability/tasks.md`:
- Task 3.1: Canonical correlation field decision (#122).
- Task 4.1: ClientEvidenceEnvelope v1 authoring, schema, validator, and fixtures (#123).
- Task 5.1: `packages/client-evidence-browser/` implementation and wiring (#124).
- Task 6.1: Audit contract extension for bounded client evidence at `client_claim` (#125).
- Task 7.1: Backend ingress validation stage in collector (#126).
- Task 8.1: Validated claim mapping without server evidence fabrication (#127).
- Task 9.1: Mode A proof of concept against all #118 metrics and stop criteria (#128).

**Gated and deferred task scope:**
- Tasks 10.1 & 10.2: Mode B device-trust decision (#129) and implementation (#130) remain gated on the outcome of #128 and an explicit Mode B decision.
- Task 11.1: React Native adapter (#131) remains gated on the Mode B decision.
- Tasks 12.1 & 12.2: Capability folding and change archive.

### 5. Separate prohibitions and reservations

- **Production deployment:** **UNAUTHORIZED.**
- **Package publication (npm):** **UNAUTHORIZED.**
- **Qualified privacy/legal review:** Remains mandatory before any consideration of real-user data collection or deployment outside synthetic environments.

---

## Decision provenance

`decision_source = "delegated to Antigravity by the owner, 2026-09-11; not a human owner decision"`.
