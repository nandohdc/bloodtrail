## MODIFIED Requirements

### Requirement: Scope verification restricts platform coupling to approved Node capabilities and rejects production integration surfaces

Scope verification in `@bloodtrail/security-audit-sdk-node` SHALL inspect every code artifact under the package source root (`src/`) using an AST parser. It SHALL classify every module specifier and every free identifier referenced in value position against a declared platform coupling policy.

Verification SHALL admit only the approved Node built-in module specifiers (`node:async_hooks`, `node:buffer`, `node:crypto`, `node:timers`), first-party Core package specifiers (`@bloodtrail/security-audit-sdk-core`), relative specifiers, standard language globals, and — for `src/fetch-exchange.ts` alone, the governed fetch delivery adapter — the host globals `fetch` and `AbortSignal`. Those two host globals SHALL remain undeclared for every other artifact, and the adapter SHALL admit no built-in beyond `node:buffer`. Any unapproved Node built-in (such as `node:fs`, `node:http`, or `node:child_process`), third-party package specifier, undeclared host global (such as `process` or `window`), or dynamic evaluation primitive (`globalThis`, `eval`, `Function`) SHALL fail closed.

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

#### Scenario: The adapter's host globals are confined to the adapter
- **WHEN** any source artifact other than `src/fetch-exchange.ts` references `fetch`, or `src/fetch-exchange.ts` imports a Node built-in other than `node:buffer`
- **THEN** verification fails closed with an `undeclared-global` or `undeclared-specifier` diagnostic naming the artifact

## ADDED Requirements

### Requirement: The governed fetch delivery adapter maps native outcomes onto the handoff's closed outcome set

The package SHALL provide exactly one delivery adapter, `createFetchHttpExchange`, approved by the governed inventory recorded for #113, which supplies an `HttpExchange` over the Node runtime's `fetch`. It SHALL accept an origin of an `http` or `https` scheme, host, and optional port only, and SHALL fail construction for a path, query, fragment, userinfo, or any other scheme, and for a per-attempt deadline or response bound that is not a bounded positive integer. It SHALL send each exchange only to that origin, SHALL NOT follow a redirect, SHALL bound every exchange by its deadline, and SHALL read at most its response bound. It SHALL map a response to a `response` outcome carrying the parsed acknowledgments, a deadline to `timeout`, and a connection failure to `transport_failure`; an unparseable, empty, shapeless, or oversized body SHALL map to an acknowledgment the handoff classifies as a protocol error, never to acceptance. It SHALL add no classification of its own. Caller-supplied headers SHALL be forwarded only to the configured origin and SHALL NOT be logged or echoed. The adapter SHALL authorize no deployment or delivery infrastructure, and SHALL carry `decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner decision"`.

#### Scenario: The adapter passes the common conformance suite
- **WHEN** the common per-class delivery conformance suite runs through the adapter against an acknowledging loopback peer
- **THEN** every class binding delivers its own event in one zero-based attempt, refuses foreign and unknown events, and states its frozen-row guarantees

#### Scenario: A slow peer is a timeout, never a delivery
- **WHEN** the peer responds after the per-attempt deadline
- **THEN** the handoff classifies the attempt `retryable` with code `timeout`

#### Scenario: A malformed or oversized body is never acceptance
- **WHEN** a 2xx response body is unparseable, empty, shapeless, acknowledges another event, or exceeds the response bound
- **THEN** the handoff classifies the attempt `protocol_error`

#### Scenario: A redirect is never followed
- **WHEN** the peer answers with a redirect to another origin
- **THEN** the handoff classifies the attempt `protocol_error` and the redirect target receives nothing

#### Scenario: An unsafe origin fails construction
- **WHEN** the adapter is configured with a path, query, fragment, credentials in the URL, or a non-HTTP scheme
- **THEN** construction throws and no exchange exists
