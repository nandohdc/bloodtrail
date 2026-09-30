## MODIFIED Requirements

### Requirement: The evaluation kit installs and runs outside any workspace and its gate fails closed

The Node binding SHALL provide a builder and a gate for a non-production evaluation kit.

**Kit contents.** The kit SHALL contain:

- the packed core, Node binding and collector artifacts;
- the example service, its driver, and the example receiver sources;
- a generated consumer manifest whose npm overrides pin the core to the kit's own tarball, and which has no `pnpm` field;
- a generated pnpm settings file whose overrides pin the core to the same tarball;
- the evaluator documents;
- an identity file and a checksum list.

The kit SHALL NOT contain the facilitator answer key, or any program that only the gate runs. No manifest for the examples SHALL be tracked in the repository. Building the kit SHALL NOT change the packed contents of the three packages.

**Supported installers.** The supported installers are npm and pnpm majors 10, 11 and 12. The gate SHALL pin exactly one release of each supported pnpm major. "Outside any workspace root" means outside every workspace of this repository. The kit directory SHALL be its own pnpm workspace root, through its pnpm settings file.

**The gate** SHALL run in the Node binding's validation chain on every CI Node version. It SHALL:

- install the kit with npm and with each pinned pnpm release, each into a clean directory outside any workspace root, and fail when an installer reports that a kit setting was ignored;
- prove that exactly one core copy resolves in each installation;
- type-check the example sources, every TypeScript code block in the kit's documents, and every fix in the facilitator answer key, under strict consumer settings, with TypeScript 5.9.2 and with pinned 6.0.x and 7.0.x releases;
- resolve every call-shaped reference in inline code in the kit's documents against the installed packages, and fail on a reference that names neither a function the installed packages export nor a method of an exported type;
- run the example service's driver against the example service and the example receiver over loopback, and prove that each demonstrated event is accepted and passes SDK validation at the receiver, and that the bytes the receiver received equal the bytes the SDK validated at the sender;
- prove the example receiver's behaviour, as required by "The example receiver models a careful ingress";
- drive the HTTP audit sink against a controllable loopback peer, and prove the documented failure mapping, including that a peer which stalls while sending its response body is reported as `timeout`;
- run the seeded invalid calls, and prove that each returns its expected code and path;
- fail when any kit item is missing, and when the kit contains the facilitator answer key's content.

Each of these checks SHALL be shown to fail on a planted defect. Each planted defect SHALL be applied to a disposable copy, and the control harness SHALL assert how many planted defects it applied, not only the exit code.

The gate SHALL be able to run on uncommitted work, so that verification can run before a commit.

The kit SHALL NOT widen the declared consumer TypeScript range. A TypeScript version outside that range SHALL be described only as measured compatibility, never as support.

#### Scenario: The kit installs with npm and pnpm with one core copy
- **WHEN** the gate installs the kit with npm, and with the pinned release of each of pnpm 10, 11 and 12, outside any workspace root
- **THEN** every installation succeeds without reporting an ignored setting, and the duplicate-copy probe finds exactly one core copy in each

#### Scenario: An override the installer ignores fails the gate
- **WHEN** the kit carries its pnpm override only in the consumer manifest's `pnpm` field
- **THEN** the gate fails on the pnpm 11 and pnpm 12 installations

#### Scenario: The demonstrated events arrive valid and byte-identical
- **WHEN** the driver makes the example service emit authentication success, authentication failure, authorization denial, sensitive-resource view, and sensitive-resource modification after a committed operation, all to the example receiver
- **THEN** each event is accepted and passes `validateSecurityAuditEvent` at the receiver, and the bytes the receiver received equal the bytes the SDK validated at the sender

#### Scenario: A rewritten field fails the byte comparison
- **WHEN** a sink between the SDK and the example receiver rewrites one field of a demonstrated event
- **THEN** the gate fails

#### Scenario: A stalled response body is a timeout
- **WHEN** the peer sends its response headers and then stalls the response body past the per-request deadline
- **THEN** the SDK returns `SDK_SINK_FAILURE` and the outcome callback reports `timeout`, and a mapping of that stall to a malformed acknowledgment fails the gate

#### Scenario: An invented API fails the gate
- **WHEN** a kit document names, in inline code, a function or method that the installed packages do not export, such as `op.commit()`
- **THEN** the gate fails

#### Scenario: The answer key never ships
- **WHEN** the facilitator answer key's content is copied into the kit
- **THEN** the gate fails

#### Scenario: A planted defect fails the gate
- **WHEN** the gate runs against a kit with a broken core dependency, a duplicated core, a drifted or ill-typed doc snippet, a missing kit item, a misclassified failure status, a broken first-event run, a seeded invalid call that no longer fails, or an export removed from the Node binding's packed entry point
- **THEN** the gate fails

#### Scenario: The declared TypeScript range is unchanged
- **WHEN** the declared consumer TypeScript range and the kit's documents are inspected after the kit exists
- **THEN** the declared range is the one declared before the kit existed, and TypeScript 6 and 7 are described only as measured compatibility outside it

### Requirement: The evaluation kit has a reproducible identity and authorizes no release

Every built kit SHALL carry an identity file that records:

- an identity-format version;
- the commit SHA the kit was built from;
- the SHA-256 of each packed artifact;
- a package-set digest and a manifest digest, following the repository's package-set hash convention;
- a kit digest that commits to the package-set digest, the manifest digest and the checksum list.

Every built kit SHALL also carry a checksum list, in the format that `shasum -a 256 -c` verifies. It SHALL cover every kit file other than the identity file and the checksum list itself: the artifacts, the consumer manifest, the pnpm settings file, the documents and the examples.

Recomputing these values from the kit's files SHALL reproduce them. Artifact file names SHALL be derived from the package manifests. Every ordering that an identity value depends on SHALL be code-point order, never a locale-dependent comparison.

**Tracked sources only.** The builder SHALL build every packed artifact from a clean temporary copy of the repository's tracked files: at the identity commit for a distributable kit, and from the working tree's tracked files for a kit that the gate builds. Build output, ignored files and untracked files present on disk SHALL NOT reach a kit.

The builder SHALL refuse to produce a distributable kit from a dirty tree. A kit that the gate builds from uncommitted work SHALL be marked non-distributable in its identity file.

For the same commit, the builder SHALL produce the same file list, the same artifact digests and the same kit digest. It SHALL write the kit only outside the repository tree. A distributable kit SHALL be written both as a directory and as a single archive for distribution. An archive cannot contain its own digest, so the archive's SHA-256 SHALL be recorded outside the kit, together with the kit's identity, before the kit is distributed.

Building a kit SHALL NOT publish, tag or version-move any package, and every package SHALL remain `private` and `UNLICENSED`.

#### Scenario: The identity reproduces
- **WHEN** the commit, per-artifact SHA-256, package-set digest, manifest digest and kit digest are recomputed from a built kit's files
- **THEN** they equal the values in the kit's identity file

#### Scenario: Stale build output never reaches a kit
- **WHEN** the same tree is built twice, the second time after stale content has been planted in each package's ignored build output
- **THEN** both builds produce identical artifact digests and an identical kit digest

#### Scenario: Every kit file is verifiable with standard tools
- **WHEN** `shasum -a 256 -c` runs over the checksum list in an unpacked kit, before and after one listed document is changed
- **THEN** it succeeds before the change and fails after it

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
- an evaluation guide and questionnaire;
- the seeded invalid-call exercise, which states its calls and its rules only.

They SHALL state the alpha's delivery guarantee: one attempt, no retry, no ordering, and no delivery-class conformance. Delivery retry and backpressure primitives that the Node binding exports outside the evaluated path SHALL be described as outside that path, never as the alpha's delivery. They SHALL also state:

- the supported installers, naming npm and exactly the pnpm majors the gate proves, and that yarn, and installing the Node binding on its own, are unsupported;
- the declared consumer TypeScript range, and the measured TypeScript compatibility outside it;
- that the prohibited-data value scan is heuristic;
- that the collector ingress checks structure only, so its acceptance is not validity;
- that the named-method input types require `actor`, `tenant` and, for some events, `correlation`, even where a context scope, the configuration or the SDK supplies them at runtime;
- the evaluation's rules: synthetic data only, non-production environments only, the evaluation window, and what to do if non-synthetic data reaches a receiver.

The expected codes, paths, diagnoses and fixes for the seeded invalid calls SHALL live in a facilitator-only answer key, which the kit never contains.

The documents SHALL NOT describe a planned feature as implemented, and SHALL NOT imply production use, publication or a license change. Every function or method they name SHALL exist in the installed kit, and every error illustration SHALL use only the fields of the exported error type. Every value SHALL be synthetic, and no snippet SHALL set a production environment.

Every TypeScript code block in these documents SHALL type-check in the installed kit.

#### Scenario: Planned features are never described as implemented
- **WHEN** the supported-versus-planned table and the other kit documents are inspected
- **THEN** OCSF export, OpenTelemetry transport, CloudEvents envelopes, retries, queues and framework adapters appear only as planned

#### Scenario: A planted supported feature fails
- **WHEN** a kit document lists retries as supported
- **THEN** the gate's documentation check fails

#### Scenario: A drifted snippet fails
- **WHEN** a TypeScript code block in a kit document uses a renamed option or contains a type error
- **THEN** the gate's documentation check fails

#### Scenario: Evaluators never receive the answers
- **WHEN** the kit's seeded invalid-call document and seeded example are inspected
- **THEN** the document lists the calls and the exercise's rules with no expected code, path, diagnosis or fix, and the example prints each returned error's code, category and path with no verdict

## ADDED Requirements

### Requirement: The example receiver models a careful ingress

The kit's example receiver SHALL remain a thin, in-memory `node:http` wrapper around the collector ingress, with a synthetic fixture authenticator and no storage. It is an example for the non-production evaluation, and it SHALL authorize no collector deployment and no storage.

For every submission, the receiver SHALL, in this order:

1. authenticate the caller, before it validates or reveals anything about the body;
2. read at most a fixed body bound, and stop reading beyond it;
3. parse the body and run SDK validation;
4. submit to the collector ingress only an event that passed SDK validation.

An event that fails SDK validation SHALL therefore never be admitted, and SHALL never take an identity at the ingress.

The receiver SHALL answer each case with the status that names it:

- an authentication failure: 401, revealing nothing about the body;
- a body over the bound: 413;
- a malformed body: 400;
- a conflict: 409;
- an SDK validation failure or an unsupported version: 422;
- a duplicate: a 2xx response carrying exactly one acknowledgment for that event, whose outcome is `accepted`;
- an unexpected error: 500.

A duplicate SHALL be acknowledged and never admitted twice, as the collector's domain glossary defines it. The receiver SHALL keep serving after any rejection or unexpected error, and SHALL never rethrow out of a request handler.

The receiver SHALL print each accepted event in full, exactly as received. Its health endpoint SHALL report status and counts only, and never an event body. The wire-protocol page SHALL document how a duplicate and a conflict are answered.

#### Scenario: An unauthenticated submission learns nothing
- **WHEN** a submission without valid credentials arrives, whatever its body
- **THEN** the receiver answers 401 with no validation detail, and admits nothing

#### Scenario: An oversized body is refused
- **WHEN** a body larger than the bound arrives
- **THEN** the receiver answers 413 without buffering beyond the bound

#### Scenario: Each rejection names its cause
- **WHEN** a malformed body, an event that conflicts with an admitted event, and an SDK-invalid event are each submitted
- **THEN** the receiver answers 400, 409 and 422 respectively

#### Scenario: An SDK-invalid event is never admitted
- **WHEN** an event fails SDK validation, and a corrected event with the same identity is submitted afterwards
- **THEN** the corrected event is admitted and acknowledged as `accepted`

#### Scenario: A redelivered copy is acknowledged
- **WHEN** the SDK redelivers a byte-identical copy of an event the receiver has already accepted
- **THEN** the receiver answers 2xx with exactly one `accepted` acknowledgment for that event, and the SDK returns an ok result

#### Scenario: The receiver keeps serving
- **WHEN** any rejection above, or an unexpected error, has been answered
- **THEN** the next valid event is accepted

#### Scenario: The health endpoint exposes no event
- **WHEN** the health endpoint is requested
- **THEN** it returns status and counts only, and no event body
