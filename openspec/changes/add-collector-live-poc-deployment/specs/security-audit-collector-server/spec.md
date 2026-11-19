# Spec Delta

## Purpose

The deployable security-audit collector service: the network ingress, sender authentication, PostgreSQL
storage, packaging, and the authorization scope and go-live conditions under which a live PoC may receive
real authentication events.

## ADDED Requirements

### Requirement: The live PoC authorization is recorded and bounded

The server SHALL be authorized only for a local PoC on emulated AWS with synthetic events, and a live PoC on one owner-provisioned AWS account receiving real `authentication.succeeded`, `authentication.failed` and `session.created` events from one business application. The authorization SHALL record the owner decision of 2026-11-18 and SHALL NOT authorize any other event, transport, exporter, SIEM integration, analytics, detection, publication, or sender.

#### Scenario: The authorization names its scope
- **WHEN** the change's authorization record is read
- **THEN** it names the owner decision of 2026-11-18, the local PoC, the live PoC, the one business application, the three authentication events, their `operational_short` retention as a deliberate deviation from the catalog's `security_standard`, and nothing else

#### Scenario: Out-of-scope integrations stay unauthorized
- **WHEN** the server is inspected for an exporter, SIEM integration, analytics, detection, or publication path
- **THEN** none exists, and the authorization grants none

### Requirement: Real traffic waits for the go-live checklist

A deployment SHALL NOT receive real events until every go-live item is recorded as met:
- all three storage owner roles are named;
- a retention deletion job exists;
- an AWS check shows a wrong or expired database login token is refused;
- the database parameter group forces TLS;
- the business application tags its events `operational_short`;
- the commit its SDK tarballs are packed from is recorded on the tracking issue.

#### Scenario: An unmet item blocks real traffic
- **WHEN** any go-live item is not recorded as met
- **THEN** the live PoC is not opened to the business application, and the local PoC is unaffected

#### Scenario: The checklist is part of the deployment record
- **WHEN** the deployment documentation is read
- **THEN** it lists every go-live item with the evidence that marks it met

### Requirement: The ingress endpoint wraps the collector ingress without adding outcomes

The server SHALL expose one HTTP endpoint that passes each request's credential and its body, as a byte stream, to the collector ingress, and a health endpoint that reports liveness only. It SHALL map each ingress outcome to one fixed HTTP status and SHALL NOT add an outcome, retry, or acknowledgment of its own.

#### Scenario: Outcomes map to fixed statuses
- **WHEN** the ingress returns `persisted`, the duplicate outcome, or a rejection
- **THEN** the endpoint answers with that outcome's fixed status and no status implies an outcome the ingress did not return

#### Scenario: Body bytes reach the ingress unchanged
- **WHEN** a request is received
- **THEN** the ingress receives its exact body bytes as a stream, and a body over the contract's event size limit is rejected without being buffered past that limit

### Requirement: Responses follow the Node binding's delivery protocol

A durably stored event and a duplicate of one SHALL be answered 2xx with exactly one acknowledgment carrying the event's `event.id` and the outcome `accepted`. A storage failure or indeterminate write SHALL be answered with a retryable 5xx status. Every other rejection SHALL be answered with a 4xx status the Node binding classifies as permanent. Responses SHALL carry no payload, sender, tenant, or credential material.

#### Scenario: The Node binding sees a stored event as acknowledged
- **WHEN** the Node binding's HTTP delivery handoff sends an event to the server through the governed fetch adapter and the event is stored
- **THEN** the handoff reports the event `acknowledged`

#### Scenario: A retry after a lost response is acknowledged
- **WHEN** the handoff sends the same event again after the server stored it
- **THEN** the server answers the duplicate with the same acknowledgment, and the handoff reports it `acknowledged`

#### Scenario: Storage trouble is retryable and rejections are permanent
- **WHEN** the storage port reports a failed or indeterminate write, and separately when an event fails authentication, size, schema, version, retention, scope, or conflict checks
- **THEN** the handoff classifies the first as retryable and every other case as permanent

### Requirement: The server refuses to run without storage

The server SHALL fail at startup, before it listens, unless storage is configured with all three owner roles named. A 2xx answer SHALL therefore always mean that a record is stored.

#### Scenario: Missing storage stops startup
- **WHEN** the server starts with no storage configuration, or with any owner role unnamed
- **THEN** it exits with a configuration error and never opens its listening port

### Requirement: Only backends inside the network reach the endpoint

The ingress endpoint SHALL be reachable only from inside the deployment's network, through an internal load balancer. Senders SHALL be backend services. No API key SHALL be issued to a browser, mobile, or other front-end client.

#### Scenario: The endpoint has no public address
- **WHEN** the live overlay's load balancer and network policies are inspected
- **THEN** the load balancer is internal and no rule admits traffic from outside the network

#### Scenario: Front ends never hold a key
- **WHEN** the API key inventory is read
- **THEN** every key names a backend application, and none is configured for a front-end client

### Requirement: Operations are observable without disclosing content

The server SHALL expose the collector's counters on a port that the internal load balancer does not route, and SHALL log one line per request holding only the outcome code, the HTTP status and the latency. No log line or metric SHALL carry a body, payload field, API key, sender identity, or tenant identity.

#### Scenario: Metrics are internal only
- **WHEN** the metrics port is requested through the internal load balancer
- **THEN** it is unreachable there, and it is reachable from inside the cluster

#### Scenario: Logs carry no content
- **WHEN** authenticated, rejected, stored, and failed requests are made with sentinel values in their body, key, sender, and tenant
- **THEN** no sentinel appears in any log line or metric

#### Scenario: Health reports liveness only
- **WHEN** the health endpoint is called
- **THEN** it reports liveness and discloses no configuration, owner name, credential, or stored data

### Requirement: Senders authenticate with per-application API keys

The server SHALL authenticate each request with a per-application API key from a mounted secret, compared in constant time, as the collector ingress's authenticator. The key's configured application name SHALL be the sender identity. A missing, malformed, or unknown key SHALL be rejected before any body byte is read. No key SHALL appear in any response, log, metric, or diagnostic.

#### Scenario: Unknown key is rejected before the body
- **WHEN** a request carries a missing, malformed, or unknown API key
- **THEN** it is rejected with the authentication diagnostic and no body byte is read

#### Scenario: Sender identity is the application name
- **WHEN** a request authenticates with a configured key
- **THEN** the ingress outcome names the key's application, never the key

#### Scenario: Keys never leave the secret
- **WHEN** responses, logs, metrics, and diagnostics are inspected after authenticated and rejected requests
- **THEN** no API key value appears in any of them

### Requirement: PostgreSQL is the server's storage backend

The server SHALL store records in PostgreSQL through a backend that implements the collector's asynchronous storage port with the same identity, duplicate, conflict, failure, indeterminate, unsupported-version, and tenant-scope semantics as the library's SQLite backend.

#### Scenario: Port semantics match the reference backend
- **WHEN** the shared storage port conformance tests run against the PostgreSQL backend
- **THEN** every result for write, duplicate, conflict, read, unsupported version, scope, and expiry equals the SQLite backend's result for the same input

#### Scenario: A lost connection is indeterminate
- **WHEN** the connection fails after a write was sent and before its result is read
- **THEN** the backend reports `indeterminate`, and the ingress issues no `persisted` acknowledgment

### Requirement: Database login uses IAM tokens and never a stored password

The server SHALL log in to the database with short-lived IAM authentication tokens obtained through its workload identity. No database password SHALL be stored in configuration, a secret, an image, or the repository, except for an explicitly local-only connection to the emulated or containerised database.

#### Scenario: Live configuration carries no password
- **WHEN** the live deployment's manifests and secrets are inspected
- **THEN** no database password is present, and connections authenticate with an IAM token

#### Scenario: A refused token is a definite failure
- **WHEN** the database refuses a login token
- **THEN** the backend reports `failed` for the write, and no record is acknowledged

### Requirement: The server enforces TLS to the database from its own side

The server SHALL connect to the database over TLS and verify the server certificate and host name against the bundled RDS certificate authority. It SHALL refuse an unencrypted or unverified connection unless an explicitly local-only setting is present, and that setting SHALL be rejected when the live configuration is selected.

#### Scenario: Unverified connection is refused
- **WHEN** the database presents a certificate that does not chain to the bundled authority or does not match the host name
- **THEN** the connection is refused and no write is attempted

#### Scenario: The local-only switch cannot reach live
- **WHEN** the live configuration is selected together with the local-only TLS setting
- **THEN** the server refuses to start

### Requirement: The server's runtime dependencies are exactly two

The server workspace SHALL declare exactly `pg` and `@aws-sdk/rds-signer` as third-party runtime dependencies. Its dependency gate SHALL fail closed on any other runtime dependency and on any built-in module outside its declared allowlist.

#### Scenario: A third dependency fails the gate
- **WHEN** any runtime dependency other than `pg` or `@aws-sdk/rds-signer` is declared or imported
- **THEN** the server's dependency gate fails closed, naming it

### Requirement: The server ships as one image deployed with two replicas

The server SHALL be packaged as one container image that runs as a non-root user with a read-only root filesystem. Its Kubernetes manifests SHALL run two replicas, mount the API key secret read-only, bind the IAM workload identity, and set resource requests and limits.

#### Scenario: Image runs unprivileged
- **WHEN** the image and its pod specification are inspected
- **THEN** the process runs as a non-root user on a read-only root filesystem with no added capabilities

#### Scenario: Two replicas share one store
- **WHEN** the same event is submitted to each of the two replicas
- **THEN** one record is stored and the second submission returns the duplicate outcome acknowledged `persisted`

### Requirement: The local PoC runs the same manifests on emulated AWS

A documented local command SHALL run the server's manifests against LocalStack-emulated EKS and RDS with synthetic events only. The documentation SHALL state that the emulator does not validate database IAM tokens or enforce TLS, so the local PoC proves the wiring and not those controls.

#### Scenario: Local PoC persists a synthetic event
- **WHEN** the local command runs and a synthetic event is submitted with a configured API key
- **THEN** the event is acknowledged `persisted` and is readable through the storage port in its scope

#### Scenario: Emulator limits are stated
- **WHEN** the local PoC documentation is read
- **THEN** it states that IAM token validation and TLS enforcement are not proven locally
