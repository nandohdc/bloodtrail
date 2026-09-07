## Context

The delivery conformance contract (#102) and the contract-version support policy (#75/#76) are ratified; the owner decision record #343 authorizes bounded collector implementation starting with #107. The SDK core's scope gate forbids collector source inside the producer package, and the delivery conformance contract states no included sink SHALL perform collector communication — so the collector must be a dedicated package (`packages/security-audit-collector`), private and UNLICENSED, with zero third-party runtime dependencies. The frozen contract bounds are `event_max_bytes` 65536, `object_max_depth` 8, `default_string_max` 256, `display_string_max` 128, `message_string_max` 512, `array_max_items` 32, `extension_max_namespaces` 4, `retry_attempt_max` 1000. The standalone generated validator `packages/security-audit-sdk-core/src/generated/schema-validator.generated.cjs` (Ajv 2020, zero runtime dependencies) is the structural authority both sides must share. The canonical event declares its contract version at `schema.version`.

## Goals / Non-Goals

**Goals:**

- A collector ingress library with the fixed order authenticate → size → parse → schema → version → accept, each stage failing closed, with deterministic, instrumented test evidence (the nine arms E1–E8 + N0 from the committed #107 plan).
- Structural validation through the byte-identical generated validator with a drift gate, so producer and collector cannot disagree.
- Size limits derived from the frozen contract bounds, never configured.
- A non-production authenticator: an authentication interface plus exactly one mock/synthetic implementation; no production credential system is selected.
- The ratified asymmetric version policy applied: an explicitly enumerated finite supported set, distinct version rejection.
- Bounded diagnostics (code, category, path) and non-secret metrics; no payload or credential leakage; no recursive audit-event loop.
- Repository integration: package-discovery declaration, CI wiring, and the five-package topology amendment recorded in the `repository-topology` capability.

**Non-Goals:**

- No idempotency/deduplication (#108), no storage (#115), no delivery state machine beyond admission (#103–#106), no network server or listener, no production credentials or infrastructure, no deployment.
- No modification of `packages/security-audit-sdk-core`, the frozen contract, generated SDK artifacts, or `research/`.
- No trust or truth claims derived from authentication.

## Decisions

### Ingress order is fixed and each stage fails closed

Stages run in exactly `authenticate → size → parse → schema → version → accept`. A rejection at any stage terminates before later stages and consumes no admission capacity. E2–E4 prove authentication rejects an otherwise valid body before parse by instrumenting the parse stage — an ordering assertion measured at runtime, not inferred from code.

**Alternative considered: authenticate after size/parse.** Rejected as it would let an unauthenticated attacker drive body-size and parsing work before any identity check; #107's acceptance criterion requires authentication failures to precede acceptance, and F4 requires the ordering to be testable.

### Structural validation is a byte-identical vendored copy of the generated validator, with a drift gate

The collector vendors `schema-validator.generated.cjs` verbatim into the package and a `check:generated-validator` gate recomputes byte identity (sha256) against the canonical path. The validator is standalone CJS with zero runtime dependencies, so vendoring costs no runtime dependency and keeps the producer package untouched.

**Alternative considered: a `file:` runtime dependency on sdk-core.** Rejected: sdk-core does not export the validator and must stay platform-neutral; a cross-package import of an unexported generated file would couple the collector to sdk-core internals. **Alternative considered: reimplementing structural validation.** Rejected (F2): two validators guarantee drift between producer and collector.

### The authenticator is an interface plus one non-production implementation

`Authenticator` interface: `verify(credentials) → verified sender identity | rejection`, failing closed on missing/malformed/invalid material. The shipped implementation (`SyntheticFixtureAuthenticator`) accepts only mock credentials defined in synthetic test fixtures and is documented as non-production. No production credential system, secret store, or network mechanism is selected (the issue explicitly excludes that choice).

**Alternative considered: shipping no implementation, interface only.** Rejected: the nine arms need a deterministic authenticator; an interface without any implementation cannot run E1/E4.

### The supported version set is the single canonical version 1.0.0

The version stage enforces the ratified asymmetric policy with the explicit finite set `{ "1.0.0" }`, read from the submission's `schema.version`. E7 proves an unsupported version yields the version diagnostic, distinguishable from E6's schema diagnostic. The set never broadens producer EXACT_ONE binding.

**Alternative considered: accepting any well-formed semver.** Rejected: that would implement no version policy at all and would contradict the ratified policy's explicit-set requirement.

### Bounds are derived from the frozen contract, not configured

The ingress reads the frozen `bounds` block and derives every limit; there is no configuration surface for limits. Deriving guarantees the collector can never accept what the producer could not emit and never rejects a valid event through a self-chosen limit.

**Alternative considered: package-local configuration constants.** Rejected (F3): configuration drifts from the contract silently.

### Diagnostics and metrics are bounded, stable, and non-secret

Rejections carry `{ code, category, path }` with codes drawn from a closed vocabulary (`COLLECTOR_AUTH_MISSING`, `COLLECTOR_AUTH_MALFORMED`, `COLLECTOR_AUTH_REJECTED`, `COLLECTOR_SIZE_EXCEEDED`, `COLLECTOR_PARSE_INVALID`, `COLLECTOR_SCHEMA_INVALID`, `COLLECTOR_VERSION_UNSUPPORTED`). Counters (`accepted`, `rejected_authentication`, `rejected_size`, `rejected_parse`, `rejected_schema`, `rejected_version`) are plain counts with no labels carrying caller data. E8 inspects diagnostics and counters after a mixed run and asserts no payload/secret material appears.

**Alternative considered: echoing validation error messages from the generated validator.** Rejected: validator messages embed instance data; only a bounded projection (code, category, bounded pointer) is surfaced.

### The collector package mirrors the sdk-node package skeleton

Standalone `package.json` (`private: true`, `UNLICENSED`, `engines >=24 <25 || >=26 <27`, no runtime dependencies, TypeScript 5.9.2 / @types/node 24.2.0 devDependencies), `tsconfig*.json`, `scripts/` gates (scope, dependencies, package-contents, validator drift), `node:test` runtime tests compiled from `.test.ts`, and a `validate` chain mirroring the sdk-node shape. CI wiring follows #85's pattern: package-discovery declaration plus a dedicated CI job and coverage entry.

**Alternative considered: a root workspace or a workspace manifest.** Rejected: the ratified repository topology forbids root manifests and keeps per-package ownership.

### The repository-topology capability is amended, not bypassed

The ratified target set moves from four to five packages through a MODIFIED requirement in this change's delta, bound to the #343 authorization. The amendment is decision-bearing: the proposal and PR bodies flag it for owner ratification on return; nothing in this change claims that ratification has occurred.

**Alternative considered: landing the package without amending the topology.** Rejected: that would leave a canonical capability contradicting the repository's actual state.

## Risks / Trade-offs

- [A vendored copy of the validator could drift] → the drift gate fails closed on any byte difference and CI runs it; regeneration of the canonical validator in a later contract change surfaces as a red gate naming the drift, prompting a governed re-vendor.
- [The change is decision-bearing (topology amendment)] → the authorization chain is quoted verbatim in the proposal and PR bodies; the amendment is explicitly flagged for owner ratification; no production authority is claimed anywhere.
- [A parser stage could duplicate the validator's work] → parse means only JSON deserialization into a plain value; all semantic and structural judgment belongs to the generated validator and the version stage.
- [Metrics could leak payload through labels] → labels are a closed vocabulary; E8 asserts no submission-derived material appears in any counter label or diagnostic.
- [CodeScene delta findings on new code] → keep stage functions small, avoid cyclomatic complexity at threshold, pass options as a context object rather than more than four positional arguments; CI's mandatory CodeScene check is the binding gate.

## Migration Plan

1. Scaffold the package; vendor the validator byte-identically; wire the drift gate, scope/dependency/package gates, and the validate chain.
2. Write the nine arms (E1–E8 + N0) first and observe the RED state against the not-yet-implemented ingress.
3. Implement the ingress in stage order; observe GREEN across all arms; run the full package validate plus contract and governance verification.
4. Amend the discovery declaration and CI; run the repository governance suite (phases, dual check) and the full pre-push matrix.
5. Commit the proposal and implementation separately; merge only when every required CI check is green on the exact head; fold and archive in dedicated later PRs.
