## 1. Proposal

- [ ] 1.1 Land the proposal PR for issue #86 against `origin/main`: the complete packet (`proposal.md`, `design.md`, the `security-audit-sdk-core` delta spec, `tasks.md`, `assessment.json`), `openspec validate extract-platform-neutral-core --strict` passing, the required CI contexts green, conventional commit `docs(openspec): propose extract-platform-neutral-core`, and every task unchecked. The diff SHALL modify only paths under `openspec/changes/extract-platform-neutral-core/` — no runtime source, no package manifests, no contract paths.
- [ ] 1.2 Run strict verification of OpenSpec and governance checkers: `openspec validate --all --strict`, `check-design-pattern-governance --phase assessment`, and `run-governance-dual-check.mjs` must pass cleanly at the proposal commit.

## 2. Review and authorization

- [ ] 2.1 Obtain an independent exact-commit technical review bound to the proposal commit; record the review as evidence, not approval.
- [ ] 2.2 Obtain the project owner's exact-commit authorization bound to the proposal commit before merge. Merge only after recorded decision and all required CI checks are green.

## 3. RED phase — Prove platform coupling violations

- [ ] 3.1 Run the platform coupling policy with a strict platform-neutral role declaring zero Node built-in imports and zero host globals; record every current coupling (`node:crypto`, `node:async_hooks`, `Buffer`, CommonJS `module`) as the baseline RED worklist.
- [ ] 3.2 Define paper second consumer provider types under `tests/fixtures/paper-consumer/`; confirm that Core does not compile against the non-Node provider set today without type errors.
- [ ] 3.3 Run null control: verify that the unmodified package passes `validate` prior to any code edits.

## 4. GREEN phase — Extract SPIs and achieve platform neutrality

- [ ] 4.1 Define the `PlatformProvider` SPI in `src/providers.ts` covering IDs, clock, byte length, timers (with optional `unref`), and schema runtime; remove `node:crypto` import from Core.
- [ ] 4.2 Split `src/context.ts` to place ambient execution context behind the `ContextProvider` SPI while retaining the brand registry, the 35 brand constructors, and the 19 brand kinds strictly in Core; remove `node:async_hooks` import from Core.
- [ ] 4.3 Replace direct `Buffer.byteLength` references in `src/errors.ts` and `src/validation/prohibited.ts` with the platform byte length SPI and standard `TextEncoder` fallback.
- [ ] 4.4 Implement timer management through `AuditTimerProvider`, treating handle `unref()` as an optional capability with graceful degradation.
- [ ] 4.5 Abstract event schema validation behind `AuditSchemaRuntime` SPI so Core requires no CommonJS loader and references no `module` global.
- [ ] 4.6 Implement an automated duplicate-Core fixture and null control under Option C: prove that duplicate Core module copies fail closed with `AUTHORITY_ESCALATION` before sink handoff, and that single deduplicated Core passes.
- [ ] 4.7 Rescope dependency verification in `scripts/check-dependencies.mjs` and `scripts/check-coherence.mjs` from "empty dependencies" to "no third-party runtime dependencies", enforcing a strict first-party allowlist (`@bloodtrail/*`).

## 5. Verification, fold, and archive

- [ ] 5.1 Re-run platform coupling policy: verify zero Node built-in imports, zero host globals, zero third-party runtime dependencies, and verify that the paper second consumer compiles cleanly under `test:types`.
- [ ] 5.2 Assert pinned counts unchanged: exactly 24 canonical catalog events, 24 named event APIs, 35 brand constructors, and 19 brand kinds.
- [ ] 5.3 Fold the `security-audit-sdk-core` delta into canonical `openspec/specs/security-audit-sdk-core/spec.md`, verify strict validation, and archive the completed change in a byte-preserving relocation commit.
