# ADR-SDK-015: An injected-provider failure is contained and attributed to its provider

- Status: Accepted for SDK-core implementation
- Date: 2026-10-13
- Issue: https://github.com/nandohdc/bloodtrail/issues/811
- Owning change: `openspec/changes/fix-core-provider-fault-containment/`
- Decision source: owner decision, 2026-10-13, via grilling and triage in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E

## Context

Host capabilities are fixed at construction but may fail later. Previously identifier and schema exceptions escaped result boundaries, named methods blamed caller input, raw schema failures leaked arbitrary fields, and timer faults could leave shutdown stuck in `shutting_down`. Construction validation alone cannot guarantee runtime containment.

## Decision

This decision refines ADR-SDK-005; ADR-SDK-005 remains unchanged. Contain identifiers, clock, context provider, schema runtime and timers where invoked, without inspecting or forwarding a caught value. Cover beginOperation, every named method, emit, redeliver, shutdown and the free validateSecurityAuditEvent. A provider fault is never SDK_INVALID_INPUT and never reaches the sink. Caller-input faults retain SDK_INVALID_INPUT; invalid construction retains SecurityAuditSdkError.

Reuse existing codes: SDK_INVALID_IDENTIFIER / validation at the exact operation, event or correlation identifier path; SDK_INVALID_CLOCK / configuration at /clock; SDK_INVALID_CONFIGURATION / configuration at /contextProvider, /schemaRuntime or /timers. Supplied IDs bypass generation and the first faulting operation-ID call wins. Preserve lifecycle-first and same-instance operation authority checks.

Schema results must explicitly succeed or provide a known generated SDK/contract code and one of configuration, validation, authority, privacy, lifecycle or sink. Rebuild failures with failure(code, category, path), passing only a string path so it is bounded, and dropping all extra fields. Contain non-results and inspection errors. Default diagnostics and runtime selection remain unchanged.

If setTimeout throws or returns null/undefined, fail closed immediately to shut_down with /timers, without waiting or sink lifecycle calls. All other handles, including numbers, remain valid; absent/non-callable unref degrades gracefully. A throwing unref continues bounded work. A throwing unref or clearTimeout reports /timers only on otherwise successful work; an earlier SDK_SHUTDOWN_TIMEOUT or SDK_SINK_FAILURE wins. Every outcome reaches shut_down, later shutdown returns SDK_SHUT_DOWN, concurrent shutdown is single-flight and sink flush/shutdown stay at-most-once.

## Alternatives

- New SDK_PROVIDER_FAILURE: expands the surface unnecessarily.
- SDK_INVALID_CONFIGURATION for every fault: loses identifier/clock attribution.
- Keep SDK_INVALID_INPUT: falsely blames caller input.
- Drain without a timer or remain ready: loses the deadline or admits new work after shutdown request.
- Ignore unref/clearTimeout faults: conceals failure of the fixed host capability.
- Pass schema failures through: leaks unknown codes, categories, unbounded paths and extra fields.
- Split bad returns or sanitization into other issues: leaves this same boundary unprotected.

## Consequences and verification

Consumers previously matching SDK_INVALID_INPUT for provider faults must match the provider's code instead. Types, exports and error sets are unchanged; this is a non-breaking correctness correction with migration guidance, severity:medium.

The explicit top-level site matrix proves invocation, exact diagnostics, no throw/rejection/leak and no sink handoff for each fault. Separate controls cover terminal shutdown, earlier-failure precedence, sanitizer bounds/default diagnostics, caller faults, healthy use, provider bypass, lifecycle order and redelivery. Existing F08/F10/F11 mutation suites retain byte-identical anchors. Build/typecheck, runtime gates, strict OpenSpec, coherence, path ownership, Git checks and CodeScene delta provide independent verification surfaces. Old-code sensitivity is subject to the orchestrator, not a committed mutant or approval claim.

Passing tests and AI review are not approval, release, production authorization, merge, fold or archive.

## Boundary

Frozen contract 2.1.0, generator/generated artifacts, public types/exports, Node providers, collector, existing sink/hook contracts and unused identifier/byte-length providers are unchanged. Runtime selection (#816), runWithContext/currentAuditContext/createAuditContextFrame, malformed context frames already represented as results and wrongly accepting schema runtimes remain out of scope.
