# SDK core final technical review packet

## Packet state

- Purpose: prepare exact-commit technical review of the isolated framework-independent SDK core.
- Packet preparation state: complete for verified pre-commit technical closure; the final technical commit does not exist yet.
- Final technical commit: `PENDING — insert only after the Pass 3 technical commit exists`.
- Reviewed commit: `PENDING — no exact commit has been submitted or reviewed`.
- Reviewer identity and feedback: `PENDING`.
- Project-owner SDK decision: `PENDING — not requested and not inferred`.
- Merge decision: `PENDING`.
- Archive decision: `PENDING`.

A technical result, AI review, task assignment, branch push, pull request, or informal message is not project-owner or organizational approval.

## Commit and contract inventory

| Item | Exact target |
| --- | --- |
| Proposal commit | `94dc6e3bcc74beecd1fca2832948b139167fdd3b` |
| Pass 1 implementation | `2703b6a65bd2b83bef1d3b90c6083f2f8a38e4e3` |
| Pass 2 hardening | `529de906255d65a4d43b9e7a6976b8c9bf46f5d4` |
| Pass 3 final technical commit | `PENDING — no placeholder hash may be treated as a target` |
| Normative contract target | `8c5992bb6edc5c6dfdbfd0f48988b32f88ad2993` |
| Contract version | `1.0.0` only |
| Package | `@bloodtrail/security-audit-sdk-core` `0.1.0`, private/unpublished candidate |

The proposal baseline for exact changed-path and contract checks is the proposal commit. Pass 1 and Pass 2 are frozen and must not be amended, squashed, or rewritten.

## Task status at technical closure

- Total checklist entries: 106.
- Current evidence-supported task state after final Pass 3 verification: 99/106 complete; 7/106 remain.
- Evidence-supported technical entries after successful Pass 3 reconciliation: 99.
- Governance, owner-decision, merge, and archive entries that remain unchecked: 7 (`14.1` through `14.7`).
- Unsupported completed entries permitted: 0.

Task status is derived from `tasks.md`; this packet does not override the checklist. If final validation fails, affected entries must not be checked.

## Public API inventory

The root export provides:

- immutable `createSecurityAuditSdk` configuration and `SecurityAuditSdk` lifecycle;
- `AuditResult`, safe SDK errors/codes, contract error codes, and transport-neutral sink types;
- contract-derived `SecurityAuditEvent`, registries, catalog, field policy, operation contexts, input map, and version constants;
- authority-specific actors, actor claims, authenticated principal, subject, tenant/resource authority, tenant claims, credential/session/authentication/authorization/delegation/impersonation/source/destination/workload/data/risk/integrity constructors;
- immutable AsyncLocalStorage context frame/run/read helpers;
- transaction-aware operation handles;
- privacy hook types and registered enrichment extension;
- 24 named methods from `accountRegistrationAttempted` through `tenantContextViolationDetected`;
- validated canonical `emit` and pure `redeliver` paths.

The `./testing` export provides only capturing and bounded in-memory test sinks plus test-provider types. Source internals and the generated standalone validator are not subpath exports.

## Generated artifact inventory

Generated from approved canonical inputs by `scripts/generate-contract.mjs`:

- `src/generated/contract.generated.ts`;
- `src/generated/schema-validator.generated.cjs`;
- `src/generated/schema-validator.generated.d.cts`.

The build copies the standalone validator into `dist/generated/`. Generation is deterministic and `npm run check:generated` must pass before and after generation. Generated files are not manually editable contract forks.

## Technical evidence inventory

### Pass 1 and Pass 2 frozen evidence

Pass 2 was independently reported on exact Node `24.2.0` and `26.5.0`, with all then-current 47 runtime tests passing, no contract drift, and no production-scope violation. Pass 3 reruns the expanded suite; this historical statement does not substitute for final evidence.

### Pass 3 final execution evidence

Current state: `TECHNICAL VERIFICATION PASSED; FINAL TECHNICAL COMMIT PENDING`.

The clean canonical `npm run verify` execution passed on Node `26.5.0` / npm `11.17.0`. It removed disposable output and `node_modules`, installed the exact lockfile with `npm ci`, rejected pre-existing generated drift, regenerated and rechecked, type-checked, built fresh output, compiled and ran tests/examples, and completed every repository gate in the canonical order.

Canonical results:

- generated drift: current before and after generation;
- runtime tests: 47 passed, 0 failed, 0 skipped;
- approved fixture and semantic coverage: passed within the runtime suite;
- compile-time positive/negative API tests: passed;
- documentation examples: 15 compiled and executed;
- package exports and compatibility checks: passed;
- dependency/license/integrity policy: 0 runtime dependencies and 9 locked installed development packages inspected;
- `npm audit --audit-level=low`: 0 vulnerabilities;
- package dry-run allowlist: 76 files, 101,776-byte tarball, 735,371 bytes unpacked;
- exact changed paths: 68 paths since proposal baseline, active mode, passed;
- cross-artifact coherence: contract `1.0.0`, 24 catalog events, 24 named APIs, 0 runtime dependencies, and governance pending;
- strict OpenSpec: active change valid; repository 2 passed, 0 failed;
- Git whitespace/final-newline: passed; index empty.

Independent exact-runtime matrix:

| Runtime | npm | Exact install | Type-check | Build | Runtime tests | Type tests | Examples | Exports | Audit | Package dry-run |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Node `24.2.0` | `11.3.0` | passed | passed | passed | 47/47 passed | passed | 15 passed | passed | 0 vulnerabilities | 76 files passed |
| Node `26.5.0` | `11.17.0` | passed | passed | passed | 47/47 passed | passed | 15 passed | passed | 0 vulnerabilities | 76 files passed |

The matrix ran in exact official Node container images with the repository root mounted so canonical contract inputs remained available. An initial Node 24 package-only mount failed before build because repository-level contract paths were unavailable; no support claim uses that invalid probe. The corrected full-repository run passed every recorded stage.

## Dependency and audit inventory

- Runtime dependencies: required to remain exactly zero.
- Exact direct development dependencies and purposes: `DEPENDENCIES.md`.
- Lockfile: version 3 with exact integrity-bound graph.
- `npm audit --audit-level=low`: passed with 0 vulnerabilities on canonical Node 26 and both exact-runtime matrix runs.
- License metadata check for installed development graph: passed for all 9 locked installed development packages.

Development tools do not become runtime capabilities.

## Package-content inventory

The package remains `private: true` and must not be published. The intentional dry-run top-level content is restricted to:

- built ESM/declaration/source-map output and required standalone validator under `dist/`;
- consumer documentation (`README.md`, `API.md`, `SECURITY.md`, `MIGRATION.md`, `DEPENDENCIES.md`);
- machine-readable compatibility and contract provenance;
- compilable synthetic TypeScript examples;
- npm-required `package.json`.

Tests, source, scripts, ADRs, build/test caches, tarballs, OpenSpec/governance material, canonical contract source copies, local paths, secrets, and machine-specific evidence are absent. `npm pack --dry-run --json` reported 76 intentional files, a 101,776-byte tarball, and 735,371 unpacked bytes. The command was a dry run; nothing was published.

## Compatibility evidence

- Contract support range: exactly `1.0.0` to `1.0.0`.
- Unsupported versions `0.9.0` and `2.0.0` are negative runtime checks and must fail with `SDK_UNSUPPORTED_CONTRACT_VERSION`.
- Node support: exactly majors 24 and 26; pinned evidence versions `24.2.0` and `26.5.0`.
- TypeScript: `>=5.9.2 <6`, pinned compiler `5.9.2`.
- Public ESM exports: `.` and `./testing`.
- Runtime dependencies: zero.
- Manifest: `packages/security-audit-sdk-core/compatibility.json`.
- Migration policy: `packages/security-audit-sdk-core/MIGRATION.md`.

Compatibility claims must remain machine-checked and do not imply that a future package version is compatible.

## Unresolved production decisions

No decision has been made for:

- production sink/transport technology or operational behavior;
- collector, queue/outbox, retry, durable acceptance, storage, retention, or SIEM integration;
- framework adapters or application instrumentation;
- fail-open/fail-closed application policy;
- real-user-data privacy/legal approval;
- browser telemetry;
- analytics/detection or cryptographic integrity/chaining;
- package license, publication, release version, or support commitment.

Each requires separate scope, evidence, and approval.

## Authorization limitations

The final production-scope scan passed across 16 SDK source files: only the approved `node:async_hooks` and `node:crypto` runtime imports were present, runtime dependencies remained zero, and no framework, transport/exporter, collector, broker/queue/outbox, storage/SIEM, analytics/detection, browser telemetry, production instrumentation, diagnostic logging, or cryptographic-chain implementation was found. Contract immutability also passed with no changes under the approved contract capability, archived contract change, or canonical contract artifacts.

The review target is only an isolated package candidate. The following remain explicitly not authorized:

- production deployment;
- production event collection;
- real-user data processing;
- framework instrumentation;
- production transports, exporters, collectors, queues, outboxes, storage, or SIEM integration;
- test sinks in production;
- browser telemetry.

Sink success is not durable delivery. Contract/schema validity, transport integrity, or cryptographic integrity does not prove producer truthfulness.

## Exact-commit decision record — leave pending

| Decision field | Value |
| --- | --- |
| Exact reviewed SDK commit | `PENDING` |
| Reviewer/project owner | `PENDING` |
| Review date | `PENDING` |
| Technical implementation accepted as isolated candidate | `PENDING` |
| Contract change approved | `NOT APPLICABLE / NOT REQUESTED` |
| Package release approved | `PENDING` |
| Production deployment approved | `NO — NOT AUTHORIZED` |
| Production collection approved | `NO — NOT AUTHORIZED` |
| Real-user processing approved | `NO — NOT AUTHORIZED` |
| Merge approved | `PENDING` |
| Archive approved | `PENDING` |
| Review feedback/evidence reference | `PENDING` |

Do not replace any pending decision based on technical verification alone. After the final technical commit exists, update this packet in a separate governance step, bind review to that exact commit, and obtain an explicit project-owner decision before merge or archive.
