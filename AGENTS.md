# Repository Guidelines

## Project Structure & Module Organization

This repository has no root `package.json`; run npm commands within a workspace or use `--prefix`.

- `contracts/security-audit/`: frozen contract. `source/contract.source.json` is authoritative; `catalog/`, `registries/`, `policies/`, `docs/`, and `adr/` are generated.
- `packages/security-audit-sdk-core/`: strict ESM TypeScript SDK. Source is in `src/`, tests in `tests/`, and build output in `dist/`.
- `research/browser-telemetry/`: isolated research harness, tests, evidence, and reviews—not production code.
- `openspec/`: current specs, active changes, governance rules, and governance tests.
- `.github/`: CI workflows, contribution automation, and the required PR template.

## Build, Test, and Development Commands

- **Product test loop (~18s across all three workspaces — use during active development):**
  - `npm run test:matrix --prefix packages/security-audit-sdk-core`: fast SDK product test loop (~14.6s cold, ~9.2s runtime warm) across its matrix-safe checks.
  - `npm run validate --prefix contracts/security-audit`: validate generated contract artifacts and contract tests (~1.5s).
  - `npm run lint --prefix research/browser-telemetry && npm test --prefix research/browser-telemetry`: check the research harness (~15s).
- **Full governance-gate chains (~291s — run before pushing):**
  - `npm run validate --prefix packages/security-audit-sdk-core`: complete SDK validation chain. Dominant cost (~254s) is `test:verification` (mutation testing proving governance gates fail closed, not product test assertions).
  - `npm run validate --prefix contracts/security-audit`: validate generated contract artifacts and contract tests.
- `npx --yes @fission-ai/openspec@latest validate --all --strict`: validate OpenSpec changes and specs.
- `git diff --check`: catch trailing whitespace and malformed patch whitespace before committing.

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

Engineering work is tracked in Hermes Kanban on the `bloodtrail` board.
GitHub Issues remain an external intake surface only.
See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles map onto Hermes Kanban statuses and typed
block kinds, not label strings.
See `docs/agents/triage-labels.md`.

### Domain docs

Domain documentation uses a multi-context layout with a root `CONTEXT-MAP.md`,
per-context `CONTEXT.md` files, and scoped ADR directories.
See `docs/agents/domain.md`.
