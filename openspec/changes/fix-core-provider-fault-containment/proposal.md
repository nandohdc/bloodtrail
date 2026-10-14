# Provider-fault containment — #811

## Why

Injected-provider exceptions currently escape result boundaries, disclose the provider's own error, are misclassified as caller input, or wedge shutdown in `shutting_down`. Consumers need bounded, provider-attributed results at every result-returning site.

## What changes

Contain identifiers, clock, context provider, schema runtime and timers at their invocation seams. Reuse existing codes, sanitize runtime failures, and guarantee terminal shutdown. Add an explicit site matrix and ADR-SDK-015 refining ADR-SDK-005. This is a non-breaking `fix(sdk-core)` correction; types and exports remain unchanged.

## Impact

Capability: `security-audit-sdk-core`. Severity: `severity:medium`. Runtime changes are limited to sdk.ts, events.ts, operations.ts and validation/schema.ts. The Node binding receives diagnostic documentation only. Contract `2.1.0`, generated artifacts and founding requirements remain unchanged. Consumers matching `SDK_INVALID_INPUT` for provider faults must instead match the provider's bounded diagnostic.

## Owner decisions

Decision source: owner decision, 2026-10-13, via grilling and triage in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E

| Decision | Disposition |
|---|---|
| Q1 | Cover beginOperation, every named method, emit, redeliver, shutdown and the free validateSecurityAuditEvent; not runWithContext or currentAuditContext. |
| Q2 | Reuse existing provider-specific codes for throws and bad returns; never expose the provider's error object or message. |
| Q3 | Provider faults cease being SDK_INVALID_INPUT at /; caller faults retain it. Non-breaking fix with MIGRATION entry. |
| Q4 | An unarmed shutdown timer fails closed immediately to shut_down, without waiting, flushing or sink shutdown. |
| Q5 | A clearTimeout fault cannot escape; shut_down is terminal. Report /timers only if no earlier sink failure or shutdown timeout exists. |
| Q6 | Add ADR-SDK-015, “An injected-provider failure is contained and attributed to its provider”, refining unchanged ADR-SDK-005. |
| Q7 | Use the exact Injected provider and Provider fault vocabulary below. |
| Q8 | Contain schema non-results and null/undefined timer handles in this change. |
| Q9 | Rebuild well-formed schema failures with failure(), bounded string-only path and no extra fields. |
| Q10 | Explicit site-matrix regression with spies and exact count; no committed mutant. Independent old-code sensitivity belongs to the orchestrator. |
| Q11 | An unref fault does not prevent bounded shutdown work; report with Q5 precedence. |
| Q12 | severity:medium. |

- **Injected provider:** a host capability fixed at construction. These are identifiers (`AuditIdentifierProvider`), clock (`AuditClock`), context provider (`ContextProvider`), schema runtime (`AuditSchemaRuntime`) and timers (`AuditTimerProvider` with `AuditTimerHandle`). The sink and the transformation hooks keep their own existing failure contracts.
- **Provider fault:** an injected provider that throws or returns an unusable value. It is attributed to the provider, never to the caller's input, and the provider's own error never crosses the public boundary.

## Review follow-up

Follow-up decision source: owner decision, 2026-10-14, via code-review follow-up in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E

| Decision | Disposition |
|---|---|
| R-Q9 | Rebuild only CONTRACT_ERROR_CODES, SDK_SCHEMA_VALIDATION_FAILED or SDK_MISSING_EVENT_FIELD with validation/privacy categories; all other diagnostics become SDK_INVALID_CONFIGURATION/configuration at /schemaRuntime. Keep bounded string-only paths and drop extras. |
| R-T | Extend the explicit matrix to 33 rows and sanitizer table to eight rows; add throwing-unref timeout/sink precedence controls and preserve existing controls. |
| R-C | Clarify unref outcome and terminal state assignments, add local context diagnostic helper and restore the F11 rationale; no new internal export. |
| R-D | Polish documentation and glossary formatting, restate the result table as SHALL rules and cite gates by name without local paths. |

G1 restores four F07 anchors and proves the unchanged mutants are killed; it repairs a required gate under the original anchor rule and is not an owner decision. Full `test:verification` and `make governance-gates` are required this time. Append five planning/runtime/tests/docs/evidence commits without rewriting the existing fix. No additional approval is claimed.

## Non-goals

#816 and runtime selection by named methods; runWithContext(), currentAuditContext(), createAuditContextFrame(); malformed ContextProvider.get frames already represented as results; unused causationId/requestId/messageId methods and byte length provider; wrongly accepting invalid schema runtimes; Node's own providers; existing sink and transformation-hook containment; new codes, public types/exports, generated artifacts, generator or frozen contract changes. No push, PR, approval, merge, fold, archive, release or production authorization is part of implementation.

Issue: https://github.com/nandohdc/bloodtrail/issues/811
Triage: https://github.com/nandohdc/bloodtrail/issues/811#issuecomment-6158614932
Authoritative brief: https://github.com/nandohdc/bloodtrail/issues/811#issuecomment-6158615189
