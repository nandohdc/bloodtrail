## Context

See `proposal.md` for motivation and measured findings. The scope gate at `scripts/check-scope.mjs` enforces the authorization boundary and production-integration isolation. However, it currently skips `src/generated/` and inspects import specifiers rather than free identifiers, leaving runtime sources blind to undeclared host globals like `Buffer` or `process`.

The declared coupling inventory in the SDK is small and enumerable: standard ECMAScript globals, universal timer globals (`setTimeout`, `clearTimeout`), `Buffer` in authored source for byte-length calculation, and `module` in generated CommonJS validator output.

## Goals / Non-Goals

**Goals:**

- Classify every module specifier and free global identifier in SDK runtime source artifacts (`src/`, including `src/generated/` and `.cjs`) against a frozen, role-keyed coupling policy.
- Use the TypeScript AST parser (`ts.createSourceFile`) to inspect syntactic structure, tracking lexical scopes and distinguishing value identifiers from type positions and property accesses.
- Fail closed on any undeclared host global or module specifier, unreadable file, unparseable file, or empty inventory.
- Ban `globalThis` across all roles to defeat dynamic global evasion by construction.
- Preserve existing filename regex, source-content regexes, import loop, and manifest assertions verbatim.
- Distinguish platform coupling diagnostics using a `[platform-coupling:<code>]` prefix.
- Provide deterministic mutation tests and negative controls in a standalone verification test file.

**Non-Goals:**

- Removing or replacing existing `Buffer.byteLength` usage.
- Core extraction, multi-package restructuring, or runtime engine widening.
- Adding an engine check to the scope gate (`check-compatibility.mjs` and `check-coherence.mjs` already pin Node engines).
- Replacing or rewriting the legacy source-content regexes in this change.
- Mechanically detecting host-object member access such as `Timeout.unref()` (declared in policy data as non-detected).
- Adding new npm scripts or SDK ADRs (the SDK ADR count is coherence-pinned at 11).

## Decisions

### Pure policy module with AST inspection

A new module `packages/security-audit-sdk-core/scripts/platform-coupling-policy.mjs` defines `PLATFORM_COUPLING_POLICY` as frozen data and provides `collectCouplingReferences` and `inspectPlatformCoupling`. Following the precedent of `shipped-import-policy.mjs`, it uses `ts.createSourceFile` to parse TypeScript and JavaScript sources.

### Role-keyed admission

Sources are partitioned into two roles:
- `authored`: code under `src/` excluding `src/generated/`. Admitted host globals: `Buffer` (with explicit rationale: byte-length calculations). Admitted specifiers: `node:async_hooks`, `node:crypto`.
- `generated`: code under `src/generated/`. Admitted host globals: `module` (CommonJS wrapper export). Admitted specifiers: none.
- Shared `languageGlobals`: standard ECMAScript globals (`Array`, `Object`, `Promise`, etc.) and universal timer globals (`setTimeout`, `clearTimeout`).
- `globalThis` is admitted in no role, closing dynamic member evasion.

### Lexical scope tracking and position exclusion

The visitor tracks nested lexical scopes (functions, arrow functions, blocks, catch clauses, parameters, variable declarations, loop bindings, class declarations). An identifier is collected only if it is in value position and not bound in any enclosing lexical scope. Identifiers in type position (type references, type aliases, interface declarations, type arguments) and property positions (member access property, property assignment key, object method name, import/export clause names) are excluded.

### Fail closed

The inspection fails closed if:
- An identifier or module specifier is not in the declared set for the artifact's role (`undeclared-global`, `undeclared-specifier`).
- An artifact cannot be read (`read-failure`).
- An artifact cannot be parsed into an AST (`parse-failure`).
- The inspected artifact set is empty (`empty-inventory`).

### Verbatim legacy stage retention

Existing filename checks, source-content regexes, import-specifier checks, and manifest assertions remain unchanged in `scripts/check-scope.mjs`. The legacy `src/generated/` skip at line 30 is preserved for legacy stages because those regexes were not designed for generated output. The new coupling inspection stage inspects all of `src/` including generated files.

### Diagnostic prefixing and output bounding

Platform coupling violations are formatted as `[platform-coupling:<code>] <artifactPath>: <detail>`, keeping them distinguishable from legacy production-integration violations. Diagnostics contain no raw source text and total output is bounded.

## Risks / Trade-offs

- [AST pass increases execution time] -> Measured overhead is ~0.17 s, well within acceptable bounds for validate and test:matrix.
- [False positives on local bindings sharing global names] -> Resolved via full lexical scope tracking in AST visitor, verified by negative control M-71-E.
- [TypeScript utility types causing false positives] -> Resolved by explicitly excluding all AST nodes in type positions, verified by negative control M-71-F.
- [Host member access like timer.unref() undetected] -> Documented in policy data and noted in assurance limitations rather than adding fragile heuristics.
