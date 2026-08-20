# Issue #69 — Reject Undeclared Runtime Imports in the Dependency Gate — Implementation Plan

> **For Hermes:** Execute with the `openspec-propose` / `openspec-apply-change` /
> `openspec-verify-change` / `openspec-sync-specs` / `openspec-archive-change` skills. This is a
> governed SDK implementation change with a canonical capability requirement, so it rides a full
> assessment — but **no signed governance record and no owner exact-commit approval are required**
> (F10). TDD is load-bearing: PLAN-074 and this repository's own precedent say a gate nobody proved
> can fail is a gate that never fired. Verify read-only with an empty index before every commit.
> Do NOT merge — the owner merges.

**Goal:** Make `npm run test:dependencies` inspect the module specifiers of every shipped artifact
and fail closed on anything not provably permitted — undeclared externals, dynamic specifiers, and
unclassifiable import forms — while the current approved output continues to pass.

**Architecture:** One new module, `packages/security-audit-sdk-core/scripts/shipped-import-policy.mjs`,
performs a pure inspection: it takes the shipped-file inventory that `npm pack --dry-run --json`
already produces (the same authoritative source `check-package-contents.mjs` uses), parses each
JavaScript/TypeScript artifact with the pinned `typescript` parser, and classifies every module
specifier it finds into `internal`, `node-builtin`, `self-reference`, `declared-dependency`, or a
violation. `check-dependencies.mjs` gains one import and one call site; no new npm script, no CI
change, no CLAUDE.md change. One new verification file carries the fixtures and the deterministic
undeclared-AJV mutation. One ADDED requirement lands in the `security-audit-sdk-core` capability.

**Tech Stack:** ESM `.mjs` under `packages/security-audit-sdk-core/scripts/`, the `typescript@5.9.2`
parser (already an exact-pinned devDependency), `node --test` under `tests/verification/`,
`npm pack --dry-run`, openspec CLI 1.9.0 (verified on PATH), git + gh, Node pinned
`>=24 <25 || >=26 <27`, npm via `--prefix` only (there is no root `package.json`).

**Known pins (re-verified read-only on 2026-08-20; every anchor below was read, not assumed):**

| Role | Value |
| --- | --- |
| Landing baseline (HEAD == origin/main, clean) | `c08c45bd32473c767393c40b4a13507598fd3e6b` |
| Issue | #69, OPEN, labels `enhancement` `security-audit-sdk` `verification` `area:core` `needs-triage` |
| Dependency gate today | `packages/security-audit-sdk-core/scripts/check-dependencies.mjs`, 52 lines |
| Scope gate blind spot | `check-scope.mjs:30` (`src/generated/` skipped), `check-scope.mjs:57-66` (walks `src/` only) |
| Shipped inventory source | `check-package-contents.mjs:12-21` (`npm pack --dry-run --json`) |
| Mutation-harness precedent | `tests/verification/f10-mutations.test.mjs:70-76` |
| Build-first precedent | `tests/verification/packed-consumer-closure.test.mjs:33-35` |
| Bounded-violation precedent | `check-scope.mjs:52-54` |
| Landing-shape precedent | PRs #187 / #188 / #189 (`fd6320c`, `3f872be`, `2de6e07`, `bf42852`) |
| Lifecycle mode | `archived` (`test:changed-paths` reports it today) |
| Node / TypeScript / openspec on this workstation | v26.7.0 / 5.9.2 / 1.9.0 |

---

## Proven findings (read from source at `c08c45b`)

### F1 — The defect #69 describes is already repaired; the gate is not

#69's "Current state" section was written against `main@71dbd95` and says packed
`dist/generated/schema-validator.generated.cjs` requires AJV modules. That is no longer true. #68
landed on 2026-08-18 (`openspec/changes/archive/2026-08-18-bundle-validator-runtime-helpers/`) and
bundled the AJV runtime helper and the two ajv-formats validators into the generated artifact.
Measured at `c08c45b`: `grep -o 'require(' src/generated/schema-validator.generated.cjs | wc -l`
returns **0**, and the artifact opens with `"use strict";` followed by the MIT attribution header.

**Consequence for this change:** acceptance criterion "Approved output passes" is satisfied by
today's tree with no repair work, and this change is purely a **regression lock**. Say that plainly
in the proposal, the PR body, and the issue-closing comment. Do not describe it as fixing a live
`MODULE_NOT_FOUND`; that would misrepresent the state of the repository.

### F2 — The gate inspects manifests only, never an artifact

`check-dependencies.mjs` reads, in order: `package.json`, `package-lock.json`, `DEPENDENCIES.md`,
every installed `node_modules/*/package.json`, and `npm ls --omit=dev --all --json`. It asserts the
three runtime-dependency fields are empty in both the manifest and the lockfile root, that the four
direct devDependencies are exactly pinned and recorded, that every installed package carries
`sha512-` integrity and license metadata, and that the production tree is empty. It opens **no file
under `dist/` or `examples/`**. The issue's summary — "reports zero runtime dependencies while
generated output requires undeclared AJV modules" — is an accurate description of that gap.

### F3 — The hole is specific, and no other gate covers it

`check-scope.mjs` is the only import check in the package, and it has two boundaries that leave
shipped code unscanned:

- `check-scope.mjs:30` — `if (relativePath.startsWith("src/generated/")) continue;`. Generated
  sources are exempt from the scope gate entirely, and generated output is **exactly where the S-6
  defect lived**.
- `check-scope.mjs:57-66` — `walk()` starts at `src/` and takes `.ts` files only. The three shipped
  `examples/*.ts` files (listed in `package.json` `files`, and required by
  `check-package-contents.mjs:38-40`) are never scanned by any import check.

So the new control duplicates nothing. `test:runtime`, `test:examples`, and
`packed-consumer-closure.test.mjs` prove the current output *executes*; none of them constrains what
a future artifact is allowed to import.

### F4 — Baseline inventory: 38 code artifacts, exactly six distinct external specifiers

Measured from `npm pack --dry-run --json` at `c08c45b` (80 packed files; 17 `.js`, 1 `.cjs`,
17 `.d.ts`, 3 example `.ts`, 34 `.map`, 5 `.md`, 3 `.json`):

| Specifier | Artifact(s) | Intended class |
| --- | --- | --- |
| `node:async_hooks` | `dist/context.js` | approved builtin (SDK runtime) |
| `node:crypto` | `dist/providers.js` | approved builtin (SDK runtime) |
| `node:assert` | `examples/run.ts` | approved builtin (examples) |
| `node:timers/promises` | `examples/scenarios.ts` | approved builtin (examples) |
| `@bloodtrail/security-audit-sdk-core` | `examples/scenarios.ts`, `examples/support.ts` | self-reference to export `"."` |
| `@bloodtrail/security-audit-sdk-core/testing` | `examples/support.ts` | self-reference to export `"./testing"` |

`dist/generated/schema-validator.generated.cjs` contributes **no** specifier at all. That is the
bundled case, and it means the "a declared or bundled fixture passes" acceptance criterion is
satisfied by a real shipped artifact rather than a synthetic one. Every `.d.ts` file imports only
relatively.

### F5 — One flat allowlist cannot work; the policy is role-scoped

`examples/` legitimately imports `node:assert` and `node:timers/promises`, which the SDK runtime
must never import — CLAUDE.md and `check-scope.mjs:26` both fix the runtime set at
`node:async_hooks` and `node:crypto`. A single allowlist would either break the examples or silently
widen the SDK runtime surface. The policy therefore carries two roles:

- `dist/**` — builtins `node:async_hooks`, `node:crypto`.
- `examples/**` — builtins `node:assert`, `node:timers/promises`, plus self-reference.

**Unprefixed builtins are rejected in both roles.** A bare `crypto` resolves to a userland package
whenever one is installed under that name, so accepting it would defeat the gate. Every current
specifier already carries the `node:` prefix.

### F6 — Self-reference is a fourth class and must be verified, not exempted

`@bloodtrail/security-audit-sdk-core` and `.../testing` are self-references. Node resolves them
through the package's own `exports` map, so they are legitimate — but only for subpaths the map
actually declares. Accept a self-reference **only** when its subpath (`"."` for the bare name,
`"./x"` otherwise) is a key of `package.json.exports`. Both current uses resolve. This turns two
imports that would otherwise be an exemption into a positively verified class, and it fails closed
if someone imports `.../transport` before the export exists.

### F7 — Parse with the pinned TypeScript parser, not a regex

A regex cannot distinguish a specifier from a comment, a string, or a regex literal, and the largest
shipped artifact is a 248 KB generated CJS file made almost entirely of packed regexes — precisely
the input a text scan gets wrong. `typescript@5.9.2` is already an exactly pinned devDependency
(`package.json` devDependencies, `check-coherence.mjs:33-34` pins the range and CI version), and
`scripts/generate-contract.mjs:4-6` already imports devDependencies (`ajv`, `ajv-formats`) from a
build script, so this introduces no new dependency and no new precedent. The parser also reads the
`.ts` examples natively, which no JavaScript-only scanner would.

`test:dependencies` already requires an installed devDependency graph — it reads
`node_modules/*/package.json` and shells out to `npm ls` — so requiring `typescript` on disk adds no
new precondition.

### F8 — The fail-closed cases, named

The AST walk must treat each of these as a violation rather than as silence:

1. `import(expr)` or `require(expr)` whose argument is not a string literal (template literals
   included) — diagnostic class `dynamic-specifier`. This is the issue's "Fail closed on dynamic or
   unclassifiable external imports".
2. `require` appearing outside call position in a shipped artifact (aliasing it defeats case 1).
3. An external specifier matching no permitted class — `undeclared-external`.
4. **Zero artifacts inspected.** Mirror the existing `installedPackages > 0` assert at
   `check-dependencies.mjs:44`. `validate` and `test:matrix` both run `build` before
   `test:dependencies`, but a bare `npm run test:dependencies` does not, and a gate that passes on
   an empty inventory is worse than no gate. Follow the "run npm run build first" precedent at
   `packed-consumer-closure.test.mjs:33-35`.
5. A file the parser cannot read — treat an I/O or parse failure as a violation, never as a skip.

### F9 — Fixtures use the package-copy harness, not a disposable git clone

The `tests/verification/disposable-git.mjs` convention exists for controls that read git history.
This control reads a packed inventory, so the applicable precedent is `f10-mutations.test.mjs:70-76`:
copy the package to a temp directory with `copyPackageStable`, symlink `node_modules`, apply the
mutation, and run the real script from the copy. `npm pack --dry-run` needs no git, so the copy works
unmodified. The undeclared-AJV mutation writes `require("ajv/dist/runtime/ucs2length")` into a copied
`dist/` artifact and asserts that `node scripts/check-dependencies.mjs` exits non-zero and names both
the artifact path and the module.

The live-tree rule still holds: **the new test must not write inside the live package**. Copy first,
mutate second.

### F10 — Governance shape: full assessment, no signed record, three PRs

- `packages/` is `governed_implementation` and `openspec/specs/` is a normative path
  (`design-pattern-policy.json`), so every new file needs an entry in the change's `owned_paths`.
- Adding a requirement to `openspec/specs/security-audit-sdk-core/spec.md` matches
  `canonical_capability_requirement`; a supply-chain admission control also matches
  `security_sensitive_behavior`. Both are in `full_assessment_triggers`, so the assessment is
  **full**, `material_capability_modification: true`, `security_sensitive: true` (which means no
  `security_justification` map is required — that requirement is triggered by `false`).
- **No signed governance record is required.** `review-freshness.mjs:13-16` states that a change
  never signed in any reachable commit is a legitimate pre-signing technical state, and R15 binds
  only records that exist. The three-day-old `enforce-archive-relocation-completeness` change added a
  canonical capability requirement under a full assessment and landed with **no**
  `governanceRecords` entry at all (`grep -c enforce-archive-relocation verification-lifecycle.json`
  returns 0). This change follows that precedent, not #68's T→S→M cycle.
- `verification-lifecycle.json` is therefore **not** edited, which keeps a
  `governance_record_only` path out of the commit entirely.
- Landing is the #187/#188/#189 shape: PR 1 = propose commit + implementation commit; PR 2 = fold the
  spec delta into the canonical spec; PR 3 = archive the change as a pure relocation. **The spec fold
  must be its own PR before the relocation**: `ownedPathsFor()` grants a relocated change only its
  change and archive directories, so a relocated change no longer covers
  `openspec/specs/security-audit-sdk-core/`.

### F11 — No ADR, and no ADR is permitted without also editing coherence

`check-coherence.mjs:191` pins `adrFiles.length === 11` and `:192` pins the exact 001..011 sequence.
The policy this change enforces already exists in ADR-SDK-001 (zero runtime dependencies),
ADR-SDK-003 (standalone CommonJS validator), ADR-SDK-009 (dependency/license policy), and
ADR-SDK-011 (BUNDLED_STANDALONE_VALIDATOR). Adding a twelfth ADR would fail `test:coherence` and buy
nothing.

### F12 — Nothing in governance-core is touched

`test:dependencies` is already wired into `validate` and `test:matrix`, and it is **absent** from
CLAUDE.md's "Targeted gates" table, so extending the existing script requires no CLAUDE.md edit.
CLAUDE.md, `.hermes.md`, `.github/workflows/`, `CONTRIBUTING.md`, and `openspec/scripts/` are all
`governance_core` — none of them is in scope. Adding a *new* npm script would have dragged the gate
table (and therefore governance-core) into the change; extending the existing one does not.

### F13 — Sonar sees every new file, at `new_violations = 0`

`sonar-project.properties:14` puts `packages/security-audit-sdk-core/scripts` and `.../examples` in
`sonar.sources`; `:18` puts `packages/security-audit-sdk-core/tests` in `sonar.tests`. The project
quality gate fails on any new violation. Keep every new function small and single-purpose, avoid
nested ternaries and long parameter lists, and prefer early returns. `sonar.coverage.exclusions`
already covers `**/scripts/**`, so the new module is not held to the coverage threshold —
but the test file is not excluded from analysis, only from coverage duty.

Per the repository's own experience, do not read a green `codescene delta` as proof a function is
healthy: CodeScene CLI 1.0.37 silently skips functions whose parameter lists use the `readonly` type
modifier. That modifier does not apply to `.mjs`, so both analysers should see this code — treat them
as complementary and fix what either one reports.

### F14 — The lifecycle gate permits everything this change writes

`test:changed-paths` reports `archived` mode today, so `openspec/specs/security-audit-sdk-core/` is
writable (that is how the PR 2 fold lands). The untracked-new-file rule at
`check-changed-paths.mjs:101` is bounded to `ownership.sdkSourcePrefixes`, which is exactly
`packages/security-audit-sdk-core/src/` and `.../lib/`. New files under `scripts/` and
`tests/verification/` classify as `sdk-package` with no violation and need no
`reviewedNewSdkSourcePaths` entry.

---

## Decisions taken (settle these; do not re-litigate during execution)

| # | Decision | Why |
| --- | --- | --- |
| D1 | Extend `test:dependencies`; add no new npm script | The issue names that command; a new script drags CLAUDE.md's gate table into governance-core (F12) |
| D2 | Take the inventory from `npm pack --dry-run --json`, not a `dist/` glob | "Shipped" is defined by the pack manifest; the glob would miss `examples/` and could include unpacked strays. Precedent: `check-package-contents.mjs:12` |
| D3 | Classify relative specifiers `internal` and do **not** resolve them on disk | Externals are the subject of #69, and execution-level proof already exists (`test:runtime`, `test:examples`, `packed-consumer-closure`). Record as an assurance limitation |
| D4 | Policy as frozen constants inside the new module, not a JSON file | Matches `check-scope.mjs:26` and `check-package-contents.mjs:46-55`; a policy file would add a path to classify and a second source of truth |
| D5 | Inspect every shipped `.js` / `.cjs` / `.mjs` / `.ts` / `.cts` / `.mts` artifact, `.d.ts` included | They are shipped, the walk is the same code, and a declaration file importing an undeclared package breaks a consumer's typecheck |
| D6 | One ADDED requirement in `openspec/specs/security-audit-sdk-core/` | A gate with no normative requirement is an orphan; the assessment is full either way (F10) |
| D7 | Three PRs, no signed record, no owner exact-commit approval | F10; mirrors #187/#188/#189 |

---

## Files to change

**PR 1 (propose commit P, then implementation commit T)**

- Create `openspec/changes/reject-undeclared-shipped-imports/{.openspec.yaml, proposal.md, design.md, tasks.md, assessment.json, specs/security-audit-sdk-core/spec.md}`
- Create `packages/security-audit-sdk-core/scripts/shipped-import-policy.mjs`
- Modify `packages/security-audit-sdk-core/scripts/check-dependencies.mjs` (one import, one call, one bounded throw)
- Create `packages/security-audit-sdk-core/tests/verification/shipped-import-policy.test.mjs`
- Modify `packages/security-audit-sdk-core/DEPENDENCIES.md` (one sentence recording that the gate now inspects shipped imports)
- Add this plan file (optional; matches `62e0975` precedent)

**PR 2 (spec fold)**

- Modify `openspec/specs/security-audit-sdk-core/spec.md` (append the ADDED requirement)
- Modify `openspec/changes/reject-undeclared-shipped-imports/tasks.md` (tick the fold task)

**PR 3 (archive, pure relocation)**

- Move `openspec/changes/reject-undeclared-shipped-imports/` to
  `openspec/changes/archive/<YYYY-MM-DD>-reject-undeclared-shipped-imports/`
- Add `archive-evidence.md` in the archive directory

**Explicitly untouched:** `package.json` (deps stay `{}`, no new script), `package-lock.json`,
`compatibility.json` (`runtimeDependencyCount: 0` becomes better enforced, not different),
`verification-lifecycle.json` (F10), `adr/` (F11), CLAUDE.md / `.hermes.md` / `.github/workflows/` /
`CONTRIBUTING.md` / `openspec/scripts/` (F12), `check-scope.mjs` (#71), `check-package-contents.mjs`
(#70), `sonar-project.properties` (editing it raises `path-unclassified` — it matches no
`path_classes` pattern).

---

## Task 0: Preflight, triage promotion, branch

```sh
cd /Users/fernando.costa/Git/bloodtrail
git fetch --prune origin
git status --short --branch && git rev-parse HEAD origin/main
gh issue edit 69 --remove-label needs-triage --add-label ready-for-agent
gh issue view 69 --json labels -q '[.labels[].name] | join(", ")'
git switch -c feat/reject-undeclared-shipped-imports
git rev-parse origin/main   # BASELINE_SHA for assessment ordering
```

Expected: clean tree, local `main` == `origin/main` == `c08c45b…` (re-check; `main` moves).
`ready-for-agent` and `needs-triage` are both real labels in this tracker
(`docs/agents/triage-labels.md`), and the five canonical roles are mutually exclusive — remove the
old one in the same call.

Never create the branch with `git checkout -b <name> origin/main`: that sets the upstream to `main`,
so a later bare `git push` would bypass the PR entirely. `git switch -c` is correct.

## Task 1: Propose the change (commit P)

**Files:** `openspec/changes/reject-undeclared-shipped-imports/*`

```sh
openspec new change "reject-undeclared-shipped-imports"
```

Do not hand-create the directory. This change **has** a specs delta, so `skip_specs` stays absent.

`proposal.md` — Why: F1 (the defect is repaired, the gate is not), F2 (manifest-only inspection),
F3 (the two unscanned shipped surfaces). What Changes: shipped-artifact import inspection inside
`test:dependencies`, a role-scoped permitted-class policy, fail-closed handling of dynamic and
unclassifiable specifiers, bounded diagnostics, fixtures plus a deterministic undeclared-AJV
mutation, one new capability requirement. Scope: the files listed above. Non-Goals: no packaging
decision or repair (#67/#68, both closed), no package-contents hardening (#70), no scope-gate change
(#71), no dependency *safety* claim, no publication, no production authorization, no transport,
collector, or browser telemetry. Capabilities: Modified — `security-audit-sdk-core`.
State the traceability line: PLAN-036, PLAN-038, PLAN-074.

`specs/security-audit-sdk-core/spec.md` — the delta. Match the canonical format exactly:
`### Requirement:` then a non-empty body, then `#### Scenario:` blocks each containing a line
starting `- **WHEN**` and a line starting `- **THEN**` (`check-coherence.mjs:383-388` rejects
anything else, and it parses the canonical spec, so a malformed fold fails PR 2).

```markdown
## ADDED Requirements

### Requirement: Dependency verification inspects module imports in shipped artifacts

Dependency verification SHALL inspect every shipped JavaScript and TypeScript artifact and SHALL
classify every module specifier the artifact references, in ESM import and export positions and in
CommonJS `require()` position.

A specifier SHALL be permitted only when it is relative to the artifact, an approved Node built-in
for that artifact's role, a declared runtime dependency of the package, or a self-reference whose
subpath is a declared package export. Every other specifier SHALL fail verification, including a
specifier that is not a literal string and a Node built-in referenced without its `node:` prefix.

Verification SHALL fail when it inspects no shipped artifact, and SHALL fail when a shipped artifact
cannot be read or parsed.

Diagnostics SHALL name the artifact path, the module specifier, and the violated class, SHALL be
bounded in count and length, and SHALL NOT include artifact source content.

#### Scenario: Approved shipped output passes
- **WHEN** dependency verification inspects the built package whose shipped artifacts reference only
  approved Node built-ins, declared package exports, and relative modules
- **THEN** verification passes and reports the number of artifacts and specifiers inspected

#### Scenario: Undeclared external module is rejected
- **WHEN** a shipped artifact requires `ajv/dist/runtime/ucs2length` while the package declares no
  runtime dependencies
- **THEN** verification fails and the diagnostic names that artifact and that module

#### Scenario: Declared runtime dependency is accepted
- **WHEN** a shipped artifact imports a module whose package is declared in the package manifest's
  runtime dependencies
- **THEN** verification accepts that specifier as a declared dependency

#### Scenario: Bundled module contributes no specifier
- **WHEN** a shipped artifact embeds third-party code instead of importing it
- **THEN** the artifact contributes no external specifier and verification passes

#### Scenario: Unprefixed or unapproved built-in is rejected
- **WHEN** a shipped artifact references a Node built-in without the `node:` prefix, or references a
  built-in that is not approved for that artifact's role
- **THEN** verification fails and names the artifact and the module

#### Scenario: Dynamic specifier is rejected
- **WHEN** a shipped artifact calls `import()` or `require()` with an argument that is not a literal
  string
- **THEN** verification fails and reports the artifact and the unclassifiable import form

#### Scenario: Empty inspection set fails closed
- **WHEN** dependency verification finds no shipped JavaScript or TypeScript artifact to inspect
- **THEN** verification fails rather than reporting a pass
```

`design.md` — record: the inventory source and why it is `npm pack --dry-run` (D2); the role-scoped
policy table and why one flat allowlist fails (F5); why self-reference is verified against the
exports map rather than exempted (F6); why the TypeScript parser rather than a regex (F7); the five
fail-closed cases (F8); the deliberate omission of relative-specifier resolution and its residual
(D3); why the fixtures use the package-copy harness (F9); and the rejected alternative below.

`tasks.md` — all unchecked, three ordered groups. Group 3 is human-owned and must stay unchecked
while the change is active (`check-coherence` rejects starting a later group early, and merge or
archive tasks must remain unchecked on an active change).

```markdown
## 1. Decision and scope
- [ ] 1.1 Record the gap, the repaired-defect context, and the traceability in the proposal
- [ ] 1.2 Bound the change to the declared owned paths

## 2. Implementation and verification
- [ ] 2.1 Prove the control fails on an undeclared shipped import before it exists
- [ ] 2.2 Implement shipped-artifact import classification with a role-scoped policy
- [ ] 2.3 Wire the classification into the dependency gate with bounded diagnostics
- [ ] 2.4 Cover the bundled, declared, built-in, dynamic, and empty-inventory classes
- [ ] 2.5 Record the inspection in the dependency record
- [ ] 2.6 Run the full SDK and contract gate chains
- [ ] 2.7 Run the governance checkers and strict OpenSpec validation

## 3. Landing (human-owned)
- [ ] 3.1 Owner merges the implementation PR
- [ ] 3.2 Fold the capability requirement into the canonical spec
- [ ] 3.3 Archive the change as a complete relocation
- [ ] 3.4 Close #69 with evidence
```

## Task 2: Write the assessment (still commit P)

**File:** `openspec/changes/reject-undeclared-shipped-imports/assessment.json`

Closed schema 1.1, `full` level, `direct_implementation`. `security_sensitive: true`, so no
`security_justification` map is needed (`assessment-security-false-requires-justification` fires on
`false`, not on `true`). A full assessment requires at least one `direct_implementation` candidate
**and** at least one `alternative` candidate, every rejected id must appear in `rejection_reasons`,
and each rejection reason must be force-based — never "best practice" or "industry standard"
(`non_force_based_reason_patterns`).

```json
{
  "schema_version": "1.1",
  "change_id": "reject-undeclared-shipped-imports",
  "assessment_level": "full",
  "decision": "direct_implementation",
  "forces": [
    "The dependency gate asserts zero runtime dependencies from manifests alone and never opens a shipped artifact, so a shipped import that no manifest declares passes unseen.",
    "Generated output and shipped examples are outside the scope gate's walk, so no existing check constrains what they may import.",
    "A specifier that is not a literal string cannot be classified, and treating it as absent would make the gate silently incomplete.",
    "Diagnostics must identify the artifact and the module precisely without emitting artifact source content."
  ],
  "applicability": {
    "triggers_matched": ["canonical_capability_requirement", "security_sensitive_behavior"],
    "material_capability_modification": true,
    "capabilities": ["security-audit-sdk-core"]
  },
  "owned_paths": [
    "packages/security-audit-sdk-core/scripts/shipped-import-policy.mjs",
    "packages/security-audit-sdk-core/scripts/check-dependencies.mjs",
    "packages/security-audit-sdk-core/tests/verification/shipped-import-policy.test.mjs",
    "packages/security-audit-sdk-core/DEPENDENCIES.md"
  ],
  "candidate_approaches": [
    {
      "id": "approach-shipped-artifact-import-classification",
      "kind": "direct_implementation",
      "summary": "Take the shipped inventory from npm pack --dry-run, parse each JavaScript and TypeScript artifact with the pinned TypeScript parser, and classify every specifier as internal, approved built-in, declared dependency, or verified self-reference; fail closed on anything else, on non-literal specifiers, and on an empty inventory.",
      "forces_addressed": [
        "The dependency gate asserts zero runtime dependencies from manifests alone and never opens a shipped artifact, so a shipped import that no manifest declares passes unseen.",
        "Generated output and shipped examples are outside the scope gate's walk, so no existing check constrains what they may import.",
        "A specifier that is not a literal string cannot be classified, and treating it as absent would make the gate silently incomplete.",
        "Diagnostics must identify the artifact and the module precisely without emitting artifact source content."
      ]
    },
    {
      "id": "approach-extend-scope-gate-to-generated-sources",
      "kind": "alternative",
      "summary": "Remove the src/generated exemption from the scope gate and extend its walk to the examples directory, keeping a single source-level import check instead of an artifact-level one.",
      "forces_addressed": [
        "Generated output and shipped examples are outside the scope gate's walk, so no existing check constrains what they may import."
      ]
    }
  ],
  "selected_approach_id": "approach-shipped-artifact-import-classification",
  "rejected_alternative_ids": ["approach-extend-scope-gate-to-generated-sources"],
  "rejection_reasons": {
    "approach-extend-scope-gate-to-generated-sources": {
      "forces": [
        "The dependency gate asserts zero runtime dependencies from manifests alone and never opens a shipped artifact, so a shipped import that no manifest declares passes unseen."
      ],
      "reason": "A source-level check cannot see what is shipped. The generated validator's requires were emitted by the generator into build output, not written in source, and the packed inventory is produced by npm pack rather than by the source tree; inspecting sources would leave the defect class that motivated this issue outside the gate's reach."
    }
  },
  "selected_pattern_ids": [],
  "implementation_invariant_ids": [
    "implementation-shipped-imports-classified",
    "implementation-unclassifiable-imports-fail-closed",
    "implementation-diagnostics-bounded-and-content-free"
  ],
  "invariant_evidence": {
    "implementation-shipped-imports-classified": {
      "task_ids": ["2.2", "2.4"],
      "evidence_ids": ["shipped-import-policy.test.mjs bundled, declared, and built-in fixtures", "check-dependencies pass line reports artifacts and specifiers inspected"]
    },
    "implementation-unclassifiable-imports-fail-closed": {
      "task_ids": ["2.1", "2.3"],
      "evidence_ids": ["undeclared ajv/dist/runtime/ucs2length mutation exits non-zero", "dynamic-specifier and empty-inventory fixtures"]
    },
    "implementation-diagnostics-bounded-and-content-free": {
      "task_ids": ["2.3", "2.4"],
      "evidence_ids": ["diagnostic assertions naming artifact and module and asserting the absence of surrounding source text"]
    }
  },
  "security_sensitive": true,
  "ordering": { "proposal_baseline_commit": "<BASELINE_SHA>" },
  "verification_task_ids": ["2.4", "2.6", "2.7"]
}
```

Commit P as `docs(openspec): propose rejecting undeclared shipped imports` with an explicit staged
allowlist of the six change-directory files. Do not stage anything else.

## Task 3: RED — prove the control can fail before it exists

**File:** `packages/security-audit-sdk-core/tests/verification/shipped-import-policy.test.mjs` (new)

A new file, not an addition to `mutations.test.mjs`: that file is 59 KB and a known analyser hotspot,
so file-level rules would fail `codescene delta` regardless of the quality of the new code.

Write the failing controls first and watch each one fail for the intended reason:

1. **Undeclared external (end-to-end).** Copy the package with the `f10-mutations.test.mjs`
   `copyPackageStable` helper (exclude `node_modules`, `dist-tests`, `dist-examples`; **include**
   `dist`), symlink `node_modules`, append
   `const helper = require("ajv/dist/runtime/ucs2length");` to a copied
   `dist/generated/schema-validator.generated.cjs`, then run
   `node scripts/check-dependencies.mjs` from the copy. Assert exit status is non-zero, that the
   output contains `dist/generated/schema-validator.generated.cjs` and
   `ajv/dist/runtime/ucs2length`, and that it does **not** contain the surrounding source text.
2. **Unit fixtures against the module directly**, each a small artifact written into a temp
   directory: bundled (no specifier), declared dependency, approved built-in, unapproved built-in,
   unprefixed built-in, unverified self-reference subpath, `import(variable)`, `require(variable)`,
   aliased `require`, unreadable artifact, empty inventory.
3. **Positive control on the live tree.** Assert the module accepts today's real inventory — this is
   the acceptance criterion "Approved output passes" and it must be a real assertion, not a comment.

At this point every test fails because the module does not exist. Record the failure output; that
record is the PLAN-074 evidence.

## Task 4: GREEN — implement the classification module

**File:** `packages/security-audit-sdk-core/scripts/shipped-import-policy.mjs` (new)

Named exports (write them as declarations; keep each function short for F13):

| Export | Shape | Responsibility |
| --- | --- | --- |
| `SHIPPED_IMPORT_POLICY` | frozen object | the role table from F5 plus the self-reference package name |
| `collectSpecifiers` | `(artifactPath, sourceText) => {specifiers, failures}` | one TypeScript AST walk over one artifact |
| `classifySpecifier` | `(specifier, artifactPath, context) => class or violation` | the five-class decision |
| `inspectShippedImports` | `async ({packageRoot, files, manifest}) => {inspected, specifiers, violations}` | drives the walk over the inventory |

Implementation notes, in the order they matter:

- Import the parser as `import ts from "typescript";` and build each artifact with
  `ts.createSourceFile(path, text, ts.ScriptTarget.ESNext, true, scriptKindFor(path))`. Choose
  `ts.ScriptKind.TS` for `.ts`/`.mts`/`.cts`, `ts.ScriptKind.JS` for `.js`/`.mjs`/`.cjs`. Setting
  `setParentNodes` to `true` keeps the walk simple.
- Collect from: `ImportDeclaration.moduleSpecifier`, `ExportDeclaration.moduleSpecifier`,
  `ImportEqualsDeclaration` external module references, `ImportTypeNode` arguments, `CallExpression`
  where the expression is `ts.SyntaxKind.ImportKeyword`, and `CallExpression` where the expression is
  an identifier named `require`. For each, accept only `ts.isStringLiteral(argument)`; anything else
  becomes a `dynamic-specifier` violation carrying the artifact path and nothing else.
- Flag any `require` identifier whose parent is not the call expression it heads
  (F8 case 2).
- Classification order: relative (`.`/`..`) → `internal`; `node:` prefix → check the role allowlist;
  bare name in `ts.SyntaxKind`-independent Node builtin list → `unprefixed-builtin` violation;
  package name equal to `manifest.name` → self-reference, permitted only when the subpath is a key of
  `manifest.exports`; package name (or scope/name pair) present in `manifest.dependencies` →
  `declared-dependency`; otherwise `undeclared-external`.
- Derive the role from the artifact path prefix (`dist/` versus `examples/`). An artifact matching no
  role is itself a violation — the policy must not silently widen when the packed layout changes.
- Return violations as plain data. Sort by code point (`byCodePoint` from
  `verification-helpers.mjs`), cap the reported list at 50 entries and each message at 240
  characters, and never include source text — only the artifact path, the specifier, and the class.

**File:** `packages/security-audit-sdk-core/scripts/check-dependencies.mjs` (modify)

Add the import, take the packed inventory the same way `check-package-contents.mjs:12-21` does, call
`inspectShippedImports`, assert `inspected > 0` alongside the existing `installedPackages > 0`
assert, and throw one bounded error listing the violations in the style of `check-scope.mjs:52-54`.
Extend the final `process.stdout.write` line to report the artifact and specifier counts so a passing
run is self-evidencing rather than silent.

Run the Task 3 tests until every one is green for the intended reason.

## Task 5: Record the inspection

**File:** `packages/security-audit-sdk-core/DEPENDENCIES.md` (modify)

Add one line to the Rules list stating that dependency verification inspects the module specifiers of
every shipped artifact and rejects any specifier that is not relative, an approved Node built-in for
that artifact's role, a declared runtime dependency, or a declared self-reference export. Keep the
existing wording intact — `check-dependencies.mjs:27` matches `` `name` `` and `| version |`
substrings in this file, and `check-coherence.mjs:204` reads README/API/SECURITY/MIGRATION (not this
file), so the edit is safe as long as the dependency table is untouched.

## Task 6: Full read-only verification (empty index, BEFORE staging T)

Run the Stage 1 battery from Task 9. `test:git` requires an **empty** Git index, so verification runs
before `git add`, never after. It also rejects a missing final newline, any CR byte, and any trailing
whitespace in every file changed since the baseline — untracked Markdown included, which covers this
plan file.

Additionally, prove the two directions once more on the exact tree that will be committed:

```sh
cd packages/security-audit-sdk-core
npm run build
npm run test:dependencies            # expect PASS, with the new counts on the summary line
node --test tests/verification/shipped-import-policy.test.mjs
```

## Task 7: Commit T, push, PR 1

Stage an explicit allowlist: the new module, the modified gate, the new test file,
`DEPENDENCIES.md`, the change's `design.md`/`tasks.md` updates, and this plan file. Nothing else.

Commit as `feat(sdk): reject undeclared runtime imports in the dependency gate`. Conventional
Commits are validated on the PR title **and every commit subject**. Open the PR against `main` from
`feat/reject-undeclared-shipped-imports`; the body states the F1 context (the defect is already
repaired; this is a regression lock), the four acceptance criteria with their evidence, the assurance
limitation from D3, and that `#70` and `#71` remain out of scope.

Required checks: `ci / lint|test|audit`, `sdk`, `contract`, `sonar`, `conventional-commits`,
`codescene delta`, `design-pattern-governance`. If `sonar` is red, read its "Explain quality gate
failure" step before assuming the code is at fault — the self-hosted server is the more common cause,
and the job already retries once after 30s.

Rebase onto `main` if it moves; never `git merge main` into the branch — a `Merge branch 'main'
into …` subject has no exemption from the conventional-commits check.

## Task 8: PR 2 (spec fold), then PR 3 (archive)

**PR 2 — fold the delta into the canonical spec.** Branch `docs/sync-sdk-shipped-import-requirement`.
Use `openspec-sync-specs`. Two files only, exactly as `2de6e07` did: the canonical
`openspec/specs/security-audit-sdk-core/spec.md` gains the requirement, and the change's `tasks.md`
ticks 3.2. Commit as `docs(openspec): fold the shipped-import requirement into the SDK spec`.

**PR 3 — archive as a complete relocation.** Branch
`docs/archive-reject-undeclared-shipped-imports`. Use `openspec-archive-change`. Perform the move
with `git mv` so the commit carries both the additions and the deletions: R25 now rejects an archive
whose active directory still exists at `HEAD`, and `git add <destination>` alone commits additions
only. Add `archive-evidence.md` in the archive directory. Commit as
`docs(openspec): archive reject-undeclared-shipped-imports`.

Order is not negotiable: the fold must land **before** the relocation (F10).

## Task 9: The gate battery (run for every PR above)

**Stage 1 — before `git add`** (`test:git` requires an empty index):

```sh
npm run check:generated --prefix packages/security-audit-sdk-core   # before validate, which regenerates
npm run validate --prefix packages/security-audit-sdk-core
npm run validate --prefix contracts/security-audit
openspec validate --all --strict
openspec validate --all --archived --strict
git diff --check
```

**Stage 2 — after the commit.** These read `HEAD`. Before the commit they are vacuously green:
`defaultBase()` returns the merge-base, which on an unchanged branch equals `HEAD`, and
`check-design-pattern-governance.mjs:321` short-circuits with `if (base === head) return;` before the
perimeter runs. A pre-commit run is a green that checked nothing.

```sh
node openspec/scripts/check-design-pattern-governance.mjs --phase final ; echo "exit=$?"
node openspec/scripts/check-design-pattern-governance.mjs --phase final --json   # rangePaths must NOT be null
node openspec/scripts/run-governance-dual-check.mjs
node --test openspec/tests/design-pattern-governance/*.test.mjs
```

Never judge a checker through a `sed` or `grep` pipe — that reports the filter's exit status. Read
the exit code directly. When reading `run-governance-dual-check.mjs` itself, use
`command grep --binary-files=text`: it contains NUL bytes and plain `grep` returns silence rather
than no-match.

**Stage 3 — the commit tree** (PR 3 especially):

```sh
git show --name-status --no-renames HEAD     # a move shows A and D lines, not A alone
git ls-tree --name-only HEAD openspec/changes/
git status --porcelain                       # only intended untracked files
```

`owned_paths` covers future PRs too, so every file any of the three PRs touches under `packages/`
must appear in the assessment's `owned_paths` as an **exact path**, not a directory prefix.

## Task 10: Close #69 and report

```sh
gh issue close 69 --comment "<evidence>"
```

The evidence comment states: the merge commits of all three PRs, the acceptance criteria mapped to
the tests that prove them, the baseline inventory from F4, the F1 correction (the AJV requires were
already gone before this change; the gate now prevents their return), the assurance limitation from
D3, and what was **not** verified.

Then:

```sh
openspec list                                   # expect: No active changes found.
openspec validate --all --strict
openspec validate --all --archived --strict
git status --short --branch
```

---

## Validation matrix

| Acceptance criterion (#69) | Evidence |
| --- | --- |
| Approved output passes | `npm run test:dependencies` green on the built live tree; the positive control in `shipped-import-policy.test.mjs` asserts the real inventory classifies cleanly |
| An undeclared `require("ajv/dist/runtime/ucs2length")` fixture fails deterministically | End-to-end mutation in a package copy; `node scripts/check-dependencies.mjs` exits non-zero and names artifact and module |
| A declared or bundled fixture passes | Declared-dependency fixture (manifest with a runtime dependency) plus the real bundled artifact, which contributes no specifier |
| Diagnostics name artifact and module without exposing contents | Diagnostic assertions check for the path and specifier and assert the absence of the surrounding source text; count and length are capped |
| Fail closed on dynamic or unclassifiable external imports | `import(variable)`, `require(variable)`, aliased `require`, unreadable artifact, unmatched role, and empty-inventory fixtures |
| Node built-in fixture | `node:crypto` in `dist/` accepted, `node:assert` in `dist/` rejected, bare `crypto` rejected in both roles |

---

## Risks, tradeoffs, and open questions

- **The gate proves declaration and bundling consistency, not dependency safety.** #69 says so
  explicitly; the proposal, the requirement, and the issue-closing comment must all repeat it. A
  declared dependency passes this gate no matter what it does.
- **Relative specifiers are not resolved (D3).** A shipped artifact importing a relative path that
  was not packed would still pass this gate. `test:runtime`, `test:examples`, and
  `packed-consumer-closure.test.mjs` cover that by execution, and `check-package-contents.mjs` covers
  the inventory. Record it as an assurance limitation rather than quietly widening scope.
- **`npm pack --dry-run` runs twice per `validate`** (here and in `test:package`). That is a few
  seconds; a shared cache would couple two gates that must be able to fail independently.
- **The TypeScript parser is error-tolerant.** It returns a tree for malformed input rather than
  throwing, so "parsed without error" is not a claim this gate can make. It claims only that every
  specifier the parser *did* find is classified. Treat a read failure as a violation (F8 case 5), and
  do not reach for internal parser diagnostics APIs to strengthen the claim.
- **Sonar `new_violations = 0` is the likeliest CI surprise** (F13), and the second likeliest is a
  trailing space in a Markdown file failing `test:git`.
- **Open question for the owner:** should the same role-scoped policy eventually replace
  `check-scope.mjs`'s `allowedNodeImports`, so the runtime built-in allowlist has one home instead of
  two? That is #71's territory and is deliberately not attempted here.

## What this does not authorize

Nothing in this change authorizes publication, production deployment, real-user data, framework
instrumentation, transports, exporters, collectors, queues, outboxes, storage, SIEM integration,
analytics, detection, browser telemetry, or cryptographic audit-log chaining. It adds no runtime
dependency, changes no public API, and leaves contract `1.0.0` untouched. `runtimeDependencyCount: 0`
in `compatibility.json` is now better enforced, not different.

## What this plan did not verify

- CI behaviour of the new gate on Node 24 (only Node 26.7.0 was available on this workstation);
  `test:matrix` covers it in CI.
- Whether `codescene delta` and `sonar` accept the new module — that is only knowable from a real
  pushed commit.
- The exact packed inventory after the change; it is unchanged by construction, since no file in
  `files` is added or removed, but `test:package` re-proves it each run.
