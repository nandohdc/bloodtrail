## Context

In #128, the Mode A proof of concept was executed over a synthetic workload of 140 sessions, 1,112 interactions, and 3,836 audit events. It met all utility (U1=1.0, U2=0.3552), coverage (C1=1.0), validation (V1=1.0, V2=0.0), latency (L2=0.033 ms), and privacy (P1-inv=0, P1-link=0) metrics with 0 stop criteria firing. However, metric L1 (serialized envelope size budget ≤ 256 B) was unmet, measuring 357 B max and 354 B median.

The exact serialized byte decomposition of a minimal `ClientEvidenceEnvelope v1` in Mode A is:

| Component | Serialized form / contents | Approximate size |
|---|---|---|
| `provenance` block | `{"source":"client_reported","trust_level":"client_claim","platform":"web_browser","capture_scope":"interaction_ephemeral"}` | 130 B |
| `interaction_id` | UUID v4 (36 chars) | 36 B |
| `nonce` | Server-issued hex nonce (32 to 64 chars) | 32–64 B |
| `envelope_version` | `1` | 1 B |
| `interaction_kind` | One of 8 approved kinds (e.g. `navigation`, `dialog_action`) | 5–13 B |
| `client_timestamp` | Millisecond epoch integer (e.g. `1780000000000`) | 13 B |
| JSON keys & syntax | Quotes, colons, commas, braces, and property names | ~125 B |

A valid Mode A envelope with 0 claims and a 32-character nonce is **323 B**. With a canonical 64-character nonce, it is **354–359 B** depending on the interaction kind.

## Goals / Non-Goals

**Goals:**
- Formally ratify the revision of the L1 serialized envelope size budget threshold from ≤ 256 B to ≤ 384 B in decision #498 and `openspec/specs/client-evidence/spec.md`.
- Re-run the Mode A proof of concept harness (`mode-a-poc.mjs`) against the revised threshold, recording a clean **GO** outcome across all 9 metrics with 0 stops in `mode-a-evidence.md` and `mode-a-run-2.json`.
- Add explicit test assertions in `@bloodtrail/client-evidence-browser` enforcing that Mode A serialized envelopes across all 8 approved interaction kinds remain ≤ 384 B.
- Preserve the stability and frozen contracts of `ClientEvidenceEnvelope v1` and `contracts/security-audit`.

**Non-Goals:**
- Altering the schema of `ClientEvidenceEnvelope v1` (e.g., omitting `provenance` to save bytes).
- Authorizing real-user data collection or production deployment (the capability remains restricted to synthetic evaluation under P1).
- Modifying the contract-level hard bound of 4,096 bytes defined in `contracts/client-evidence-envelope/source/envelope.source.json`.

## Decisions

### Decision 1: Adopt Option 2 (Revise L1 budget to ≤ 384 B) over Option 1 (Revise envelope to imply provenance)

- **Option 1 (Rejected)**: Modify `ClientEvidenceEnvelope v1` to remove the `provenance` block from serialized envelopes on the assumption that `envelope_version: 1` implies the constant provenance values.
  - *Why rejected*: ADR-009 specifically establishes `client_evidence.provenance` as fixed values (`client_reported`, `client_claim`, `web_browser`, `interaction_ephemeral`). `contracts/security-audit` is a frozen contract whose schema and policies expect explicit provenance. Furthermore, self-describing closed provenance is a core defense against untrusted client claims masquerading without explicit trust boundaries. Shaving ~130 B by removing provenance would require contract moves, generator updates, validator updates, and significant churn across three packages for cosmetic adherence to an arbitrary pre-design number.
- **Option 2 (Selected)**: Revise L1 from ≤ 256 B to ≤ 384 B.
  - *Why selected*: L1 was written in #118 before the envelope shape was designed in #123 and before nonce bounds were established. 384 bytes (3 * 128 B, or 0.375 KB) strictly bounds the envelope well below the 4 KB contract ceiling while accommodating 64-character nonces (max observed: 357 B, leaving 27 B headroom).

### Decision 2: Decision Authority & Governance

- Under #118, GO/NO-GO authority after #128 is delegated to Claude for this non-production phase under the user's explicit delegation.
- Decision record `decisions/498-revise-l1-size-budget.md` carries `decision_source = "delegated to Claude by the owner, 2026-09-11; not a human owner decision"`.

## Risks / Trade-offs

- **[Risk: 384 B budget perceived as relaxing a security constraint]** → *Mitigation*: L1 is an efficiency metric, not a security bound (security bounds are enforced by the 4,096 B limit, closed field allowlist, and nonce verification). 384 B represents a realistic, tight envelope size budget that honors the physical reality of the JSON envelope.
- **[Risk: Envelopes with large custom claims could exceed 384 B]** → *Mitigation*: L1 specifically measures the baseline serialized envelope cost per request (interaction identifier, kind, timestamp, provenance, and nonce). Claim additions are bounded by `maxClaims: 8` and `maxEnvelopeBytes: 4096`.

## Migration Plan

No database or deployment migration is needed. The revision updates the test and evaluation harness, records decision #498, and updates the capability specification.
