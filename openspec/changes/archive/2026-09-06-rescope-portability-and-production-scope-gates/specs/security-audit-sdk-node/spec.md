## ADDED Requirements

### Requirement: Scope verification restricts platform coupling to approved Node capabilities and rejects production integration surfaces

Scope verification in `@bloodtrail/security-audit-sdk-node` SHALL inspect every code artifact under the package source root (`src/`) using an AST parser. It SHALL classify every module specifier and every free identifier referenced in value position against a declared platform coupling policy.

Verification SHALL admit only the approved Node built-in module specifiers (`node:async_hooks`, `node:buffer`, `node:crypto`, `node:timers`), first-party Core package specifiers (`@bloodtrail/security-audit-sdk-core`), relative specifiers, and standard language globals. Any unapproved Node built-in (such as `node:fs`, `node:http`, or `node:child_process`), third-party package specifier, undeclared host global (such as `process` or `window`), or dynamic evaluation primitive (`globalThis`, `eval`, `Function`) SHALL fail closed.

Verification SHALL also reject forbidden production integration filenames (including `transport`, `collector`, `browser`, `adapter`, `telemetry`, `queue`, `outbox`, `storage`, `siem`), third-party runtime dependencies in `package.json`, and forbidden exports. Diagnostics SHALL name the artifact and violation code, bounded in length, and verification SHALL fail closed if any artifact or directory cannot be read, or if the source inventory is empty.

#### Scenario: Approved Node capabilities pass and are reported
- **WHEN** scope verification runs against the `@bloodtrail/security-audit-sdk-node` source root as authored
- **THEN** verification passes, reporting the inspected artifacts, classified references, and zero undeclared couplings

#### Scenario: Unapproved Node built-in is rejected
- **WHEN** a source artifact references an unapproved Node built-in specifier such as `node:fs` or `node:http`
- **THEN** verification fails closed with an `undeclared-specifier` diagnostic naming the artifact and specifier

#### Scenario: Undeclared host global is rejected
- **WHEN** a source artifact references an undeclared host global identifier such as `process` or `window`
- **THEN** verification fails closed with an `undeclared-global` diagnostic naming the artifact and identifier

#### Scenario: Dynamic global evasion is rejected
- **WHEN** a source artifact references `globalThis`, `eval`, or `Function`
- **THEN** verification fails closed with an `undeclared-global` diagnostic

#### Scenario: Forbidden production integration filename is rejected
- **WHEN** an artifact whose filename contains a forbidden integration term (such as `transport.ts` or `collector.ts`) is present under `src/`
- **THEN** verification fails closed with a `forbidden production integration filename` diagnostic

#### Scenario: Forbidden export in package manifest is rejected
- **WHEN** `package.json` declares an export containing a forbidden term such as `transport` or `collector`
- **THEN** verification fails closed with a forbidden export diagnostic

#### Scenario: Third-party runtime dependency is rejected
- **WHEN** `package.json` declares a runtime dependency not matching `@bloodtrail/*`
- **THEN** verification fails closed with an invalid dependency diagnostic

#### Scenario: Unreadable artifact or empty inventory fails closed
- **WHEN** an artifact cannot be read, contains unparseable syntax, or the source inventory is empty
- **THEN** verification fails closed rather than reporting success

#### Scenario: Cross-package transport or browser code placement is rejected
- **WHEN** transport, collector, or browser implementation files are moved into `src/`
- **THEN** verification fails closed, detecting either a forbidden filename or undeclared platform specifier/global
