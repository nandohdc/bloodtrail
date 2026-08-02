# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

Bloodtrail is currently a **governance-bound design repository**, not a running application. There is no root `package.json`, no service, no deployable artifact. It contains three isolated units, each authorized by a separate OpenSpec change:

| Path | Unit | Authorization status |
| --- | --- | --- |
| `contracts/security-audit/` | Canonical Security Audit Event Contract 1.0.0 (source of truth for everything else) | Approved design basis; development-only artifacts |
| `packages/security-audit-sdk-core/` | `@bloodtrail/security-audit-sdk-core` — ESM TypeScript SDK core that builds/validates contract events | Isolated candidate; private, unpublished, **no production authorization** |
| `research/browser-telemetry/` | FingerprintJS/BotD reproducibility harness + sanitized evidence | Research-only; decision is **DEFER — no adoption**; no real-user collection |
| `openspec/` | Spec-driven planning (`specs/` = canonical capabilities, `changes/archive/` = completed changes) | — |

Each unit has its own `package.json`, lockfile, and `node_modules`. Always run npm commands from inside the unit directory (or with `--prefix`).

The READMEs are dense and normative — read the relevant one before changing anything in a unit. `contracts/security-audit/README.md` and every file under `contracts/security-audit/docs/`, `adr/`, `schema/`, `catalog/`, `registries/`, `policies/`, `examples/`, `fixtures/` are **generated**; do not hand-edit them.

## Commands

`node_modules` is not checked in for the contract or SDK units; run `npm ci` first.

### contracts/security-audit (Node >= 26.5.0)

```sh
npm ci --prefix contracts/security-audit
npm run generate --prefix contracts/security-audit        # regenerate all artifacts from source/contract.source.json
npm run check:generated --prefix contracts/security-audit # byte-for-byte drift check
npm run validate --prefix contracts/security-audit        # validate-contract.mjs --all + tests
node --test tests/contract.test.mjs                       # single test file (from the unit directory)
```

### packages/security-audit-sdk-core (Node 24.x or 26.x only; TypeScript pinned to 5.9.2)

```sh
cd packages/security-audit-sdk-core
npm ci
npm run build          # clean + generate + tsc -p tsconfig.build.json + copy standalone validator
npm run typecheck      # strict tsc --noEmit over src
npm test               # build + compile tests + node --test dist-tests/**/*.test.js
npm run test:types     # compile-time positive/negative API assertions (tests/types)
npm run test:examples  # compiles and executes examples/scenarios.ts
```

Tests import from `../dist/*.js`, so a build must precede them. To run one test file or one test:

```sh
npm run build && npx tsc -p tsconfig.test.json
node --test dist-tests/pass2.test.js
node --test --test-name-pattern "tenant scenario" dist-tests/pass2.test.js
```

`npm run validate` (all checks) and `npm run verify` (`scripts/verify-all.mjs`, the documented canonical entry point) additionally wipe `node_modules`, reinstall from the lockfile, and run the guardrail scripts below. **Both currently fail**: `check-coherence.mjs` and the strict-OpenSpec step still point at `openspec/changes/implement-security-audit-sdk-core/`, which was archived in commit `482bc95`. Until those scripts are updated for archived mode (`check-changed-paths.mjs` already handles it), run the individual `test:*` scripts you need instead of `verify`.

### research/browser-telemetry (Node >= 26.5.0)

```sh
cd research/browser-telemetry
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
npm ci --ignore-scripts        # --ignore-scripts is deliberate
npm run lint                   # scripts/check-syntax.mjs — this is the whole lint story
npm test                       # node --test tests/*.test.mjs
npm run test:egress            # single test file
npm run poc                    # full PoC (needs a real Chrome); poc:headless for non-GUI
npm run poc -- --only headless_chrome_basic_stealth
```

Do not overwrite `evidence/baseline-2026-07-30.sanitized.json` or anything else under `evidence/`; the sanitize/validate scripts intentionally refuse to overwrite.

### OpenSpec

```sh
openspec list            # active changes
openspec list --specs    # canonical capabilities
openspec validate --all --strict   # repository-level canonical planning check
```

`.hermes/skills/openspec-*/SKILL.md` define the workflow slash commands (`openspec-propose`, `openspec-apply-change`, `openspec-archive-change`, …). New work goes through a change (proposal → specs delta → design → tasks → apply → archive) before implementation.

### CI

`.github/workflows/ci.yml` only exercises `research/browser-telemetry` (reusable `nandohdc/gh-pipelines` Node workflow: lint, test, `npm audit --audit-level=high`) plus a SonarQube scan and quality gate scoped to that directory (`sonar.projectKey=nandohdc_bloodtrail_e3ef77af-1937-442c-b4f1-4fea5eeada74`). Coverage gating is deferred (`coverage-min: 0`). The contract and SDK units are verified locally, not in CI.

## Architecture

### One source of truth, two generation stages

```
contracts/security-audit/source/contract.source.json
  └─ contracts/.../scripts/generate-artifacts.mjs
       → schema/ catalog/ registries/ policies/ docs/ adr/ examples/ fixtures/ README.md
  └─ packages/.../scripts/generate-contract.mjs
       → src/generated/contract.generated.ts          (types, EVENT_CATALOG, EVENT_METHODS, FIELD_POLICY, REGISTRIES)
       → src/generated/schema-validator.generated.cjs (standalone Ajv 2020-12 validator, CJS by design)
```

Both stages are deterministic and have a `--check` drift mode. Never hand-edit generated output; change `contract.source.json` and regenerate — and note that changing the contract requires its own governance (the SDK is pinned to normative contract commit `8c5992bb6edc5c6dfdbfd0f48988b32f88ad2993` via `contract-provenance.json`, and `check-contract-immutability.mjs` enforces it).

The 24 catalog events drive everything downstream: the 24 named SDK methods, their required context, lifecycle phases, outcomes, commit states, and minimum delivery class. Adding an event means editing the source contract, not the SDK.

### SDK runtime pipeline

`sdk.ts` (`createSecurityAuditSdk`) is the only entry point. A named method call flows:

1. `config.ts` — configuration was validated, cloned, normalized and deep-frozen at construction; it can never be replaced afterwards.
2. `context.ts` — `AsyncLocalStorage` frame merged with the explicit input. Authority context objects (`authoritativeActor`, `authoritativeTenant`, …) carry **runtime brands**; plain objects and TypeScript casts are rejected, so authority cannot be forged inside the process.
3. `events.ts` — `buildNamedAuditEvent` derives canonical identity/delivery class from the generated catalog, applies field-scoped transformation hooks, and enforces lifecycle/commit/causality rules.
4. `validation/index.ts` — prohibited-data scan → standalone schema validation → semantic validation → prohibited-data rescan.
5. `sink.ts` — the frozen event goes to `AuditEventSink.emit()`, which returns only `accepted` / `rejected` / `unknown`. The core has no transport, retry, queue, or durability.

Expected failures are returned as `AuditResult` values with bounded, secret-free codes and paths (`errors.ts`); only initialization misuse throws (`SecurityAuditSdkError`). Public exports are exactly what `src/index.ts` and `src/testing.ts` re-export; `src/internal.ts`, `src/validation/`, and `src/generated/` are not reachable subpaths.

### Guardrail scripts (packages/security-audit-sdk-core/scripts/)

These enforce the authorization boundary mechanically and will fail on changes that look harmless:

- `check-scope.mjs` — SDK `src/` may import only `node:async_hooks` and `node:crypto`. No `fetch`, `console.*`, DOM/browser globals, filesystem, or any third-party package. `dependencies` must stay empty. Filenames containing `transport`, `exporter`, `collector`, `browser`, `telemetry`, `middleware`, framework names, etc. are rejected.
- `check-changed-paths.mjs` — diffs against the `proposalBaseline` commit in `contract-provenance.json` and rejects any changed path outside the SDK package and its OpenSpec change. `contracts/security-audit/` and the archived contract change are protected.
- `check-git-state.mjs` — trailing whitespace, CR bytes, missing final newline, and a non-empty Git index all fail. Run verification *before* staging.
- `check-coherence.mjs` — cross-checks hard-coded invariants (24 events, 0 runtime deps, Node 24/26, TS 5.9.2, exports `.` and `./testing`, 15 scenarios, 106 tasks) across README, API.md, `compatibility.json`, and the OpenSpec change docs. Any doc/code divergence fails.
- `check-exports.mjs`, `check-compatibility.mjs`, `check-dependencies.mjs`, `check-package-contents.mjs` — export map, compatibility manifest, exact dev-dependency pinning, `npm pack` file allowlist.

## Boundaries to respect

- Nothing here is authorized for production, real-user data, framework instrumentation, transports/collectors/SIEM integration, analytics, browser telemetry, or cryptographic audit-log chaining. Adding any of those requires a new reviewed OpenSpec change, not an inline edit.
- The SDK implements contract `1.0.0` exactly; unsupported versions must fail safely rather than degrade.
- Test sinks (`createCapturingAuditSink`, `createInMemoryAuditSink`) are development-only and perform no I/O.
- Governance and review records (`reviews/`, `openspec/changes/archive/`) are historical evidence bound to specific commits — do not rewrite them to match new work.
