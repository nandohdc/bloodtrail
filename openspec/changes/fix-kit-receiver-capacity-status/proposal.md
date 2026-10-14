## Why

Issue [#798](https://github.com/nandohdc/bloodtrail/issues/798) reproduces the example receiver answering the collector's no-storage deduplication capacity refusal with `500 {"error":"ingress_rejected"}`. This disguises bounded backpressure as an unexpected ingress failure. See the [executed triage](https://github.com/nandohdc/bloodtrail/issues/798#issuecomment-6160374019) and [agent brief](https://github.com/nandohdc/bloodtrail/issues/798#issuecomment-6160374199).

## What Changes

Name the refusal by its diagnostic code at the existing receiver seam, prove it in a fresh installed-kit receiver and a measured negative control, and document its wire answer. No collector, Core, contract, public export, shared HTTP classification or delivery retry changes.

### Delegated recommendations

Decision source: owner decision, 2026-10-14, via overnight planning in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E

These are Claude's delegated recommendations, subject to owner override, not personal owner approval.

| ID | Delegated decision |
| --- | --- |
| R1 | Answer capacity with `429`. |
| R2 | Use exactly `{"error":"deduplication_capacity"}`. |
| R3 | Match `DIAGNOSTIC_CODES.DEDUPLICATION_CAPACITY` (`COLLECTOR_DEDUPLICATION_CAPACITY`) by code, like conflict; preserve the unknown-category `?? 500` / `ingress_rejected` fallback. |
| R4 | Send no `Retry-After` header. |
| R5 | Preserve the 32-identity / 300 s no-storage cap ratified by #478; do not edit the collector. |
| R6 | Add only the requirement "The example receiver names a deduplication capacity refusal" to the Node capability; leave "The example receiver models a careful ingress" byte-identical. |
| R7 | Add the wire capacity row and note: `429` maps to `http_retryable` / `SDK_SINK_FAILURE`; the SDK does not read `Retry-After`; retry inside the 300 s window meets the same refusal. Preserve "No delivery retry (planned)". |
| R8 | Use a fresh receiver exclusively for 32 acknowledged identities, refusals 33–34, healthy health and an acknowledged duplicate; add a measured capacity-to-500 negative kit control. |
| R9 | Create `fix-kit-receiver-capacity-status`, `security_sensitive: false`, all 15 justifications and checker-required full assessment. |
| R10 | No ADR or glossary term. |

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-node`: the example receiver names a deduplication capacity refusal; exactly one ADDED requirement, without replacing careful ingress.

## Impact

Only the six change artifacts, example receiver, existing kit delivery/control/gate scripts and `docs/wire-protocol.md` are owned (exact paths in assessment.json). The Node documentation search found no other example-receiver answer enumeration requiring revision; general transport error examples remain unchanged. No production guarantee, durable storage, admission policy, cap, authentication or automatic retry is introduced. Merge, canonical fold and archive are excluded.
