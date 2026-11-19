# Design

## Context

See proposal.md for why. Today:

- **Ingress.** `CollectorIngress.submit()` is a synchronous function call. No package starts a server.
- **Authentication.** The only authenticator is `SyntheticFixtureAuthenticator`.
- **Storage port.** `StoragePort.put/get/deleteExpired` return their result unions synchronously, because
  `node:sqlite` is synchronous.
- **Gates.** The collector's dependency and scope gates allow one built-in, `node:sqlite`, confined to
  `src/sqlite-storage.ts`, and no third-party runtime dependency.
- **Retention.** Retention durations are package constants derived from each record's
  `data.retention_class`. The ratified rule says a deployment may decline a class but never shorten one.
- **Owners.** Storage refuses to start unless the data owner, the retention and deletion authority, and
  the key owner are named.

The decisions below were settled with the owner in a grilling session on 2026-11-18. That session
covered:

- where the data lands (RDS for PostgreSQL rather than S3);
- the cluster (EKS, two replicas, RDS private, IAM database login);
- sender authentication (per-application API keys in a Kubernetes Secret);
- retention (store only the 30-day class);
- owner roles (the owner holds all three);
- the slice plan, and LocalStack for the local PoC.

## Goals / Non-Goals

**Goals:**

- A local PoC on LocalStack with synthetic events, then a live PoC on AWS with real authentication
  events, both running the same image and manifests.
- The collector library keeps its outcome semantics, its single SQLite backend, and zero runtime
  dependencies.
- Every slice leaves required CI green and needs no license.

**Non-Goals:**

- **The retention deletion job.** Tracked as a separate issue and a go-live blocker; nothing here
  calls `deleteExpired` on a schedule.
- **Any read API for stored events.** The demo reads them with a read-only database role (see Risks).
- **Exporters, SIEM integration, analytics, alerting, cryptographic chaining, or multi-region.**
- **Provisioning AWS accounts, EKS clusters, RDS instances, or KMS keys.** The repository carries
  manifests and a documented checklist; the owner provisions.
- **Changing the frozen contract or any SDK package.**

## Decisions

### D1. A sixth workspace holds everything deployable

The new `packages/security-audit-collector-server` depends on the collector library through a `file:`
reference and holds:
- the HTTP server;
- the API-key authenticator;
- `PostgresStorage`;
- the database migration entry point;
- the Dockerfile and the Kustomize manifests.

*Alternative rejected:* building all of this into `security-audit-collector` and loosening its
zero-dependency and scope gates. That would turn the audited library into a network service, and the
gates that keep it narrow would have to go. A separate workspace keeps every new dependency and
privilege reviewable in one place.

### D2. The storage port becomes async, and `submit()` always returns a promise and reads a stream

`put`, `get` and `deleteExpired` return promises of the same closed unions. `submit()` always returns a
promise, with or without storage, so callers learn one interface. The ingress awaits `put` inside the
persist stage. The stage order is unchanged, and so is the outcome type.

The submission's `body` is either a `string` or an `AsyncIterable<Uint8Array>`. The ingress
authenticates first, and only then reads the stream, stopping once it exceeds `event_max_bytes`. This
keeps "authenticate before reading" and the size limit in the one module that already owns them, with
their tests. The HTTP server stays a thin adapter that hands over the request stream.

*Alternative rejected:* the server checking the key itself before reading, with `submit()` checking it
again. The ordering rule would then live in two places, and the library could no longer prove it.
- `SqliteStorage` wraps its synchronous calls in resolved promises, so its behaviour, including the
  `secure_delete` probe, is unchanged.
- A rejected promise is handled exactly as a thrown call is today: indeterminate.

*Alternatives rejected:*
- **A synchronous facade over a worker thread with `Atomics.wait`.** It would block the event loop of
  an HTTP server.
- **A second async port beside the sync one.** It would leave two persistence paths, each with its own
  duplicate semantics.

### D3. A deployment may declare the retention classes it stores

`storage.storedRetentionClasses` is an optional non-empty subset of `operational_short`,
`security_standard` and `security_elevated`. A record of any other class gets the existing
`COLLECTOR_RETENTION_CLASS_DECLINED` diagnostic before the port is called. The live PoC sets
`["operational_short"]`, which keeps everything for exactly 30 days.

*Alternative rejected:* a retention ceiling that shortens every class to 30 days. It breaks the ratified
"never shorten" rule, and a record would silently claim a class it is not kept for. The owner chose
declining.

### D4. PostgreSQL mirrors the SQLite schema and port semantics

There is one table, `audit_records`:
- **Columns:** the SQLite backend's columns.
- **Primary key:** `(scope_kind, scope_tenant, event_id)`.
- **Indexes:** no secondary index, so no index holds a copy of any non-key column.

`put` works in two steps:
1. Run `INSERT … ON CONFLICT DO NOTHING RETURNING event_id`.
2. When that returns no row, select the stored `occurrence_key` and return `duplicate` if it matches,
   or `failed`/`conflict` if it does not.

Results map to the port's unions as follows:
- **`failed`:** errors PostgreSQL guarantees had no effect, such as a refused login or a constraint
  violation before the commit.
- **`indeterminate`:** everything else, including a socket that closes after the query was sent.

One shared conformance suite runs every port scenario against both backends (`:memory:` SQLite and a
PostgreSQL container).

The schema is created by a Kubernetes `Job` that runs the server image's migrate entry point before the
`Deployment` rolls out. Two replicas running DDL at startup could race on `CREATE TABLE IF NOT EXISTS`,
which is why the replicas don't create it themselves.

### D5. IAM database login with client-enforced TLS

- **IAM login.** Each new pool connection gets a fresh token from `@aws-sdk/rds-signer`, using the
  pod's IRSA role. Connection lifetime is capped below the token's 15-minute validity.
- **TLS.** `pg` connects with `ssl: { rejectUnauthorized: true, ca: <bundled RDS global CA> }` and
  checks the host name.
- **Local-only mode.** `COLLECTOR_DB_MODE=local` allows a static password and no TLS, for the CI
  container and LocalStack. Startup refuses `COLLECTOR_DB_MODE=local` together with
  `COLLECTOR_ENV=live`.

*Alternative rejected:* a password in a Secret. It is a long-lived credential, and the owner chose IAM.

### D6. HTTP ingress on plain `node:http`, speaking the Node binding's protocol

The ingress is one endpoint, `POST /v1/events`, plus `GET /healthz`. The request stream goes straight
to `submit()` (D2).

The Node binding's response classifier (`http-response-classification.ts`) is the specification here.
A 2xx counts as delivered only with exactly
`{"acknowledgments":[{"event_id":"<event.id>","outcome":"accepted"}]}`. 5xx, 408, 425 and 429 are
retryable, and every other 4xx is permanent. Outcomes therefore map as follows:

| Ingress outcome | HTTP status | Body |
|---|---|---|
| `persisted` | 201 | the acknowledgment |
| duplicate (always acknowledged `persisted`, D10) | 200 | the acknowledgment |
| authentication | 401 | bounded diagnostic |
| size | 413 | bounded diagnostic |
| parse (malformed body) | 400 | bounded diagnostic |
| schema validation, version | 422 | bounded diagnostic |
| retention-declined, scope-unresolved | 422 | bounded diagnostic |
| conflict | 409 | bounded diagnostic |
| deduplication capacity (unreachable with storage) | 429 | bounded diagnostic |
| storage failure, indeterminate | 503 | bounded diagnostic |
| unexpected server error | 500 | fixed `internal_error` |

**Prior art.** The Node binding's evaluation receiver already wraps `CollectorIngress` in `node:http`
for the non-production evaluation kit. It answers with the same acknowledgment body, and maps
authentication to 401, size to 413, parse to 400, validation and version to 422, conflict to 409 and
deduplication capacity to 429. The table above keeps every one of those statuses, so the SDK, its
evaluation kit and the server agree on what each status means. The server adds 201 for a fresh store,
the storage statuses and the retention and scope statuses.

The receiver calls `submit()` synchronously, so slice 1 updates it to await the promise. Its string-anchored
receiver controls must keep matching, and the evaluation kit checks must keep passing.

Answering a duplicate 2xx is what lets the producer's retry after a lost response finish as
`acknowledged`. Without it, a retried event would look rejected.

The conformance tests run the Node binding's public `createHttpDeliveryHandoff` and
`createFetchHttpExchange` against a real server, as a dev dependency. A change on either side then
fails a test, not the PoC.

**Network.** TLS from senders terminates at an **internal** AWS load balancer with an ACM certificate.
Only backends inside the VPC can reach it, because front ends never talk to the collector: the browser
evidence package makes no network request, and the host application forwards evidence to its own
backend. From the load balancer to the pod, traffic stays inside the VPC (see Risks).

*Alternatives rejected:*
- **A response format of the server's own.** The Node binding would classify every success as
  `malformed_acknowledgment`.
- **An HTTP framework.** It is one route, and every dependency is attack surface the owner limited to
  two packages.

### D9. Counters and content-free request logs

- **Counters.** The collector's existing `metrics()` counters are served in Prometheus text format on
  a separate port. The `Service` behind the load balancer doesn't expose that port; in-cluster scrapers
  reach it through a second, cluster-internal `Service`.
- **Logs.** One JSON line per request: the outcome code, the HTTP status and the latency in
  milliseconds. Nothing else.
- **What these are not.** They are operational signals, not analytics or detection, which stay
  unauthorized.

### D11. The producer side composes the frozen delivery primitives

- **Events.** The business application builds `authentication.succeeded`, `authentication.failed` and
  `session.created` with the SDK core, setting `data.retention_class: "operational_short"` in the
  frame data. The SDK reads it at `events.ts`, where it otherwise defaults to the catalog's
  `security_standard`.
- **Delivery.** It composes `createHttpDeliveryHandoff` over `createFetchHttpExchange`, aimed at the
  internal load balancer with an `Authorization: ApiKey <key>` header, with
  `createBoundedDeliveryRetry`, `createBoundedDeliveryBackpressure` and `createDeliveryShutdown`.
  Retries are safe because the server acknowledges duplicates (D6).
- **Distribution.** It gets both SDK packages as `npm pack` tarballs built from one commit recorded on
  the tracking issue.

*Alternatives rejected:*
- **`createHttpAuditSink`.** It makes one attempt, so every 503 loses a login event.
- **The `transaction_critical` events.** Their commit gate would have to be wired into the
  application's transactions.
- **A registry or git dependency.** The packages are never published, and npm can't install a git
  subdirectory cleanly.

### D10. No storage, no server

The server's configuration loader requires storage and the three named owners, and exits before
listening otherwise. To the Node binding a 2xx means durable, so an ingress that only admits events
must never sit behind this endpoint.

### D7. API keys are stored as hashes in a mounted Secret

- **The Secret** mounts `keys.json`, which maps each application name to the SHA-256 of its key.
- **Checking a key.** The authenticator hashes the presented `Authorization: ApiKey <key>` value and
  compares it with `timingSafeEqual` against every entry. A match yields the application name as the
  sender identity.
- **Where the raw key lives.** It goes to the business application only. The cluster never holds it,
  so reading the Secret doesn't leak a usable key.
- **Rotation.** Add the new hash, roll the application, then remove the old one.

### D8. Packaging, manifests and CI

- **Image.** A multi-stage Dockerfile that runs on a distroless Node 24 base as a non-root user, with
  a read-only root filesystem and the RDS CA bundle copied in.
- **Manifests.** A Kustomize `base`, with `overlays/local` (LocalStack) and `overlays/live`:
  - a `Deployment` with 2 replicas, a `PodDisruptionBudget`, a `Service` and an `Ingress`;
  - a `ServiceAccount` with the IRSA annotation;
  - a `NetworkPolicy` restricting egress to RDS and DNS;
  - the migration `Job`.
- **Required CI.** The server joins the existing per-concern jobs through the declared package list
  (ci-topology). Its tests use a `postgres` service container.
- **The mandatory check set.** CI topology requires every declared package to have build, typecheck,
  runtime tests, a production-only packed install, at least one deterministic mutation control, and
  enforced line and branch coverage thresholds. The server gets all of them. Its mutation control
  plants a forbidden runtime dependency and a forbidden built-in, and proves the dependency and scope
  gates fail. The packed install proves the production closure is exactly the collector plus `pg`
  and `@aws-sdk/rds-signer`. `sonar-project.properties` gains the server's sources, tests, tsconfig
  and coverage report, because the quality gate analyses every declared package.
- **The `localstack` job.**
  - Uses `LOCALSTACK_AUTH_TOKEN`. It starts LocalStack, creates RDS and EKS, applies `overlays/local`,
    and submits synthetic events.
  - Is never required, and its `if:` renders a skip when the secret is absent.
  - Runs on the declared runner label, and cleans its Docker volumes on exit, given earlier
    out-of-disk failures from Docker volume leaks on the kind runners.

## Risks / Trade-offs

- **Real login events become personal data at rest, and nothing deletes them yet.** Mitigation: the
  deletion job is a go-live blocker. Until it lands, the live PoC receives no real traffic.
- **RDS backups and snapshots keep deleted records beyond the collector's reach.** Mitigations:
  - set automated backup retention to 1 day;
  - take no manual snapshots;
  - document the residue.

  The storage semantics bind the collector, not the platform's backups.
- **PostgreSQL keeps deleted rows on disk until VACUUM.** Old row versions and index entries survive a
  `DELETE`, so the SQLite `secure_delete` guarantee doesn't carry over. Mitigation: the deletion job
  (separate issue) runs `VACUUM` after each purge, and the gap is recorded in the server README.
- **LocalStack doesn't validate IAM tokens or enforce TLS.** Mitigation: before real traffic, a go-live
  check on AWS shows a wrong or expired token is refused, and `rds.force_ssl=1` is set.
- **Traffic from the load balancer to the pod is unencrypted inside the VPC.** Mitigations: a
  NetworkPolicy and security groups limit who can reach the pod port. End-to-end TLS stays open for
  after the PoC.
- **The legal basis for processing login data is outside this change.** By the owner's decision of
  2026-11-18, recording it isn't a go-live item, and nothing here establishes one.
- **The demo reads data with SQL, outside the port's tenant scoping.** Mitigation: a dedicated
  read-only IAM database role for the owner only. The port's no-cross-tenant guarantee covers the
  collector, not a human holding that role.
- **`submit()` becoming async breaks callers.** Mitigation: the callers are the collector's own tests,
  its package probe, and the Node binding's evaluation receiver with its receiver controls, all updated
  in slice 1.
- **The new dependencies bring a transitive tree that `npm audit` can flag.** A finding there blocks
  required checks. Mitigation: the server's lockfile is audited when the workspace is created. A
  finding at or above the CI threshold stops the work for an owner decision, and is never silenced with
  an override.
- **The LocalStack job uses CI credits on every run.** Mitigation: it runs on `main`, on manual
  dispatch, and on server-touching PRs only.

## Migration Plan

1. **Slice 1:** async port, stored retention classes, and the new workspace with `PostgresStorage` and
   its conformance suite against a CI container.
2. **Slice 2:** the HTTP endpoint and the API-key authenticator.
3. **Slice 3:** the image, the Kustomize manifests, the migration Job, the `localstack` job, and the
   local PoC.
4. **Live PoC:** the owner provisions AWS, works through the go-live checklist, and applies
   `overlays/live`.

**Rollback:** scale the `Deployment` to zero; the business application's events then fail at its own
delivery layer. Reverting slices 1 to 3 restores the synchronous library. No stored data needs
migrating back, because the live PoC store is discarded with the PoC.

## Open Questions

- AWS region, RDS instance size and EKS node size. These are deferrable provisioning choices and don't
  affect the specs or the tasks.
