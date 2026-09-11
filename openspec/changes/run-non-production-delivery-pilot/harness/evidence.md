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

## Run 2 — completed with no stop criterion

| Item | Value |
|---|---|
| Commit | `main` at `93e4f490b733ab17d7375df2b4c67be9e0eda6e9` (#478's fix merged as #482) |
| Harness | `pilot.mjs` unchanged from the revision committed with this change |
| Node.js | `v26.8.1` |
| Contract | `2.0.0` |
| Operator | Claude, under the owner's 2026-09-11 instruction, which renews the 2026-09-10 delegation for #116 |
| Raw output | `run-2-output.json` |

**Preflight:** all six stop criteria fired on their planted defects and stayed silent on the null
control; rollback removed the probe directory.

| Measure | Value |
|---|---|
| Stop criterion | **none fired** |
| Wall clock | 66.6 s of the authorized 120 s |
| HTTP requests | 681 |
| Valid deliveries acknowledged / exhausted | **600 / 0** |
| Retries scheduled | 61 |
| Collector `persisted` | **616** (600 steady-state plus 16 burst admissions) |
| Collector `deduplicated` | 60 |
| Collector `rejectedDeduplicationCapacity` | **0** |
| Rejection classes | wrong credential, unsupported version, unresolvable storage scope, and declined retention: each `non_retryable` at the producer and refused before storage |
| Saturation burst of 64 | 16 acknowledged, 48 `rejected_overload` at the producer's bound of 16 |
| Storage read-back of acknowledged events | 616 / 616 found; no read under another tenant returned a record |
| Whole-record expiry, clock advanced past the longest retention | 205 + 206 + 205 deleted, 0 remaining |
| Storage file at close | 2.8 MiB of the 64 MiB bound |
| Shutdown | 668 accepted, 668 completed, 0 abandoned; a submission after shutdown was `rejected_shutting_down` |
| Latency p50 / p95 / max | 6 / 1,012 / 1,034 ms |
| Rolled back | yes — the pilot directory is absent |

**How the counts reconcile.** 681 HTTP requests = 600 steady-state + 4 rejection cases + 16 admitted
burst deliveries + 61 retries. Every retry followed a response the harness delayed past the
producer's 1 s timeout on purpose (every eleventh request). Sixty of those first attempts had
already been stored, so the retry reached the storage port as a `duplicate` and was acknowledged
`persisted` — the path #478 changed. The sixty-first was the declined-retention case, rejected on
both attempts, which is why `rejectedRetentionDeclined` is 2 for one delivery. The p95 latency is
that injected delay, not collector cost.

**What run 2 shows.** With storage configured, persisted throughput is no longer bounded by the
in-memory ledger: 616 distinct identities were stored inside one 300-second window where run 1
stopped at 32. Every acknowledged event was durably readable under its own tenant and no other, no
credential or payload marker reached any output, and rollback left nothing behind.

**What run 2 does not show.** It is one loopback process on one workstation with synthetic data.
It says nothing about network partitions, a second host, real credentials, sustained load, or any
volume above 600 events, and it proves no production property. **It authorizes nothing further**:
not production, not a longer or larger pilot, and not real data.
