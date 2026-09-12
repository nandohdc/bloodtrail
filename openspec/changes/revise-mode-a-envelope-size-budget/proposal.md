## Why

In #128, the Mode A proof-of-concept met every utility, coverage, validation, and privacy threshold in `118-success-and-stop-criteria.md` over 1,112 synthetic interactions, but one success metric was unmet: **L1**, the serialized envelope size budget of ≤ 256 bytes per request (#498). Measured: **357 B max, 354 B median**.

The run showed that L1 is unreachable as written rather than missed by implementation:
1. The smallest possible envelope `ClientEvidenceEnvelope v1` can produce with zero claims, no transforms, and the minimum 32-byte hex nonce is **323 B** (provenance block: ~130 B, `interaction_id`: 36 B, `nonce`: 32 B, client timestamp and JSON syntax: the rest).
2. With a canonical 64-character hex nonce, the baseline size is **354–357 B**.
3. L1 was written in #118 before the envelope shape was designed (#123) and before the nonce bounds (32–64 B) it inherits were established; it was set against an envelope that did not yet exist.

Two options were analyzed in #498:
- **Option 1 (Revise envelope to imply provenance):** Would remove provenance from the envelope body, saving ~130 B. However, this incurs high churn and architectural risk: ADR-009 fixes client-evidence provenance, `contracts/security-audit` is a frozen contract whose schema/policies reference these fields, and dropping explicit provenance weakens the self-describing closed boundary of client claims.
- **Option 2 (Revise L1 threshold to Mode A's actual floor):** Revises the L1 size budget threshold from ≤ 256 B to ≤ 384 B (3 * 128 B, 0.375 KB), recording why the original estimate did not survive contact with the finalized envelope shape. This keeps `ClientEvidenceEnvelope v1` stable, preserves frozen contract compatibility, and provides 27 B headroom over the measured 357 B maximum while still strictly bounding client payload size.

Under delegated authority (`decision_source = "delegated to Claude by the owner, 2026-09-11; not a human owner decision"`), Option 2 is adopted, resolving the REVISE outcome of the Mode A proof of concept to **GO**.

## What Changes

- **Revise L1 size budget in client-evidence criteria**:
  - Update L1 serialized envelope size threshold from ≤ 256 B to ≤ 384 B per request.
  - Record decision #498 documenting the structural floor analysis and rationale.
- **Update Mode A Proof of Concept harness and evidence**:
  - Update `mode-a-poc.mjs` threshold to evaluate `L1: metrics.L1_envelope_bytes_max <= 384`.
  - Re-run the PoC harness over 1,112 interactions, generating `mode-a-run-2.json` with 100% metrics met and recommendation: `GO`.
  - Update `mode-a-evidence.md` recording the revised threshold and clean `GO` outcome.
- **Add regression test to `@bloodtrail/client-evidence-browser`**:
  - Add test asserting that Mode A serialized envelopes across all 8 interaction kinds with 64-character hex nonces satisfy the L1 budget of ≤ 384 bytes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `client-evidence`: Updates requirement `A Mode A proof of concept decides whether the wave continues` to incorporate the revised L1 envelope size budget of ≤ 384 B (superseding the ≤ 256 B figure from #118), and adds a scenario verifying that serialized Mode A envelopes meet this revised budget.

## Impact

- **Affected code**: `packages/client-evidence-browser/tests/browser.test.ts`, `openspec/specs/client-evidence/spec.md`, and change artifacts.
- **Non-affected code**: Runtime production code in `@bloodtrail/client-evidence-browser`, `@bloodtrail/security-audit-collector`, and `@bloodtrail/security-audit-sdk-core` remains unchanged. Contracts (`contracts/*`) remain unchanged.
- **Governance**: Abbreviated/governed implementation assessment path. No `governance_core` files are modified.
