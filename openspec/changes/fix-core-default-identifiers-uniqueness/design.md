## Context

Issue [#796](https://github.com/nandohdc/bloodtrail/issues/796) identifies a fixed
`0x9e3779b9` seed and Mulberry32 generator in Core's `src/providers.ts`. Every fresh process
repeats the same default IDs. Bounded per-instance reuse checks cannot detect IDs minted elsewhere.
The public `AuditIdentifierProvider` SPI and frozen `systemAuditIdentifiers` object already supply
the necessary seam; no abstraction or export addition is needed.

## Design Pattern Assessment

`assessment.json` is the author-written, schema 1.1 machine-readable assessment. It selects
`direct_implementation`, contains no catalog binding or selected pattern IDs, and declares a full,
security-sensitive modification of `security-audit-sdk-core`. Applicable triggers are security
behavior, concurrency, and a canonical capability requirement. Assessment baseline is
`5d931ad695fb10db3fe51e6b151352447e21d822`; planning must be committed before implementation.
The assessment is technical design evidence, not owner authorization or signed review.

### Architectural forces

1. Default identifiers must resist collisions and prediction across independent process starts;
   per-instance bounded reuse detection cannot prevent cross-process duplicates.
2. Hosts without cryptographic UUID generation must fail before readiness when using system
   defaults, rather than silently weakening audit integrity.
3. Core must remain portable with zero Node built-in imports, zero third-party runtime dependencies,
   and unchanged public exports; custom providers must need no host crypto.
4. Caller-owned providers must retain identity and receiver behavior without construction-time
   invocation or mutation.
5. Static coupling declarations must permit host crypto only in src/providers.ts and continue
   rejecting other globals and host module imports.

### Candidates and decision

- **approach-direct-host-uuid (selected):** lazily call host `crypto.randomUUID()` in the existing
  default provider, with construction-time capability validation only on the system-default path.
  This fixes #796 without changing the SPI or adding platform-specific modules.
- **approach-node-crypto-import (rejected):** Node's `node:crypto` supplies cryptographic UUIDs but
  violates the zero host built-in import and non-Node portability force. A portable host capability
  plus custom injection answers that force without a Node dependency in Core.
- **approach-mandatory-custom-injection (rejected):** remove defaults and require applications to
  inject randomness. This preserves host independence but shifts the default-safety obligation to
  each application and changes ordinary initialization despite an existing usable portable UUID API.

### Simplicity and implementation

Delete the seed, nibble generator, and UUID template. All seven methods (`eventId`, `operationId`,
`correlationId`, `causationId`, `requestId`, `messageId`, `transactionId`) call host
`crypto.randomUUID()` lazily, retaining its receiver. Keep the provider frozen. Do not probe or
capture crypto at module evaluation, so import remains possible without crypto.

In `resolveProviders`, only `input.identifiers === undefined` or exact identity with
`systemAuditIdentifiers` requires a present crypto object and callable `randomUUID`. Missing crypto,
missing method, and non-function method all throw
`SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/identifiers")` before
readiness or sink use. A custom provider is validated structurally without reading host crypto or
calling its methods; its object identity and method receiver remain unchanged. Host removal after
construction is not healed with a fallback; no insecure source is ever used.

Use bare host `crypto` behind a providers-only coupling role. Do not add it to `LANGUAGE_GLOBALS`
or the general authored role, import `node:crypto`, or broaden `globalThis` access. Update role
selection, inventory initialization/reporting and `BASELINE_INVENTORY` from actual gate output.
Document this explicit host boundary in the spec delta, API, and ADR-SDK-013. Advance both the
coherence ADR inventory count and the consecutive sequence from 001..012 to 001..013.

### Implementation-specific invariants

These do not claim catalog conformance; the same IDs and task/evidence mappings appear in the JSON.

| Invariant | Tasks | Concrete evidence |
| --- | --- | --- |
| implementation-host-uuid-generation | 2.1, 2.2, 3.1, 3.2 | All seven methods delegate with correct receiver, distinct lowercase v4 samples; concurrent fresh-process sample has zero collisions; old-seed negative control fails |
| implementation-default-fail-closed | 2.1, 2.2 | Public constructor rejects absent crypto, missing method and non-function method for implicit and explicit defaults, at /identifiers, without sink emission |
| implementation-custom-provider-independence | 2.1, 2.2 | Import and deterministic custom construction without host crypto; exact provider identity, zero construction calls, receiver-preserving use |
| implementation-provider-local-coupling | 2.3 | Scope inventory matches baseline; provider-local crypto positive control; crypto elsewhere and node:crypto negative controls |
| implementation-preserved-boundaries | 4.1, 4.2, 4.3 | ADR/API coherence, exports/dependencies/package gates, final governance and protected-path diff checks |

### Security and correctness implications

This is security-sensitive: **cryptography** replaces predictable entropy; **audit_integrity** protects
occurrence identity; **fail_posture** rejects unavailable randomness; **concurrency** covers distinct
producers; **lifecycle** introduces a capability requirement at construction. The **trust_boundary**
is the host Web Crypto implementation, not a new authority registry. Applications and hosts remain
trusted to supply their declared providers; callable validation is not attestation of a compromised
host. Errors carry only the fixed code, category and path, not caller data (**error_disclosure**).
Bounded histories and **resource_retention**, retry/redelivery, privacy, confidentiality,
authentication/authorization, mutation ownership, authority provenance and external integrations
remain unchanged. No new security claim is made in those unchanged dimensions.

UUID v4 is collision-resistant, not mathematically unique. Finite regression samples are evidence
against sequence reuse, not proof over all future processes. Existing format, causality, and bounded
reuse checks remain in place for both default and injected providers.

### Constraints and non-goals

Own only the exact paths in `assessment.json`. Preserve governance_core instructions and policy,
frozen contracts, generated source, public exports, provider interfaces, Node binding behavior,
collector behavior, version pins, and dependency manifests. Do not introduce a fallback PRNG,
Math.random, counters, a global ID registry, network allocation, contract folding, signed review,
publication, production integration, or deployment authority.

### Verification strategy

US-001's planning-only `assessment.test.mjs` asserts full classification, exact baseline, owned
paths, task/evidence references and spec scenario coverage, with negative controls on those
relations. Run assessment governance and strict OpenSpec validation before committing the plan.

US-002 adds `tests/cross-process-identifiers.test.ts`: method-level UUID/receiver controls and an
isolated public construction matrix for implicit and explicit defaults under absent crypto, missing
method and non-function method. Prove deterministic custom injection with no host crypto. Extend
coupling mutations to reject crypto outside providers and any Node crypto import while accepting
the narrow exception. Restore global descriptors or isolate manipulation in child processes.

US-003 concurrently launches at least four fresh `process.execPath` Node children, each initializing
Core without custom identifiers and collecting at least 128 event and 128 operation IDs. Assert
normal exit, exact counts, v4 version/variant and zero duplicates over the full union. Bound child
deadlines and stderr, clean up timers/listeners, and kill overdue children. Repeat three times and
restore the seeded implementation only in a disposable-copy negative control to demonstrate failure.

US-004 runs the root product loop through the supplied tamandua-test command, full Core validation,
final governance, strict OpenSpec validation, and empty-index Git whitespace/path checks. Record
only actually executed results in tasks.md; runtime evidence is pending until later stories finish.

### Risks and re-evaluation triggers

Hosts lacking Web Crypto UUID support must inject a provider; this intentional fail-closed change
is documented, not hidden behind fallback entropy. Revisit if supported hosts need a new cryptographic
capability, identifier formats change, custom providers become host-dependent, or public exports
need expansion. Any such scope change needs renewed assessment before implementation.
