## ADDED Requirements

### Requirement: Contract-version support is exact-one per SDK package version

Each SDK package version SHALL support exactly one canonical Security Audit Event Contract version across one indivisible compatibility surface: the compatibility manifest, generated public types, generated validator projection, construction-time contract-version check, and event-validation semantics. Several SDK package versions MAY support the same canonical contract version, but one SDK package version SHALL NOT support several canonical contract versions.

A producer SDK instance SHALL be constructible only for the contract version supported by its package version. Unsupported versions SHALL fail closed before readiness; the SDK SHALL NOT negotiate, coerce, downgrade, fall back, or apply a best-effort interpretation.

Replacing the package's sole supported contract baseline SHALL be classified as SDK compatibility-major even when the canonical contract change is additive and contract-minor. While the package is in private, unpublished `0.x` initial development, any separately authorized release SHALL express that classification through the project's `0.x` versioning policy; this requirement does not itself authorize a release or version change.

A separately authorized collector MAY support an explicitly enumerated finite set of canonical contract versions for migration. Collector support SHALL NOT broaden producer package support or producer SDK instance binding, and this migration allowance SHALL NOT create or authorize a collector, transport, production integration, or real-user processing.

#### Scenario: Package compatibility surface has one contract owner
- **WHEN** an SDK package version declares its canonical contract compatibility
- **THEN** the manifest, generated public types, generated validator projection, construction-time version check, and event-validation semantics are all bound to exactly one canonical contract version

#### Scenario: Several package versions retain the same contract baseline
- **WHEN** multiple SDK package versions preserve the same canonical contract interpretation
- **THEN** each package version may point to that same contract version without permitting any one package version to point to multiple contract versions

#### Scenario: Supported version is bound at construction
- **WHEN** configuration requests the canonical contract version supported by the SDK package version
- **THEN** the producer SDK instance may become ready bound to that exact version without version negotiation or later switching

#### Scenario: Unsupported version fails before readiness
- **WHEN** configuration requests any contract version other than the one supported by the SDK package version
- **THEN** construction fails with a safe unsupported-version error before readiness and no fallback or best-effort interpretation occurs

#### Scenario: Additive contract minor replaces the support baseline
- **WHEN** a future SDK adaptation replaces its sole supported contract version with an additive contract-minor version
- **THEN** the SDK change is classified as compatibility-major without changing the contract change's contract-minor classification or authorizing a package release

#### Scenario: Collector migration support remains separate
- **WHEN** a separately authorized collector is designed to bridge a migration between explicitly enumerated contract versions
- **THEN** its finite support set does not broaden any producer package's exact-one support or any producer instance's exact-version binding

#### Scenario: No collector authorization exists
- **WHEN** no separate collector authorization has been granted
- **THEN** the exact-one producer policy creates no collector, transport, storage, production integration, or real-user processing authority
