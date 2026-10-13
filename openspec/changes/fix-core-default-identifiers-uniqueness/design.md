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

### Owner decisions

Decision source: owner decision, 2026-10-13, via grilling in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E

These decisions close the earlier brief's planning gaps; runtime behavior is already correct and
is not changed by this follow-up. The earlier brief's "Approved desired behavior" predated any
owner decision, and the assessment remains technical design evidence, not authorization.

| # | Decision |
| --- | --- |
| A | Keep a secure DEFAULT identifier provider. Do not make an explicit provider mandatory. |
| B | Source is host Web Crypto `crypto.randomUUID()`, with a coupling declared for `src/providers.ts` only. Rejected alternatives: a `node:crypto` import, `crypto.getRandomValues` with hand formatting, and Math.random, time, PID or any seeded fallback. |
| C | Fail closed at construction for both the implicit default and an explicit `systemAuditIdentifiers`, with `SDK_INVALID_CONFIGURATION` / `configuration` / `/identifiers`. The check never invokes an identifier method. Custom providers stay host-independent. Rejected: failing lazily at the first ID. |
| D | Classify as `fix(sdk-core)`, non-breaking. API.md and MIGRATION.md record the host requirement and the injection alternative. |
| E | The guarantee is probabilistic collision resistance: 122 CSPRNG bits per UUID v4. Never claim absolute uniqueness. |
| G | Commit a re-runnable negative control. A prose record of a one-off disposable-copy run is not evidence. |

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
| implementation-host-uuid-generation | 2.1, 2.2, 3.1, 3.2, 6.1, 6.2, 6.4 | All seven methods delegate with correct receiver, distinct lowercase v4 samples; concurrent fresh-process sample has zero collisions; prospectively committed tests/cross-process-identifiers-negative-control.test.ts: old seeded identifier provider repeats event and operation sequences across concurrent fresh processes; vacuous-helper mutation must fail |
| implementation-default-fail-closed | 2.1, 2.2 | Public constructor rejects absent crypto, missing method and non-function method for implicit and explicit defaults, at /identifiers, without sink emission |
| implementation-custom-provider-independence | 2.1, 2.2 | Import and deterministic custom construction without host crypto; exact provider identity, zero construction calls, receiver-preserving use |
| implementation-provider-local-coupling | 2.3 | Scope inventory matches baseline; provider-local crypto positive control; crypto elsewhere and node:crypto negative controls |
| implementation-preserved-boundaries | 4.1, 4.2, 4.3, 6.1, 6.3, 6.4 | Prospective ownership and provenance, ADR/API/MIGRATION/glossary documentation, exports/dependencies/package gates, final governance and protected-path diff checks |

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
deadlines and stderr, clean up timers/listeners, and kill overdue children. Repeat three times;
the historical disposable-copy negative control demonstrated failure. That historical execution is
retained in tasks.md, but does not establish committed, re-runnable control sensitivity.

US-004 runs the root product loop through the supplied tamandua-test command, full Core validation,
final governance, strict OpenSpec validation, and empty-index Git whitespace/path checks. Record
only actually executed results in tasks.md; runtime evidence is pending until later stories finish.

### Owner-decision follow-up verification (group 6)

Task 6.1 commits this planning-only amendment before newly owned files are touched. Existing
cross-process AST controls remain targeted at the inherited test until task 6.2 moves the helpers.
No future implementation file is required to exist by the planning regression.

Task 6.2 moves `runConcurrentChild`, `buildIdentifierSamplingScript`, `parseChildRecord`,
`validateIdentifierSamples` and `parseAndValidateChildResult` into top-level
`tests/cross-process-harness.ts`, preserving deadlines, bounded streams, child reaping and cleanup.
An optional provider-source parameter inlines a custom `identifiers` provider; omitting it leaves
Core defaults selected. Extract one pure exported `findRepeatedIdentifiers(results)` over the full
event/operation union, including repeats within a child. The positive test requires `[]` while
retaining distinct PIDs and sample counts.

Commit `tests/cross-process-identifiers-negative-control.test.ts` with stable test name
"old seeded identifier provider repeats event and operation sequences across concurrent fresh processes".
It uses the SAME harness and collision finder, injecting a test-only old-provider replica with
module-level seed `0x9e3779b9`, Mulberry32 step and
`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx` nibble formatting. At least two concurrent fresh children
must return identical complete sequences, valid frozen-contract event.id values and a non-empty
collision list after successful exit/PID/count/format validation. The replica stays only in tests;
production source never receives a seeded generator or fallback. Keep tests at the top level for
shell discovery, and helpers small (complexity at most 9, at most 70 lines, no bumpy road).

Task 6.3 documents the host/injection migration and three identifier glossary terms, adds ADR
provenance and rejected alternatives, and confirms the API's existing four guarantees. Task 6.4
executes all supplied gates and temporarily makes only the shared collision finder return `[]`.
The negative control must FAIL specifically at its non-empty collision assertion, not at compile
or child validation. Restore exact source bytes in cleanup, recompile and rerun both suites; never
commit the mutation. Record actual mutation/restoration and gate outcomes in Executed Evidence.
Tasks 6.2–6.4 and committed sensitivity evidence are prospective in this planning amendment;
historical disposable evidence is not a substitute.

### Risks and re-evaluation triggers

Hosts lacking Web Crypto UUID support must inject a provider; this intentional fail-closed change
is documented, not hidden behind fallback entropy. Revisit if supported hosts need a new cryptographic
capability, identifier formats change, custom providers become host-dependent, or public exports
need expansion. Any such scope change needs renewed assessment before implementation.
