## Why

The dependency gate currently proves manifest and lockfile properties but never inspects the artifacts selected for packaging. Generated sources are exempt from the source-scope gate and shipped examples are outside its walk, so a future undeclared external import in either surface can pass every dependency assertion.

The AJV runtime-import defect described by #69 is no longer live: #68 made the generated validator self-contained and the current artifact contains no `require()` calls. This change is a regression lock that makes the repaired output's dependency closure enforceable rather than a repair for a current `MODULE_NOT_FOUND` failure.

## What Changes

- Extend the existing `test:dependencies` command to inspect the module specifiers of every shipped JavaScript and TypeScript artifact from the `npm pack --dry-run --json` inventory.
- Classify literal specifiers as relative internal references, role-approved `node:` built-ins, manifest-declared runtime dependencies, or package self-references whose subpaths are present in the export map.
- Keep built-in permissions role-scoped so shipped examples cannot widen the SDK runtime surface.
- Fail closed on undeclared externals, unprefixed or unapproved built-ins, unknown self-reference subpaths, dynamic or aliased import forms, unreadable artifacts, unknown artifact roles, and an empty inspection set.
- Emit deterministic bounded diagnostics naming only the artifact path, module specifier or unclassifiable form, and violation class.
- Add positive fixtures and deterministic failing mutations proving the control can reject the defect class it governs.
- Add one capability requirement governing shipped-artifact module-import verification.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-core`: require dependency verification to inspect and classify module references in every shipped JavaScript and TypeScript artifact and fail closed when a reference is not provably permitted.

## Impact

- **Scope**: one shipped-import policy module, one call from the existing dependency gate, one verification test file, and one dependency-record sentence.
- **Dependencies and API**: no runtime dependency, package-manifest, lockfile, npm-script, public API, compatibility, contract, or generated-artifact change. The already exact-pinned TypeScript development dependency supplies the parser.
- **Assurance boundary**: the gate proves declaration and bundling consistency, not dependency safety. Relative specifiers remain covered by existing runtime, examples, packed-consumer closure, and package-content checks rather than being resolved by this control.
- **Non-goals**: no reopening of the packaging decision or validator repair (#67 and #68), package-content hardening (#70), source-scope redesign or policy consolidation (#71), ADR, publication, production deployment, real-user processing, framework instrumentation, transport, exporter, collector, queue, storage, SIEM integration, analytics, detection, browser telemetry, or audit-log chaining.
- **Traceability**: PLAN-036, PLAN-038, and PLAN-074.
