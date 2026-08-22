## Why

The scope gate in `scripts/check-scope.mjs` skips `src/generated/`, admits `.ts` files only, and inspects import specifiers rather than free identifiers, leaving runtime sources blind to undeclared host globals like `Buffer` or `process`. While generated module specifiers and Node engine bounds are already enforced by `check:generated`, `check-dependencies.mjs`, and `check-compatibility.mjs`, no gate in the repository detects free global identifiers or inspects generated CommonJS runtime artifacts at source.

Disposable package-copy measurements demonstrate that `Buffer.byteLength`, `process.env`, and `globalThis["fe" + "tch"]` pass `check-scope.mjs` unseen at exit 0. Furthermore, regex-based content matching is easily evaded and susceptible to false positives from comments and string literals. The set of host couplings actually exercised by the SDK is small (~24 language globals, universal timers, `Buffer` in authored code, and `module` in generated code) and can be fully declared and verified.

## What Changes

- Add an AST-based platform coupling analysis stage to `npm run test:scope` (`scripts/check-scope.mjs`) inspecting every code artifact under `src/` including `src/generated/` and CommonJS files (`.ts`, `.cts`, `.mts`, `.js`, `.cjs`, `.mjs`).
- Define `scripts/platform-coupling-policy.mjs` holding the declared coupling policy as frozen data keyed by artifact role (`authored` and `generated`), language globals, and admitted host globals with justification.
- Collect free identifiers in value position (excluding type positions and property accesses) and module specifiers across import/export/require positions, classifying each against the role policy.
- Fail closed on any undeclared global or specifier, unreadable file, unparseable syntax tree, or empty artifact inventory.
- Ban `globalThis` across all roles to prevent dynamic global evasion.
- Preserve verbatim the existing filename regex, source-content regexes, import loop, and manifest assertions in `check-scope.mjs`.
- Distinguish platform coupling diagnostics with a distinct `[platform-coupling:<code>]` prefix while keeping existing production-integration diagnostics unchanged.
- Report the declared coupling inventory per role on the passing path.
- Add deterministic mutation tests and negative controls in `tests/verification/platform-coupling-mutations.test.mjs`.
- Record domain terms in `CONTEXT.md` and architectural rationale in root ADR 0004.
- Update `CLAUDE.md`, `.hermes.md`, and `README.md` to reflect platform coupling enforcement in the scope gate.

Traceability: PLAN-014, PLAN-015, PLAN-074.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-core`: Require scope verification to classify all platform coupling across authored and generated runtime code against a declared role-keyed policy, fail closed on undeclared coupling, and provide positive and negative verification controls.

## Impact

Implementation is confined to SDK verification scripts, test harnesses, documentation, and governance files. No runtime dependencies, npm commands, exported APIs, contract modifications, or production integrations are introduced. `Buffer` usage in `src/errors.ts` and `src/validation/prohibited.ts` is explicitly retained and declared.

Assurance limitations: The gate bounds which host capabilities are referenced, not their specific call sites. Host-object member access (such as `Timeout.unref()`) is not mechanically detected and is documented in policy data.
