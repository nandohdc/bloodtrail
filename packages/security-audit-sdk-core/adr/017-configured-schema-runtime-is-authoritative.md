# ADR-SDK-017: An SDK instance validates only with its configured schema runtime

- Status: Accepted for SDK-core implementation
- Date: 2026-10-15
- Issue: https://github.com/nandohdc/bloodtrail/issues/816
- Owning change: `openspec/changes/archive/2026-10-15-fix-core-configured-schema-runtime/`
- Decision source: owner decision, 2026-10-15, via grilling and triage in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E

## Context

Named construction and named redelivery consulted the global schema runtime, then delivery validated again with the configured runtime. This violated instance authority and exactly-once validation: an unrelated process-wide override could refuse named methods while `emit()` on the same instance succeeded.

## Decision

This decision refines `ADR-SDK-003` and `ADR-SDK-011`; both remain unchanged. A configured schema runtime is the `AuditSchemaRuntime` fixed at SDK construction. Omitted `schemaRuntime` selects `cjsSchemaRuntime`, not the active global runtime. Every instance event validates exactly once using only that configured runtime.

| Entry point | Global runtime calls | Configured runtime calls |
|---|---|---|
| Named execution | `0` | `1` |
| Named redelivery via `input.redelivery` | `0` | `1` |
| `emit(event)` | `0` | `1` |
| `redeliver(event)` | `0` | `1` |
| Free `validateSecurityAuditEvent(event)` | `1` | `0` |
| Free `validateSecurityAuditEvent(event, runtime)` | `0` | `1` to the passed runtime |

Pass `config.schemaRuntime` at existing named construction validation seams in `events.ts`. Private named delivery in `sdk.ts` retains its lifecycle check but does not revalidate. Complete-event delivery retains its configured validation. No public bypass, new source path, additional state or export is introduced.

`setSchemaRuntime` and `getSchemaRuntime` retain their signatures and exports in Core and the Node binding. They affect/read only the free validator's process-global default. A refusing global runtime cannot affect an instance, including one omitting runtime configuration. Explicit-runtime free validation remains independent.

## Alternatives

- Temporarily swap the global runtime: leaks instance authority to concurrent instances and free validation even with restoration.
- Validate twice with the configured runtime: still violates exactly-once validation and may change stateful-runtime results or add a second provider fault.
- Remove or deprecate global setters: unnecessary public-surface change outside the settled correction.

## Consequences and verification

Consumers relying on a global override for named instance validation must configure the instance explicitly. All codes, categories, paths, check order, #811's provider containment/sanitized verdicts and #812's outcome rules remain unchanged. Configured faults retain `SDK_INVALID_CONFIGURATION` / `configuration` / `/schemaRuntime` with no sink call. Operation authority, reservations/settlement, redelivery identity and provider bypass remain unchanged.

The six-entry counting matrix, refusing-global same-instance control and omitted-runtime control prove selection. Four global-dependent provider cases become isolation controls, preserving the 33-row matrix and configured containment. Re-anchor `M-F11-F` and `M-F11-G` without changing the defects they inject; the complete `test:verification` suite must still kill every mutant. Build/typecheck, runtime/type/example/kit regressions, strict OpenSpec, coherence, ownership, final governance and CodeScene delta provide additional checks.

## Boundary

No public type, signature, export, error-code, contract `2.1.0`, generated artifact, collector or validator-packaging change. Exactly-once validation is not exactly-once delivery or durability. Local verification and AI review are not remote CI, maintainer approval, release, production authorization, merge, fold or archive.
