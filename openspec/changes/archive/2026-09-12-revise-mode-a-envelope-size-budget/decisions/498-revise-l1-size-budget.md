# Revision of Client-Evidence L1 Size Budget (#498)

Status: **ratified under delegation**.

- **Bound to:** Purpose P1 (*interaction-scoped audit correlation* in `117-client-evidence-purpose.md`), success criteria in `118-success-and-stop-criteria.md`, and issue #498.
- **Decision source:** `decision_source = "delegated to Claude by the owner, 2026-09-11; not a human owner decision"`.
- **Evaluation environment:** Synthetic, non-production only — the #128 proof-of-concept harness. No criterion here authorizes collecting anything from a real user.

## Context

In #128, the Mode A proof-of-concept met every utility, coverage, validation, and privacy threshold in `118-success-and-stop-criteria.md` over 1,112 synthetic interactions:
- U1 (Grouping accuracy): 1.0000 (threshold ≥ 0.99)
- U2 (Incremental utility): 0.3552 (threshold ≥ 0.10)
- C1 (Coverage): 1.0000 (threshold ≥ 0.95)
- V1 (Rejection completeness): 1.0000 (threshold = 1.00)
- V2 (False rejection): 0.0000 (threshold ≤ 0.001)
- L2 (Ingress validation latency p95): 0.0333 ms (threshold ≤ 1 ms)
- P1-inv (Inventory violations): 0 (threshold = 0)
- P1-link (Identifier reuse): 0 (threshold = 0)

However, metric **L1** (serialized envelope size budget ≤ 256 B) was unmet, measuring **357 B max, 354 B median**.

## Structural Analysis

The threshold of 256 B was established in #118 before the envelope shape was designed in #123 and before the 32–64 byte hex nonce bounds were defined. A minimal valid `ClientEvidenceEnvelope v1` with 0 claims consists of:
- `provenance` block: 130 B
- `interaction_id`: 36 B
- `nonce`: 32–64 B
- `envelope_version`, `interaction_kind`, `client_timestamp`, and JSON syntax: ~125 B
- Total minimal size: **323 B** (with 32-char nonce) to **359 B** (with 64-char nonce).

Dropping the nonce and client timestamp reaches 247 B, but removing the server-issued nonce removes Mode A itself.

## Options Evaluated

1. **Option 1 (Revise envelope to imply provenance):** Removing the provenance block from the wire envelope could save ~130 B. However, this violates the closed self-describing model of `ClientEvidenceEnvelope v1`, breaks ADR-009, requires updates to the frozen contract `contracts/security-audit`, and introduces unnecessary complexity across browser and collector packages.
2. **Option 2 (Revise L1 budget to Mode A's structural floor):** Revise the L1 threshold from ≤ 256 B to ≤ 384 B (3 * 128 B). This preserves the integrity of `ClientEvidenceEnvelope v1`, requires no contract churn, and strictly constrains envelope size while providing 27 B headroom over the measured 357 B maximum.

## Decision

Adopt Option 2:
1. Metric L1 in `118-success-and-stop-criteria.md` is hereby superseded and revised to:
   - **Threshold:** `≤ 384 B` serialized envelope bytes per request.
2. With this revision, the Mode A proof-of-concept evaluation outcome is resolved from `REVISE` to **`GO`**.
3. All stop criteria in #118 remain in full force.
