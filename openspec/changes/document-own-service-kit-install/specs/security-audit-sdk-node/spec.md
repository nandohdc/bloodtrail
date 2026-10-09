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
- install an own service, outside the kit directory and outside any workspace root, from the integration
  guide's documented snippets verbatim, with npm and with each pinned pnpm release; fail when the documented
  dependencies omit either SDK package, when an installer reports a setting the documented install adds as
  unknown, ignored, or no longer read, or when npm reports an invalid dependency; and prove in each
  installation that the Node binding's entry point and both core entry points load with exactly one core copy;
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

#### Scenario: An own service installs the kit as documented
- **WHEN** the kit gate installs an own service outside the kit directory from the integration guide's
  documented snippets, with npm and with the pinned release of each of pnpm 10, 11 and 12
- **THEN** every installation succeeds, npm reports no invalid dependency, and the Node binding and both core
  entry points load with exactly one core copy in each

#### Scenario: An own service without the core pin fails the gate
- **WHEN** the integration guide's documented install omits the core pin for npm, or for pnpm
- **THEN** the kit gate fails at that installer

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
- how to add the kit to an own service outside the kit directory, with npm and with each supported pnpm major:
  both SDK packages from the kit's tarballs and the core pin, in snippets the kit gate installs from verbatim;
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
