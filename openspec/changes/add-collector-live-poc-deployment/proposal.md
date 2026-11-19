# Proposal

Tracking issue: #973.

## Why

The collector has only ever run as a synthetic, in-process library. Nothing can send it events over a
network, its only authenticator checks hard-coded test tokens, and its only storage is a local SQLite
file. A business application now needs to send it real authentication events in a **live PoC**: a
proof of concept that processes real data and is therefore production as far as data protection is
concerned, whatever it is called. First comes a **local PoC**: the same stack emulated on LocalStack
with synthetic data. The owner authorized both on 2026-11-18. This change records that
authorization and the design, and it lifts the non-production boundary only for the parts it names.

## What Changes

- **Authorization.** The owner authorizes a local PoC and a live PoC of the collector on AWS: EKS and
  RDS for PostgreSQL in one network. The live PoC receives three real authentication events
  (`authentication.succeeded`, `authentication.failed`, `session.created`) from one business
  application.
- **Producer side.** That application may use the SDK core and the Node binding in production, as
  tarballs packed from one commit recorded on the tracking issue (nothing is published). It builds the
  three events as `operational_short` (30 days), a recorded deviation from the catalog's
  `security_standard`. It delivers them by composing the Node binding's frozen handoff, fetch exchange,
  retry, backpressure and shutdown primitives. The one-shot HTTP audit sink stays non-production, and
  no SDK code changes. The owner fills all three storage owner roles: data owner, retention and deletion
  authority, and key owner. Nothing else becomes authorized: no other transport, exporter, SIEM
  integration, analytics, detection, or publication.
- **BREAKING (collector library):** the storage port becomes asynchronous. `put`, `get` and
  `deleteExpired` resolve to the same closed result unions, and `CollectorIngress.submit()` always
  returns a promise. `submit()` also accepts the body as a byte stream, which it reads only after
  authentication and only up to the contract's size limit. `SqliteStorage` stays as the library's one
  backend, behind the async port.
- **Stored retention classes.** A deployment may name which retention classes it stores, and every
  other class is declined with the existing retention-declined diagnostic. The live PoC stores only
  `operational_short`, which is 30 days. The ratified rule that a deployment never shortens retention
  is unchanged.
- **New sixth workspace, `packages/security-audit-collector-server`.** It holds the deployable
  service:
  - a plain `node:http` ingress endpoint, reachable only through an internal load balancer by backends
    in the same network, answering with the acknowledgments the Node binding's delivery handoff
    expects;
  - a health endpoint, internal-only counters, and request logs that carry no content;
  - a refusal to start without storage, so a 2xx always means a stored record;
  - an authenticator for per-application API keys, read from a mounted Kubernetes Secret;
  - a `PostgresStorage` backend over `pg`, which logs in through RDS IAM using
    `@aws-sdk/rds-signer` and enforces TLS with `verify-full` from the client side;
  - a container image, and Kubernetes manifests for two replicas.

  Its only third-party runtime dependencies are `pg` and `@aws-sdk/rds-signer`. The collector
  library stays dependency-free.
- **CI.** The required checks test the server against a plain `postgres` container, with no license
  needed. A new `localstack` job runs the EKS + RDS stack with a LocalStack CI Auth Token. It is not
  required: it runs on pushes to `main`, on manual dispatch, and on PRs from this repository that
  touch the server, and it renders as a skip when the secret is absent.
- **Go-live checklist.** The live PoC may receive real traffic only after:
  - the three owner roles are named in the deployment;
  - the retention deletion job exists (tracked as a separate issue; not built here);
  - an AWS check shows a wrong or expired IAM token is refused;
  - `rds.force_ssl=1` is set on the RDS parameter group;
  - the business application tags its events `operational_short`.

## Capabilities

### New Capabilities

- `security-audit-collector-server`: the deployable collector service, covering:
  - its authorization scope;
  - the HTTP ingress and the API-key authenticator;
  - the PostgreSQL backend with IAM login and client-enforced TLS;
  - its dependency allowance;
  - container and manifest packaging;
  - the go-live checklist.

### Modified Capabilities

- `collector-storage-semantics`:
  - the port's three operations become asynchronous;
  - the decision-provenance requirement names this change as the governed selection that admits a
    PostgreSQL backend in the server workspace.
- `security-audit-collector`:
  - the persist stage awaits the asynchronous port;
  - a deployment may declare the retention classes it stores.
- `security-audit-sdk-core`: one business application may build the three live PoC events with the
  SDK core from a recorded commit.
- `security-audit-sdk-node`: that application may deliver them through the frozen delivery
  primitives, while the HTTP audit sink stays non-production.
- `repository-topology`: the target set grows to seven packages. It adds the collector server, and
  ratifies `client-evidence-browser`, which was already declared under #117/#124.
- `ci-topology`:
  - the declared package list names the server workspace and the already-declared browser evidence
    package;
  - a non-required, secret-gated LocalStack job is added.

## Impact

- **Code:**
  - `packages/security-audit-collector/src/{storage,sqlite-storage,ingress,index}.ts` and its tests:
    the async port, and stored retention classes;
  - the new `packages/security-audit-collector-server/` workspace.
- **APIs:** `CollectorIngress.submit()` becomes asynchronous. Its only callers are this repository's
  tests and package probes.
- **Dependencies:** `pg` and `@aws-sdk/rds-signer`, in the server workspace only.
- **Repository:**
  - `Makefile` and `.github/scripts/check-package-discovery.mjs`, for six workspaces;
  - `.github/workflows/ci.yml`, for the server's per-concern jobs and the new `localstack` job;
  - `CLAUDE.md`, `README.md` and `AGENTS.md` wording that says "five workspaces".
- **Infrastructure (outside the repository):** an EKS cluster and an RDS for PostgreSQL instance in
  one VPC, a KMS key, an IAM role for the service account, and a `LOCALSTACK_AUTH_TOKEN` repository
  secret. The owner provisions these; the repository holds the manifests, not the accounts.
- **Data protection:** real authentication events become personal data at rest in RDS for 30 days.
  RDS automated backups and snapshots hold copies beyond the collector's reach, so the design bounds
  their retention.
