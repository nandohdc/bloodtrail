# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A contract-bound security audit event system: one canonical event contract (`contracts/security-audit/`, version `1.0.0`, frozen) plus a framework-independent TypeScript SDK core (`packages/security-audit-sdk-core/`) whose types, constants, catalog, and schema validator are **generated** from the contract.

The contract is the product; the SDK is a projection of it. Two boundaries govern everything:

- **Authorization boundary.** The SDK is an isolated technical candidate. Production deployment, real-user data, framework instrumentation, transports, exporters, collectors, queues, outboxes, storage, SIEM integration, analytics, detection, browser telemetry, and cryptographic audit-log chaining are all **unauthorized**. Only a transport-neutral sink interface and non-production test sinks exist. None of these may be added incidentally alongside another change — each needs its own OpenSpec change and explicit authorization. `test:scope` enforces this mechanically.
- **Canonical boundary.** Bloodtrail is canonical. OCSF 1.8.0 is export-only, OpenTelemetry 1.59.0 / SemConv 1.43.0 are transport-only, CloudEvents 1.0.2 is optional-envelope-only. No external standard may redefine event identity, actor, tenancy, resource ownership, authorization decision, outcome, delivery class, or schema version.

## Workspaces and commands

**There is no root `package.json`.** Every workspace is standalone — always use `--prefix` or `cd` into the package.

| Workspace | Node engines | Purpose |
|---|---|---|
| `packages/security-audit-sdk-core/` | `>=24 <25 \|\| >=26 <27` | the SDK (`@bloodtrail/security-audit-sdk-core`, private, `UNLICENSED`, never published) |
| `contracts/security-audit/` | `>=26.5.0` | the canonical contract, frozen at `1.0.0` |
| `research/browser-telemetry/` | `>=26.5.0` | isolated investigation, not shipping code |

```bash
# Full gate chains — run both before pushing
npm run validate --prefix packages/security-audit-sdk-core
npm run validate --prefix contracts/security-audit

# Matrix-safe subset (no git/package/coherence gates) — use when running across Node majors
npm run test:matrix --prefix packages/security-audit-sdk-core

# Canonical verification: wipes node_modules, npm ci, every gate, plus strict OpenSpec validation.
# Heavier than `validate` and needs the `openspec` CLI on PATH.
npm run verify --prefix packages/security-audit-sdk-core
```

There is **no ESLint or Prettier** anywhere. `lint` exists only in `research/browser-telemetry` and is a syntax check. Strict `tsc`, SonarQube, and CodeScene serve the linter's role.

### Running one test

```bash
cd packages/security-audit-sdk-core

# Runtime tests: TypeScript in tests/*.test.ts, compiled into dist-tests/ before running
npm run build && npx tsc -p tsconfig.test.json
node --test dist-tests/f08-retention.test.js

# Verification tests: plain .mjs, run directly from source
node --test tests/verification/f08-mutations.test.mjs

# Type tests are compile-only (positive and negative assertions)
npm run test:types
```

Verification tests **must operate on a disposable clone** via `tests/verification/disposable-git.mjs`, never on the live tree. Sibling test files snapshot the live package in parallel, so a write to the working tree corrupts *other* test files, not just the one doing the writing.

### Targeted gates (all `--prefix packages/security-audit-sdk-core`)

| Script | Enforces |
|---|---|
| `check:generated` | `src/generated/` matches the contract byte-for-byte; regenerate with `npm run generate` |
| `test:scope` | the authorization boundary — forbidden filenames, imports, exports, and undeclared platform coupling |
| `test:contract-immutability` | the frozen contract was not mutated |
| `test:compatibility` | `compatibility.json` still holds, including the pinned toolchain |
| `test:coherence` | package identity, version, engines, event counts, and consumer docs all agree |
| `test:changed-paths` | lifecycle-aware staged scope (see below) |
| `test:git` | whitespace, final newlines, and an empty Git index |
| `test:verification` | the mutation/evidence suite in `tests/verification/` |

## Architecture

### Generation pipeline

```
contracts/security-audit/source/contract.source.json      ← single source of truth
  ├─ scripts/generate-artifacts.mjs → catalog/ registries/ policies/ docs/ adr/ schema/
  └─ packages/security-audit-sdk-core/scripts/generate-contract.mjs
       ├─ src/generated/contract.generated.ts          types, EVENT_CATALOG, EVENT_METHODS,
       │                                               FIELD_POLICY, REGISTRIES, error codes
       └─ src/generated/schema-validator.generated.cjs standalone Ajv 2020 validator (CJS)
```

**Never hand-edit generated output.** The fix is always in the generator, never in its output. `check:generated` compares byte-for-byte, and generation must stay deterministic and locale-independent (the generators sort by code point deliberately, not `localeCompare`).

### SDK runtime flow

`src/sdk.ts` exposes 24 named event methods, one per catalog entry, all funnelling into `#emitNamed`:

1. **Lifecycle guard** — the SDK is `ready` / `shutting_down` / `shut_down`; anything but `ready` fails immediately.
2. **Operation resolution** (`src/operations.ts`) — an `AuditOperationHandle` is an opaque frozen object; its real state lives in a module-private `WeakMap` keyed by handle identity, so a cast or hand-rolled object cannot forge one. Handles carry commit-state transitions (`markCommitted`, `markCompensated`, …) and a reserve/complete/release protocol that makes duplicate terminal-success emission impossible.
3. **Event construction** (`src/events.ts`) — merges the configured authoritative context, the ambient `AsyncLocalStorage` frame, and per-call input; derives name/category/action/lifecycle/outcome/commit-state/delivery-class from the catalog definition; applies registered field-transformation hooks; validates; deep-freezes.
4. **Validation** (`src/validation/`) — normalize (`structuredClone` + JSON round-trip, rejecting non-plain prototypes, getters, cycles, functions, symbols, BigInt) → prohibited-data scan → generated-Ajv structural check → semantic check (tenant-scope policy, causality, authority rules) → post-transformation rescan.
5. **Sink handoff** (`src/sink.ts`) — a bare `emit`/`flush?`/`shutdown?` interface. In-flight promises are tracked so `shutdown()` can drain them under a timeout.

### Invariants to preserve when editing

- **Results, not exceptions.** The public API returns `AuditResult<T>` (`{ ok: true, value }` | `{ ok: false, error }`) and never throws across the boundary. The single exception is configuration: `createSecurityAuditSdk` throws `SecurityAuditSdkError` at construction. Errors are safe by construction — code, category, and a bounded path only, never caller data.
- **Unforgeable authority.** `src/context.ts` brands values (`authoritativeActor`, `claimedTenant`, `sessionEvidence`, …) through a module-private `WeakMap` registry, not symbols — `structuredClone` silently drops non-enumerable symbols, which is why the earlier approach was abandoned. Only the constructors in that file can insert registry entries. Client-supplied claims must stay type-distinguishable from server-authoritative values.
- **No premature success.** Terminal commit states may only originate from a real operation snapshot; a caller cannot pass `event.commit_state: "committed"` without having transitioned a handle.
- **Zero runtime dependencies.** `node:async_hooks` and `node:crypto` are the only permitted non-relative imports in `src/`. `dependencies`, `peerDependencies`, and `optionalDependencies` must stay empty.

## Gates that will bite you

**`test:changed-paths` is lifecycle-aware.** It reads `packages/security-audit-sdk-core/verification-lifecycle.json`, which names the governed OpenSpec change, its `proposalBaseline` commit, and protected prefixes. Mode auto-resolves to `active` when the change directory exists and `archived` when exactly one dated archive does; override with `SDK_VERIFICATION_MODE` / `SDK_VERIFICATION_CHANGE` or `--mode` / `--change`. Consequences:

- Writes to `contracts/security-audit/`, `openspec/specs/security-audit-event-contract/`, or the archived contract change are rejected outright.
- `openspec/specs/security-audit-sdk-core/` may change only in `archived` mode — that is, through archiving, not by hand.
- **A new, uncommitted file under `src/` fails the gate** unless its exact path is listed in `ownership.reviewedNewSdkSourcePaths` in `verification-lifecycle.json`.

**`test:git` requires an empty Git index.** Verification runs *before* `git add`, not after. It also rejects a missing final newline, any CR byte, and any trailing whitespace in every file changed since the baseline — including new Markdown, YAML, and JSON. A stray trailing space fails CI.

**`validate` runs `generate` first**, which rewrites `src/generated/` and would mask committed drift. Run `check:generated` *before* `validate` to catch it, exactly as CI does.

**`test:coherence` pins constants** — package name and version, Node engines, TypeScript range, catalog counts, task counts. Changing one of them means updating `compatibility.json` and `verification-lifecycle.json` in the same change.

**CodeScene cannot see `readonly` parameters.** CLI 1.0.37 silently skips any function whose parameter list uses the `readonly` type modifier (`tags: readonly string[]`), so such a function is never scored and never reaches the gate regardless of its complexity. `ReadonlyArray<T>` is analysed normally, and `readonly` inside an interface is unaffected. SonarQube does flag this code — treat the two analysers as complementary. Do not read a green `codescene delta` as proof a function is healthy.

## Workflow

**Changes go through OpenSpec, not straight to code.** Use the `openspec-*` skills rather than editing change directories by hand: `openspec-propose` / `openspec-new-change` to start, `openspec-continue-change` / `openspec-update-change` / `openspec-apply-change` to work it, `openspec-verify-change` before commit, `openspec-archive-change` / `openspec-sync-specs` to land it. `openspec/specs/<capability>/spec.md` states what the system must do; a change's `specs/` entries are **deltas**, not replacements.

Task groups in an active change must complete in order — `check-coherence` rejects starting a later group early, and merge/archive tasks must remain unchecked while the change is active.

The skill directories `.claude/skills/`, `.agents/skills/`, and `.hermes/skills/` are per-tool copies generated by the `openspec` CLI. Regenerate with `openspec update`; do not hand-edit them.

**Commits.** Conventional Commits, validated on the PR title *and every commit subject* in the PR. Allowed types: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `security`, `style`, `test`. Use separate commits for proposal, implementation, and archive — never mixed. Stage an explicit allowlist; leave unrelated untracked files alone. Run read-only semantic verification *before* committing, and do not regenerate, reformat, or rerun tests on an already-verified candidate.

**Branches.** Rebase, never `git merge main` into a PR branch — a `Merge branch 'main' into …` subject has no exemption from the conventional-commits check and blocks the PR. The exception is a branch under concurrent automation, where rebasing rewrites history beneath the other writer; prefer pausing the automation and rebasing once idle. For stacked PRs, retarget B onto `main` **before** merging or deleting A's branch: squash-merging A and deleting its branch closes B outright rather than retargeting it.

`main` is protected, but only by required status checks: there is no CODEOWNERS file and
`required_pull_request_reviews` is null, so `reviewDecision` is empty on every PR and GitHub
supplies no approval gate. `enforce_admins` is false, so PRs land with `gh pr merge --admin`.
That flag bypasses nothing but the checks' blocking effect — never treat it as a substitute for
the checks themselves being green. Review is a human and process obligation that GitHub does not
enforce here. **AI review is not approval**; bind formal reviews to the exact reviewed commit hash.

## CI

`.github/workflows/ci.yml` runs on pushes to `main` and on every PR. Branch protection requires **nine** contexts to merge: `ci / lint`, `ci / test`, `ci / audit` (research), `sdk`, `contract`, `sonar`, `conventional-commits`, `codescene delta`, and `design-pattern-governance`. Not required: `coverage`, the CodeScene App's own Check Run (its context name varies by base branch), and `release-please`. Count the reported contexts against that nine rather than trusting an empty pending list: `gh pr checks --required` lists only contexts that have reported, so a check that never started is invisible there.

A red `sonar` is more often the self-hosted server than the code — the job already retries once after a 30s wait, and its "Explain quality gate failure" step prints the failing conditions so triage does not need the dashboard.

Releases are managed by Release Please from Conventional Commits. A release versions `version.txt` and a `vX.Y.Z` tag only: **no package is ever published**, no `package.json` version moves, and a tag does not lift the authorization boundary. See `RELEASING.md`.

## Related documents

`README.md` (boundaries, gates, CI) · `CONTRIBUTING.md` (workflow, commits, branch mechanics) · `RELEASING.md` · `SECURITY.md` · `packages/security-audit-sdk-core/{API,SECURITY,MIGRATION}.md` · `.hermes.md` (the agent working agreement this file overlaps — keep the two consistent).

## Agent skills

### Issue tracker

Engineering work is tracked in Hermes Kanban on the `bloodtrail` board; GitHub Issues
remain an external intake surface only. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles map onto Hermes Kanban statuses and typed block kinds,
not label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Domain documentation uses a multi-context layout with a root `CONTEXT-MAP.md`, per-context `CONTEXT.md` files, and scoped ADR directories. See `docs/agents/domain.md`.
