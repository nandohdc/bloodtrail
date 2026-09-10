# Repository Guidelines

## Project Structure & Module Organization

This repository has no root `package.json`; run npm commands within a workspace or use `--prefix`.

- `contracts/security-audit/`: frozen contract. `source/contract.source.json` is authoritative; `catalog/`, `registries/`, `policies/`, `docs/`, and `adr/` are generated.
- `packages/security-audit-sdk-core/`: strict ESM TypeScript SDK. Source is in `src/`, tests in `tests/`, and build output in `dist/`.
- `research/browser-telemetry/`: isolated research harness, tests, evidence, and reviews—not production code.
- `openspec/`: current specs, active changes, governance rules, and governance tests.
- `.github/`: CI workflows, contribution automation, and the required PR template.

## Build, Test, and Development Commands

- **Product test loop (~45s local across all five workspaces — use during active development):**
  - `make` (or `make test` / `make runtime-gates`): bare root entry point running the loop across every declared workspace. `.github/scripts/check-package-discovery.mjs` asserts the recipe actually invokes each one, so a package cannot be silently skipped (#412).
  - `npm run test:matrix --prefix packages/security-audit-sdk-core`: fast SDK core product test loop (~25s local) across its matrix-safe checks (or `make sdk`, ~40s local).
  - `npm run validate --prefix packages/security-audit-sdk-node`: typecheck, build, tests, scope, frozen exports, dependencies, and package contents for the Node binding.
  - `npm run validate --prefix packages/security-audit-collector`: generated-artifact drift, tests, scope, dependencies, and package contents for the collector.
  - `npm run validate --prefix contracts/security-audit`: validate generated contract artifacts and contract tests (~1s local) (or `make contract`).
  - `npm run lint --prefix research/browser-telemetry && npm test --prefix research/browser-telemetry`: check the research harness (~3s local) (or `make research`).
- **Full governance-gate chains (~13-20min local across all five workspaces — run before pushing):**
  - `make governance-gates`: runs full validation across every declared workspace (states cost upfront before executing).
  - `npm run validate --prefix packages/security-audit-sdk-core`: complete SDK core validation chain (~12-20min on its own). 94-95% of it is `test:verification` (mutation testing proving governance gates fail closed, not product test assertions).
  - `npm run validate --prefix packages/security-audit-sdk-node`: Node binding validation chain, including the frozen-export check.
  - `npm run validate --prefix packages/security-audit-collector`: collector validation chain, including generated-artifact drift.
  - `npm run validate --prefix contracts/security-audit`: validate generated contract artifacts and contract tests.
- `npx --yes @fission-ai/openspec@latest validate --all --strict`: validate OpenSpec changes and specs.
- `git diff --check`: catch trailing whitespace and malformed patch whitespace before committing.

**Every figure above is a measurement, not a threshold.** The local ones were taken on 2026-09-10
with `time make <target>` on an Apple Silicon workstation (Darwin arm64, node v26.8.1, npm 11.19.0),
warm, with dependencies installed. Re-derive a local figure the same way. Re-derive a CI figure from
the interval between one npm script's banner and the next in the job log — the job's own step timing
also covers checkout, `npm ci` and the matrix legs, which is why the `sdk` job total and the step
total disagree so widely.

The spread is large and is not noise to average away. `test:verification` measured 258s, 301s, 321s,
344s, 681s, 1022s and 1234s across seven consecutive green `main` runs of unchanged code (runs
`34478007327`, `34436080971`, `34440060205`, `34437677579`, `34430899289`, `34426872820`,
`34479556234`), and 700s to 1164s locally in one afternoon. The cause is runner shape — the scanner
reports `Available processors: 2` — and it is #306, not the code under test. Use these numbers to
decide whether to run a chain before pushing. Never as a service level, and never to estimate CI
wall-clock from a local run.

Use Node 24 or 26 for the SDK; the contract and research workspaces require Node `>=26.5.0`. Install dependencies independently with `npm ci --prefix <workspace>`.

## Coding Style & Naming Conventions

Follow existing two-space indentation, semicolons, and quoted imports. TypeScript is strict ESM; include explicit `.js` extensions in relative imports. Use `camelCase` for values/functions, `PascalCase` for types/classes, and descriptive kebab-case OpenSpec change IDs. Never hand-edit `src/generated/` or generated contract directories; change the canonical source or generator, then run `npm run generate`.

## Testing Guidelines

Tests use Node's built-in `node:test`. Name runtime tests `*.test.ts` in the SDK and `*.test.mjs` elsewhere. Add focused regression coverage beside the affected workspace and run its full validation command. CI also records coverage via each workspace's `test:coverage` script.

## Commit & Pull Request Guidelines

Use Conventional Commits: `type(scope): description`, for example `fix(sdk): reject reused operation IDs (#42)`. Allowed types include `feat`, `fix`, `docs`, `test`, `refactor`, `security`, `ci`, and `chore`. Rebase feature branches onto `origin/main`; do not merge `main` into them.

Changes begin with an owning OpenSpec change. Complete every section of `.github/PULL_REQUEST_TEMPLATE.md`, link the issue/change, describe behavior and governance classification, and list exact verification results. Include screenshots only when visual or browser-research output changes. Required CI checks must pass before merge.

### Batching Routine Documentation Updates

`AGENTS.md`, `CLAUDE.md`, `.hermes.md`, and `CONTRIBUTING.md` are classified as `governance_core`. Touching any of them triggers `governance_core_path` and forces a full OpenSpec assessment with 15-dimension security justifications. Never touch these paths incidentally alongside an unrelated bounded change (such as an SDK bugfix or test helper). Routine documentation corrections must be deferred and batched into periodic documentation-only changes to keep bounded changes on the lightweight/abbreviated assessment path.

## Agent skills

### Issue tracker

Engineering work is tracked in **GitHub Issues**. Hermes Kanban is retained for
fleet runs but is not authoritative for execution state — do not read the board
to decide what is done.
See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles are GitHub labels of the same name:
`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`.
See `docs/agents/triage-labels.md`.

### Domain docs

Domain documentation uses a multi-context layout with a root `CONTEXT-MAP.md`,
per-context `CONTEXT.md` files, and scoped ADR directories.
See `docs/agents/domain.md`.
