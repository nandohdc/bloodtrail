# ADR-SDK-013: Cryptographic collision resistance for default identifiers

- Status: Accepted for SDK-core implementation
- Date: 2026-10-13
- Issue: https://github.com/nandohdc/bloodtrail/issues/796
- Owning change: `openspec/changes/fix-core-default-identifiers-uniqueness/`
- Decision source: owner decision, 2026-10-13, via grilling in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E

## Context

Core's fixed seed `0x9e3779b9` and Mulberry32 generator restarted the same identifier sequence in every fresh process. Distinct producers could therefore submit conflicting event IDs to the collector, receive `DUPLICATE_CONFLICT`, and lose delivery through `SDK_SINK_REJECTED`. Bounded per-instance reuse detection cannot detect collisions with another process or a previous lifetime.

## Decision

The frozen `systemAuditIdentifiers` provider delegates all seven methods (`eventId`, `operationId`, `correlationId`, `causationId`, `requestId`, `messageId`, and `transactionId`) to host Web Crypto `crypto.randomUUID()`. Each call resolves the host lazily and preserves its receiver, producing an unpredictable, collision-resistant lowercase RFC 4122 UUID v4. Neither module import nor provider construction generates identifiers.

`resolveProviders()` validates that host `crypto.randomUUID` exists and is callable when identifiers are omitted or exactly `systemAuditIdentifiers` is explicitly selected. If unavailable, construction fails closed before readiness or sink emission with `SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/identifiers")`. Browser hosts may require a secure context for this capability. Hosts must retain the capability for subsequent default generation.

Custom injected `AuditIdentifierProvider` objects retain dependency inversion: initialization does not probe host crypto or invoke their methods, retains their exact identity, and later preserves their receiver. Deterministic providers remain supported without host cryptography; callers still own their identifier quality and mutable-state coordination.

The host global exception is confined to `src/providers.ts` in the platform-coupling policy. No Node built-in crypto import or third-party dependency is introduced; runtime dependencies remain zero. Existing public exports and the frozen event contract are unchanged.

## Alternatives

- Retaining the static PRNG or replacing it with `Math.random` was rejected: neither provides cryptographic unpredictability or defensible cross-process collision resistance. Insecure fallbacks are forbidden; missing host capability must fail closed.
- Importing `node:crypto` was rejected: it would couple portable Core to a Node-only runtime rather than the host Web Crypto boundary, violating the portable-core host import policy.
- Requiring custom injection for every consumer (mandatory injection) was rejected: it transfers the default-safety obligation to each application even when safe host UUID generation is available, an unnecessary consumer burden despite the secure default.
- Using `crypto.getRandomValues` with hand formatting was rejected: it adds an unnecessary custom UUID implementation when `crypto.randomUUID` exists.
- Failing lazily at the first ID was rejected: it is too late versus construction fail-closed, allowing an unusable default to reach readiness.

## Consequences and verification

UUID v4 collision resistance is probabilistic, with 122 CSPRNG bits per UUID v4, not an absolute lifetime-global uniqueness guarantee. The existing insertion-order FIFO event/operation histories continue detecting reuse only within their configured per-instance windows; they are not cross-process coordination or durable deduplication.

`tests/cross-process-identifiers.test.ts` verifies all seven UUID methods, host receiver/lazy invocation, fail-closed implicit and explicit defaults, custom-provider independence, and zero collisions over concurrent fresh-process samples. The committed `tests/cross-process-identifiers-negative-control.test.ts` test, `old seeded identifier provider repeats event and operation sequences across concurrent fresh processes`, injects a test-only old-seed replica as a custom provider. It uses the same `tests/cross-process-harness.ts` child harness and `findRepeatedIdentifiers(results)` collision finder as the positive test, validates the frozen event.id pattern and identical fresh-process sequences, and requires detected collisions. The sensitivity strategy temporarily makes that shared finder return `[]`: the negative control must fail at its non-empty collision assertion, then exact source bytes must be restored and both suites rerun; never commit the mutation. Historical disposable-copy results alone do not prove this committed control's sensitivity. Platform-coupling mutations prove that crypto elsewhere and Node crypto imports remain forbidden. Coherence requires exactly ADR-SDK-001 through ADR-SDK-013, and API documentation explains the host requirement and bounded guarantees.

## Boundary

This decision changes only Core's default identifier capability and its construction check. It does not authorize package publication, production deployment, collector changes, frozen-contract edits, canonical spec folding, or governance authorization changes.
