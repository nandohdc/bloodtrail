# Design — configured runtime authority

Decision source: owner decision, 2026-10-15, via grilling and triage in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E

## Design Pattern Assessment

`assessment.json` is the full machine-readable assessment with all 15 security justifications. This is direct implementation at existing seams, not catalog-pattern conformance. Security-sensitive runtime selection and a material capability modification require a full assessment.

## Forces and selection

- Each instance event must consult only its configured runtime exactly once.
- Preserve diagnostic order, lifecycle gating, provider containment and operation settlement.
- Preserve frozen public and contract boundaries without new source paths.

Select `approach-existing-seams`: pass `config.schemaRuntime` in both named construction branches; split private already-validated delivery from complete-event validation in `sdk.ts`. The private named delivery seam retains the ready-state check before sink handoff. `emit()` and `redeliver()` retain their existing pre-validation lifecycle check and configured validation. No public bypass or new state is introduced.

Reject `approach-global-swap`: temporarily replacing the global runtime would leak authority across concurrent instances and free validation, even if restored in `finally`. Reject `approach-double-configured`: validating twice with the configured runtime avoids global authority but violates exactly-once execution, changes stateful-runtime results and repeats provider work.

## Invariants and placement

### `implementation-configured-once`

Named execution and named redelivery validate with `config.schemaRuntime` during construction. Both then enter the private already-validated delivery seam without another validation. Complete-event `emit()` and `redeliver()` retain their configured validation. The default remains `cjsSchemaRuntime`, independent of the process global. Free validation retains global default and explicit-runtime selection.

### `implementation-preserved-boundaries`

Keep normalization, prohibited-data, schema, semantic and post-scan order. Retain the ready-state check immediately before named sink handoff, duplicate/reservation/settlement logic, redelivery identity and provider bypass. Preserve #811's bounded verdict sanitization and exact provider diagnostics and #812's outcome rules. Existing public types, exports, signatures and error codes remain unchanged.

## Verification and task mapping

- `1.1`–`1.2`: six proposal artifacts, exact ownership and full assessment; assessment governance and strict validation before the proposal-only commit.
- `2.1`–`2.2`: existing production seams only; build/typecheck and relevant existing regressions. The four global-dependent provider cases are updated in the next commit, not discarded.
- `3.1`–`3.3`: top-level counting tests for all six entry points, refusing-global same-instance controls and omitted runtime; four rewritten global-provider cases preserving every other row; re-anchor `M-F11-F` and `M-F11-G` without changing their weakening. Execute focused and full runtime tests.
- `4.1`: API/error row, migration after #812, security threat, continuous glossary, `ADR-SDK-017` refining unchanged `ADR-SDK-003` and `ADR-SDK-011`, inventory through `017`, Node error catalog; coherence and Node kit.
- `5.1`–`5.3`: supplied eight-command chain, exact wrapper, full mutation totals, CodeScene delta and orchestrator repro; exact ownership/format/history audit; lightweight evidence-edit checks before staging and committed-head rechecks reported externally.

## Delivery boundaries

Five primary commits in proposal/runtime/tests/docs/evidence order, exact supplied subjects, `Refs #816` and co-author trailer. No rewriting or baseline movement. Gate-driven in-scope corrections require appended corrective commits and their own task before evidence closure; an out-of-scope diagnostic fails the story, never bypasses a gate.

Only exact `owned_paths` may change. No new `src/` file, generated artifact, manifest, contract, collector, governance-core, canonical-spec, archive, CI or CodeScene configuration change. Every other provider row and unrelated runtime/type/example/kit test remains byte-identical. Functions stay at complexity <=9 and <=70 lines without bumpy road; tables stay module-scoped. Re-evaluate only in a separately governed runtime-selection or public API change. Local tests do not constitute remote CI or approval; merge, fold and archive remain pending.
