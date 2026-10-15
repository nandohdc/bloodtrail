# Configured schema runtime authority — #816

## Why

Named methods currently consult a process-global runtime before the configured runtime. This both validates twice and lets unrelated process-wide overrides alter instance behavior. An instance must validate each event exactly once with its configured runtime.

## What Changes

Pass `config.schemaRuntime` at the existing named construction and named-redelivery validation seams in `events.ts`. In `sdk.ts`, deliver already-validated named events without a second validation, preserving lifecycle checks. Keep `emit()` and `redeliver()` validation unchanged. Add counting and refusing-global controls, rewrite only the four specified provider tests, re-anchor affected verification mutations, and document `ADR-SDK-017`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-core`: add `An SDK instance validates only with its configured schema runtime`; modify only `Provider containment schema non-result` in the whole copied `Injected-provider faults are contained and attributed to the provider` requirement.

## Impact

Bounded `fix(sdk-core)` for #816. No new source path, public type, signature, export or error code. Contract `2.1.0`, generated artifacts, collector, canonical specs and archives stay unchanged. Omitted runtime configuration continues to use `cjsSchemaRuntime`. `setSchemaRuntime` and `getSchemaRuntime` remain exported unchanged in Core and the Node binding. Existing check order, provider containment and outcome rules remain unchanged.

## Decided authority

Decision source: owner decision, 2026-10-15, via grilling and triage in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E

`Q1`–`Q10` are settled owner decisions, not questions to reopen. Baseline: `01999a4b5a85f95e0e5db1e4a9eeeec788dc831a`.

Issue: https://github.com/nandohdc/bloodtrail/issues/816
Triage: https://github.com/nandohdc/bloodtrail/issues/816#issuecomment-6192527486
Authoritative brief: https://github.com/nandohdc/bloodtrail/issues/816#issuecomment-6192527846

## Non-goals

No global-runtime removal or deprecation, new validation bypass API, diagnostic or ordering change, operation redesign, contract/collector change, push, PR, remote comment, merge, fold or archive. Required remote CI and maintainer actions stay pending.
