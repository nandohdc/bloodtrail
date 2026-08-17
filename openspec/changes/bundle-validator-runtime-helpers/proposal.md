## Why

The packed SDK artifact is not importable from a production-only install: `dist/generated/schema-validator.generated.cjs` requires `ajv/dist/runtime/ucs2length` and `ajv-formats/dist/formats`, both declared as devDependencies only, so a consumer install with `--omit=dev` fails eagerly with `MODULE_NOT_FOUND` before any SDK API is reachable (S-6, reproduced in the archived adversarial-review technical packet). Issue #68 requires this fixed, and the owner decision recorded in ADR-SDK-011 (policy A — BUNDLED_STANDALONE_VALIDATOR, #67) requires the fix to keep zero runtime dependencies rather than declare them.

## What Changes

- The generator (`scripts/generate-contract.mjs`) post-processes the emitted standalone CommonJS validator so the three `require(...)` expressions are replaced by bundled definitions inlined as source text from two new vendored modules, keeping `"use strict";` as the first statement.
- New vendored modules under `packages/security-audit-sdk-core/vendor/` carry the bundled MIT-licensed code: the ajv `ucs2length` runtime helper and the ajv-formats `date-time` and `uri` validators, transcribed verbatim from the pinned dependency versions.
- The generated artifact gains an MIT attribution header naming the bundled packages, versions, sources, and the ADR-SDK-011 reference.
- The generator fails closed: it aborts generation if the emitted code references any require target outside the known set or still contains any `require(` after bundling.
- `DEPENDENCIES.md` records the bundled code and its attribution; the ajv and ajv-formats rows are updated to state their generation-time role.
- Two new verification tests: a parity matrix proving the bundled validators are behavior-identical to the pinned dependency implementations, and a packed-consumer test installing the tarball with `--omit=dev`, importing both public exports by package specifier, and running positive and negative schema validation.
- One new requirement in the `security-audit-sdk-core` capability spec.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-core`: adds the requirement that the packed artifact installs and validates with production-only dependencies and that the generated validator is self-contained with recorded MIT attribution.

## Impact

- Affected: the generator, the regenerated validator artifact, two vendored source files, two verification tests, and dependency documentation.
- No runtime code, public API, or contract semantic change; no package topology, publication, or deployment change.
- `runtimeDependencyCount: 0` and `modulePolicy: "esm-public-cjs-standalone-validator"` in `compatibility.json` become true of the shipped artifact; no compatibility metadata rewrite is required (ADR-SDK-011).
- `package.json` dependencies remain `{}`; the lockfile is unchanged.
- The packed-consumer test adds roughly 10–30 seconds to every `npm run validate`.

This proposal is an ADDED requirement rather than a MODIFIED delta on "Verification covers runtime, compile-time, package, and scope boundaries" (`openspec/specs/security-audit-sdk-core/spec.md`), which covers package export tests but says nothing about a production-only install of the packed artifact. ADDED is the lower-risk shape through `openspec archive`.
