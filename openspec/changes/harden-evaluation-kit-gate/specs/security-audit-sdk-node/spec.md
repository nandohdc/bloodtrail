## MODIFIED Requirements

### Requirement: The evaluation kit installs and runs outside any workspace and its gate fails closed

The Node binding SHALL provide a builder and a kit gate for a non-production evaluation kit. The kit gate
SHALL produce a verification summary whose clauses identify only checks that ran, whether it built a
verification kit or checked an existing kit. Each check SHALL have a stable identity and SHALL contribute its
clause only when that check ran.

**Kit contents.** The kit SHALL contain:

- the packed core, Node binding and collector artifacts;
- the example service, its driver, and the example receiver sources;
- a generated consumer manifest whose npm overrides pin the core to the kit's own tarball, and which has no
  `pnpm` field;
- a generated pnpm settings file whose overrides pin the core to the same tarball;
- the 13 evaluator document files under `docs/`, including the copied Node binding and Core READMEs, but not
  the repository root README;
- an identity file, a checksum list, and the separately stored kit-digest file required by "The evaluation
  kit has a reproducible identity and authorizes no release".

The kit SHALL NOT contain the facilitator answer key, any representation of its content, or any program that
only the kit gate runs. No manifest for the examples SHALL be tracked in the repository. Building the kit
SHALL NOT change the packed contents of the three packages.

**Supported installers.** The supported installers are npm and pnpm majors 10, 11 and 12. The kit gate SHALL
pin exactly one release of each supported pnpm major. "Outside any workspace root" means outside every
workspace of this repository. The kit directory SHALL be its own pnpm workspace root, through its pnpm
settings file.

**The kit gate and its planted-defect controls** SHALL run through the Node binding's `test` script on every
supported Node version and in its validation chain. The Node binding's `test` script is the per-version surface
for these runtime gates; no CI workflow file is part of this requirement. The kit gate SHALL:

- install the kit with npm and with each pinned pnpm release, each into a clean directory outside any
  workspace root, and fail when an installer reports that a setting the kit ships is unknown, ignored, or no
  longer read;
- prove that exactly one core copy resolves in each installation;
- type-check the example sources, every TypeScript block in the kit documents, and every fix in the
  facilitator answer key, under strict consumer settings, with TypeScript 5.9.2 and with pinned 6.0.x and
  7.0.x releases;
- recognize a TypeScript fence when its language name matches in any letter case and an info string follows
  it, require every fence to name an allowlisted language, and run each document block that contains no
  `declare`;
- resolve every identifier-shaped span in the kit documents against the installed declarations unless the
  span occurs in a reviewed exception list, and fail when a span names neither an exported function nor a
  method or member of an exported type;
- run the example service's driver against the example service and the example receiver over loopback, and
  prove that each demonstrated event is accepted and passes SDK validation at the receiver, and that the
  bytes the receiver received equal the bytes the SDK handed to the HTTP audit sink;
- prove the example receiver's behaviour, as required by "The example receiver models a careful ingress";
- drive the HTTP audit sink against a controllable loopback peer, and prove the documented failure mapping,
  including that a peer which stalls while sending its response body is reported as `timeout`;
- run the seeded invalid calls, and prove that each returns its expected code and path;
- scan every kit file and every text entry in the packed artifacts for facilitator answer-key material, using
  each fix's code and each expected code-and-path pair;
- require every planned row to name its feature in glossary terms, including the planned feature name
  `Delivery retry by the HTTP audit sink, in process or durable`, and fail a sentence that names a planned
  feature in any verb form without a planned marker, except at a reviewed file-and-heading pair for the Node
  README's frozen-primitives sections or the Core README's re-execution sections; and
- scan every kit document and example, links included, so every host, email address, IP address, and
  environment name is synthetic or on a reviewed gate list, which starts empty.

When a kit document describes performing an audited operation again, it SHALL say `re-execution`, never
`retry`; the planned feature name above remains the glossary name for delivery retry. The known-issues page
SHALL name `event.timestamp` and `event.observed_at`, not `occurred_at`.

Each kit-gate check SHALL be shown to fail on a planted defect. Each planted-defect control SHALL make one
measured change to a disposable copy, fail at the stable identity of the check it names, and itself fail when
disabling that named check permits its plant. The control harness SHALL derive its applied count from measured
plants, and a plant that changes nothing SHALL fail the harness. Resealing a disposable copy is permitted
only to isolate the named check.

The kit gate, its controls, and the builder SHALL perform their work when invoked through a symlinked path.
The kit gate SHALL be able to run on uncommitted work, so that verification can run before a commit.

The kit SHALL NOT widen the declared consumer TypeScript range. A TypeScript version outside that range SHALL
be described only as measured compatibility, never as support.

#### Scenario: The kit installs with npm and pnpm with one core copy
- **WHEN** the kit gate installs the kit with npm, and with the pinned release of each of pnpm 10, 11 and 12,
  outside any workspace root
- **THEN** every installation succeeds without reporting an unknown, ignored, or no-longer-read setting the
  kit ships, and the duplicate-copy probe finds exactly one core copy in each

#### Scenario: An override the installer ignores fails the gate
- **WHEN** the kit carries its pnpm override only in the consumer manifest's `pnpm` field
- **THEN** the kit gate fails on the pnpm 11 and pnpm 12 installations

#### Scenario: The demonstrated events arrive valid and byte-identical
- **WHEN** the driver makes the example service emit authentication success, authentication failure,
  authorization denial, sensitive-resource view, and sensitive-resource modification after a committed
  operation, all to the example receiver
- **THEN** each event is accepted and passes `validateSecurityAuditEvent` at the receiver, and the bytes the
  receiver received equal the bytes the SDK handed to the HTTP audit sink

#### Scenario: A rewritten field fails the byte comparison
- **WHEN** a sink between the SDK and the example receiver rewrites one field of a demonstrated event
- **THEN** the kit gate fails

#### Scenario: A stalled response body is a timeout
- **WHEN** the peer sends its response headers and then stalls the response body past the per-request deadline
- **THEN** the SDK returns `SDK_SINK_FAILURE` and the outcome callback reports `timeout`, and a mapping of
  that stall to a malformed acknowledgment fails the kit gate

#### Scenario: An invented API fails the gate
- **WHEN** a kit document names, in an identifier-shaped span, a function or method that the installed
  packages do not export, such as `op.commit()`
- **THEN** the kit gate fails

#### Scenario: The answer key never ships
- **WHEN** the facilitator answer key's code or an expected code-and-path pair is copied into any kit file or
  any text entry in a packed artifact
- **THEN** the kit gate fails

#### Scenario: A planted defect fails the gate
- **WHEN** the kit gate runs against a kit with a broken core dependency, a duplicated core, a drifted or
  ill-typed document block, a missing kit item, a missing or copied facilitator answer key, a misclassified
  failure status, a broken first-event run, a seeded invalid call that no longer fails, a planned feature
  without its marker, a non-synthetic value, or an export removed from the Node binding's packed entry point
- **THEN** the kit gate fails at the identity of the check for that measured planted defect

#### Scenario: The declared TypeScript range is unchanged
- **WHEN** the declared consumer TypeScript range and the kit's documents are inspected after the kit exists
- **THEN** the declared range is the one declared before the kit existed, and TypeScript 6 and 7 are described
  only as measured compatibility outside it

### Requirement: The evaluation kit has a reproducible identity and authorizes no release

Every built kit SHALL carry an `identity.json` file in identity format 3. The kit gate SHALL refuse identity
format 2 by name. The identity file SHALL record:

- identity-format version 3;
- the commit SHA the kit was built from;
- whether the kit is distributable;
- the SHA-256 of each packed artifact; and
- a package-set digest and a manifest digest, following the repository's package-set hash convention.

Every built kit SHALL also carry `checksums.sha256`, in the format that `shasum -a 256 -c` verifies.
`checksums.sha256` SHALL include `identity.json` and every other kit file except itself and
`kit-digest.sha256`: the artifacts, the consumer manifest, the pnpm settings file, the documents, and the
examples. The kit digest SHALL be the SHA-256 of `checksums.sha256`, stored only outside that list in
`kit-digest.sha256` in `shasum -c` format. `kit-digest.sha256` SHALL contain the sole recorded kit digest;
the identity file SHALL NOT duplicate it.

Recomputing this format-3 identity material from the kit's files SHALL reproduce it. Artifact file names
SHALL be derived from the package manifests. Every ordering that identity material depends on SHALL be
code-point order, never a locale-dependent comparison, except that entries inside an artifact SHALL retain
npm's measured-stable order.

**Tracked sources only.** The builder SHALL build every packed artifact from a clean temporary copy of the
repository's tracked files: at the identity commit for a distributable kit, and from the working tree's
tracked files for a verification kit that the kit gate builds. For a distributable kit, the builder and kit
gate SHALL compare every exported regular file with the identity commit's blob. Build output, ignored files,
untracked files, attributes, filters, line-ending settings, local umask, and non-regular files present on disk
SHALL NOT vary or reach a kit.

The builder SHALL refuse to produce a distributable kit from a dirty tree. A kit that the kit gate builds from
uncommitted work SHALL be marked non-distributable in `identity.json`. The kit gate SHALL build a
distributable kit from a disposable clean clone of the tree under test and prove that it has the same artifacts
and checksum list as a verification kit built from that tree; the dirty-tree control SHALL use a real
uncommitted change in a disposable clone.

For the same commit, the builder SHALL produce the same file list, the same artifact digests, and the same
kit digest independent of the local Git configuration and umask. It SHALL write the kit only outside the
repository tree. A distributable kit SHALL be written both as a directory and as a single archive for
distribution. An archive cannot contain its own digest, so the archive's SHA-256 SHALL be recorded outside
the archive, together with the kit identity, before the kit is distributed. The evaluation facilitator SHALL
publish the kit digest and archive digest. Neither digest authorizes a release.

Building a kit SHALL NOT publish, tag or version-move any package, and every package SHALL remain `private`
and `UNLICENSED`.

#### Scenario: The identity reproduces
- **WHEN** the format-3 commit, distributable flag, per-artifact SHA-256, package-set digest, manifest
  digest, checksum list, and kit digest are recomputed from a built kit's files
- **THEN** they equal the values in `identity.json`, `checksums.sha256`, and the separately stored
  `kit-digest.sha256` as applicable

#### Scenario: Stale build output never reaches a kit
- **WHEN** the same tree is built twice, the second time after stale content has been planted in each
  package's ignored build output
- **THEN** both builds produce identical artifact digests and an identical kit digest

#### Scenario: Every kit file is verifiable with standard tools
- **WHEN** `shasum -a 256 -c` runs over `checksums.sha256` and `kit-digest.sha256` in an unpacked kit, before
  and after one listed document is changed
- **THEN** both commands succeed before the change and the checksum-list command fails after it

#### Scenario: A dirty tree never yields a distributable kit
- **WHEN** the builder is asked for a distributable kit while the repository has uncommitted changes, and the
  kit gate builds a kit from the same tree
- **THEN** the distributable build refuses and produces no kit, and the kit gate's kit is marked
  non-distributable in its identity file

#### Scenario: Building releases nothing
- **WHEN** a kit is built
- **THEN** no package is published, tagged or version-moved, and every package remains `private` and
  `UNLICENSED` at its current version

### Requirement: Evaluator documentation states the alpha's boundaries and is checked

The kit's documents SHALL include:

- a quickstart;
- the error catalog;
- a wire-protocol page with a failure table;
- privacy guidance;
- a supported-versus-planned table;
- known issues;
- an evaluation guide and questionnaire;
- the seeded invalid-call exercise, which states its calls and its rules only.

They SHALL state the alpha's delivery guarantee: one attempt, no re-execution, no ordering, and no delivery-class
conformance. The planned feature `Delivery retry by the HTTP audit sink, in process or durable` and backpressure
primitives that the Node binding exports outside the evaluated path SHALL be described as outside that path,
never as the alpha's delivery. Every claim that compares a
demonstrated event's bytes SHALL say that the example receiver received the bytes the SDK handed to the HTTP
audit sink. A successful named emit's value SHALL be documented as only
`{status}`. They SHALL also state:

- the supported installers, naming npm and exactly the pnpm majors the gate proves, and that yarn, and
  installing the Node binding on its own, are unsupported;
- the declared consumer TypeScript range, and the measured TypeScript compatibility outside it;
- that the prohibited-data value scan is heuristic;
- that the collector ingress checks structure only, so its acceptance is not validity;
- that the named-method input types require `actor`, `tenant` and, for some events, `correlation`, even where
  a context scope, the configuration or the SDK supplies them at runtime; and
- the evaluation's rules: synthetic data only, non-production environments only, the evaluation window, and
  what to do if non-synthetic data reaches a receiver.

The expected codes, paths, diagnoses and fixes for the seeded invalid calls SHALL live in a facilitator-only
answer key, which the kit never contains. The known-issues page SHALL name `event.timestamp` and
`event.observed_at`, not `occurred_at`.

The documents SHALL NOT describe a planned feature as implemented, and SHALL NOT imply production use,
publication or a license change. Each planned-feature row SHALL name its feature in the Node binding glossary's
terms; the planned row for `Delivery retry by the HTTP audit sink, in process or durable` SHALL use that exact
glossary term and mark it planned. A sentence that names a planned feature in any verb form SHALL carry a planned
marker, except at a reviewed file-and-heading pair in the Node README's frozen-primitives sections or the Core
README's re-execution sections. When a kit document describes performing an audited operation again, it SHALL
say `re-execution`, never `retry`; the planned feature above retains its glossary name. Every identifier-shaped
span that a document names SHALL resolve against the installed declarations unless it occurs in a reviewed exception
list, and every error illustration SHALL use only the fields of the exported error type. Every value SHALL be
synthetic, and no snippet SHALL set a production environment.

Every fence in these documents SHALL name an allowlisted language. Every TypeScript code block, whose language
name matches in any letter case and may have an info string after it, SHALL type-check in the installed kit. A
document block that contains no `declare` SHALL run in the installed kit.

#### Scenario: Planned features are never described as implemented
- **WHEN** the supported-versus-planned table and the other kit documents are inspected
- **THEN** OCSF export, OpenTelemetry transport, CloudEvents envelopes, `Delivery retry by the HTTP audit sink,
  in process or durable`, queues and framework adapters appear only as planned, and that planned-feature row
  uses its exact glossary term

#### Scenario: A planted supported feature fails
- **WHEN** a kit document lists `Delivery retry by the HTTP audit sink, in process or durable` as supported
- **THEN** the gate's documentation check fails

#### Scenario: A drifted snippet fails
- **WHEN** a TypeScript code block in a kit document uses a renamed option or contains a type error
- **THEN** the gate's documentation check fails

#### Scenario: Evaluators never receive the answers
- **WHEN** the kit's seeded invalid-call document and seeded example are inspected
- **THEN** the document lists the calls and the exercise's rules with no expected code, path, diagnosis or fix,
  and the example prints each returned error's code, category and path with no verdict

### Requirement: The example receiver models a careful ingress

The kit's example receiver SHALL remain a thin, in-memory `node:http` wrapper around the collector ingress,
with a synthetic fixture authenticator and no storage. It is an example for the non-production evaluation, and
it SHALL authorize no collector deployment and no storage.

For every request, the receiver SHALL read no more than a fixed body bound, whatever answer that request will
receive. When a body is within the bound, the receiver SHALL read it completely before answering. Once it
observes that a body is past the bound, it SHALL send the answer applicable to that request, close the
connection, and read nothing more. These limits apply to authentication failures, oversized valid submissions,
wrong-path requests, and every other answer.

For a submission on its configured path whose body is within the bound, the receiver SHALL, in this order:

1. authenticate the caller, before it validates or reveals anything about the body;
2. parse the body and run SDK validation;
3. submit to the collector ingress only an event that passed SDK validation.

A credential SHALL authenticate only when it uses the `Bearer` scheme, matched without regard to letter case;
a bare credential or one with no scheme SHALL fail authentication. An event that fails SDK validation SHALL
therefore never be admitted, and SHALL never take an identity at the ingress.

The receiver SHALL answer each case with the status that names it:

- an authentication failure: 401, revealing nothing about the body;
- a body over the bound on an authenticated submission-path `POST`: 413;
- a `POST` to any path other than the configured submission path: 404;
- any method other than `POST`: 405 with `Allow: POST`;
- a malformed body: 400;
- a conflict: 409;
- an SDK validation failure or an unsupported version: 422;
- a duplicate: a 2xx response carrying exactly one acknowledgment for that event, whose outcome is `accepted`;
- an unexpected error: 500.

A duplicate SHALL be acknowledged and never admitted twice, as the collector's domain glossary defines it. A
client abort SHALL be treated as an abort, not logged as a 500 and not counted as a rejection. The receiver
SHALL keep serving after any rejection or unexpected error, and SHALL never rethrow out of a request handler.

The receiver SHALL print each accepted event in full, exactly as received. The wire-protocol page SHALL
document how a duplicate, a conflict, a bare credential, a `POST` to another path, and a client abort are
answered.

#### Scenario: An unauthenticated submission learns nothing
- **WHEN** a submission without valid credentials arrives, whatever its body
- **THEN** the receiver reads no more than the bound, reads a within-bound body before answering 401 with no
  validation detail, closes and reads nothing more when the body exceeds the bound, and admits nothing

#### Scenario: An oversized body is refused
- **WHEN** an authenticated submission-path `POST` whose body is larger than the bound arrives
- **THEN** the receiver answers 413, closes the connection, and reads nothing more

#### Scenario: Each rejection names its cause
- **WHEN** a malformed body, an event that conflicts with an admitted event, and an SDK-invalid event are each
  submitted on the configured path with valid credentials
- **THEN** the receiver answers 400, 409 and 422 respectively

#### Scenario: An SDK-invalid event is never admitted
- **WHEN** an event fails SDK validation, and a corrected event with the same identity is submitted afterwards
- **THEN** the corrected event is admitted and acknowledged as `accepted`

#### Scenario: A redelivered copy is acknowledged
- **WHEN** the SDK redelivers a byte-identical copy of an event the receiver has already accepted
- **THEN** the receiver answers 2xx with exactly one `accepted` acknowledgment for that event, and the SDK
  returns an ok result

#### Scenario: The receiver keeps serving
- **WHEN** any rejection above, or an unexpected error, has been answered
- **THEN** the next valid event is accepted

#### Scenario: The health endpoint exposes no event
- **WHEN** `GET /health` is requested
- **THEN** the receiver reads no more than the bound, reads a within-bound body before answering 405 with
  `Allow: POST`, closes and reads nothing more when the body exceeds the bound, and exposes no event body

#### Scenario: A POST to another path is not a submission
- **WHEN** a `POST` to a path other than the configured submission path arrives
- **THEN** the receiver reads no more than the bound, reads a within-bound body before answering 404, closes
  and reads nothing more when the body exceeds the bound, and admits nothing

#### Scenario: Non-POST methods are refused
- **WHEN** a request uses a method other than `POST`
- **THEN** the receiver reads no more than the bound, reads a within-bound body before answering 405 with
  `Allow: POST`, closes and reads nothing more when the body exceeds the bound, and admits nothing

#### Scenario: Bearer credentials are strict and case-insensitive
- **WHEN** a submission presents a bare credential, a credential with no scheme, or a `Bearer` scheme in any
  letter case
- **THEN** the bare and schemeless credentials receive 401, and each case-insensitive `Bearer` credential is
  authenticated

#### Scenario: A client abort is not a rejection
- **WHEN** a client aborts while its request body is being read
- **THEN** the receiver treats it as an abort, does not log a 500 or count a rejection, and keeps serving

### Requirement: The governed fetch delivery adapter maps native outcomes onto the handoff's closed outcome set

The package SHALL provide exactly one delivery adapter, `createFetchHttpExchange`, approved by the governed
inventory recorded for #113, which supplies an `HttpExchange` over the Node runtime's `fetch`. It SHALL accept
an origin of an `http` or `https` scheme, host, and optional port only, and SHALL fail construction for a path,
query, fragment, userinfo, or any other scheme, and for a per-attempt deadline or response bound that is not a
bounded positive integer. It SHALL send each exchange only to that origin, SHALL NOT follow a redirect, SHALL
bound every exchange by its deadline, and SHALL read at most its response bound. It SHALL map a response to a
`response` outcome carrying the parsed acknowledgments, a deadline, including one while reading a response
body, to `timeout`, and a connection failure or an error while reading a response body other than the deadline
to `transport_failure`. The handoff classifies that `transport_failure` as `retryable`, so the existing delivery
retry retries it. An unparseable, empty, shapeless, or oversized body SHALL map to an acknowledgment the
handoff classifies as a protocol error, never to acceptance. It SHALL add no classification of its own.
Caller-supplied headers SHALL be forwarded only to the configured origin and SHALL NOT be logged or echoed.
The adapter SHALL authorize no deployment or delivery infrastructure, and SHALL carry
`decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner decision"`.

#### Scenario: The adapter passes the common conformance suite
- **WHEN** the common per-class delivery conformance suite runs through the adapter against an acknowledging
  loopback peer
- **THEN** every class binding delivers its own event in one zero-based attempt, refuses foreign and unknown
  events, and states its frozen-row guarantees

#### Scenario: A slow peer is a timeout, never a delivery
- **WHEN** the peer responds after the per-attempt deadline
- **THEN** the handoff classifies the attempt `retryable` with code `timeout`

#### Scenario: A malformed or oversized body is never acceptance
- **WHEN** a 2xx response body is unparseable, empty, shapeless, acknowledges another event, or exceeds the
  response bound, or reading its body fails other than at the deadline
- **THEN** the handoff classifies the malformed or oversized body `protocol_error`, and classifies the
  non-deadline response-body read error `retryable` with code `transport_failure`, so the delivery retry
  retries it

#### Scenario: A redirect is never followed
- **WHEN** the peer answers with a redirect to another origin
- **THEN** the handoff classifies the attempt `protocol_error` and the redirect target receives nothing

#### Scenario: An unsafe origin fails construction
- **WHEN** the adapter is configured with a path, query, fragment, credentials in the URL, or a non-HTTP scheme
- **THEN** construction throws and no exchange exists
