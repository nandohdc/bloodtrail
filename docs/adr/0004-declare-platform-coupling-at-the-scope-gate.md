# ADR 0004: Declare platform coupling at the scope gate

- Status: Accepted
- Date: 2026-08-21
- Decision owners: Project owner

## Context

The SDK validation chain enforces an authorization boundary via `test:scope` (`scripts/check-scope.mjs`). That gate previously enforced forbidden filenames, forbidden source-content regexes, import specifiers, and manifest dependencies. However, it skipped `src/generated/` and inspected import specifiers rather than free identifiers, leaving runtime sources blind to undeclared host globals like `Buffer` or `process`.

While generated module specifiers and Node engine bounds are enforced by `check:generated`, `check-dependencies.mjs`, and `check-compatibility.mjs`, no gate in the repository detected free global identifiers or inspected generated CommonJS runtime artifacts at source. Furthermore, regex-based source-content matching is easily evaded by dynamic member access (e.g. `globalThis["fe" + "tch"]`) and susceptible to false positives from comments and string literals.

## Decision

Platform coupling SHALL be declared as frozen data in `scripts/platform-coupling-policy.mjs`, keyed by artifact role (`authored` and `generated`), distinguishing language globals from role-admitted host globals and declared module specifiers.

The scope gate SHALL use TypeScript AST inspection (`ts.createSourceFile`) to track lexical scopes, distinguish value identifiers from type and property positions, classify free identifiers and module specifiers against the declared policy, and fail closed on undeclared couplings, unreadable files, parse failures, or empty inventories.

`globalThis` SHALL NOT be admitted in any role, defeating dynamic global evasion by construction.

Existing host couplings (`Buffer` in authored code for byte-length calculation, `module` in generated CommonJS validator output) SHALL be explicitly declared with justification, rather than banned outright or site-bound. Host-object member access (such as `Timeout.unref()`) is declared in policy data as an uninspected coupling.

## Consequences

- `test:scope` now uses TypeScript AST inspection, adding ~0.17 s overhead to `validate` and `test:matrix`.
- `test:scope` requires `node_modules` for `typescript` resolution.
- Any new host capability reference requires an explicit policy edit with a recorded justification.
- The gate bounds which host capabilities the SDK sources use, not where they are used, providing an authoritative inventory for any future Core-extraction work.

## Alternatives considered

### Ban Node host coupling outright

Rejected. Banning Node coupling outright would require removing `Buffer` from authored code, violating the scope constraints of issue #71 and deciding the Core-extraction architecture by side effect.

### Site-bound coupling declarations

Rejected. Binding approved globals to exact file paths and line numbers drifts on legitimate refactorings and has no precedent in the codebase (where `allowedNodeImports` is name-bound).

### Extend source-content regexes

Rejected. Text-based regexes match occurrences in comments and string literals causing false positives, while dynamic indexing (`globalThis["fe" + "tch"]`) evades name matching. AST inspection with lexical scope analysis is required for sound classification.
