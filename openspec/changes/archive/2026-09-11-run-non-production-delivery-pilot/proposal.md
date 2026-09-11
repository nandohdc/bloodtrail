## Why

#116 is the proof-of-concept milestone: an event leaves a real producer, crosses a real transport,
and is durably stored by a real collector, on synthetic data, for one bounded, authorized interval.
It needs #109's verified delivery chain and #115's storage, and both are on `main`. It also needs a
written authorization naming the environment, versions, data classification, duration, and owners,
with stop and rollback criteria testable before execution. Nothing like that existed.

## Authorization

The owner's 2026-09-10 instruction names #116: *"implement ONLY the issues between #96 to #132 … you
full authorization to implement them"*. `pilot-authorization.md` is the written authorization. It
was drawn up by Claude under that delegation with `decision_source = "delegated to Claude by the
owner, 2026-09-10; not a human owner decision"`, and it authorizes one loopback-only, synthetic,
120-second run and nothing else — no production, no real data, no larger pilot.

## What Changes

- `pilot-authorization.md` — the authorization packet: environment, versions, data classification,
  duration and volume, owners, six stop criteria, rollback, and closure.
- `harness/pilot.mjs` — the pilot. It wires the real sdk-node delivery stack (HTTP handoff, bounded
  retry, backpressure, deadline-bounded shutdown) to the real collector with `SqliteStorage`, over a
  real `127.0.0.1` HTTP socket and real `fetch`. A preflight proves every stop criterion fires on a
  planted defect and stays silent on its null control, and proves rollback removes the pilot
  directory, before any traffic. The workload has three phases: steady traffic with injected timeouts;
  the rejection classes (declined retention, unsupported version, wrong credential, unresolvable
  scope); and a saturation burst. Rollback runs on success, on any stop criterion, and on any error.
- `harness/evidence.md` — closure for each run.

**Run 1 terminated on a stop criterion, and that is its result.** With storage configured, the
collector's 32-identity deduplication ledger capped persisted throughput at 32 events per five
minutes. `SC4-deadline` fired, and the pilot was stopped and rolled back exactly as authorized. The
finding is #478, fixed in `delegate-collector-deduplication-to-storage`. Run 2, after that fix, is
recorded in this change's next PR.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. The pilot exercises `security-audit-collector` and `delivery-conformance-contract` as ratified
and changes neither; `skip_specs: true`.

## Impact

Adds only `openspec/changes/run-non-production-delivery-pilot/`. No package, contract, or workflow
changes. The harness's HTTP listener lives in this change directory, not in the collector package,
whose scope gate still forbids a server.

## Assurance limitations

A successful bounded pilot on one workstation proves the pieces compose under the measured load. It
does not prove production readiness, durability on other hardware, behaviour under real network
conditions beyond loopback, or anything about real data.
