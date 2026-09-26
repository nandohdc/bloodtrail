## ADDED Requirements

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
