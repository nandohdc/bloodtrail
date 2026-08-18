## ADDED Requirements

### Requirement: Packed package installs and validates with production-only dependencies

The packed SDK artifact SHALL install and function with production-only dependency installation. The generated schema validator SHALL be self-contained, embedding the AJV runtime helper and the AJV-formats validators it uses, and SHALL record the MIT attribution of the bundled AJV and ajv-formats code in its header.

#### Scenario: Production-only install imports both public exports
- **WHEN** a consumer installs the packed tarball with `--omit=dev` and imports both public entry points by package specifier
- **THEN** both entry points resolve through the declared export map with the documented exports and no `MODULE_NOT_FOUND` occurs

#### Scenario: Schema validation works from the consumer installation
- **WHEN** `validateSecurityAuditEvent` is invoked from the production-only consumer install with a valid canonical event, and separately with an event whose timestamp is semantically invalid RFC 3339
- **THEN** the valid event validates and the invalid event is rejected with a bounded diagnostic

#### Scenario: Generated validator is self-contained
- **WHEN** the generated validator artifact is inspected
- **THEN** it contains no `require(` of external modules and carries the bundled-code MIT attribution header
