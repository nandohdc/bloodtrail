## Context

See `proposal.md` for the motivation. The existing dependency gate reads package and lockfile metadata, the dependency record, installed package manifests, and the production dependency tree, but opens no shipped artifact. The existing source-scope check walks only TypeScript under `src/`, exempts `src/generated/`, and does not inspect the shipped examples.

The authoritative shipped inventory already exists: the package-content gate obtains it from `npm pack --dry-run --json`. The package currently ships JavaScript, CommonJS, declaration, and example TypeScript artifacts. Their legitimate non-relative references differ by role: SDK runtime output uses `node:async_hooks` and `node:crypto`, while examples use `node:assert`, `node:timers/promises`, and declared package self-references. The generated validator is now bundled and contributes no module specifier.

The exact-pinned TypeScript parser is already a development dependency and the dependency gate already requires the installed development graph, so syntax-aware inspection adds no runtime dependency or new execution precondition.

## Goals / Non-Goals

**Goals:**

- Inspect the artifacts npm identifies as shipped rather than inferring shipment from a source or output directory.
- Classify every discoverable ESM, TypeScript, dynamic-import, and CommonJS module reference through one fail-closed policy.
- Preserve the narrower SDK runtime built-in surface while accepting the distinct references needed by shipped examples.
- Verify valid self-references against the package export map rather than exempting them by name.
- Produce deterministic bounded diagnostics that identify the violation without reproducing artifact source.
- Prove the gate is live with positive fixtures and a deterministic undeclared-AJV mutation against the real command.

**Non-Goals:**

- Resolve relative specifiers on disk; execution and package-closure checks retain that responsibility.
- Determine whether a declared dependency is safe.
- Change the package inventory, packaging policy, runtime dependency policy, public API, source-scope gate, package-content gate, or production authorization boundary.

## Decisions

### D1 — The package dry-run inventory defines shipped artifacts

The dependency gate will consume the file list from `npm pack --dry-run --json --ignore-scripts` and inspect every `.js`, `.cjs`, `.mjs`, `.ts`, `.cts`, and `.mts` entry, including declaration files.

A `dist/` glob was rejected because it would miss shipped examples and could include output not selected for packaging. A source-tree walk was rejected because generated imports can be introduced during generation or build and therefore may not exist in authored sources.

### D2 — The policy is role-scoped

The policy has two artifact roles:

| Role | Path | Approved built-ins | Self-reference |
| --- | --- | --- | --- |
| SDK runtime | `dist/**` | `node:async_hooks`, `node:crypto` | not approved |
| Examples | `examples/**` | `node:assert`, `node:timers/promises` | approved only for declared exports |

A flat built-in allowlist was rejected because accepting example-only built-ins throughout the package would silently widen the runtime surface. Unprefixed built-ins are rejected in every role because a bare name can resolve through the userland package graph.

### D3 — Self-reference is positively verified

A specifier whose package name equals the manifest name is accepted only when its derived subpath is a key in the manifest export map: `.` for the bare package name and `./x` for a subpath. This keeps current example imports valid while rejecting undeclared package subpaths. A package-name exemption was rejected because it would permit imports of implementation surfaces not exposed by the package.

### D4 — Parse syntax with the pinned TypeScript parser

Each artifact is parsed with the exact-pinned TypeScript parser and walked for import declarations, export declarations, external import assignments, import type nodes, dynamic import calls, and `require()` calls. A regex was rejected because it cannot distinguish module references from comments, strings, or regular-expression literals, particularly in the large generated CommonJS validator.

The parser's error-tolerant tree is used only to claim that discoverable module references were classified. The gate does not claim full syntax validation. File-read failures remain violations.

### D5 — Unclassifiable forms fail closed

The inspector returns plain violation data for:

1. `import()` or `require()` whose argument is not a string literal, including template literals;
2. a `require` identifier used outside the direct call position, because aliasing can bypass call inspection;
3. any external specifier matching no permitted class;
4. an empty artifact inspection set;
5. a file that cannot be read; and
6. an artifact whose shipped path matches no declared role.

Violations are sorted by code point. Reporting is capped at 50 entries and 240 characters per diagnostic. Only artifact paths, specifiers or unclassifiable-form markers, and violation classes are emitted.

### D6 — Relative references are classified but not resolved

A specifier beginning with `.` or `..` is classified as internal without checking whether its target is packed. This control addresses external dependency declaration and bundling consistency. Existing runtime, example, packed-consumer closure, and package-content checks provide the independent execution and inventory evidence. Resolving relative references here was rejected because it would duplicate those controls and conflate dependency policy with package closure.

### D7 — Tests use stable package copies

Unit fixtures exercise the policy module directly in temporary directories. The end-to-end mutation copies the package, including built output and its installed dependency graph, before adding an undeclared AJV `require()` to the copied validator and executing the real dependency command. No test writes inside the live package.

A disposable Git clone was rejected because the gate reads a packed inventory and package metadata, not repository history. A package copy is the narrower fixture and matches existing mutation-harness precedent.

## Risks / Trade-offs

- **The TypeScript parser accepts malformed source and may still return a tree** → the gate limits its claim to classified references and treats read failures as violations; syntax correctness remains the build/typecheck responsibility.
- **Relative target absence is not detected here** → existing execution and package-content gates remain independent coverage, and the assurance limitation is explicit in the proposal and requirement evidence.
- **The package dry run executes twice in the full chain** → keep the gates independent rather than coupling their pass/fail state through a shared cache.
- **A future packed layout introduces another code-artifact role** → fail closed as an unknown role until policy is deliberately extended.
- **Diagnostic volume could expose or overwhelm output** → cap count and message length and never emit source content.
- **Static classification cannot prove dependency safety** → report only declaration and bundling consistency.
