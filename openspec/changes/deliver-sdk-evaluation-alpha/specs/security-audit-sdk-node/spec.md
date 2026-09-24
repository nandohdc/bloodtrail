## ADDED Requirements

### Requirement: The HTTP audit sink sends one byte-exact request per event through the governed fetch adapter

The Node binding SHALL provide `createHttpAuditSink(options)`, which implements the core's transport-neutral sink interface for non-production evaluation only.

Each emitted event SHALL become exactly one HTTP `POST` to the configured origin and path, with content type `application/json`. The body SHALL be the canonical JSON serialization of exactly the event the SDK validated, byte for byte. No field SHALL be added, removed or rewritten; in particular, `correlation.retry_attempt` SHALL be sent exactly as validated.

The request SHALL reach the network only through the governed fetch delivery adapter. It SHALL NOT follow a redirect, and it SHALL be bounded by the configured per-request timeout. The sink SHALL NOT be a second delivery adapter: it performs no exchange of its own.

Construction SHALL throw synchronously for any of these options:

- an origin that is not an `http` or `https` scheme, host and optional port;
- a path that is not a bounded absolute path;
- a timeout that is not a bounded positive integer;
- an invalid header name or value.

Caller-supplied headers SHALL be sent only to the configured origin. They SHALL NOT appear in any result, error, outcome report or log.

#### Scenario: One request carries the validated bytes
- **WHEN** an event whose `correlation.retry_attempt` is non-zero is emitted through the sink to a loopback peer
- **THEN** the peer receives exactly one `POST` to the configured path with content type `application/json`, whose body is byte-identical to the canonical serialization of the validated event, including the unchanged `correlation.retry_attempt`

#### Scenario: A redirect is never followed
- **WHEN** the peer answers with a 3xx redirect
- **THEN** the redirect target receives nothing and the SDK returns `SDK_SINK_FAILURE`

#### Scenario: Invalid options fail construction
- **WHEN** the sink is configured with an origin carrying a path, query, credentials or a non-HTTP scheme, a relative or unbounded path, a non-positive or unbounded timeout, or an invalid header
- **THEN** construction throws and no sink exists

#### Scenario: Credentials stay on the wire to the configured origin
- **WHEN** a sentinel credential header is configured and requests succeed, fail and time out
- **THEN** the sentinel appears only in requests to the configured origin and never in a result, error, outcome report or log

### Requirement: The HTTP audit sink and the delivery handoff share one response classification

HTTP response classification SHALL be defined once, and both the delivery handoff and the HTTP audit sink SHALL use it:

- A 2xx response SHALL be `acknowledged` only when it carries exactly one acknowledgment whose `event_id` equals the event's `event.id` and whose `outcome` is `accepted`. Any other 2xx acknowledgment SHALL be `malformed_acknowledgment`.
- 5xx, 408, 425 and 429 SHALL be `http_retryable`. Every other 4xx SHALL be `http_permanent`.
- 1xx, 3xx and invalid statuses SHALL be `unexpected_response`.
- A deadline SHALL be `timeout`, and a connection failure SHALL be `transport_failure`.

Extracting the classification SHALL leave every observable handoff outcome and code unchanged.

The sink SHALL map `acknowledged` to accepted, `http_permanent` to rejected, and every other code to unknown. The SDK therefore returns an ok result, `SDK_SINK_REJECTED` or `SDK_SINK_FAILURE` respectively. The sink SHALL add no classification rule of its own.

#### Scenario: A permanent 4xx is a rejection
- **WHEN** the peer answers 400, 403, 404 or 422
- **THEN** the SDK returns `SDK_SINK_REJECTED`

#### Scenario: Retryable statuses, timeouts and connection failures are failures
- **WHEN** the peer answers 408, 425, 429, 500 or 503, exceeds the timeout, or refuses the connection
- **THEN** the SDK returns `SDK_SINK_FAILURE`

#### Scenario: Only the exact acknowledgment is acceptance
- **WHEN** a 2xx response carries no acknowledgment, more than one, one for another event, or one whose outcome is not `accepted`
- **THEN** the SDK returns `SDK_SINK_FAILURE` and never reports acceptance

#### Scenario: The handoff's outcomes are unchanged
- **WHEN** the delivery handoff classifies any status, acknowledgment shape, timeout or transport failure after the extraction
- **THEN** it returns the same outcome and code it returned before the extraction

### Requirement: The HTTP audit sink reports each request's cause through an optional outcome callback

The sink SHALL accept an optional `onOutcome` callback. It SHALL invoke the callback exactly once per request, with three things:

- the event identifier;
- the shared classifier's code;
- the HTTP status, when a response was received.

The callback SHALL NOT receive a request or response body, an event payload, or a header value.

If the callback throws or returns a rejected promise, that SHALL NOT change the sink's result and SHALL NOT produce an unhandled rejection.

Because every callback invocation carries the event identifier, a developer can correlate each failed send with its event.

#### Scenario: Each request reports its cause once
- **WHEN** a request ends in any classifier code
- **THEN** `onOutcome` is invoked once with the event identifier, that code, and the HTTP status if a response was received

#### Scenario: A failing callback changes nothing
- **WHEN** `onOutcome` throws or returns a rejected promise
- **THEN** the sink's result is unchanged and no unhandled rejection occurs

### Requirement: The HTTP audit sink drains in-flight sends and adds no delivery machinery

`flush` SHALL resolve once every request started before the call has settled. It SHALL NOT wait for requests started after the call.

When the SDK that uses the sink shuts down, the sink SHALL let its in-flight sends settle within the SDK's shutdown bound, and SHALL close only after they have settled or the bound has expired. Through the SDK, a send that outlives the bound SHALL surface as `SDK_SHUTDOWN_TIMEOUT`, and an emit after shutdown SHALL surface as `SDK_SHUT_DOWN`.

Concurrent emits SHALL be allowed. Each SHALL produce one request, and each request SHALL be reported exactly once, with no ordering guarantee.

The sink SHALL NOT retry, batch, queue, apply backpressure, cap concurrency, persist, or claim delivery-class conformance. The delivery-conformance attempt-identity requirement does not apply to it.

#### Scenario: Flush waits for in-flight requests only
- **WHEN** `flush` is called while a loopback peer holds earlier responses, and a new emit starts afterwards
- **THEN** `flush` stays pending until the held requests settle and does not wait for the later request

#### Scenario: Shutdown drains within its bound
- **WHEN** the SDK shuts down while a held request settles within the shutdown bound, and again while one outlives it
- **THEN** the first shutdown succeeds after the send settles, the second returns `SDK_SHUTDOWN_TIMEOUT`, and an emit after either returns `SDK_SHUT_DOWN`

#### Scenario: Concurrent emits are each sent once
- **WHEN** N emits run concurrently
- **THEN** the peer receives N requests and each emit is settled and reported exactly once

### Requirement: The frozen Node surface widens additively for the HTTP audit sink

This change SHALL add exactly three exports to the frozen Node surface:

- the HTTP audit sink factory;
- its options type;
- its outcome type.

The additions SHALL be recorded in three places:

- the frozen export lists;
- a new amendment to the public-surface freeze record, which leaves the original freeze record and earlier amendments unchanged;
- an architecture decision record, which also records the shared response classification.

No added name SHALL collide with the core's frozen export surface. No added source file name SHALL contain a token the scope gate forbids.

#### Scenario: The widening is recorded as an amendment
- **WHEN** the export check and the public-surface freeze record are inspected after the widening
- **THEN** the frozen lists contain the three new names, the freeze record gains one amendment naming them, and the original freeze record and earlier amendments are byte-identical

#### Scenario: The widening collides with nothing
- **WHEN** the widened Node surface is compared with the core's frozen surface and the scope gate runs
- **THEN** no name appears in both surfaces and the scope gate passes without a change to its rules

### Requirement: The error catalog documents every exported error code and stays complete

The Node binding SHALL provide an error catalog for evaluators. It SHALL document every code in the core's exported SDK and contract error code lists. Each entry SHALL give the code's meaning, its common causes, the fix, and the result fields to read.

The catalog SHALL call out the mappings that mislead:

- `PREMATURE_SUCCESS` when no operation handle was passed;
- `UNSUPPORTED_SCHEMA_VERSION` for a wrong schema name;
- `AUTHORITY_ESCALATION` for a plain object where an authority constructor was expected;
- `MISSING_TENANT_CONTEXT`, with its three tenant sources (per call, context scope and configuration).

It SHALL explain how `SDK_SINK_REJECTED` differs from `SDK_SINK_FAILURE`, and it SHALL point to the HTTP sink's outcome callback for the precise cause and the event identifier.

A completeness check SHALL run in the Node binding's validation chain. It SHALL fail when an exported code is undocumented, and when the catalog documents a code that does not exist.

Every example value SHALL be synthetic.

#### Scenario: A complete catalog passes
- **WHEN** every exported SDK and contract error code has a catalog entry and no entry names an unknown code
- **THEN** the completeness check passes

#### Scenario: A missing entry fails
- **WHEN** one exported code's entry is removed from the catalog
- **THEN** the completeness check fails and names that code

#### Scenario: An unknown code fails
- **WHEN** the catalog documents a code that neither exported list contains
- **THEN** the completeness check fails and names that code

### Requirement: The evaluation kit installs and runs outside any workspace and its gate fails closed

The Node binding SHALL provide a builder and a gate for a non-production evaluation kit.

**Kit contents.** The kit SHALL contain:

- the packed core, Node binding and collector artifacts;
- the example service and example receiver sources;
- a generated consumer manifest whose npm and pnpm overrides pin the core to the kit's own tarball;
- the evaluator documents;
- an identity file.

No manifest for the examples SHALL be tracked in the repository. Building the kit SHALL NOT change the packed contents of the three packages.

**The gate** SHALL run in the Node binding's validation chain on every CI Node version. It SHALL:

- install the kit with npm and with a pinned pnpm, into a clean directory outside any workspace root;
- prove that exactly one core copy resolves in each installation;
- type-check the example sources and every TypeScript code block in the kit's documents under strict consumer settings, with TypeScript 5.9.2 and with pinned 6.0.x and 7.0.x releases;
- run the example service against the example receiver over loopback, and prove that each demonstrated event is accepted, passes SDK validation at the receiver, and is byte-identical to what the SDK validated;
- drive the HTTP sink against a controllable loopback peer, and prove the documented failure mapping;
- fail when any kit item is missing.

Each of these checks SHALL be shown to fail on a planted defect.

The gate SHALL be able to run on uncommitted work, so that verification can run before a commit.

The kit SHALL NOT widen the declared consumer TypeScript range. A TypeScript version outside that range SHALL be described only as measured compatibility, never as support.

#### Scenario: The kit installs with npm and pnpm with one core copy
- **WHEN** the gate installs the kit with npm and with the pinned pnpm outside any workspace root
- **THEN** both installations succeed and the duplicate-copy probe finds exactly one core copy in each

#### Scenario: The demonstrated events arrive valid and byte-identical
- **WHEN** the example service emits authentication success, authentication failure, authorization denial, sensitive-resource view, and sensitive-resource modification after a committed operation, all to the example receiver
- **THEN** each event is accepted, passes `validateSecurityAuditEvent` at the receiver, and is byte-identical to what the SDK validated

#### Scenario: A planted defect fails the gate
- **WHEN** the gate runs against a kit with a broken core dependency, a duplicated core, a drifted or ill-typed doc snippet, or a missing kit item
- **THEN** the gate fails

#### Scenario: The declared TypeScript range is unchanged
- **WHEN** the declared consumer TypeScript range and the kit's documents are inspected after the kit exists
- **THEN** the declared range is the one declared before the kit existed, and TypeScript 6 and 7 are described only as measured compatibility outside it

### Requirement: The evaluation kit has a reproducible identity and authorizes no release

Every built kit SHALL carry an identity file that records:

- the commit SHA the kit was built from;
- the SHA-256 of each packed artifact;
- a kit digest that follows the repository's package-set hash convention.

Recomputing these values from the kit's files SHALL reproduce them.

The builder SHALL refuse to produce a distributable kit from a dirty tree. A kit that the gate builds from uncommitted work SHALL be marked non-distributable in its identity file.

For the same commit, the builder SHALL produce the same file list and the same artifact digests. It SHALL write the kit only outside the repository tree. A distributable kit SHALL be written both as a directory and as a single archive for distribution.

Building a kit SHALL NOT publish, tag or version-move any package, and every package SHALL remain `private` and `UNLICENSED`.

#### Scenario: The identity reproduces
- **WHEN** the commit, per-artifact SHA-256 and kit digest are recomputed from a built kit's files
- **THEN** they equal the values in the kit's identity file

#### Scenario: A dirty tree never yields a distributable kit
- **WHEN** the builder is asked for a distributable kit while the repository has uncommitted changes, and the gate builds a kit from the same tree
- **THEN** the distributable build refuses and produces no kit, and the gate's kit is marked non-distributable in its identity file

#### Scenario: Building releases nothing
- **WHEN** a kit is built
- **THEN** no package is published, tagged or version-moved, and every package remains `private` and `UNLICENSED` at its current version

### Requirement: Evaluator documentation states the alpha's boundaries and is checked

The kit's documents SHALL include:

- a quickstart;
- the error catalog;
- a wire-protocol page with a failure table;
- privacy guidance;
- a supported-versus-planned table;
- known issues;
- an evaluation guide and questionnaire.

They SHALL state the alpha's delivery guarantee: one attempt, no retry, no ordering, and no delivery-class conformance. They SHALL also state:

- the declared consumer TypeScript range, and the measured TypeScript compatibility outside it;
- that yarn, and installing the Node binding on its own, are unsupported;
- that the prohibited-data value scan is heuristic.

They SHALL NOT describe a planned feature as implemented, and SHALL NOT imply production use, publication or a license change. Every value SHALL be synthetic, and no snippet SHALL set a production environment.

Every TypeScript code block in these documents SHALL type-check in the installed kit.

#### Scenario: Planned features are never described as implemented
- **WHEN** the supported-versus-planned table and the other kit documents are inspected
- **THEN** OCSF export, OpenTelemetry transport, CloudEvents envelopes, retries, queues and framework adapters appear only as planned

#### Scenario: A drifted snippet fails
- **WHEN** a TypeScript code block in a kit document uses a renamed option or contains a type error
- **THEN** the gate's documentation check fails
