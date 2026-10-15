# Design — provider-fault containment

Decision source: owner decision, 2026-10-13, via grilling and triage in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E

## Context and placement

Q1 covers every result boundary, not contextual APIs that return other values. The four existing source modules are the entire implementation surface. Contain provider calls without inspecting a caught value. Keep lifecycle and operation authority checks before providers; the named caller-input catch-all must never see a provider fault.

Identifiers are read individually with their exact operation/correlation paths and first-fault ordering. Caller-supplied values short-circuit provider calls. The event allocation statement remains byte-identical for F11; separate timestamp resolution from narrowly caught event allocation so throwing caller getters remain caller faults. The clock call, Date inspection and serialization are contained inside nowIso. ContextProvider.get is contained after operation authority resolution.

validateSchemaStructure is the shared seam for configured and global runtimes, including the free validator. Inspect the runtime result within containment. Only explicit ok:true or a well-formed failure is accepted. Do not change the global runtime selection at either named site (#816).

## Decisions and rejected alternatives

- Q2: reuse provider-specific existing codes. Reject a new SDK_PROVIDER_FAILURE code (unnecessary surface change) and SDK_INVALID_CONFIGURATION for every fault (loses identifier/clock attribution).
- Q3: caller faults retain SDK_INVALID_INPUT; reject keeping that code for providers because it misattributes responsibility. Document a non-breaking correction with unchanged types.
- Q4: timeout arming throws/null/undefined fail closed immediately to shut_down. Reject unbounded draining (no deadline) and staying ready (accepts work after shutdown request).
- Q5 and Q11: track post-arm unref faults, perform bounded shutdown, contain cancellation and preserve earlier SDK_SHUTDOWN_TIMEOUT/SDK_SINK_FAILURE. Reject ignoring unref/clearTimeout faults (conceals unusable host capability). Keep single-flight and at-most-once sink lifecycle methods.
- Q6: ADR-SDK-015 refines ADR-SDK-005 without rewriting historical decisions.
- Q7: use the exact glossary terms in proposal and CONTEXT; no implementation detail in the glossary.
- Q8 and Q9: contain unusable returns and sanitize failures in this change. Reject splitting bad returns or sanitization into other issues, which leaves the same boundary open. Reject pass-through failures, which permit arbitrary fields, unknown codes and unbounded disclosure.
- Q10: one module-scope site matrix, spies, exact count, no committed mutant. Independent sensitivity is not an author approval claim.
- Q12: severity:medium; no change to release authority.

## Review follow-up

Follow-up decision source: owner decision, 2026-10-14, via code-review follow-up in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E

- R-Q9: supersede the broad Q9 code/category description below with verdict-only failures: `CONTRACT_ERROR_CODES`, `SDK_SCHEMA_VALIDATION_FAILED` or `SDK_MISSING_EVENT_FIELD`, AND `validation` or `privacy`. Rebuild through `failure(code, category, path)` with only a bounded string path and no extras; all other diagnostics return `SDK_INVALID_CONFIGURATION` / `configuration` / `/schemaRuntime`. Type-check allowed literals and guard categories; default-runtime implementation and selection stay unchanged.
- R-T: 33 unique fault rows, eight sanitizer rows and two throwing-unref precedence controls; preserve every existing control and exact-count assertions.
- R-C: explicit unref outcome naming, one terminal assignment per path, local context diagnostic helper and the verbatim F11 scope rationale; no shared identifier helper or new export.
- R-D: align ADR/API/migration/catalog and glossary formatting, restate provider-result SHALL rules and cite gates without machine-local paths.
- G1 is a required-gate repair under the original byte-identical-anchor rule, not an owner decision. Restore all four F07 anchors; `timeout.cancel()` is the entire `finally` body after terminal state, records its outcome and exposes it after cleanup. Count F07/F08/F10/F11 anchors and run the complete unchanged 301-test verification suite before the runtime commit. Nullish arming fails closed; earlier sink/timeout errors still win.

Append exactly five commits in planning/runtime/tests/docs/evidence order. Run all eight supplied gates including `make governance-gates` and CodeScene CLI 1.0.53 delta, the same gate CI's `codescene delta` job runs, before evidence closure. Original observations remain historical and do not claim the previously omitted full governance chain.

## Required results

| Site | code / category / path |
|---|---|
| beginOperation operationId, transactionId, correlationId throws | SDK_INVALID_IDENTIFIER / validation / /operation/operation_id, /operation/transaction_id, /operation/correlation_id respectively; first fault wins |
| named eventId throws | SDK_INVALID_IDENTIFIER / validation / /event/id |
| named operationId or correlationId throws | SDK_INVALID_IDENTIFIER / validation / /correlation/operation_id or /correlation/correlation_id |
| now throws or returns invalid Date | SDK_INVALID_CLOCK / configuration / /clock |
| ContextProvider.get throws | SDK_INVALID_CONFIGURATION / configuration / /contextProvider |
| schema runtime throws or returns a non-result | SDK_INVALID_CONFIGURATION / configuration / /schemaRuntime |
| setTimeout throws/null/undefined, unref or clearTimeout throws | SDK_INVALID_CONFIGURATION / configuration / /timers, with Q4/Q5/Q11 rules |

Any non-nullish timer handle is accepted, including numbers. Missing/non-callable unref degrades gracefully. An armed timer continues bounding shutdown even when unref faults. All outcomes end in shut_down; repeated shutdown returns SDK_SHUT_DOWN. Arming failure neither drains nor flushes nor shuts down the sink. Cancellation faults override only success, not timeout or sink failure.

A well-formed schema failure has ok:false, an error.code in generated SDK_ERROR_CODES or CONTRACT_ERROR_CODES, and category configuration, validation, authority, privacy, lifecycle or sink (superseded by R-Q9 in the review follow-up: verdict codes with category validation or privacy only). Rebuild with failure(code, category, path), passing path only if a string; bound it and drop all extra fields. Default-runtime diagnostics must deep-equal baseline. No provider fault reaches the sink or exposes its own error, and no provider fault is SDK_INVALID_INPUT.

## Verification plan

Use the top-level provider-fault-containment.test.ts and catalog-derived branded not_applicable input. An explicit 33-row matrix covers three beginOperation identifiers, eight named faults, six emit schema faults, redelivery, two free validator faults and five timers, plus eight configured/global schema bad-return rows. Each proves exact error, no throw/rejection, invocation, no sentinel leak and zero sink emissions. Separate controls cover sanitizer bounds/default baseline, caller getters, malformed IDs/Dates, throwing sink, healthy emission, numeric handles, precedence, lifecycle-first, provider bypass, timestamps and redelivery. Restore global runtime in finally.

Before the runtime commit, externally count all required exact mutation anchors once and run unchanged F08/F10/F11 suites. Run build/typecheck and the supplied full TEST_CMD, strict validation and whitespace checks; use only the supplied CodeScene wrapper. Keep functions short, domain typed and under complexity limits. Evidence is recorded only after observation; final committed-head results are external.

## Boundary

No changes to public types/exports, frozen contract 2.1.0, generated code, packages, governance-core files, verification tests, Node runtime or other changes. No runtime selection correction (#816), malformed context-frame redesign, unused identifier methods, wrongly accepting runtimes, sink/hook contract change, merge/fold/archive or authorization claim.
