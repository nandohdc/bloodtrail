# ADR-SDK-011: Generated validator runtime packaging policy

- Status: Accepted for SDK-core implementation
- Date: 2026-08-16

## Context

The generated schema validator shipped in the packed artifact (`dist/generated/schema-validator.generated.cjs`) requires ajv runtime helper modules (`ajv/dist/runtime/ucs2length` and related) that are declared as devDependencies only. A production-only install therefore fails at import with `MODULE_NOT_FOUND`. This is the S-6 defect reproduced and recorded in the archived adversarial-review technical packet (`openspec/changes/archive/2026-08-11-remediate-security-audit-sdk-adversarial-review/technical-review-packet.md`, S-6 section). `runtimeDependencyCount: 0` and `modulePolicy: "esm-public-cjs-standalone-validator"` in `compatibility.json` were unreconciled with this shipped behavior.

Issue #67 required exactly one packaging policy to be selected and recorded. The project owner selected A — BUNDLED_STANDALONE_VALIDATOR on 2026-08-16 (decision comment on issue #67). This ADR records that decision in-repo.

## Decision

The generated validator is a bundled standalone artifact. Policy: **BUNDLED_STANDALONE_VALIDATOR** (keep zero runtime dependencies).

1. `runtimeDependencyCount: 0` in `compatibility.json` is retained and ratified.
2. `modulePolicy: "esm-public-cjs-standalone-validator"` is now an explicit, decided policy rather than an unreconciled claim; this choice requires no `compatibility.json` gate rewrite.
3. The generator emits a self-contained validator with the ajv runtime helpers (`ucs2length`, `equal`, codegen) bundled into the generated artifact, which remains a standalone CommonJS output.
4. Ajv (MIT) attribution is recorded in the generated artifact header and in `DEPENDENCIES.md`.
5. The package gate must prove runtime closure of the packed artifact with production-only installation.

Required changes enumerated by this decision (implemented by #68–#71 in dependency order, not by this ADR):

- Manifest: `package.json` dependencies remain `{}`; no manifest change is required.
- Lockfile: no change; ajv and ajv-formats remain devDependencies pinned by `package-lock.json`.
- Generator: `scripts/generate-contract.mjs` emits the self-contained validator bundling the ajv runtime helpers; `scripts/copy-generated-validator.mjs` continues copying the artifact to `dist/generated/`.
- License: Ajv MIT attribution in the generated artifact header and in `DEPENDENCIES.md`.
- Gates: `check-package-contents.mjs` proves production-only runtime closure of the packed artifact (#70); `check-dependencies.mjs` rejects undeclared runtime imports (#69); `check-scope.mjs` detects Node globals and generated runtime imports (#71).

Rejected alternative: DECLARED_RUNTIME_DEPENDENCIES (declare ajv/ajv-formats as runtime dependencies) — rejected because it retires the zero-runtime-dependency identity, widens the runtime surface, and forces `compatibility.json` and gate rewrites.

## Consequences

- The decision is bound to the reproduced S-6 failure: the packed artifact requires devDependency ajv runtime helpers and cannot be imported from a production-only install.
- This ADR changes no runtime code, no public API, and no contract surface; the defect remains unfixed until #68 implements the generator bundling.
- Recording this ADR required updating the coherence gate's ADR count and sequence (ADR-SDK-001 through ADR-SDK-011).

## Boundary

This ADR authorizes no application integration or production deployment.
