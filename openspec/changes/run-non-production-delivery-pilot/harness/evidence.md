# Pilot evidence (#116)

Authorization: `../pilot-authorization.md`. Every run is loopback-only, synthetic, and at most 120
seconds, and every run ends with the pilot directory deleted.

**Reproduction** (repository root, clean clone, at the run's commit):

```bash
npm ci --prefix packages/security-audit-sdk-core && npm run build --prefix packages/security-audit-sdk-core
npm ci --prefix packages/security-audit-sdk-node && npm run build --prefix packages/security-audit-sdk-node
npm ci --prefix packages/security-audit-collector && npm run build --prefix packages/security-audit-collector
node openspec/changes/run-non-production-delivery-pilot/harness/pilot.mjs
```

## Run 1 — terminated on a stop criterion

| Item | Value |
|---|---|
| Commit | `main` at `d4bd9b6a63399cfdccbc7083474cb1dc8a76f067` (#115 merged; #478 not yet fixed) |
| Harness | the first revision of `pilot.mjs`: the same workload and criteria, before rollback moved into a `finally` and before duplicates were acknowledged only when persisted. Neither refinement changes a number below |
| Node.js | `v26.8.1` |
| Contract | `1.1.0` |
| Raw output | `run-1-output.json` |

**Preflight:** all six stop criteria fired on their planted defects and stayed silent on the null
control; rollback removed the probe directory.

| Measure | Value |
|---|---|
| Stop criterion | **`SC4-deadline`** after 124.8 s |
| HTTP requests | 1,289 |
| Deliveries acknowledged / exhausted | 32 / 418 |
| Retries scheduled | 839 |
| Collector `persisted` | **32** |
| Collector `rejectedDeduplicationCapacity` | **1,254** |
| Storage read-back of acknowledged events | 32 / 32 found |
| Whole-record expiry, clock advanced past the longest retention | 11 + 11 + 10 deleted, 0 remaining |
| Shutdown | 450 accepted, 450 completed, 0 abandoned; a submission after shutdown was `rejected_shutting_down` |
| Latency p50 / p95 / max | 20 / 1,020 / 1,034 ms |
| Rolled back | yes — the pilot directory is absent |

**What run 1 found.** With storage configured, the collector kept its in-memory deduplication ledger
(32 live identities, 300 s) in front of the storage port. After the 32nd distinct event every new
identity was refused with `COLLECTOR_DEDUPLICATION_CAPACITY`, so the producer retried and exhausted,
and the authorized interval ran out. The stop mechanism, rollback, read-back, tenant isolation, and
secret-free outputs all behaved as authorized. The only defect was the throughput ceiling: **#478**.

**What run 1 did not find.** No stop criterion other than the deadline fired. No secret or payload
marker appeared in any output; no acknowledged event was missing from storage; no cross-tenant read
returned a record.

## Run 2

Recorded after #478's fix merges.
