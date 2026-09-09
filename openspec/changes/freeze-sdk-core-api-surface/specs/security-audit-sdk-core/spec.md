## MODIFIED Requirements

### Requirement: SDK package has an explicit supported runtime and public surface

The SDK package SHALL publish an explicit supported Node.js runtime policy, module format policy, strict TypeScript compiler baseline, package export map, and public API compatibility policy. Only documented public exports SHALL be treated as supported; internal generated, validation, and implementation modules SHALL NOT be reachable through undocumented package subpaths.

The package SHALL initialize from an immutable configuration snapshot and SHALL reject invalid or incomplete configuration before accepting event construction or emission. Configuration SHALL identify contract version `1.0.0`, producer, service, environment, deployment, authoritative-context providers, clock and identifier providers, validation policy, registered transformation hooks, and sink.

After a passing producer-to-collector vertical-slice evidence record exists, the package's complete public export surface — every runtime value export and every type-only export declared by the package's entry point — SHALL be frozen: recorded as an explicit, versioned list referencing the exact evidence commit it depends on, and mechanically checked on every verification run. An addition, removal, or rename of any export, hand-authored or generated, SHALL fail that check unless the frozen list is updated in the same governed change. No frozen export name SHALL be a Node-runtime-specific symbol; Node-specific implementations SHALL remain exclusively in the Node platform binding package.

#### Scenario: Supported runtime imports the package
- **WHEN** a consumer running a documented Node.js and TypeScript configuration imports each public package entry point
- **THEN** the package resolves with the documented types and runtime exports and exposes no internal generated or validator subpath

#### Scenario: Unsupported contract version is configured
- **WHEN** initialization requests a schema or contract version other than `1.0.0`
- **THEN** initialization fails with a safe unsupported-version error before any event can be emitted

#### Scenario: Configuration object is mutated after initialization
- **WHEN** caller code mutates the original configuration object after successful initialization
- **THEN** SDK behavior remains bound to the validated immutable snapshot and does not adopt the mutation

#### Scenario: The frozen surface is explicit, versioned, and evidence-bound
- **WHEN** the package's public-surface freeze record is inspected
- **THEN** it names an explicit, version-controlled list of every value and type-only export and the exact commit of the vertical-slice evidence the freeze depends on

#### Scenario: An unapproved export mutation is rejected
- **WHEN** a disposable mutation adds, removes, or renames any export from the package's entry point without updating the frozen list
- **THEN** the public-surface check fails closed and names the unapproved or missing export

#### Scenario: The frozen surface contains no Node-specific symbol
- **WHEN** the frozen export list is inspected
- **THEN** no entry is a Node-runtime-specific symbol, and every Node-specific implementation is found only in the Node platform binding package
