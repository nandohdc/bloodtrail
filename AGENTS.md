# Repository Guidelines

## Project Structure & Module Organization

Bloodtrail is organized as independent, governance-bound units rather than one root application. `contracts/security-audit/` contains the canonical event contract; edit `source/contract.source.json`, then regenerate its schema, catalog, policies, examples, and documentation. `packages/security-audit-sdk-core/` is the strict ESM TypeScript SDK, with code in `src/`, tests in `tests/`, examples in `examples/`, and generated bindings in `src/generated/`. `research/browser-telemetry/` contains the isolated browser PoC, tests, and sanitized evidence. `openspec/specs/` holds current capability specifications; `openspec/changes/` records proposed and archived work.

Each unit owns its `package.json` and lockfile; there is no root npm workspace. Do not hand-edit generated contract artifacts, SDK generated files, archived governance records, or committed evidence baselines.

## Build, Test, and Development Commands

Use Node 26.5+ for the contract and research units; the SDK supports Node 24 or 26.

```sh
npm ci --prefix contracts/security-audit
npm run validate --prefix contracts/security-audit
npm ci --prefix packages/security-audit-sdk-core
npm run build --prefix packages/security-audit-sdk-core
npm run verify --prefix packages/security-audit-sdk-core
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --ignore-scripts --prefix research/browser-telemetry
npm run lint --prefix research/browser-telemetry
npm test --prefix research/browser-telemetry
openspec validate --all --strict
```

`validate` checks contract artifacts and tests. SDK `verify` is the comprehensive generation, type, runtime, package, dependency, and governance check. CI currently exercises the research unit, so validate contract and SDK changes locally.

## Coding Style & Naming Conventions

Use two-space indentation and ES modules. TypeScript is strict; preserve `.js` import suffixes, explicit types at public boundaries, and existing `readonly` usage. Follow the surrounding unit’s quote and semicolon style. Use `camelCase` for functions and variables, `PascalCase` for types, kebab-case for change directories, and canonical dotted event names such as `bloodtrail.audit.authentication.succeeded`.

## Testing Guidelines

Tests use Node’s built-in `node:test` and are named `*.test.ts` or `*.test.mjs`. Add focused positive and failure-path coverage for behavioral changes. Build the SDK before running compiled tests. There is currently no numeric coverage threshold; passing the relevant unit’s full validation is the acceptance baseline.

## Commit & Pull Request Guidelines

Follow Conventional Commits seen in history: `feat(sdk): ...`, `fix(verification): ...`, or `docs(openspec): ...`. Keep commits scoped and imperative. Pull requests should link the governing issue/OpenSpec change, describe authorization and security boundaries, list exact validation commands, and call out generated artifacts. Include screenshots only for browser PoC changes, and never include secrets, raw user telemetry, or unsanitized evidence.
