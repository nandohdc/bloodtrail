# Mode A proof-of-concept evidence (#128)

Authorization: `../decisions/121-implementation-authorization.md`. Criteria and thresholds:
`../decisions/118-success-and-stop-criteria.md`. Synthetic, non-production, in-memory only.

**Outcome: REVISE.** Every stop criterion stayed silent and every utility, coverage, validation and
privacy threshold was met. One success metric was not: L1, the envelope's size budget, and the run
shows it is unreachable as written rather than missed by implementation.

## What ran

`mode-a-poc.mjs`, at `main` plus this change, on Node `v26.8.1`. It is the real code end to end:
`@bloodtrail/client-evidence-browser` builds every envelope, the collector's
`ClientEvidenceIngress`, `InteractionNonceLedger` and `InteractionClaimMapper` admit and map them,
and `@bloodtrail/security-audit-sdk-core` emits and validates every audit event. Nothing is
transmitted, deployed, or persisted.

**Reproduction** (repository root, at this commit):

```bash
npm ci --prefix packages/security-audit-sdk-core && npm run build --prefix packages/security-audit-sdk-core
npm ci --prefix packages/client-evidence-browser && npm run build --prefix packages/client-evidence-browser
npm ci --prefix packages/security-audit-collector && npm run build --prefix packages/security-audit-collector
node openspec/changes/add-client-evidence-capability/harness/mode-a-poc.mjs
```

Raw report: `mode-a-run-1.json`.

## The workload, and why it is the hard case

One seeded workload, replayed twice: once with P1 interaction identifiers, once with only what a
server already records. 140 sessions, **1,112 interactions**, 3,836 requests, and so 3,836 audit
events per arm. It contains every case #118 names as making the question hard:

- interactions within one session **interleave**, because their requests are ordered by time;
- **274 interactions reuse another interaction's trace**, at a 0.35 rate, which is what real trace
  instrumentation does;
- an interaction **spans up to five requests**;
- **15% of requests are retried**, repeating a request inside one interaction.

The trace-reuse and retry rates are the only knobs that could flatter P1. They are stated here and in
the report rather than tuned against the result.

## Metrics

| # | Metric | Threshold | Measured | Met |
|---|---|---|---|---|
| U1 | Grouping accuracy with P1 | ≥ 0.99 | **1.0000** | yes |
| U2 | Incremental utility over the baseline | ≥ 0.10 absolute | **0.3552** | yes |
| — | Baseline accuracy (best achievable) | — | 0.6448, at a 250 ms gap threshold | — |
| C1 | Coverage of instrumented interactions | ≥ 0.95 | **1.0000** | yes |
| V1 | Rejection completeness | = 1.00 | **1.0000** | yes |
| V2 | False rejection of well-formed envelopes | ≤ 0.001 | **0.0000** | yes |
| L1 | Serialized envelope bytes | ≤ 256 B | **357 B** max, 354 B median | **no** |
| L2 | Ingress validation time, p95 | ≤ 1 ms | **0.049 ms** | yes |
| P1-inv | Fields beyond the #117 inventory | = 0 | **0** | yes |
| P1-link | Identifiers repeated across interactions | = 0 | **0** | yes |

**The baseline was given every advantage.** It groups by session and trace and then splits on a time
gap, and the harness tries ten gap thresholds and keeps the best one — an oracle no deployment has.
Its ceiling is 0.6448 because a reused trace makes several interactions indistinguishable, which no
threshold repairs.

**P1-link** counts identifier reuse across the run's 1,112 interactions. The second half of that
criterion — that no identifier is persisted client-side — is a property of the browser package,
which holds no storage API at all; its own scope gate and tests carry that, not this run.

## Why L1 is unmet

A Mode A envelope cannot reach 256 bytes. The smallest one this code can produce, with the shortest
admitted nonce and no claims, is **323 bytes**:

- ~130 B is the `provenance` block, whose four values are the only ones P1 admits — it restates
  constants on every request;
- 36 B is the interaction identifier, 32–64 B the server-issued nonce, and the rest is field names.

Dropping the nonce and client timestamp would reach 247 B, but the nonce is what binds a Mode A
claim to an interaction the server started, so removing it removes the mode.

The threshold predates both the envelope's shape (#123) and the nonce bounds it inherits, so it was
set against an envelope that did not yet exist. Two revisions are open, and **neither is taken
here**, because revising a criterion in the same breath as failing it is how a criterion stops
meaning anything:

1. **Revise the envelope** so `envelope_version` implies the constant provenance, which would remove
   roughly 130 B. This keeps the intent — a small client cost — and costs an envelope contract move.
2. **Revise L1** to the floor Mode A actually has (~325 B with a 32-byte nonce), recording that the
   original figure was set before the envelope existed.

Filed as #498.

## Adversarial arms

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

## What this run does and does not show

It shows that, on synthetic data, an interaction identifier groups server events exactly where the
best server-side alternative reaches 0.64, that the ingress refuses every attempted abuse
deterministically, and that validation costs about 50 microseconds per envelope.

It does not show that a real browser produced any claim, that a real user performed any interaction,
that the producer did not fabricate the whole exchange, or anything about real traffic, real
devices, or production. Mode A cannot show those, and #119 records that spoofing stays unpreventable
within it. **This run authorizes nothing**: not production, not real-user collection, not
publication, and not Mode B.

## Provenance

`decision_source = "delegated to Claude by the owner, 2026-09-11; not a human owner decision"`. The
owner has not reviewed this run or its outcome. Under #118 the GO/NO-GO authority is the project
owner's, delegated to Claude for this non-production phase only.
