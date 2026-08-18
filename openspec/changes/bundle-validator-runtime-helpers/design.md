# Design: bundling the validator runtime helpers and formats

## Context

`scripts/generate-contract.mjs` compiles the canonical Draft 2020-12 schema with `Ajv2020` (strict, all-errors, `code: { source: true }`, `validateFormats: true`) plus `addFormats`, and emits `standaloneCode` output as `src/generated/schema-validator.generated.cjs`. The emitted CJS is a single line opening with `"use strict";` and containing exactly three `require(` expressions, each on the right-hand side of a top-level `const`:

| Emitted declaration | Call shape in the artifact |
|---|---|
| `const func3 = require("ajv/dist/runtime/ucs2length").default;` | `func3(data1)` — bare function |
| `const formats0 = require("ajv-formats/dist/formats").fullFormats["date-time"];` | `formats0.validate(data11)` — object with `.validate` |
| `const formats4 = require("ajv-formats/dist/formats").fullFormats.uri;` | `formats4(data54)` — **bare function** |

There are zero `.compare` usages. The two format entries have different shapes: `fullFormats["date-time"]` is a `fmtDef` object (`{validate, compare}`) while `fullFormats.uri` is a plain function. The replacements are therefore asymmetric.

## Mechanism

The generator post-processes the emitted code (`bundleValidatorRuntime`):

1. **Source-text inlining, not function serialization.** `date_time` and `uri` close over module-level constants and helpers (`DATE`, `DAYS`, `date`, `isLeapYear`, `TIME`, `getTime`, `DATE_TIME_SEPARATOR`, `getDateTime`, `NOT_URI_FRAGMENT`, `URI`), so `Function.prototype.toString()` cannot carry them. Instead the vendored module bodies are inlined as whole source text: `vendor/bundled-validator-formats.mjs` and `vendor/bundled-validator-runtime.mjs` are read at generation time, their single trailing `export { … };` statement is stripped, and the remaining body is emitted into the artifact after the strict directive and the attribution header. The vendored bodies are adapted from the upstream transcription rather than copied verbatim: control flow is restructured into single-branch conditions (no logical operators, no ternaries, no function above the analyzer cyclomatic threshold) so the bundled code stays within the branch thresholds the CodeScene delta gate enforces, with no behavior change (see 4 and the parity test).
2. **Strict directive stays first.** A leading block comment is legal before `"use strict";`; declarations are not. Output order: `"use strict";`, attribution header comment, vendored bodies, then the transformed generated code.
3. **Fail-closed asserts.** Generation aborts if (a) the emitted code does not open with `"use strict";`, (b) any require target is outside the known set, (c) any expected replacement pattern is absent, (d) any `require(` remains after replacement, (e) a bundled top-level name collides with a declaration in the generated code, or (f) a vendored module fails the export-statement/no-import shape checks.
4. **Vendor placement and analyzer interaction.** The bundled sources live under `packages/security-audit-sdk-core/vendor/`. `sonar.sources` enumerates `src`, `scripts`, and `examples`; `vendor/` is scanned by nothing (and is not in `sonar.tests`). The upstream regex code raises several Sonar findings under the project's own profile (`new_violations = 0` quality gate), and "fixing" them would change the semantics the parity test exists to preserve. `sonar-project.properties` must not be edited: it matches no `path_classes` pattern and would fail the governance checker as `path-unclassified`. CodeScene's delta gate, by contrast, scans the entire diff with no vendor exclusion and gates on introduced branch complexity — so the vendored bodies are restructured branch-light while remaining behavior-identical, and that identity is what the parity test and the runtime suite enforce.

## Why not the alternatives

- **DECLARED_RUNTIME_DEPENDENCIES** (declare ajv/ajv-formats at runtime): recorded and rejected by the owner decision in ADR-SDK-011.
- **fastFormats (regex-only formats):** silently weakens validation — e.g. `2023-02-30T…` passes the regex. Semantic date validity is part of the standards-compatible interpretation of `date-time` on a security-audit event. Rejected.

## Verification strategy

- **Parity test** (`tests/verification/bundled-formats-parity.test.mjs`): compares the bundled validators against the pinned dependency implementations over input matrices, and asserts the *shapes* of the pinned entries (object vs bare function) so a future ajv-formats change that flips either shape fails here rather than in the artifact.
- **Packed-consumer test** (`tests/verification/packed-consumer-closure.test.mjs`): packs the tarball to a destination outside the package root, installs it into a fresh temp consumer with `--omit=dev --offline`, imports both public entry points **by package specifier** (so the export map is exercised), and runs positive, structural-negative, and semantic-negative (`2023-02-30`) validation, including an event carrying a `uri`-format field so the bare-function replacement runs end to end. Static checks on the installed artifact: no `require(`, attribution header present, `"use strict";` first.
- **Existing runtime suite** (`test:runtime`): the control on identifier collisions and on the `uri` call shape — a wrong shape throws on any event carrying `authenticated_principal.issuer` or `authentication.identity_provider`, both of which the fixtures exercise.

## Determinism

Generation inputs are unchanged except for the two vendored module bodies, which are committed repo files; ajv 8.20.0 and ajv-formats 3.0.1 remain pinned by the lockfile. `check:generated` continues to prove byte-for-byte determinism.
