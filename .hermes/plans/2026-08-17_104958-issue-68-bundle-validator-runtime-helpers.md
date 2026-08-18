# Issue #68 — Bundle Validator Runtime Helpers + Formats (Production-Only Install) — Implementation Plan

> **For Hermes:** Execute with the `openspec-governed-change-lifecycle`, `bloodtrail-governance-machinery`, and `governed-landing-cycle-execution` skills (not subagent fan-out — this is a governed normative change with a T→S→M→archive landing cycle). Verify read-only with an empty index before every commit. Do NOT merge — the owner merges.

**Goal:** Make the packed SDK importable and functional under a production-only install by making the generated validator fully self-contained (bundled ajv runtime helper + the two ajv-formats validators it uses, MIT attribution recorded), completing #68's acceptance criteria, and landing it through the full governed cycle.

**Architecture:** The generator keeps `Ajv2020 + addFormats + standaloneCode` (generation-time only) and post-processes the emitted CJS: the three `require(...)` expressions (`ajv/dist/runtime/ucs2length`, `ajv-formats/dist/formats` ×2) are replaced with references to bundled definitions, and the bundled definitions themselves are inlined **as source text** read from two new vendored modules (`vendor/bundled-validator-runtime.mjs`, `vendor/bundled-validator-formats.mjs`). The artifact gains an MIT attribution header, keeps `"use strict";` as its first statement, and fail-closed asserts guarantee the output contains no `require(` at all. A parity test proves the bundled validators are behavior-identical to the pinned dependency implementations; a packed-consumer test reproduces the S-6 scenario and proves it no longer occurs. A specs delta adds the requirement to the `security-audit-sdk-core` capability; the change rides a full T→S→M→archive governed cycle.

**Tech Stack:** ajv 8.20.0 / ajv-formats 3.0.1 (pinned devDeps, generation-time), ESM generator scripts, node:test verification suite, npm pack/install (offline-safe), openspec CLI 1.9.0, gh CLI.

---

## Context / assumptions (verified read-only 2026-08-17)

- #68 (OPEN; labels bug, severity:high, security-audit-sdk, openspec-change-needed, area:core, needs-triage). Acceptance: (1) clean tarball installs with `--omit=dev` and imports both public exports; (2) schema validation works from the consumer install; (3) metadata and documentation match the chosen policy; (4) the missing-AJV reproduction no longer occurs. Depends on #67 — DONE (ADR-SDK-011 merged 3003e73).
- Policy (ADR-SDK-011, decided): BUNDLED_STANDALONE_VALIDATOR. Generator emits a self-contained validator with ajv runtime helpers bundled, MIT attribution in the artifact header and DEPENDENCIES.md; `runtimeDependencyCount: 0` and `modulePolicy: "esm-public-cjs-standalone-validator"` stay as-is (no compatibility.json change); `package.json` dependencies stay `{}`.
- **Exact defect surface** (measured at main 3003e73): `src/generated/schema-validator.generated.cjs` is a single 240 KB line opening with `"use strict";` and contains exactly three `require(` occurrences, each on the right-hand side of a top-level `const`:

  | Emitted declaration | Call shape in the artifact |
  |---|---|
  | `const func3 = require("ajv/dist/runtime/ucs2length").default;` | `func3(data1)` — bare function |
  | `const formats0 = require("ajv-formats/dist/formats").fullFormats["date-time"];` | `formats0.validate(data11)` — object with `.validate` |
  | `const formats4 = require("ajv-formats/dist/formats").fullFormats.uri;` | `formats4(data54)` — **bare function** |

  0 `.compare` usages. S-6 reproduction evidence: archived `technical-review-packet.md` S-6 section.
- **The two format entries have different shapes.** `fullFormats["date-time"]` is `{validate, compare}`; `fullFormats.uri` is a plain function (verified: `typeof fullFormats.uri === "function"`). The replacements are therefore asymmetric — see Task 6.
- **Formats**: ajv 2020 has no built-in format validators (`validateFormats: true` + strict mode throws "unknown format" without `addFormats`). `date_time` and `uri` are closures over module-level constants and helpers (`DATE`/`DAYS`/`date`/`isLeapYear`, `TIME`/`getTime`, `DATE_TIME_SEPARATOR`/`getDateTime`, `NOT_URI_FRAGMENT`/`URI`) — they cannot be `toString()`-serialized in isolation, so the whole vendored module body is inlined as text and guarded by a parity test. `ucs2length` (ajv 8.20.0 runtime) gets the same treatment.
- **No semantic-weakening option**: dropping to `fastFormats` (regex-only) would accept e.g. `2023-02-30T…` — a standards-incompatible weakening of timestamp validation on a security-audit event. Full-semantics bundling is the only acceptable option. No existing tests cover semantic date invalidity — the new parity + closure tests will.
- **Sonar scans `packages/security-audit-sdk-core/scripts` and `.../tests`** (`sonar-project.properties:14,18`), and the project quality gate has `new_violations` with an **error threshold of 0** (conditions: `new_coverage ≥ 80`, `new_duplicated_lines_density ≤ 3`, `new_violations = 0`). Verbatim third-party regex code placed under `scripts/` raises six new violations and fails the required `sonar` check — see Corrections 3. `sonar.coverage.exclusions` already covers `**/scripts/**`, so coverage is not at risk.
- **Governance shape**: this is a normative implementation change touching `packages/` (governed_implementation) and ADDING a requirement to the canonical `security-audit-sdk-core` spec → the openspec change declares capabilities `["security-audit-sdk-core"]`, `material_capability_modification: true`, triggers `["canonical_capability_requirement", "security_sensitive_behavior"]` → **full assessment**, and the change lands via **T → S (owner exact-commit approval) → M (identity-preserving merge) → archive**.
- Lifecycle mode resolves `archived` → `test:changed-paths` permits `openspec/specs/security-audit-sdk-core/` changes. Its untracked-new-file rule is bounded to `ownership.sdkSourcePrefixes` = `src/` and `lib/` only, so new files under `vendor/` and `tests/verification/` classify `sdk-package` with no violation. `check-scope.mjs` walks `src/**/*.ts` only and never sees them. `tsconfig.json` includes `src/**/*.ts` and `src/**/*.mts` only, so `vendor/` is outside typecheck.
- Worktree currently on `main` @ 3003e73, clean (untracked: this plan file). Node v26.7.0 (within engines). openspec CLI 1.9.0.
- #170's PR body promised "the canonical spec change rides #68's implementation change" — this plan honors that.

---

## Corrections applied to the draft

Review of the pre-execution draft surfaced five blockers and three ordering weaknesses. All are folded into the task bodies below. Execute the corrected form; do not reconstruct the draft.

1. **`fullFormats.uri` is a bare function (blocker).** The draft replaced it with `{ validate: bundledUriValidate }`, which emits `const formats4 = { validate: … };` while the artifact calls `formats4(data54)` — a `TypeError` on every event carrying `authenticated_principal.issuer` or `authentication.identity_provider`. Only the `date-time` entry takes the `{ validate: … }` form.
2. **`Function.prototype.toString()` drops everything outside the body (blocker).** The draft serialized three functions individually; `date_time` alone depends on `DATE_TIME_SEPARATOR`, `getTime`, `date`, `DATE`, `TIME`, `DAYS`, and `isLeapYear`, none of which would appear in the artifact. The generator now inlines the vendored **module source text**, which also lets the transcription stay verbatim rather than restructured.
3. **Sonar `new_violations = 0` (blocker).** The verbatim transcription raises six new issues under the project's own profile — `javascript:S5843` ("reduce complexity from 558 to the 20 allowed", on `URI`), `S5869`, `S6035`, `S6353`, and `S7758` ×2 on `ucs2length`'s `charCodeAt` — and "fixing" S7758 or S5869 would change the semantics the parity test exists to preserve. The bundled sources therefore live in `packages/security-audit-sdk-core/vendor/`, which `sonar.sources` does not enumerate. Do **not** reach for `sonar.exclusions` instead: `sonar-project.properties` matches no `path_classes` pattern in `design-pattern-policy.json`, so touching it raises `path-unclassified` and fails the governance checker closed.
4. **`owned_paths` must list `verification-lifecycle.json` (blocker).** `governedPatterns()` in `check-design-pattern-governance.mjs` builds its include list from the raw `governed_implementation` patterns and does not re-run `classifyPath`, so the record file matches `packages/` and lands in the governed set despite its `governance_record_only` class. Without the entry the S commit fails `openspec-association-unrelated`. Precedent: the archived `establish-design-pattern-governance` assessment lists it explicitly.
5. **`"use strict";` must stay the first statement (blocker).** Prepending the prelude ahead of it demotes the directive to an inert expression statement and drops the whole validator into sloppy mode. A leading block comment is fine; declarations are not.
6. **This plan file is in scope for `test:git` (blocker, fixed here).** `changedPathsSince()` unions tracked diffs with `git ls-files --others --exclude-standard`, and `.hermes/plans/` is not ignored. The draft had a trailing space on its archive-PR command line, which would have failed Task 9 before anything else ran. Keep this file free of trailing whitespace, CR bytes, and any line beginning with `export function`, `export class`, `export const x = (`, `module.exports =`, or `exports.x =` — `checkHiddenImplementation` scans `documentation_only` paths, untracked files included.
7. **R15 staleness binds from T, not from M (ordering).** `verifyBinding` scans `commitsBetween(technical, "HEAD")`. Any commit landing on `main` between T and the archive — including *before* the merge — enters the range and raises `signed-review-stale` on every normative path it touched, and rebasing out of it would rewrite T and break the binding. T must remain a direct descendant of the mainline tip through merge and archive.
8. **The archive PR's spec fold is covered only by a still-active sibling (ordering).** `ownedPathsFor()` returns only the change directory and archive directory for a relocated change; a relocated change no longer grants `openspec/specs/<capability>/`. The archive commit's edit to `openspec/specs/security-audit-sdk-core/spec.md` is covered solely because `record-validator-packaging-policy` is still active and declares the same capability. Do not archive that change before or alongside this one.

---

## Files to change

- Create `openspec/changes/bundle-validator-runtime-helpers/{.openspec.yaml, proposal.md, design.md, tasks.md, assessment.json, specs/security-audit-sdk-core/spec.md}`
- Create `packages/security-audit-sdk-core/vendor/bundled-validator-runtime.mjs` (bundled `ucs2length`)
- Create `packages/security-audit-sdk-core/vendor/bundled-validator-formats.mjs` (bundled date-time + uri validators)
- Modify `packages/security-audit-sdk-core/scripts/generate-contract.mjs` (post-processor + header wiring)
- Regenerate `packages/security-audit-sdk-core/src/generated/schema-validator.generated.cjs` (generator output; no hand edits)
- Create `packages/security-audit-sdk-core/tests/verification/bundled-formats-parity.test.mjs`
- Create `packages/security-audit-sdk-core/tests/verification/packed-consumer-closure.test.mjs`
- Modify `packages/security-audit-sdk-core/DEPENDENCIES.md` (attribution + purpose rows)
- Modify `packages/security-audit-sdk-core/verification-lifecycle.json` (S commit only — one new governanceRecords entry)
- Archive stage (separate PR): move `openspec/changes/bundle-validator-runtime-helpers/` → `openspec/changes/archive/<date>-bundle-validator-runtime-helpers/`, fold spec delta into `openspec/specs/security-audit-sdk-core/spec.md`

Explicitly untouched: `package.json` (deps stay `{}`), `package-lock.json` (no dep changes), `compatibility.json` (ratified claims become true; no rewrite per ADR-011), `sonar-project.properties` (see Corrections 3), `adr/` (no new ADR — the decision exists), `check-scope.mjs` (#71), `check-dependencies.mjs` (#69), `check-package-contents.mjs` (#70), `copy-generated-validator.mjs`, `.d.cts`.

---

## Proposed approach — tasks

### Task 0: Preflight and branch

```sh
cd /Users/fernando.costa/Git/bloodtrail
git fetch --prune origin
git status --short --branch && git rev-parse HEAD origin/main
git switch -c feat/bundle-validator-runtime-helpers
git rev-parse origin/main   # BASELINE_SHA for assessment ordering
```

Expected: clean, local main == origin/main (re-check — main moves fast, and per Corrections 7 it must not move again until the archive lands).

### Task 1: Scaffold the OpenSpec change (P artifacts)

**Files:** `openspec/changes/bundle-validator-runtime-helpers/*` (scaffold)

```sh
openspec new change "bundle-validator-runtime-helpers"
```

Do not hand-create the dir. Do NOT delete the specs dir this time — this change HAS a specs delta, so `skip_specs` stays absent. Write:

- `proposal.md` — Why: S-6 defect live; #68 acceptance; ADR-SDK-011 policy A implementation. What Changes: self-contained generated validator (bundled helper + 2 format validators, MIT attribution header), DEPENDENCIES.md bundled-code section, new parity + packed-consumer tests, one new spec requirement. Scope: the files listed above. Non-Goals: no publication/package topology/contract semantic change/deployment; no gate hardening (#69/#70/#71); no production authorization. Capabilities: Modified — `security-audit-sdk-core`.
- `specs/security-audit-sdk-core/spec.md` (delta, `## ADDED Requirements`) — match the canonical spec format (`### Requirement:` / `#### Scenario:` + WHEN/THEN):

```markdown
## ADDED Requirements

### Requirement: Packed package installs and validates with production-only dependencies

The packed SDK artifact SHALL install and function with production-only dependency installation. The generated schema validator SHALL be self-contained, embedding the AJV runtime helper and the AJV-formats validators it uses, and SHALL record the MIT attribution of the bundled AJV and ajv-formats code in its header.

#### Scenario: Production-only install imports both public exports
- **WHEN** a consumer installs the packed tarball with `--omit=dev` and imports both public entry points by package specifier
- **THEN** both entry points resolve through the declared export map with the documented exports and no `MODULE_NOT_FOUND` occurs

#### Scenario: Schema validation works from the consumer installation
- **WHEN** `validateSecurityAuditEvent` is invoked from the production-only consumer install with a valid canonical event, and separately with an event whose timestamp is semantically invalid RFC 3339
- **THEN** the valid event validates and the invalid event is rejected with a bounded diagnostic

#### Scenario: Generated validator is self-contained
- **WHEN** the generated validator artifact is inspected
- **THEN** it contains no `require(` of external modules and carries the bundled-code MIT attribution header
```

Note for the reviewer, to be stated in `proposal.md`: this is an ADDED requirement rather than a MODIFIED delta on "Verification covers runtime, compile-time, package, and scope boundaries" (`openspec/specs/security-audit-sdk-core/spec.md:283`), which covers package export tests but says nothing about a production-only install of the packed artifact. ADDED is the lower-risk shape through `openspec archive`.

- `design.md` — the bundling mechanism (source-text inlining of the vendored modules, the asymmetric replacement shapes, the strict-directive constraint, the fail-closed asserts), why the bundled sources live outside `sonar.sources`, the rejected fastFormats weakening, and the parity-test strategy.
- `tasks.md` — all unchecked, three ordered groups; group 3 is human-owned and must stay unchecked while the change is active:

```markdown
## 1. Decision and scope
- [ ] 1.1 Record the ADR-SDK-011 basis and the exact defect surface in the proposal
- [ ] 1.2 Bound the change to the declared owned paths

## 2. Implementation and verification
- [ ] 2.1 Vendor the ajv runtime helper and the ajv-formats validators
- [ ] 2.2 Wire the generator post-processor and the MIT attribution header
- [ ] 2.3 Prove bundled format semantics match the pinned implementations
- [ ] 2.4 Record the bundled-code attribution in DEPENDENCIES.md
- [ ] 2.5 Reproduce and regression-lock the production-only consumer install
- [ ] 2.6 Run the full SDK and contract gate chains
- [ ] 2.7 Run the governance checkers and strict OpenSpec validation

## 3. Landing (human-owned)
- [ ] 3.1 Owner exact-commit approval of T
- [ ] 3.2 Owner identity-preserving merge of T and S
- [ ] 3.3 Archive the change and fold the spec delta
- [ ] 3.4 Close #68 with evidence
```

### Task 2: Scaffold the assessment (A artifact)

**Files:** `openspec/changes/bundle-validator-runtime-helpers/assessment.json`

Closed schema 1.1, **full** level (material capability modification), `direct_implementation`. `security_sensitive: true`, so no `security_justification` map is required (that requirement is triggered by `false`, not by `true`).

```json
{
  "schema_version": "1.1",
  "change_id": "bundle-validator-runtime-helpers",
  "assessment_level": "full",
  "decision": "direct_implementation",
  "forces": [
    "The packed artifact must be importable with production-only dependencies, and source-workspace tests are insufficient proof.",
    "The bundled validator must preserve the exact validation semantics of the pinned ajv and ajv-formats versions; bundling must not weaken timestamp or URI validation.",
    "Bundled third-party code requires recorded MIT attribution in the artifact and in DEPENDENCIES.md.",
    "The generator must fail closed: any unrecognized require target in the emitted code must abort generation rather than ship a broken artifact."
  ],
  "applicability": {
    "triggers_matched": ["canonical_capability_requirement", "security_sensitive_behavior"],
    "material_capability_modification": true,
    "capabilities": ["security-audit-sdk-core"]
  },
  "owned_paths": [
    "packages/security-audit-sdk-core/scripts/generate-contract.mjs",
    "packages/security-audit-sdk-core/vendor/bundled-validator-runtime.mjs",
    "packages/security-audit-sdk-core/vendor/bundled-validator-formats.mjs",
    "packages/security-audit-sdk-core/src/generated/schema-validator.generated.cjs",
    "packages/security-audit-sdk-core/tests/verification/bundled-formats-parity.test.mjs",
    "packages/security-audit-sdk-core/tests/verification/packed-consumer-closure.test.mjs",
    "packages/security-audit-sdk-core/DEPENDENCIES.md",
    "packages/security-audit-sdk-core/verification-lifecycle.json"
  ],
  "candidate_approaches": [
    { "id": "approach-bundled-standalone-validator", "kind": "direct_implementation",
      "summary": "Post-process the standalone CJS output to replace the three require expressions with bundled definitions inlined as source text from vendored repo modules, add an MIT attribution header, and fail generation on any remaining require. Preserves full format semantics; zero runtime dependencies.",
      "forces_addressed": ["The packed artifact must be importable with production-only dependencies, and source-workspace tests are insufficient proof.", "The bundled validator must preserve the exact validation semantics of the pinned ajv and ajv-formats versions; bundling must not weaken timestamp or URI validation.", "Bundled third-party code requires recorded MIT attribution in the artifact and in DEPENDENCIES.md.", "The generator must fail closed: any unrecognized require target in the emitted code must abort generation rather than ship a broken artifact."] },
    { "id": "approach-declared-runtime-dependencies", "kind": "alternative",
      "summary": "Declare ajv and ajv-formats as real runtime dependencies so the packed artifact resolves its requires at install time.",
      "forces_addressed": ["The packed artifact must be importable with production-only dependencies, and source-workspace tests are insufficient proof."] }
  ],
  "selected_approach_id": "approach-bundled-standalone-validator",
  "rejected_alternative_ids": ["approach-declared-runtime-dependencies"],
  "rejection_reasons": {
    "approach-declared-runtime-dependencies": {
      "forces": ["The packed artifact must be importable with production-only dependencies, and source-workspace tests are insufficient proof."],
      "reason": "Recorded and rejected by the owner decision in ADR-SDK-011 (#67): declaring runtime dependencies retires the zero-runtime-dependency identity enforced by ADR-SDK-001, DEPENDENCIES.md, and the dependency gate, widens the package trust boundary, and forces compatibility.json and gate rewrites. Bundling keeps the ratified zero-runtime-dependency claim true."
    }
  },
  "selected_pattern_ids": [],
  "implementation_invariant_ids": ["implementation-self-contained-validator", "implementation-format-semantics-preserved", "implementation-bundled-attribution-recorded"],
  "invariant_evidence": {
    "implementation-self-contained-validator": { "task_ids": ["2.2", "2.5"], "evidence_ids": ["generated artifact contains no require( after bundling", "packed-consumer-closure.test.mjs"] },
    "implementation-format-semantics-preserved": { "task_ids": ["2.1", "2.3"], "evidence_ids": ["bundled-formats-parity.test.mjs matrix against ajv-formats 3.0.1 fullFormats and ajv 8.20.0 ucs2length"] },
    "implementation-bundled-attribution-recorded": { "task_ids": ["2.2", "2.4"], "evidence_ids": ["generated artifact header", "DEPENDENCIES.md bundled-code section"] }
  },
  "security_sensitive": true,
  "ordering": { "proposal_baseline_commit": "<BASELINE_SHA>" },
  "verification_task_ids": ["2.5", "2.6", "2.7"]
}
```

(Invariant ids are author-coined: implementation invariants are declared per change, not registered — only the `^implementation-[a-z0-9-]+$` pattern and a matching `invariant_evidence` entry are enforced. Nothing validates that the task ids exist in `tasks.md`, but keep them aligned anyway.)

Verify before committing:

```sh
node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change bundle-validator-runtime-helpers
```

### Task 3: Commits P and A

```sh
git add openspec/changes/bundle-validator-runtime-helpers/.openspec.yaml \
        openspec/changes/bundle-validator-runtime-helpers/proposal.md \
        openspec/changes/bundle-validator-runtime-helpers/design.md \
        openspec/changes/bundle-validator-runtime-helpers/tasks.md \
        openspec/changes/bundle-validator-runtime-helpers/specs
git diff --cached --check && git diff --cached --name-status
git commit -m "docs(openspec): propose bundling validator runtime helpers for production-only installs"
git add openspec/changes/bundle-validator-runtime-helpers/assessment.json
git commit -m "docs(governance): assess validator runtime helper bundling"
```

### Task 4: Write the failing parity tests (RED)

**Files:** Create `packages/security-audit-sdk-core/tests/verification/bundled-formats-parity.test.mjs`

**Step 1:** Write the test. It imports `bundledUcs2length` from `../../vendor/bundled-validator-runtime.mjs` and `bundledDateTimeValidate` / `bundledUriValidate` from `../../vendor/bundled-validator-formats.mjs` — the same modules whose source the generator inlines — and compares them against `ajv/dist/runtime/ucs2length` and `ajv-formats/dist/formats` fullFormats over matrices. Compare against `fullFormats["date-time"].validate` (object form) and `fullFormats.uri` (bare function form); asserting the *shape* of each pinned entry is itself part of the test, so a future ajv-formats change that flips either shape fails here rather than in the artifact.

- date-time: `"2026-08-16T10:30:00Z"`, `"2026-08-16t10:30:00z"`, `"2026-02-30T10:30:00Z"`, `"2026-08-16T23:59:60Z"`, `"2026-08-16T10:30:00+02:00"`, `"2026-08-16T10:30:00.123456789Z"`, `"2026-08-16 10:30:00Z"`, `"2026-08-16T10:30:00"`, `"not-a-date"`, `""` — each must match exactly.
- uri: `"https://example.com/a?b=c#d"`, `"urn:isbn:0451450523"`, `"ftp://x"`, `"//host/path"`, `"http://"`, `"%zz"`, `"a b"`, `""` — each must match exactly.
- ucs2length: ASCII, BMP, surrogate pairs (`"😀"` → 1), lone high surrogate, empty string — must match `require("ajv/dist/runtime/ucs2length").default`.

**Step 2:** Run: `node --test packages/security-audit-sdk-core/tests/verification/bundled-formats-parity.test.mjs`
Expected: FAIL — `Cannot find module .../vendor/bundled-validator-runtime.mjs`.

### Task 5: Vendor the bundled modules (GREEN parity)

**Files:** Create `vendor/bundled-validator-runtime.mjs`, `vendor/bundled-validator-formats.mjs`

Transcribe **verbatim** from the PINNED sources (both MIT), keeping the original identifiers, structure, and comments. Verbatim transcription is the point: the parity matrix is the guard, and restructuring is what introduces divergence.

- `vendor/bundled-validator-runtime.mjs` — `node_modules/ajv/dist/runtime/ucs2length.js` lines 3-21 (the two source-reference comments and `function ucs2length`). Do not copy lines 1-2 or 22-24 (`"use strict"`, the `__esModule` definition, and the CJS exports).
- `vendor/bundled-validator-formats.mjs` — `node_modules/ajv-formats/dist/formats.js` lines 70-73 (`isLeapYear`), 74-88 (`DATE`, `DAYS`, `date`), 98-120 (`TIME`, `getTime`), 145-153 (`DATE_TIME_SEPARATOR`, `getDateTime`), 173-178 (`NOT_URI_FRAGMENT`, `URI`, `uri`). Copy nothing else: 89 opens `compareDate`, 121 opens `compareTime`, and 154 opens `compareDateTime`, none of which the artifact uses. Keep `getTime(strictTimeZone)` and `getDateTime(strictTimeZone)` parameterised exactly as upstream; bind strictness at the alias instead.

Each file opens with a comment naming the source file, package, version, license (MIT), the upstream line range, and the ADR-SDK-011 reference, and closes with exactly one alias block and one export statement, in this shape:

```js
const bundledDateTimeValidate = getDateTime(true);
const bundledUriValidate = uri;

export { bundledDateTimeValidate, bundledUriValidate };
```

and, in the runtime module:

```js
const bundledUcs2length = ucs2length;

export { bundledUcs2length };
```

Constraints the generator enforces in Task 6, so satisfy them here: exactly one `export { … };` statement per file, on its own line, as the last statement; no `import`, no `require`, no `exports.` assignment anywhere in the file. The alias consts must exist as real declarations, because the generator strips only the export statement and the artifact resolves the `bundled*` names from the inlined body.

**Step 2:** Re-run the parity test — Expected: PASS (all three matrices match, and both pinned shape assertions hold).

### Task 6: Wire the generator post-processor (self-contained artifact)

**Files:** Modify `packages/security-audit-sdk-core/scripts/generate-contract.mjs`

`emitStandaloneValidator` is at line 299; its result is written at line 66. Add `import assert from "node:assert/strict";` and `readFile` to the existing `node:fs/promises` import, then:

```js
const vendorRoot = resolve(packageRoot, "vendor");
const EXPORT_STATEMENT = /^export \{[^}]*\};$/m;
const TOP_LEVEL_DECLARATION = /^(?:const|function)\s+([A-Za-z_$][\w$]*)/gm;
const STRICT_DIRECTIVE = '"use strict";';

const REPLACEMENTS = Object.freeze([
  ['require("ajv/dist/runtime/ucs2length").default', "bundledUcs2length"],
  ['require("ajv-formats/dist/formats").fullFormats["date-time"]', "{ validate: bundledDateTimeValidate }"],
  ['require("ajv-formats/dist/formats").fullFormats.uri', "bundledUriValidate"],
]);

const ATTRIBUTION_HEADER = [
  "/* Bundled runtime code, MIT licensed, inlined by scripts/generate-contract.mjs per ADR-SDK-011:",
  " * - ajv 8.20.0 runtime helper ucs2length (https://github.com/ajv-validator/ajv)",
  " * - ajv-formats 3.0.1 date-time and uri validators (https://github.com/ajv-validator/ajv-formats)",
  " * Sources: vendor/bundled-validator-runtime.mjs, vendor/bundled-validator-formats.mjs. See DEPENDENCIES.md. */",
].join("\n");

async function readVendoredSource(name) {
  const text = await readFile(resolve(vendorRoot, name), "utf8");
  assert(EXPORT_STATEMENT.test(text), `${name} must carry exactly one export statement`);
  const body = text.replace(EXPORT_STATEMENT, "").trimEnd();
  assert(!/\b(?:import|require)\s*[({]/.test(body), `${name} must not reference external modules`);
  return body;
}

function declaredNames(source) {
  return [...source.matchAll(TOP_LEVEL_DECLARATION)].map((match) => match[1]);
}

function bundleValidatorRuntime(code, vendored) {
  assert(code.startsWith(STRICT_DIRECTIVE), "generated validator does not open with the strict-mode directive");
  for (const name of declaredNames(vendored)) {
    assert(!new RegExp(`(?:const|let|var|function)\\s+${name}\\b`).test(code), `bundled name ${name} collides with generated code`);
  }
  let bundled = code.slice(STRICT_DIRECTIVE.length);
  for (const [pattern, replacement] of REPLACEMENTS) {
    assert(bundled.includes(pattern), `expected generated validator to reference ${pattern}`);
    bundled = bundled.replaceAll(pattern, replacement);
  }
  assert(!/require\s*\(/.test(bundled), "generated validator is not self-contained");
  return [STRICT_DIRECTIVE, ATTRIBUTION_HEADER, vendored, bundled.trimStart()].join("\n");
}
```

`emitStandaloneValidator` reads the two vendored bodies (runtime first, then formats — a fixed order, for determinism) and returns `bundleValidatorRuntime(standaloneCode(ajv, validate), vendored)`. Keep it table-driven (CodeScene: ≤3 decision points, no nested branches).

Three properties this shape buys, each of which is the fix for a specific draft defect: `"use strict";` stays the first statement; the whole vendored body — constants and helpers included — reaches the artifact; and the collision assert catches any future ajv identifier that happens to match a vendored name before the artifact is written.

**Step 2:** Regenerate + drift check:

```sh
npm run generate --prefix packages/security-audit-sdk-core
npm run check:generated --prefix packages/security-audit-sdk-core
grep -c 'require(' packages/security-audit-sdk-core/src/generated/schema-validator.generated.cjs   # expect 0
head -c 400 packages/security-audit-sdk-core/src/generated/schema-validator.generated.cjs
```

Expected: artifact written; drift check passes on re-run; zero requires; `"use strict";` first, then the attribution header.

**Step 3:** Existing runtime validation suite (both format shapes exercised through the full build):

```sh
npm run test:runtime --prefix packages/security-audit-sdk-core
```

Expected: PASS. This is also the control on identifier collisions and on the `uri` call shape — a wrong shape throws `formats4 is not a function` on any event carrying `authenticated_principal.issuer` or `authentication.identity_provider`, both of which the fixtures exercise.

### Task 7: Packed-consumer closure test (S-6 regression, RED → GREEN)

**Files:** Create `packages/security-audit-sdk-core/tests/verification/packed-consumer-closure.test.mjs`

Test outline (runs inside `npm run validate`, after `build`; cwd = package root):

1. Assert `dist/index.js` and `dist/generated/schema-validator.generated.cjs` exist, failing with "run npm run build first" if not. Do not skip — a skipped gate is not a gate.
2. `mkdtemp` a consumer dir + pack dir; `npm pack --pack-destination <packdir> --ignore-scripts` (silent); expect exactly one `.tgz`. Pack destination must be outside the package root: `check-package-contents.mjs` rejects any packed `.tgz` path, and it runs earlier in the chain.
3. Write a minimal `package.json` (`{"name":"consumer","private":true,"type":"module"}`) into the consumer dir *before* installing. Without it npm walks up to the nearest ancestor manifest and installs there instead — harmless under `os.tmpdir()`, silently wrong anywhere else.
4. `npm install <tgz> --omit=dev --no-audit --no-fund --ignore-scripts --offline --loglevel=error` in the consumer dir. `--offline` is safe and verified: a zero-dependency local tarball needs no registry access.
5. Write a consumer ESM module in the temp dir that imports **by package specifier** (`@bloodtrail/security-audit-sdk-core` and `@bloodtrail/security-audit-sdk-core/testing`) and re-exports what it finds, then `await import()` that module. Importing `dist/index.js` by path would bypass the export map, and #68's first acceptance criterion is about the public exports. Assert `createSecurityAuditSdk` and `validateSecurityAuditEvent` from the root entry and both test sinks from `./testing`.
6. Positive: `validateSecurityAuditEvent(validEvent) === true`. Negative structural: mutate a required field → `false` with errors. Negative semantic: set `event.timestamp = "2026-02-30T10:30:00Z"` → `false` (proves the BUNDLED date-time validator is live in the consumer install — not just that the import works). Include one event carrying a `uri`-format field so the bare-function replacement is exercised end to end.
7. Static: read the installed `dist/generated/schema-validator.generated.cjs` → assert no `require(` substring, the attribution header is present, and the file still opens with `"use strict";`.
8. `finally`: remove both temp dirs.

The test reads the live tree rather than a disposable clone, which is the one deliberate exception to that convention: `npm pack --pack-destination <outside> --ignore-scripts` performs no write inside the package, and the convention exists to stop writes from corrupting the snapshots sibling test files take in parallel. State that rationale in a file-header comment so the next reader does not "fix" it.

Before Task 6 this test fails with `MODULE_NOT_FOUND: Cannot find module 'ajv/dist/runtime/ucs2length'` — that is the RED proof and the S-6 reproduction, now regression-locked.

**Step 2:** Run it directly: `node --test packages/security-audit-sdk-core/tests/verification/packed-consumer-closure.test.mjs` — Expected: PASS after Task 6 (takes ~10–30 s: pack + offline install).

### Task 8: DEPENDENCIES.md attribution

**Files:** Modify `packages/security-audit-sdk-core/DEPENDENCIES.md`

- Update the ajv row purpose: "Compile the approved Draft 2020-12 schema into a dependency-free standalone validator and supply the bundled `ucs2length` runtime helper."
- Update the ajv-formats row purpose: "Supply standards-compatible URI and date-time format validation during standalone generation; the `date-time` and `uri` validators are bundled into the generated artifact."
- Add a `## Bundled code` section: table rows for `ucs2length` (ajv 8.20.0, MIT), `date-time` and `uri` validators (ajv-formats 3.0.1, MIT), each with the vendored source path (`vendor/bundled-validator-*.mjs`), the target artifact, and the ADR-SDK-011 reference. Keep the "Runtime dependency count must remain zero" rule intact (it stays TRUE after this fix).

`check-dependencies.mjs` asserts, per devDependency, that the record contains the backticked name and the literal `| <version> |`. Preserve the existing four table rows verbatim apart from the two purpose cells.

### Task 9: Full read-only verification (empty index, BEFORE staging T)

Confirm the index is empty and this plan file is whitespace-clean first — untracked files are in `changedPathsSince`, so a trailing space anywhere in `.hermes/plans/` fails `test:git`.

```sh
npm run check:generated --prefix packages/security-audit-sdk-core
npm run validate --prefix packages/security-audit-sdk-core
```

Run `check:generated` before `validate`, exactly as CI does: `validate` runs `generate` first and would mask committed drift.

Expected: all 20 chained gates pass — including the two NEW verification tests (parity + packed-consumer), `test:coherence` (adr-count 11 still; `compat-module` and `runtime-dependencies` unchanged), `test:changed-paths` (archived mode; new `vendor/` and `tests/verification/` files classify `sdk-package`), `test:git` (empty index).

```sh
npm run validate --prefix contracts/security-audit
node openspec/scripts/check-design-pattern-governance.mjs --phase assessment
node openspec/scripts/check-design-pattern-governance.mjs --phase implementation
node openspec/scripts/check-design-pattern-governance.mjs --phase final
node openspec/scripts/run-governance-dual-check.mjs
node --test openspec/tests/design-pattern-governance/*.test.mjs
openspec validate bundle-validator-runtime-helpers --strict
openspec validate --all --strict
```

Expected: all green. `--phase final` passes with the change unsigned (a legitimate pre-signing state — `verifyUnsignedChange` is keyed per change id and this id has never been signed). Association: capabilities + owned_paths cover every `packages/` path in the range, `verification-lifecycle.json` included. Dual check: identical checker blobs (we touch no `openspec/scripts/`).

### Task 10: Commit T

```sh
git add packages/security-audit-sdk-core/scripts/generate-contract.mjs \
        packages/security-audit-sdk-core/vendor/bundled-validator-runtime.mjs \
        packages/security-audit-sdk-core/vendor/bundled-validator-formats.mjs \
        packages/security-audit-sdk-core/src/generated/schema-validator.generated.cjs \
        packages/security-audit-sdk-core/tests/verification/bundled-formats-parity.test.mjs \
        packages/security-audit-sdk-core/tests/verification/packed-consumer-closure.test.mjs \
        packages/security-audit-sdk-core/DEPENDENCIES.md
git diff --cached --check && git diff --cached --name-status   # exactly the 7 paths
git commit -m "fix(sdk): bundle validator runtime helpers and formats for production-only installs"
git rev-parse HEAD   # T_SHA
```

`verification-lifecycle.json` is in `owned_paths` but is NOT staged here — it changes only at S.

Do NOT re-run tests after this commit (verified candidate preserved byte-for-byte).

### Task 11: Push, PR, CI

Re-check `origin/main` has not moved before pushing (Corrections 7). If it has, stop and report: rebasing rewrites T and the whole cycle restarts.

```sh
git push -u origin feat/bundle-validator-runtime-helpers
gh pr create --base main --head feat/bundle-validator-runtime-helpers \
  --title "fix(sdk): bundle validator runtime helpers and formats for production-only installs" \
  --body-file <PR_BODY>
```

PR body: issue #68 link, ADR-SDK-011 basis, mechanism summary, the three replacement targets and their two distinct call shapes, fail-closed asserts, parity-test evidence, packed-consumer evidence, security classification (full assessment, security_sensitive true), scope (no compatibility.json / package.json / lockfile / sonar-project.properties changes), the ~10–30 s added to every `validate`, "owner merges identity-preserving; signed record + archive follow", AI-disclaimer line. Then:

```sh
gh pr checks <PR> --watch --interval 20
gh pr view <PR> --json state,mergeable,mergeStateStatus,headRefOid
```

Expected: all required contexts green (ci/*, sdk, contract, sonar, conventional-commits, codescene delta, design-pattern-governance), MERGEABLE/CLEAN at T.

Quality-gate watch, in priority order:

- **sonar** is the likeliest red. The gate is `new_violations = 0` and `sonar.tests` covers the two new test files, so any issue there blocks the PR. Read the failing conditions from the job's "Explain quality gate failure" step, or query the `sonarqube` MCP server directly for the exact rule and line. Fix findings in the code; never by suppression, and never by weakening a transcription.
- **codescene delta**: keep `bundleValidatorRuntime` and `readVendoredSource` table-driven. Remember CodeScene silently skips functions with `readonly` parameters, so a green delta is not proof a function is healthy.

If either fires, land the fix as new commits and re-approve the cumulative tip per the landing-cycle skill.

### Task 12: Owner approval → S (signed record)

Per the landing-cycle skill — approval mechanics: ask Fernando in plain chat naming exact T_SHA and the actions it authorizes (S bound to T + identity-preserving merge). One word approves; a clarify timeout is NOT approval. His own pushed commits get governed treatment: this is normative → the re-signing cycle applies.

After approval, write S: **add** one entry to `packages/security-audit-sdk-core/verification-lifecycle.json` `governanceRecords` (never two records for one change): `change: "bundle-validator-runtime-helpers"`, `reviewedCommit: T`, `candidateRoot: T's tree`, `reviewedContent.entries` = cumulative subtree objects (`git rev-parse T:path`, trees only) for every normative path of the change, `governedCommits` (P/A/T), `checkerResults` documenting the exact-T green runs, `signatureDecision` quoting the approval verbatim, `signed: true`, `withheld` non-empty. Preflight S in a disposable clone as a direct child of the branch tip; final phase must be ZERO; full SDK validate (build first) + contracts + strict openspec; prove byte identity; commit:

```sh
git commit -m "docs(governance): sign the validator runtime helper bundling"
git push
```

CI must be fully green at S. PR body updated to reflect the S head. S touches only the record path, which `reportStalePaths` treats as permitted, so it does not stale its own binding.

### Task 13: Owner merges M (identity-preserving)

Report merge readiness (never merge). Confirm `main` still has not moved: `mergeSpecificPaths` reports only paths new against *every* parent, so a clean identity-preserving merge contributes nothing to the staleness scan — but any third-party commit that entered `T..M` does. After his merge: verify two parents (old main + S), T/S reachability, `git pull --ff-only` on local main.

### Task 14: Archive PR (separate, immediately after merge)

New branch `feat/archive-bundle-validator-runtime-helpers` off fresh origin/main. Run:

```sh
openspec archive bundle-validator-runtime-helpers --yes
```

(With spec deltas — NO `--skip-specs`.) This moves the change byte-for-byte to the dated archive and folds the delta into `openspec/specs/security-audit-sdk-core/spec.md`. Then:

```sh
openspec validate --all --strict
git diff --check && git status --short
git add openspec
git diff --cached --check && git diff --cached --name-status
git commit -m "docs(openspec): archive bundle-validator-runtime-helpers"
git push
gh pr create --base main --head feat/archive-bundle-validator-runtime-helpers \
  --title "docs(openspec): archive bundle-validator-runtime-helpers" \
  --body-file <ARCHIVE_PR_BODY>
```

Verification: active change dir gone, dated archive exists with identical content, spec delta folded (inspect the new Requirement in `openspec/specs/security-audit-sdk-core/spec.md`), the staged diff is a pure archive movement + spec fold, governance checker green. Two mechanisms make it green and both must hold: the dated archive is recognised as a genuine relocation (`carriesRelocatedArtifact` matches the archived `assessment.json`/`proposal.md` against the object history carried at the active path), which retires the change from the freshness scan; and the spec-fold path is covered by the still-active `record-validator-packaging-policy`, whose assessment declares the same capability (Corrections 8). Do not archive that change in this PR or before it. Owner merges.

### Task 15: Close #68

After the archive merges: verify the spec + artifact at main, then post the AI-disclaimer evidence comment on #68 (permalinks: T commit, PRs, the spec requirement at main, the generated artifact at main, ADR-SDK-011) and close: `gh issue close 68 --repo nandohdc/bloodtrail --reason completed` (+ label cleanup: remove `needs-triage`; keep bug/severity/area labels as historical classification). #69/#70/#71 remain open in dependency order.

---

## Tests / validation summary

- `node --test tests/verification/bundled-formats-parity.test.mjs` — RED before Task 5, GREEN after; the transcription-correctness anchor, and the guard on both pinned entry shapes.
- `node --test tests/verification/packed-consumer-closure.test.mjs` — S-6 reproduction inverted into a regression (RED pre-fix, GREEN post-fix), importing by package specifier so the export map is exercised.
- `npm run generate` + `check:generated` — deterministic regeneration; drift check byte-for-byte. Editing a vendored module changes the artifact, so regeneration is mandatory after Task 5.
- `npm run test:runtime` — the control on the `uri` call shape and on identifier collisions between vendored and generated names.
- `npm run validate --prefix packages/security-audit-sdk-core` (20 gates incl. new tests), `npm run validate --prefix contracts/security-audit`.
- Governance: checker phases, dual check, 196-test suite, `openspec validate --strict` (change + --all).
- CI: all required contexts at T and again at S; archive PR green at its head.

## Risks, tradeoffs, open questions

1. **Mainline must stay still from T to the archive:** R15 scans `commitsBetween(T, HEAD)`, so any unrelated commit that enters that range stales the record on every normative path it touched, and rebasing to escape it would rewrite T. Plan the merge and the archive PR in the same session and do not interleave other PRs from Task 10 onward.
2. **Sonar `new_violations = 0` is the tightest gate:** the vendored placement keeps the transcription out of `sonar.sources`, but the two new test files are in `sonar.tests` and are analysed. Keep them plain. If `sonar` reports a finding, fix the code — a suppression or a transcription edit is not an option.
3. **Hand-transcription correctness:** the two format validators are closures — verbatim source inlining is the bundling mechanism. The parity matrix is the guard; if the matrix diverges on any input, fix the transcription, never the expectation. The parity test imports ajv-formats/ajv from devDeps — pinned by the lockfile.
4. **Identifier collision between vendored and generated names:** today ajv emits only `schemaN`/`funcN`/`patternN`/`formatsN`/`validateN`/`dataN`/`errN`/`vErrors`/`errors`, none of which collide. The generator's collision assert fails generation if that ever changes, and `test:runtime` would fail loudly on a duplicate declaration regardless.
5. **Format edge semantics:** semantic date validity (e.g. `2023-02-30`) is now regression-locked by the closure test; today no test covers it — this change ADDS that coverage.
6. **Validate-chain runtime cost:** the packed-consumer test adds ~10–30 s (pack + offline install) to every `npm run validate`. The `sdk` CI job runs a single Node version, so the cost is paid once per run, and `test:matrix` does not include `test:verification`. Acceptable; note it in the PR body.
7. **ajv/ajv-formats version bumps:** any future bump regenerates a different artifact — the fail-closed unknown-require assert, the shape assertions, and the parity matrix will flag behavioral or structural changes at generation/test time.
8. **compatibility.json untouched:** its `runtimeDependencyCount: 0` / `modulePolicy` claims become TRUE after this fix (per ADR-011, no rewrite needed). If a reviewer prefers an explicit new key documenting the bundling, that is a scope change for the owner to authorize — default is no metadata change.
9. **#68 label/state transitions:** move `needs-triage` → `ready-for-agent` when work starts (optional, consistent with #67 flow); close only after the archive lands.
10. **Owner decisions needed:** (a) approval of exact T + S + merge (bundled or split per landing-cycle skill); (b) #68 closure confirmation. Neither is inferred from CI or PR state.

## What was not verified

Plan mode: nothing executed against the repository. Facts verified read-only at 3003e73: the generated artifact's exact require set, call shapes, and `.compare` count; `typeof fullFormats.uri === "function"` and `fullFormats["date-time"]` keys against the installed ajv-formats 3.0.1; the upstream line ranges named in Task 5; `check-scope.mjs`, `check-changed-paths.mjs`, `check-git-state.mjs`, `check-dependencies.mjs`, `check-package-contents.mjs`, `check-publication-path.mjs`, and `check-coherence.mjs` behaviour on the new paths; `perimeter.mjs` / `review-freshness.mjs` / `archive-relocation.mjs` association and freshness semantics; the assessment closed schema; `sonar-project.properties` scope and the live quality-gate conditions; the six Sonar findings the verbatim transcription raises under the project's own profile; `npm install` of a private zero-dependency tarball into a `mkdtemp` directory, with and without `--offline`, and npm's ancestor-manifest walk when the consumer directory has no `package.json`. The parity matrix outcomes are predictions; Tasks 4/5 produce the real evidence.
