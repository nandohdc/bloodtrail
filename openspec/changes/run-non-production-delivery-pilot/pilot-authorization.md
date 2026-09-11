# Non-Production Delivery Pilot Authorization (#116)

Status: **authorized under delegation, for the exact interval, versions, and data below only**.

## Authorization record

- **Authorized by:** Claude (AI model `claude-opus-5`), under delegation from the project owner
  Fernando Homem da Costa (`nandohdc`). On 2026-09-10 the owner instructed: *"implement ONLY the issues
  between #96 to #132 … you full authorization to implement them"* and *"I dont have time to make
  decisions, you must do for me."* #116 is in that range.
- **Decision source:** `decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner decision"`.
  The owner has not personally reviewed this authorization. It is not an exact-commit owner
  authorization and authorizes nothing beyond the run it describes.
- **Production authorization:** none. **Real-user data:** none. **Publication:** none.

## Environment

| Item | Value |
|---|---|
| Host | one developer workstation, Darwin arm64. No cloud, cluster, or shared host |
| Network | loopback only: the collector listens on `127.0.0.1` on an ephemeral port and accepts no external connection |
| Storage | `SqliteStorage` on a file inside a fresh `mkdtemp` directory under the OS temporary directory, deleted at the end of the run |
| Processes | one Node.js process runs both the collector and the producer |
| Credentials | two synthetic fixture tokens, one issued and one not, defined in the harness. No real credential exists or is read |

## Exact versions

The run is bound to the commit recorded in `harness/evidence.md` for that run. Package versions are
read from each package's `package.json` at that commit, and the harness records the contract version
it ran against (`SUPPORTED_CONTRACT_VERSIONS[0]`) in its own output. Node.js is the version the
evidence records.

## Data classification

**Synthetic, non-sensitive, generated in the harness.** Event identifiers come from `randomUUID()`;
tenants are `tenant_pilot_a`, `tenant_pilot_b`, and `tenant_pilot_c`; every other value is a literal
in `harness/pilot.mjs`. One literal marker (`PILOT_SECRET_MARKER_4b7d`) is planted in every event
payload so the run can prove payload content never reaches a result, diagnostic, metric, or log line.
No personal, customer, or production data is used, derived, or approximated.

## Duration and volume

At most **120 seconds** wall clock and **600** steady-state events plus a fixed rejection set and a
64-event saturation burst per run. The harness enforces both limits.

## Owners

| Role | Named |
|---|---|
| Pilot owner | Fernando Homem da Costa (`nandohdc`), project owner, named by Claude under the delegation above |
| Data owner, retention and deletion authority, key owner (the three storage roles #114 requires) | the same, named by Claude under the same delegation — the harness passes these names to `CollectorIngress`, which refuses to enable storage without them |
| Pilot operator | Claude, under delegation |

Naming the owner in these roles is itself a delegated act. It is recorded here so nobody mistakes it
for the owner having accepted them in person. For synthetic data on a temporary file the roles carry
no obligation beyond deleting that file, which the run does.

## Stop criteria — testable before execution

Every criterion is a pure check over the run's observations. The harness's **preflight proves each
one fires on a planted defect and stays silent on its null control before any pilot traffic is
sent**; a run whose preflight fails does not start.

| Id | Stops the run when |
|---|---|
| SC1-secret-disclosure | a credential or the payload marker appears in any result, diagnostic, metric, or log line |
| SC2-false-durability | an event the producer saw acknowledged is not found in storage under its tenant |
| SC3-cross-tenant-read | a read under any other tenant returns an acknowledged event |
| SC4-deadline | the authorized 120-second interval elapses |
| SC5-storage-bound | the storage file exceeds 64 MiB |
| SC6-unexpected-outcome | any delivery reaches a state outside the delivery-conformance vocabulary |

## Rollback

Rollback closes the listener and the database and deletes the temporary directory. The harness
asserts the directory is absent afterwards, and preflight proves rollback on a probe directory before
the run. The pilot writes nothing outside that directory, so rollback returns the host to its prior
state. It runs on success, on any stop criterion, and on any other error.

## Closure

A run is closed by `harness/evidence.md`, which records the preflight result, every metric, the stop
criterion if one fired, and the rollback check. **A successful run authorizes nothing further**: not
production, not a longer or larger pilot, and not real data. Each of those needs its own
authorization.
