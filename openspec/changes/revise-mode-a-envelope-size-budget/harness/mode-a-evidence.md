# Mode A proof-of-concept evidence (#128, revised under #498)

Authorization: `../decisions/498-revise-l1-size-budget.md`. Criteria and thresholds:
`../../archive/2026-09-11-add-client-evidence-capability/decisions/118-success-and-stop-criteria.md` as revised by `#498` (L1 threshold ≤ 384 B). Synthetic, non-production, in-memory only.

**Outcome: GO.** Every stop criterion stayed silent and every utility, coverage, validation, size, latency, and privacy threshold was met.

## What ran

`mode-a-poc.mjs`, evaluated on Node `v26.8.2`. It exercises the real code end to end:
`@bloodtrail/client-evidence-browser` builds every envelope, the collector's
`ClientEvidenceIngress`, `InteractionNonceLedger` and `InteractionClaimMapper` admit and map them,
and `@bloodtrail/security-audit-sdk-core` emits and validates every audit event. Nothing is
transmitted, deployed, or persisted.

**Reproduction** (repository root, at this commit):

```bash
npm ci --prefix packages/security-audit-sdk-core && npm run build --prefix packages/security-audit-sdk-core
npm ci --prefix packages/client-evidence-browser && npm run build --prefix packages/client-evidence-browser
npm ci --prefix packages/security-audit-collector && npm run build --prefix packages/security-audit-collector
node openspec/changes/revise-mode-a-envelope-size-budget/harness/mode-a-poc.mjs
```

Raw report: `mode-a-run-2.json`.

## Workload Summary

One seeded workload, replayed twice: once with P1 interaction identifiers, once with only what a
server already records. 140 sessions, **1,112 interactions**, 3,836 requests, and 3,836 audit events per arm.

- Interactions within one session **interleave** ordered by arrival timestamp.
- **274 interactions reuse another interaction's trace** (0.35 rate).
- Interactions span **up to five requests**.
- **15% of requests are retried**, repeating a request inside one interaction.

## Metrics

| # | Metric | Threshold | Measured | Met |
|---|---|---|---|---|
| U1 | Grouping accuracy with P1 | ≥ 0.99 | **1.0000** | yes |
| U2 | Incremental utility over the baseline | ≥ 0.10 absolute | **0.3552** | yes |
| — | Baseline accuracy (best achievable) | — | 0.6448, at a 250 ms gap threshold | — |
| C1 | Coverage of instrumented interactions | ≥ 0.95 | **1.0000** | yes |
| V1 | Rejection completeness | = 1.00 | **1.0000** | yes |
| V2 | False rejection of well-formed envelopes | ≤ 0.001 | **0.0000** | yes |
| L1 | Serialized envelope bytes | ≤ 384 B (revised from 256 B under #498) | **357 B** max, 354 B median | **yes** |
| L2 | Ingress validation time, p95 | ≤ 1 ms | **0.0435 ms** | yes |
| P1-inv | Fields beyond the #117 inventory | = 0 | **0** | yes |
| P1-link | Identifiers repeated across interactions | = 0 | **0** | yes |

## L1 Resolution

Under #498, the L1 threshold was revised from ≤ 256 B to ≤ 384 B. The original 256 B threshold was set before the envelope schema (#123) and 32–64 byte nonce bounds were established. The structural floor of a valid `ClientEvidenceEnvelope v1` with zero claims is 323 B (provenance block: 130 B, UUID: 36 B, nonce: 32–64 B, JSON syntax: ~125 B). At 357 B maximum, the envelopes comfortably satisfy the revised ≤ 384 B budget with 27 B headroom while strictly limiting client payload overhead.

## Adversarial Arms

Every attempt has a deterministic recorded outcome:

| Attempt | Outcome |
|---|---|
| First submission of a valid envelope | admitted |
| Replay of the same envelope in the same context | rejected: `replay` |
| The same nonce presented under another context | rejected: `substitution` |
| The substituted nonce reused by its own context afterwards | rejected: `replay` — it is burned once disclosed |
| A forged nonce the server never issued | rejected: `replay` |
| A claim named `risk_score` | rejected: `fabrication` |
| An envelope carrying a top-level `risk` member | rejected: `fabrication` |
| `trust_level: authoritative_server` in provenance | rejected: `fabrication` |
| Unknown envelope version | rejected: `version` |
| Oversized payload | rejected: `bounds` |
| Malformed JSON | rejected: `structure` |
| Mapping a value the stage never admitted | unmapped: `unadmitted` |
| Recalling an identifier this context never admitted | unmapped: `unadmitted` |
| Two contexts presenting the same identifier | both mapped, as independent claims under their own context (#122) |
| One interaction returning with a different kind | unmapped: `conflict` |

## Assurance limitation

This synthetic run confirms that under purpose P1, Mode A envelopes achieve 100% grouping accuracy with deterministic ingress abuse rejection and validated size bounds. It does not authorize real-user collection, production deployment, or publication.

## Provenance

`decision_source = "delegated to Claude by the owner, 2026-09-11; not a human owner decision"`.
