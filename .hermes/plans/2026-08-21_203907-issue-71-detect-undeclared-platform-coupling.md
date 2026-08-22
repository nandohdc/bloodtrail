# Issue #71 — Detect Node Globals and Generated Runtime Imports in the Scope Gate — Triage and Implementation Plan

> **For Hermes:** Triage first, implement second. #71's "Current state" is **accurate** — unlike #70's
> — but its *scope* has shrunk since it was filed against `main@71dbd95`. Two of its four acceptance
> criteria are already satisfied by gates that landed in #68/#69, and one of PLAN-014's named
> sub-classes (Node engine support) is already pinned by `check-compatibility.mjs`. Task 0 measures
> that, Task 1 posts a durable brief that restates the residual gap and promotes the issue; only then
> is the change proposed. The normative term is **platform coupling**, and the admission states are
> **declared** and **undeclared** — do not write "allowed"/"forbidden", which the existing scope gate
> already binds to the production-integration surface. Execute with the `openspec-propose` /
> `openspec-apply-change` / `openspec-verify-change` / `openspec-sync-specs` /
> `openspec-archive-change` skills. TDD is load-bearing: PLAN-074 asks for a failing twin per failure
> class, and this gate's hardest failure mode is a false *positive*, so the negative controls matter
> as much as the mutations. Verify read-only with an empty index before every commit. Do NOT merge —
> the owner merges.

**Goal:** Make `npm run test:scope` classify every platform coupling in the SDK's runtime sources —
authored and generated, module specifiers and free global identifiers — against a declared policy,
fail closed on any coupling it cannot assign to a declared boundary, and report the declared coupling
inventory on the passing path.

**Architecture:** One new pure module,
`packages/security-audit-sdk-core/scripts/platform-coupling-policy.mjs`, holds the declared coupling
policy as frozen data and inspects `src/` with the TypeScript AST — the same mechanism
`shipped-import-policy.mjs` already uses for shipped artifacts, applied to source instead. It walks
every code artifact under `src/` including `src/generated/`, collects free identifiers in value
position and module specifiers in every import/export/require position, classifies each against the
policy for that artifact's role (`authored` or `generated`), and returns an inventory plus bounded
violations. `check-scope.mjs` keeps its filename regex, its source-content regexes, and its manifest
assertions **verbatim**, and gains the coupling stage. A new verification file carries the mutation
arms, the fail-closed arms, and two negative controls that prove the scan does not over-report. One
ADDED requirement lands in the `security-audit-sdk-core` capability, three terms land in the existing
package `CONTEXT.md`, and one system-wide ADR records why coupling is declared data rather than
banned outright.

**Tech Stack:** ESM `.mjs` under `packages/security-audit-sdk-core/scripts/` and
`tests/verification/`, `typescript` 5.9.2 (already a devDependency, already imported by
`shipped-import-policy.mjs`), `node --test`, openspec CLI 1.10.0 (verified on PATH), git + gh, Node
pinned `>=24 <25 || >=26 <27`, npm via `--prefix` only (there is no root `package.json`).

**Known pins (re-verified read-only on 2026-08-21; every anchor below was read or measured, not assumed):**

| Role | Value |
| --- | --- |
| Landing baseline (`HEAD` == `main` == `origin/main`, clean) | `39506dbfcd697da4b85f96dfab5e6b30fa06b07c` |
| Issue | #71, OPEN, labels `enhancement` `security-audit-sdk` `verification` `area:core` `needs-triage` |
| Dependencies | #67 CLOSED 2026-08-17; `issue_dependencies_summary.blocked_by` is `0` |
| Active OpenSpec changes | none — `openspec/changes/` contains only `archive/` |
| Open PRs | only #182 (`chore: release v0.4.0`, release-please) |
| Scope gate today | `packages/security-audit-sdk-core/scripts/check-scope.mjs`, 3146 bytes, 66 lines, regex-only |
| Generated skip | `check-scope.mjs:30` — `if (relativePath.startsWith("src/generated/")) continue;` |
| Extension filter | `check-scope.mjs:63` walk admits `.ts` only, so `src/generated/*.cjs` is doubly invisible |
| Buffer sites in `src/` | `src/errors.ts:81`, `src/validation/prohibited.ts:89` — both `Buffer.byteLength(…, "utf8")` |
| Generated CJS | `src/generated/schema-validator.generated.cjs`, 247908 bytes, **0** `require(` calls, `module.exports` at line 169 |
| `src` / `dist` validator | byte-identical, sha256 `928de489f60c81cdbcfc07785ba419fbda4e8f4c69a4715a69b64342eddcf2bc` |
| Scope summary today | `scope passed: 17 SDK source files, …` — the count string appears nowhere but `check-scope.mjs:55` |
| Existing scope arms | `tests/verification/mutations.test.mjs:598`, `:627`, `:639` (filename boundary, benign substrings, content/dependency) |
| Canonical scope requirement | `openspec/specs/security-audit-sdk-core/spec.md:492`, filenames and public API only |
| Canonical spec size | 49 `### Requirement:` headers, 0 delta operation headers |
| Gate cost today | `test:scope` 0.03 s; a full AST pass over the same tree measured 0.20 s |
| SDK ADR sequence | pinned at exactly 11 by `check-coherence.mjs:190-191` |
| Root ADRs | `docs/adr/0001`, `0002`, `0003` — unpinned, `documentation_only` |
| Package `CONTEXT.md` | exists (created by #70); no root `CONTEXT-MAP.md` |
| Lifecycle mode | `archived` |
| Required PR checks | `ci / lint`, `ci / test`, `ci / audit`, `sonar`, `sdk`, `contract`, `conventional-commits`, `codescene delta`, `design-pattern-governance` |
| Landing-shape precedent | PRs #195 / #196 / #197 (`becfa36`, `534ae9d`, `39506db`) |
| Node / npm / openspec on this workstation | v26.7.0 / 11.19.0 / 1.10.0 |

---

## Proven findings

F1–F8 are measured: every probe ran in a package **copy** under the session scratchpad, never in the
live tree. F9 onward are read from source at `39506db`.

### F1 — #71's "Current state" is accurate, and both halves still hold

Unlike #70, this issue's premise did not rot. `check-scope.mjs:30` still skips `src/generated/`, its
walk at `:63` still admits `.ts` only, and `src/errors.ts:81` and `src/validation/prohibited.ts:89`
still call `Buffer.byteLength(…, "utf8")`. Nothing in #68, #69, or #70 touched `check-scope.mjs`.

**Do not open this change by correcting the issue.** Open it by narrowing it (F3, F4).

### F2 — Measured: the scope gate is blind to every coupling class this issue names

Nine arms, each in a fresh package copy, running `node scripts/check-scope.mjs` from the copy:

| Arm | Mutation | Exit | Verdict |
| --- | --- | --- | --- |
| null control | none | 0 | control passes — 17 SDK source files |
| Buffer global | `Buffer.byteLength(text, "utf8")` in a new authored function | **0** | **blind** |
| `process` global | `process.env.AUDIT_PROBE` in a new authored function | **0** | **blind** |
| generated CJS require | `require("ajv/dist/runtime/ucs2length")` prepended to the generated validator | **0** | **blind** |
| generated TS import | `import ajv from "ajv"` prepended to `contract.generated.ts` | **0** | **blind** |
| unprefixed built-in | `import { createHash } from "crypto"` in authored source | 1 | **caught** — existing control works |
| evaded `fetch` | `globalThis["fe" + "tch"](u)` in authored source | **0** | **blind** |
| Node timer handle | `setTimeout(…)` then `t.unref()` in a second authored file | **0** | blind |
| widened engines | `engines.node` set to `">=18"` | **0** | blind here (see F4) |

Two things follow. The import loop is the *only* stage that works, and it works because a bare
specifier is syntactically distinguishable — the content regexes are the weak part. And the
string-concatenation arm is the proof that a regex is the wrong instrument: it is not a corner case,
it is one line, and it defeats `/\b(?:fetch|WebSocket|XMLHttpRequest)\s*\(/` completely.

### F3 — Measured: the generated-import criterion is already satisfied — by two other gates

The same generated-CJS `require` mutation, applied to **both** the `src/` and `dist/` copies of the
validator, run against three gates in one package copy:

| Gate | Exit | Signal |
| --- | --- | --- |
| `check-scope.mjs` | **0** | blind |
| `check-dependencies.mjs` (#69) | 1 | `shipped import policy violations:` — **genuine detection** |
| `generate-contract.mjs --check` | 1 | `generated artifact drift:` — **genuine detection** |

So #71's third acceptance criterion, "An unauthorized generated import mutation fails", is **already
true today**. `check:generated` catches a hand-edit to the generated output, and `check-dependencies`
catches a generator that starts emitting an external specifier, because `dist/generated/` is packed
and inspected. Say this plainly in the proposal, the PR body, the brief, and the closing comment.

What is *not* true is that `test:scope` catches it, and the issue names `test:scope`. This change adds
source-level detection as defence in depth and closes the named blind spot — it does not repair a
hole in the artifact's coverage.

### F4 — Measured: the Node-engine coupling class is already pinned, twice

`check-compatibility.mjs:20` asserts `packageJson.engines.node === ">=24 <25 || >=26 <27"` as a
literal, and `check-coherence.mjs:128` asserts it against `compatibility.json`. In a package copy with
`engines.node` widened to `">=18"`: `check-compatibility.mjs` **exit 1**, `check-scope.mjs` exit 0.

PLAN-014 names "Node engine support" as one of the six coupling classes. It is covered. Adding an
engine assertion to `test:scope` would be duplicative ceremony, and it would put a second source of
truth next to `compatibility.json`. **Scope it out with the evidence, not by omission.**

### F5 — Measured: nothing anywhere detects a Node global

`collectSpecifiers("dist/generated/schema-validator.generated.cjs", <a Buffer.byteLength artifact>)`
returns `specifiers: []` and `failures: []`. #69's policy collects module specifiers; a global is an
identifier reference and is never collected. Its own canonical scenario says so — "Bundled module
contributes no specifier … verification passes".

With `Buffer.byteLength` and `process.pid` injected into `src/internal.ts`, `dist/internal.js`, and
the shipped generated validator:

| Gate | Exit | Verdict |
| --- | --- | --- |
| `check-scope.mjs` | 0 | blind |
| `check-package-contents.mjs` (#70) | 0 | blind — the install imports fine, because Node has `Buffer` |
| `check-dependencies.mjs` | 1 | **harness artifact, not detection** — see F6 |

**The global-identifier class is uncovered end to end.** That is this change's real subject, and it is
the one thing #68, #69, and #70 did not touch.

### F6 — The null control was necessary again, and it fired again

`check-dependencies.mjs` exited 1 on the Buffer arm. A null control — the identical copy harness with
**no** mutation — also exits 1, printing `npm ls` JSON with `extraneous: fast-deep-equal@3.1.3 …`
because the copy's `node_modules` is a symlink to the live tree. On the live tree the same script
exits 0.

The generated-require arm's exit 1 (F3) was real, and the difference is visible only in the
**diagnostic text**: `shipped import policy violations:` versus an `npm ls` problem list. Therefore:

- assert on diagnostics, never on exit status alone, for anything that shells out to `npm`; and
- every differential in this change carries a null arm, including the fail-closed ones.

### F7 — Measured: the declared coupling set is small enough to enumerate

An AST pass over `src/` collecting identifiers that are referenced but not declared in the same file,
restricted to **value** position (type positions and property positions excluded), yields **30**
distinct names. Six of those are artifacts of the probe's file-local approximation (`boundEvent`,
`correlationId`, `operationId`, `transactionId`, `size`, `state` — object-literal shorthand and
destructuring the probe did not fully bind). The remaining **24** are the real free-global set:

| Class | Names | Sites |
| --- | --- | --- |
| ECMAScript language globals | `Array` `Boolean` `Date` `Error` `JSON` `Map` `Number` `Object` `Promise` `RangeError` `Reflect` `RegExp` `Set` `String` `TypeError` `WeakMap` `WeakSet` `isFinite` `isNaN` `structuredClone` | authored and generated |
| Universal timer globals | `setTimeout` `clearTimeout` | `src/sdk.ts` |
| **Node host global** | **`Buffer`** | `src/errors.ts`, `src/validation/prohibited.ts` |
| **CommonJS wrapper global** | **`module`** | `src/generated/schema-validator.generated.cjs` |

`src/generated/contract.generated.ts` contributes **no** value-position free identifier at all; its
free names are type-only (`Extract`, `NonNullable`, `Omit`, `Partial`, `Pick`, `ReadonlyArray`).

Three consequences, and they are the whole design:

1. The declared policy is a list of about two dozen names, not an open-ended judgement. "The approved
   coupling set passes" is achievable and reviewable.
2. **Type positions must be excluded**, or the policy fills with TypeScript utility types that erase
   at compile time and couple to nothing.
3. **The false-positive risk is the real risk.** The probe produced six of them at file-local
   granularity. A gate that reports a bound local as a platform coupling will be silenced, and a
   silenced gate is worse than none. The negative controls in Task 5 are not optional.

### F8 — Measured: the AST pass costs 0.17 s more than the gate costs today

`test:scope` today: 0.03 s (0.17 s cold). A full AST pass over all of `src/` including the 248 KB
generated validator: 0.20 s, three runs, stable. `test:scope` is in **both** `validate` and
`test:matrix`, so this cost lands twice per matrix run. It is still negligible, and the number should
be re-measured on the CI runner before it is quoted in a PR body.

### F9 — The gate's three stages, and which one is worth keeping

`check-scope.mjs` has three kinds of rule, and they are not equally sound:

- **Filename regex** (`FORBIDDEN_NAME_TERMS`, path-segment and delimiter bounded) — sound, well
  covered by `mutations.test.mjs:598`, and out of this change's way.
- **Import-specifier loop** — sound for what it does: any non-relative specifier that is not
  `node:async_hooks` or `node:crypto` is a violation. This is the stage the coupling scan generalises.
- **Source-content regexes** — the weak stage. `/\b(?:http|https|net|tls|dgram|fs|…)\b/` matches the
  *word* `fs` or `net` anywhere in the file, comments and string literals included, and
  `/\b(?:fetch|…)\s*\(/` is defeated by one string concatenation (F2). Both false-positive-prone and
  false-negative-prone.

**Keep all three verbatim.** Replacing the content regexes is a separate change with its own risk;
this one adds a stage that is sound by construction and leaves the weak stage untouched. Say so as an
assurance limitation rather than quietly implying the gate is now sound end to end.

### F10 — Six coupling classes, with today's coverage for each

PLAN-014 asks for all six platform-coupling classes. The source plan
(`Bloodtrail architecture & roadmap — adversarial review`, SHA-256 `616c28f6…`) is **not in this
repository** — its identifiers appear only in issue bodies — so the mapping below is derived from what
the tree actually exhibits, not read from the plan. Flag that in the brief; do not assert the six are
PLAN-014's six.

| # | Class | Covered today by | This change |
| --- | --- | --- | --- |
| 1 | Module specifier in authored source | `check-scope.mjs` import loop (measured: caught) | generalised, behaviour preserved |
| 2 | **Free global identifier in authored source** | **nothing** (F2, F5) | **added** |
| 3 | Module specifier in generated source | `check:generated` + `check-dependencies.mjs` (measured: both catch) | added at source, defence in depth |
| 4 | **Free global identifier in generated source** | **nothing** (F5) | **added** |
| 5 | Module-format interop — ESM importing a `.cjs` default export at `src/validation/schema.ts:1` | declared as `compatibility.json`'s `modulePolicy`, gated by nothing | declared in policy data; the `generated` role is what makes it explicit |
| 6 | Runtime version — `engines.node` | `check-compatibility.mjs:20`, `check-coherence.mjs:128` (measured: caught) | **out of scope** (F4) |

There is a **seventh** coupling shape this change does not detect: host-object member access.
`src/sdk.ts:387` calls `timer.unref()`, which exists on Node's `Timeout` and not on a browser's
numeric handle. It is a property access, not a free identifier, and detecting it would need either
type resolution or an allowlist of member names with a large false-positive surface. The canonical
spec already authorises it — `spec.md:523`, "SHALL unreference it where supported". **Declare it in
the policy data as a documented coupling the gate does not mechanically detect, and state it as an
assurance limitation.** Do not claim coverage the control does not have.

### F11 — Name-bound per role, not site-bound

`Buffer` is declared for the `authored` role, `module` for the `generated` role. A *new use* of an
already-declared global passes; a *new global* fails and needs a policy edit.

Site-binding — pinning `Buffer` to exactly `src/errors.ts` and `src/validation/prohibited.ts` — was
considered and is rejected: it is an enumeration that drifts on every legitimate refactor, and it has
no precedent here. `allowedNodeImports` already works this way for `node:crypto`: any `src/` file may
import it. Consistency with the stage being generalised is worth more than the marginal tightening.
State the limit plainly: this gate bounds **which** host capabilities the SDK uses, not **where**.

### F12 — Do not remove `Buffer`

`Buffer.byteLength(s, "utf8")` has a portable spelling (`new TextEncoder().encode(s).length`), and
this change must not adopt it. #71's "Out of scope" says so directly: "No Core extraction, topology
change, or blanket ban on approved Node coupling." The point of the gate is to make the coupling
*declared and visible*, so that a later Core-extraction change can act on a complete inventory. A
change that both inventories and silently drains the inventory proves nothing about the gate.

### F13 — `globalThis` should be banned outright, which closes the evasion for free

`globalThis` appears **zero** times in `src/`. Excluding it from every role's declared set makes the
measured evasion arm (`globalThis["fe" + "tch"](u)`, F2) fail as an undeclared global, with no special
rule for computed member access and no dynamic-analysis machinery. If a future need arises it goes
through a policy edit with a recorded reason, which is the correct place for that decision.

### F14 — Governance shape: full assessment, `governance_core_path` included, no signed record

- `packages/` and `openspec/specs/` are `governed_implementation` and normative, so every file this
  change touches under them needs an **exact path** entry in `owned_paths` — not a directory prefix,
  and covering all three PRs, because an active change's `owned_paths` governs future PRs too.
- **`governedPatterns` (`check-design-pattern-governance.mjs:467-474`) includes `governance_core` as
  well as `governed_implementation`.** So CLAUDE.md and `.hermes.md`, if touched, are *governed* paths
  that need `owned_paths` entries or the association fails `openspec-association-unrelated`.
- Adding a capability requirement matches `canonical_capability_requirement`; an admission control
  over the authorization boundary matches `security_sensitive_behavior`; touching CLAUDE.md matches
  `governance_core_path`. All three are `full_assessment_triggers`, so the assessment is **full**,
  `material_capability_modification: true`, `security_sensitive: true`. `true` means **no**
  `security_justification` map — the 15-dimension requirement fires on `false`.
- `isGovernanceCore` is used at `check-design-pattern-governance.mjs:345` only to set a field in the
  JSON report. It gates nothing. Review freshness (`review-freshness.mjs:337`) fires only when a
  **signed governance record** exists, and this change has none.
- **No signed governance record**, following `reject-undeclared-shipped-imports` and
  `verify-packed-artifact-completeness`. `verification-lifecycle.json` is therefore not edited, keeping
  a `governance_record_only` path out of every commit.
- The change **has** a spec delta, so `skip_specs` stays absent.
- Landing is the #195/#196/#197 shape: PR 1 propose + implement, PR 2 fold the delta into the
  canonical spec **while the change is still active**, PR 3 archive as a complete relocation. An active
  change owns `openspec/specs/<capability>/` through `applicability.capabilities`; a relocated one does
  not, so the fold cannot ride in the archive PR and cannot follow it.

### F15 — CLAUDE.md's entry becomes an incomplete enumeration, so it moves with the gate

`CLAUDE.md`'s targeted-gates table says `test:scope` enforces "the authorization boundary — forbidden
filenames, imports, and exports". That is an enumeration of stages, and after this change it is
missing one. `.hermes.md:67` says "no out-of-scope surface crept in", which stays true but should gain
the same clause; CLAUDE.md itself says to keep the two consistent. `README.md:117` and `README.md:47`
are `documentation_only` and move with them.

The cost is one trigger string and two `owned_paths` entries (F14). #69 and #70 both avoided
`governance_core`, but neither changed what a *documented* gate enforces. This one does. Take the
trigger.

### F16 — No SDK ADR is possible; a root ADR is free

`check-coherence.mjs:190` pins `adrFiles.length === 11` and `:191` the exact `001`…`011` sequence, so a
twelfth **SDK** ADR fails `test:coherence`. `docs/adr/` is unpinned, `documentation_only`, and already
holds `0001`, `0002`, and `0003`. This change's ADR is `docs/adr/0004`.

### F17 — Coherence pins nothing this change moves

No rule counts scripts, verification tests, or `src/` files. `task-count`
(`check-coherence.mjs:225`) is bound to `lifecycle.change`, which resolves to the archived remediation
change — a new change's `tasks.md` is unpinned. `node-engines` (`:128`) and the `docs-*` rules
(`:205-214`) constrain strings this change does not touch, but the package `README.md` edit must
preserve every `docs-*` substring.

`check-scope.mjs:55`'s summary string will change (it will report generated artifacts and the coupling
inventory alongside the file count). Grepped: that string occurs nowhere but the script itself.

### F18 — The lifecycle gate permits everything this change writes

`test:changed-paths` reports `archived` mode, which is what makes the PR 2 fold legal. Its
untracked-new-file rule is bounded to `ownership.sdkSourcePrefixes` — exactly
`packages/security-audit-sdk-core/src/` and `.../lib/` — so new files under `scripts/` and
`tests/verification/` classify as `sdk-package` and need no `reviewedNewSdkSourcePaths` entry.
`CLAUDE.md` classifies as `local-instruction-unrelated` (`check-changed-paths.mjs:476`) and matches no
violation rule; `.hermes.md` falls through to `unrelated-history-or-worktree`, likewise unviolating.

### F19 — Analyser exposure, and why the new control needs its own file

`sonar-project.properties:14` puts `packages/security-audit-sdk-core/scripts` in `sonar.sources`;
`:18` puts `packages/security-audit-sdk-core/tests` in `sonar.tests`. `sonar.coverage.exclusions` (`:36`)
covers `**/scripts/**`, so the new module carries no coverage duty but is fully analysed. `:24`
excludes `src/generated/**` from analysis — which is why a finding in generated code has to be a
*gate* finding, not a Sonar finding.

The new arms go in **their own file**. `mutations.test.mjs` is 59 KB and a known analyser hotspot;
file-level rules would fail `codescene delta` regardless of the quality of the new code. The
`readonly`-parameter blind spot in CodeScene CLI 1.0.37 does not apply to `.mjs`, so both analysers
should see this code — treat them as complementary. Note that #70's implementation PR needed **three**
follow-up commits (`f64b1d0`, `70b6cd6`, `6cbcbff`) for complexity and Sonar findings after the push.
Budget for that: keep every function small and single-purpose, avoid nested ternaries, prefer early
returns, and keep the scope-tracking visitor decomposed rather than one large `visit`.

### F20 — Writing about this change can trip the governance perimeter

`checkHiddenImplementation` (`perimeter.mjs:120-141`) runs on `documentation_only` and
`governance_record_only` paths, which includes `.hermes/plans/`, `docs/`, and `README.md`. Its five
signals are, verbatim from `perimeter.mjs:71-76`:
`^\+\s*export\s+(async\s+)?function\s+`, `^\+\s*export\s+class\s+`,
`^\+\s*export\s+const\s+\w+\s*=\s*(async\s*)?\(`, `^\+\s*module\.exports\s*=`, and
`^\+\s*exports\.\w+\s*=`. Note the `\s*`: **indenting the snippet does not help.** Reference symbols
by `file:line`, or write the signature without the leading keyword. This plan file does the latter.

### F21 — `.out-of-scope/` does not exist; no prior rejection applies

Checked directly: there is no `.out-of-scope/` directory in the repository, so no recorded rejection
covers this request. Say so in the brief rather than leaving it unstated.

### F22 — PR #182 is unrelated and must not be coupled to this work

`chore: release v0.4.0` (release-please) is the only open PR. It was already blocked during #70's
lifecycle on `conventional-commits` and `design-pattern-governance`; its file list includes
`version.txt` and `.release-please-manifest.json`, which match no `path_classes` pattern and so fail
closed as `path-unclassified`. Its fix is a `governance_core` policy edit and its own issue. If it
merges mid-lifecycle, re-freeze `origin/main` and rebase — a normal rebase, not a crisis.

---

## Decisions taken (settle these; do not re-litigate during execution)

| # | Decision | Why |
| --- | --- | --- |
| D1 | Triage and post a corrected brief **before** proposing | The body is accurate but two of its four acceptance criteria are already satisfied and one PLAN-014 sub-class is already gated (F3, F4). An agent implementing it verbatim would build duplicate controls |
| D2 | Extend `check-scope.mjs`; add no new npm script | #71 names `test:scope`. A new script drags CLAUDE.md's gate table in for no gain, and CLAUDE.md is already being touched for a better reason (F15) |
| D3 | Inspect with the TypeScript AST, not regexes | Measured: one string concatenation defeats the existing content regex (F2), and a word-boundary regex over raw text matches comments and string literals (F9). `shipped-import-policy.mjs` already establishes `ts.createSourceFile` as this repository's instrument for exactly this job |
| D4 | Scan **all** of `src/`, including `src/generated/`, at extensions `.ts .cts .mts .js .cjs .mjs` | The generated skip and the `.ts`-only walk are the two lines #71 exists to remove. Mirror #69's `CODE_ARTIFACT` regex rather than inventing a second one |
| D5 | Classify by **role**: `authored` (`src/`, excluding `src/generated/`) and `generated` (`src/generated/`) | Directly mirrors `SHIPPED_IMPORT_POLICY.roles`. It is what lets `module` be declared for generated CJS without declaring it for authored ESM |
| D6 | Free identifiers in **value** position only; type positions excluded | Measured: type positions contribute 14 TypeScript utility types that erase at compile time and couple to nothing (F7) |
| D7 | Declared coupling is **name-bound per role**, not site-bound | F11. Site-binding drifts and has no precedent; `allowedNodeImports` already works name-bound |
| D8 | Ban `globalThis` in every role | F13. Zero current uses, and it closes the measured evasion with no special-case machinery |
| D9 | Fail **closed**: an unknown free identifier, an unreadable artifact, an unparseable artifact, or an empty inspection set is a violation | #71's own security note: "Fail closed when coupling cannot be assigned to an approved boundary." #69's requirement already establishes the three fail-closed classes; reuse the shape and the vocabulary |
| D10 | Keep the filename regex, the content regexes, and the manifest assertions **verbatim** | F9. Replacing the weak stage is a separate change; the existing arms at `mutations.test.mjs:598/627/639` must keep passing untouched |
| D11 | Diagnostics carry a distinct `[platform-coupling:<code>]` prefix; existing scope violations keep their current shape | #71's fourth acceptance criterion is exactly this — "Diagnostics distinguish scope defects from provisional Node binding code". An arm asserts a filename mutation still yields the old diagnostic and no coupling code |
| D12 | Report the declared coupling **inventory** on the passing path | The gate's product is the inventory as much as the rejection. `test:dependencies` already prints counts; PLAN-014 asks to "account for" the classes, which a pass/fail bit cannot do |
| D13 | Do **not** add an engine check; state F4 as the reason | F4. `check-compatibility.mjs:20` and `check-coherence.mjs:128` already pin it, and a second source of truth is worse than none |
| D14 | Do **not** detect host-object member access (`timer.unref()`); declare it and state the limitation | F10. Type resolution or a member allowlist, both with large false-positive surfaces, for one already-spec'd call site |
| D15 | Do **not** remove `Buffer` or any other declared coupling | F12; #71's own "Out of scope" |
| D16 | Update CLAUDE.md and `.hermes.md`; declare `governance_core_path` and list both in `owned_paths` | F15, F14. The change alters what a documented gate enforces, and the trigger costs one string |
| D17 | Record D3/D7/D15 as root `docs/adr/0004`, not as an SDK ADR | F16. The SDK sequence is pinned at 11; `docs/adr/` is unpinned and already holds the decisions this plan depends on |
| D18 | New mutation file, package-copy harness, `node_modules` symlinked into the copy | F19 (hotspot). `check-scope.mjs` reads only the package, so the copy needs no `contracts/`; it needs `node_modules` because the module imports `typescript`. `check-scope.mjs` shells out to nothing, so the copy carries none of the `npm ls` noise F6 describes |
| D19 | Two **negative** controls are mandatory, not optional | F7. The measured false-positive rate of a naive file-local scan was six names. A gate that reports a bound local as coupling gets silenced |

---

## Files to change

**PR 1 (propose commit P, then implementation commit T)**

- Create `openspec/changes/reject-undeclared-platform-coupling/{.openspec.yaml, proposal.md, design.md, tasks.md, assessment.json, specs/security-audit-sdk-core/spec.md}`
- Create `packages/security-audit-sdk-core/scripts/platform-coupling-policy.mjs`
- Modify `packages/security-audit-sdk-core/scripts/check-scope.mjs`
- Create `packages/security-audit-sdk-core/tests/verification/platform-coupling-mutations.test.mjs`
- Modify `packages/security-audit-sdk-core/CONTEXT.md` (three terms, D11/F10)
- Modify `packages/security-audit-sdk-core/README.md` only if a `docs-*` coherence substring would otherwise go stale — otherwise leave it shut
- Create `docs/adr/0004-declare-platform-coupling-at-the-scope-gate.md` (D3/D7/D15/D17)
- Modify `CLAUDE.md` and `.hermes.md` — the `test:scope` gate line only (D16/F15)
- Modify `README.md:47` and `README.md:117` — the two `test:scope` sentences
- Add this plan file

**PR 2 (spec fold)**

- Modify `openspec/specs/security-audit-sdk-core/spec.md` (append the ADDED requirement)
- Modify `openspec/changes/reject-undeclared-platform-coupling/tasks.md` (tick the fold task)

**PR 3 (archive, pure relocation)**

- `git mv openspec/changes/reject-undeclared-platform-coupling/` to `openspec/changes/archive/<YYYY-MM-DD>-reject-undeclared-platform-coupling/`
- Add `archive-evidence.md` in the archive directory

**Explicitly untouched:** `package.json` (no new script, `files` unchanged, `engines` unchanged,
dependencies stay `{}`), `package-lock.json`, `compatibility.json`, `verification-lifecycle.json`
(F14), `packages/security-audit-sdk-core/adr/` (F16), `src/**` — including both `Buffer` call sites
(F12/D15) — `check-dependencies.mjs` and `shipped-import-policy.mjs` (#69's territory),
`check-package-contents.mjs` and `packed-completeness.mjs` (#70's territory),
`scripts/generate-contract.mjs`, `mutations.test.mjs`, `sonar-project.properties`,
`.github/workflows/`, `openspec/scripts/`, `openspec/governance/`, `CONTRIBUTING.md`, and every path
matching no `path_classes` pattern, which fails closed (F22): `version.txt`,
`.release-please-manifest.json`, and a root `CONTEXT-MAP.md`.

---

## Task 0: Preflight and re-verify the residual gap

**Files:** none. Nothing is written inside the repository in this task.

```sh
cd /Users/fernando.costa/Git/bloodtrail
git fetch --prune origin
git status --porcelain=v1 --untracked-files=all
git rev-parse HEAD main origin/main
gh issue view 71 --repo nandohdc/bloodtrail --json state,labels,url
gh api repos/nandohdc/bloodtrail/issues/71 --jq '.issue_dependencies_summary'
openspec list
```

Expected: clean tree, the three revisions equal at `39506db…` (re-check — `main` moves), #71 OPEN with
`needs-triage`, `blocked_by: 0`, and "No active changes found."

Then reproduce F2–F5 in package **copies**. This is not ceremony. The change rests on three claims
that must be re-established against whatever `main` is when work starts: the scope gate is blind to
globals, the generated-import class is already covered elsewhere, and no other gate sees a global. The
probes used to write this plan live in the session scratchpad and are disposable; re-derive them from
this recipe rather than hunting for the files.

Recipe, per arm:

1. `mkdtemp` a suite root; copy `packages/security-audit-sdk-core` into
   `<suite>/packages/security-audit-sdk-core`, filtering out `node_modules`, `dist-tests`,
   `dist-examples`, `coverage`, `.verification-output`. Symlink the live `node_modules` into the copy
   when the arm runs a gate that imports `typescript`; copy `contracts/` into `<suite>/contracts` only
   for arms that run `check-package-contents.mjs`.
2. Apply the mutation to the copy — never to the working tree.
3. Run the gate from the copy and record exit status **and** the first diagnostic line.
4. Remove the suite root.

Arms, and what each must show before implementation starts:

| Arm | Mutation | `check-scope.mjs` | Other gate |
| --- | --- | --- | --- |
| null | none | exit 0 | — |
| P-A | `Buffer.byteLength(text, "utf8")` in a new authored function | **exit 0** | `check-package-contents.mjs` exit 0 |
| P-B | `process.env.X` in a new authored function | **exit 0** | — |
| P-C | `globalThis["fe" + "tch"](u)` in a new authored function | **exit 0** | — |
| P-D | `require("ajv/dist/runtime/ucs2length")` in `src/` **and** `dist/` generated validator | **exit 0** | `check-dependencies.mjs` exit 1 with `shipped import policy violations:`; `generate-contract.mjs --check` exit 1 with `generated artifact drift:` |
| P-E | `engines.node` widened to `">=18"` | exit 0 | `check-compatibility.mjs` **exit 1** |
| P-F (null for #69) | none, but with the `node_modules` symlink present | — | `check-dependencies.mjs` exit **1** — the harness artifact, not detection (F6) |

If `check-scope.mjs` fails on P-A, P-B, or P-C, someone has already closed the gap — stop and
re-triage rather than proposing a change with no subject. If `check-dependencies.mjs` or
`generate-contract.mjs --check` *passes* on P-D, F3 no longer holds and the brief's scoping paragraph
has to be rewritten before the proposal is drafted.

Do not skip P-F. Without it, P-D's exit 1 from `check-dependencies.mjs` cannot be distinguished from
the `npm ls` noise the symlinked `node_modules` produces on an unmutated copy.

## Task 1: Correct the issue's scope, post the brief, promote the issue

**Files:** none in the repository.

Three writes to #71, in this order.

**1. Prepend a scope marker to the body.** #71's "Current state" is *accurate* (F1), so unlike #70 this
is not a superseded-facts marker — it is a narrowing. Do not rewrite or delete the original text: the
body is the traceability record of what was requested against `main@71dbd95`, and PLAN-014/015/074 are
cited from it. Fetch the body, prepend the block below, write it back.

```sh
gh issue view 71 --repo nandohdc/bloodtrail --json body -q .body > /tmp/71-body.md
# prepend the marker, then:
gh issue edit 71 --repo nandohdc/bloodtrail --body-file /tmp/71-body.md
```

The marker, verbatim:

```markdown
> **SCOPE NARROWED — 2026-08-21.** The "Current state" below is still accurate: the scope gate still
> skips `src/generated/` and still sees import specifiers but not `Buffer`. What changed is the rest
> of the tree. Since this issue was filed against `main@71dbd95`, #68, #69 and #70 landed, and two of
> the four acceptance criteria below are now satisfied by other gates: an unauthorized generated
> import is rejected by `check:generated` and by `check-dependencies.mjs`, and PLAN-014's Node-engine
> sub-class is pinned by `check-compatibility.mjs` and `check-coherence.mjs`. The residual gap is the
> **global-identifier** class, which no gate in the repository detects. The original text is preserved
> unchanged for traceability. Read the triage brief in the comments for the current state, the
> residual gap, and the acceptance criteria this issue is actually being worked against.

---
```

**2. Post the brief** below as a comment, matching the structure of #70's brief, including the leading
AI-generation disclosure.

```sh
gh issue comment 71 --repo nandohdc/bloodtrail --body-file <brief.md>
```

**3. Flip the state label.** The five canonical roles are mutually exclusive, so remove the old one in
the same call.

```sh
gh issue edit 71 --repo nandohdc/bloodtrail --remove-label needs-triage --add-label ready-for-agent
gh issue view 71 --repo nandohdc/bloodtrail --json labels -q '[.labels[].name] | join(", ")'
```

### Brief to post

```markdown
> *This was generated by AI during triage.*

## Agent Brief

**Category:** enhancement
**Summary:** Make the scope gate classify every platform coupling in the SDK's runtime sources — authored and generated, module specifiers and free global identifiers — against a declared policy, fail closed on anything it cannot assign to a declared boundary, and report the declared inventory on the passing path.

**Current behavior:**
This issue's "Current state" is still accurate. `scripts/check-scope.mjs:30` skips `src/generated/`, its directory walk at `:63` admits `.ts` files only, and `src/errors.ts:81` and `src/validation/prohibited.ts:89` call `Buffer.byteLength(…, "utf8")`. Nothing in #68, #69, or #70 touched the scope gate.

What has changed is the coverage around it, and it narrows this issue.

Measured in package copies, never in the working tree. Against `check-scope.mjs`, all in fresh copies: an unmutated control passes; a `Buffer.byteLength` call added to an authored source file passes at exit 0; a `process.env` reference passes at exit 0; `globalThis["fe" + "tch"](u)` passes at exit 0; `require("ajv/dist/runtime/ucs2length")` prepended to the generated validator passes at exit 0; `import ajv from "ajv"` prepended to the generated types passes at exit 0. The one stage that works is the import-specifier loop: `import { createHash } from "crypto"` fails at exit 1. The content regexes are the weak stage — one string concatenation defeats the `fetch` pattern, and the built-in-module pattern matches the bare word `fs` or `net` anywhere in a file including comments and string literals.

Two of the four acceptance criteria below are already satisfied, by other gates:

1. **An unauthorized generated import already fails.** The same generated-CJS `require` mutation applied to both the `src/` and `dist/` copies of the validator: `check-dependencies.mjs` exits 1 with `shipped import policy violations:`, and `generate-contract.mjs --check` exits 1 with `generated artifact drift:`. `check-scope.mjs` exits 0. The class is covered; the gate this issue names is what is blind.
2. **The Node-engine coupling class is already pinned, twice.** `check-compatibility.mjs:20` asserts the exact engines string and `check-coherence.mjs:128` asserts it against `compatibility.json`. Widening `engines.node` to `">=18"` in a package copy fails `check-compatibility.mjs` at exit 1 and passes `check-scope.mjs` at exit 0.

The residual gap is the **global-identifier** class, and no gate in the repository detects it. `check-dependencies.mjs` collects module specifiers, so a `Buffer.byteLength` artifact yields zero specifiers and zero failures — its own canonical scenario says a bundled module contributes no specifier and verification passes. `check-package-contents.mjs` installs and imports, which succeeds because Node has `Buffer`. `check-scope.mjs` sees only import positions. With `Buffer.byteLength` and `process.pid` injected into the authored source, the built output, and the shipped generated validator, `check-scope.mjs` and `check-package-contents.mjs` both exit 0.

One measurement caveat for whoever works this: in a package copy with a symlinked `node_modules`, `check-dependencies.mjs` exits 1 **with no mutation at all**, because `npm ls --omit=dev` reports extraneous packages through the symlink. Exit status alone is worthless for that script in this harness — assert on the diagnostic text, as `shipped-import-policy.test.mjs` already does.

No `.out-of-scope/` directory exists in this repository, so no recorded rejection covers this request.

**Desired behavior:**
`npm run test:scope` should keep every rule it has today — the forbidden-filename regex, the source-content regexes, the import-specifier loop, and the manifest dependency and export assertions — and add a stage that inspects every code artifact under `src/`, including `src/generated/` and including `.cjs`, using the TypeScript AST rather than a regex.

For each artifact it should collect module specifiers in every static import, export, dynamic import, and `require()` position, and free identifiers in value position — identifiers referenced but not bound anywhere in the artifact's own lexical scope. Type positions carry no runtime coupling and should be excluded.

Each collected item should be classified against a declared policy keyed by artifact role: `authored` for `src/` outside `src/generated/`, `generated` for `src/generated/`. The policy is the deliverable as much as the gate is. It should name the ECMAScript language globals every role may use, the host globals each role may use with the reason each is admitted, and the module specifiers each role may reference. Anything the policy does not name should fail — including an unreadable artifact, an unparseable artifact, and an empty inspection set.

On the passing path the gate should report the declared coupling inventory, not just a pass bit: how many artifacts were inspected per role, how many references were classified, and which host couplings were actually exercised.

Diagnostics should name the artifact, the identifier or specifier, and the violated class; should be bounded in count and length; should carry no artifact source content; and should be distinguishable at a glance from the gate's existing production-integration violations, which keep their current shape.

**Key interfaces:**

- `test:scope` / `scripts/check-scope.mjs`: extend the existing command; do not add a new npm script. Note that `test:scope` is in `test:matrix` as well as `validate`, so the cost lands on both Node majors.
- `scripts/shipped-import-policy.mjs`: the precedent for AST-based inspection in this repository, and the source of the role-keyed policy shape, the violation record shape, and the three fail-closed classes. Reuse its vocabulary; do not modify it — it is #69's territory.
- `src/generated/schema-validator.generated.cjs`: 248 KB, CommonJS, zero `require()` calls today, `module.exports` at line 169. It is byte-identical to the shipped `dist/generated/` copy.
- The package-copy mutation harness in `tests/verification/packed-completeness-mutations.test.mjs`, not the disposable git clone — this control reads source files, not git history. The copy needs a `node_modules` symlink because the new module imports `typescript`.

**Vocabulary:**
Use **platform coupling** for a dependence on a capability the host runtime provides that is not part of the ECMAScript language, and **declared** / **undeclared** for its two admission states. Do not write *allowed* or *forbidden* in specification text: the scope gate already binds those to the production-integration surface, and overloading them would make the two stages indistinguishable in diagnostics — which is one of this issue's own acceptance criteria. The terms belong in `packages/security-audit-sdk-core/CONTEXT.md`.

**Acceptance criteria:**

- [ ] `npm run test:scope` inspects every code artifact under `src/` including `src/generated/` and including `.cjs`, and reports the declared coupling inventory per role on the passing path.
- [ ] The tree as it stands passes, with `Buffer` declared for the authored role and the CommonJS `module` wrapper declared for the generated role.
- [ ] An undeclared Node global in authored source fails deterministically and the diagnostic names the artifact and the identifier.
- [ ] An undeclared global in generated source fails deterministically, including a host global declared for the authored role but not the generated one.
- [ ] An undeclared module specifier in generated source fails deterministically.
- [ ] A locally bound identifier that shares a name with an undeclared global does **not** fail, and neither does a type-position reference to a TypeScript utility type. Both have controls.
- [ ] An unreadable artifact, an unparseable artifact, and an empty inspection set each fail closed.
- [ ] Coupling diagnostics are distinguishable from the gate's existing production-integration diagnostics, and a forbidden-filename mutation still produces the existing diagnostic and no coupling diagnostic.
- [ ] The existing scope controls in `tests/verification/mutations.test.mjs` pass unchanged.
- [ ] Diagnostics are bounded in count and length and expose no artifact source content.
- [ ] The full SDK and contract validation chains, strict active and archived OpenSpec validation, and governance checks pass on the exact candidate.

**Assurance limitations:**

- This gate bounds **which** host capabilities the SDK's sources use, not **where** they are used. A new call site of an already-declared coupling passes; a new coupling does not.
- It does not detect host-object *member* access. `src/sdk.ts:387` calls `timer.unref()`, which exists on Node's `Timeout` and not on a browser's numeric handle. That coupling is declared in the policy data and is not mechanically detected. The canonical spec already authorises it at `spec.md:523`.
- The gate's existing source-content regexes are unchanged and remain both false-positive-prone and false-negative-prone. Replacing them is separate work.
- Inventorying coupling does not establish that the SDK would run on a non-Node runtime, and it makes no claim about post-split neutrality if a Core extraction is ever authorized.

**Out of scope:**

- Removing or rewriting any declared coupling, including the two `Buffer.byteLength` call sites. The issue's own out-of-scope section forbids a blanket ban on approved Node coupling, and a change that both inventories the coupling and drains the inventory proves nothing about the gate.
- Core extraction, topology change, or any multi-package split.
- Adding an engine assertion to the scope gate — `check-compatibility.mjs:20` and `check-coherence.mjs:128` already pin it.
- Rewriting the forbidden-filename or source-content regexes, the shipped-import dependency policy (#69, closed), or the packed-completeness gate (#70, closed).
- Adding a new npm command, adding a runtime dependency, changing the public API, adding an SDK ADR — the sequence is pinned at 11 by `check-coherence.mjs:190` — or any production transport, exporter, collector, storage, SIEM integration, analytics, detection, browser telemetry, publication path, or production authorization.
```

## Task 2: Branch

```sh
git switch -c feat/reject-undeclared-platform-coupling
git rev-parse origin/main   # BASELINE_SHA for assessment ordering
```

Never `git checkout -b <name> origin/main` — that sets the upstream to `main`, so a later bare
`git push` bypasses the PR entirely. `git switch -c` is correct.

## Task 3: Propose the change (commit P)

**Files:** `openspec/changes/reject-undeclared-platform-coupling/*`

Drive this with the `openspec-propose` skill; it runs
`openspec new change "reject-undeclared-platform-coupling"`. Do not hand-create the directory. This
change has a specs delta, so `skip_specs` stays absent.

`proposal.md` — Why: F2 (measured, the gate is blind to every global class), F5 (measured, so is every
other gate), F3 and F4 (measured, two of the four criteria are already met elsewhere — say so
plainly), F7 (the declared set is two dozen names, so the policy is reviewable). What Changes: an
AST-based coupling stage inside `test:scope`, a role-keyed declared-coupling policy as frozen data,
fail-closed classification, an inventory on the passing path, mutation and negative controls, one new
capability requirement. Non-Goals: no coupling removed, no Core extraction, no engine assertion, no
regex rewrite, nothing from #69 or #70, no new npm script, no SDK ADR. Capabilities: Modified —
`security-audit-sdk-core`. Traceability: PLAN-014, PLAN-015, PLAN-074.

`specs/security-audit-sdk-core/spec.md` — the delta. **Use `## ADDED Requirements`, not `## MODIFIED`.**
All delta blocks in the archive are ADDED; a MODIFIED block must restate the whole requirement
including every surviving scenario or `openspec archive` rejects it, and the existing requirement at
`spec.md:492` is about filenames and the public API — a different subject that should stay untouched
(F9/D10). Match the canonical format exactly: `### Requirement:` then a non-empty body, then
`#### Scenario:` blocks each containing a line starting `- **WHEN**` and a line starting `- **THEN**`.
`check-coherence.mjs` parses the canonical spec and rejects anything else, so a malformed fold fails
PR 2, not PR 1.

```markdown
## ADDED Requirements

### Requirement: Scope verification classifies every platform coupling against a declared policy

Scope verification SHALL inspect every code artifact under the SDK source root, including generated
artifacts and artifacts in CommonJS module format, and SHALL classify every module specifier the
artifact references and every identifier the artifact references without binding it in the artifact's
own lexical scope.

Classification SHALL be keyed to the artifact's role, distinguishing authored source from generated
source, and SHALL admit only what a declared coupling policy names for that role: the language
globals available to every role, the host globals declared for that role with the reason each is
admitted, and the module specifiers declared for that role. Identifiers referenced only in type
position SHALL NOT be classified as coupling.

Verification SHALL fail when it can assign a reference to no declared boundary, SHALL fail when a
source artifact cannot be read, SHALL fail when the parser cannot return a syntax tree, and SHALL
fail when it inspects no artifact. Verification SHALL NOT fail on an identifier that the artifact
binds in its own lexical scope.

Diagnostics for coupling SHALL name the artifact, the identifier or specifier, and the violated
class; SHALL be bounded in count and length; SHALL NOT include artifact source content; and SHALL
remain distinguishable from the production-integration diagnostics this verification already emits.

On the passing path, verification SHALL report the declared coupling inventory it classified, per
role.

The coupling policy bounds which host capabilities the sources use and not where they are used, and
it does not classify member access on host objects. Neither limit is a claim about runtime
portability.

#### Scenario: Declared coupling set passes and is reported
- **WHEN** scope verification runs against the SDK source root as it stands
- **THEN** verification passes and reports, per role, the artifacts inspected, the references
  classified, and the host couplings exercised

#### Scenario: Undeclared host global in authored source is rejected
- **WHEN** an authored source artifact references a host global the policy does not declare for the
  authored role
- **THEN** verification fails and the diagnostic names that artifact and that identifier

#### Scenario: Undeclared host global in generated source is rejected
- **WHEN** a generated source artifact references a host global the policy declares for another role
  but not for the generated role
- **THEN** verification fails and the diagnostic names that artifact and that identifier

#### Scenario: Undeclared module specifier in generated source is rejected
- **WHEN** a generated source artifact references a module specifier the policy does not declare for
  the generated role
- **THEN** verification fails and the diagnostic names that artifact and that specifier

#### Scenario: Locally bound identifier is not coupling
- **WHEN** a source artifact binds an identifier in its own lexical scope whose name matches a host
  global the policy does not declare
- **THEN** verification does not report that identifier as coupling

#### Scenario: Type-position reference is not coupling
- **WHEN** a source artifact references a name only in type position
- **THEN** verification does not report that name as coupling

#### Scenario: Unreadable or unparseable artifact fails closed
- **WHEN** a source artifact cannot be read, or the parser cannot return a syntax tree for it
- **THEN** verification fails rather than skipping that artifact

#### Scenario: Empty inspection set fails closed
- **WHEN** scope verification finds no code artifact under the SDK source root
- **THEN** verification fails rather than reporting a pass

#### Scenario: Production-integration diagnostics remain distinguishable
- **WHEN** a forbidden production-integration filename is added to the SDK source root
- **THEN** verification fails with the existing production-integration diagnostic and emits no
  coupling diagnostic for it
```

## Task 4: Write the assessment (still commit P)

**File:** `openspec/changes/reject-undeclared-platform-coupling/assessment.json`

Closed schema 1.1, `full` level, `direct_implementation`, `security_sensitive: true` (so no
`security_justification` map). A full assessment requires at least one `direct_implementation`
candidate **and** at least one `alternative`; every rejected id must appear in `rejection_reasons`;
each reason must be force-based — never "best practice" or "industry standard".

- `applicability.triggers_matched`:
  `["canonical_capability_requirement", "security_sensitive_behavior", "governance_core_path"]`
- `applicability.material_capability_modification`: `true`
- `applicability.capabilities`: `["security-audit-sdk-core"]`
- `ordering.proposal_baseline_commit`: `<BASELINE_SHA>`
- `owned_paths` — exact paths, covering all three PRs:
  - `packages/security-audit-sdk-core/scripts/platform-coupling-policy.mjs`
  - `packages/security-audit-sdk-core/scripts/check-scope.mjs`
  - `packages/security-audit-sdk-core/tests/verification/platform-coupling-mutations.test.mjs`
  - `packages/security-audit-sdk-core/CONTEXT.md`
  - `packages/security-audit-sdk-core/README.md` (only if it is actually edited)
  - `CLAUDE.md`
  - `.hermes.md`

`README.md` at the repository root and `docs/adr/0004-…` are `documentation_only` and need no
`owned_paths` entry; the canonical capability spec is covered by `applicability.capabilities` while
the change is active. `CLAUDE.md` and `.hermes.md` are **not** documentation for this purpose —
`governedPatterns` unions `governance_core` with `governed_implementation`
(`check-design-pattern-governance.mjs:470`), so they must be listed or the association fails
(F14).

Forces to state (each drawn from a measured or read finding, not from principle):

- A `Buffer` call, a `process` reference, and a `globalThis` reference each pass the scope gate at
  exit 0, and no other gate in the repository reports any of them.
- The gate's own source-content regexes are defeated by one string concatenation, and its
  built-in-module pattern matches the bare word in a comment.
- `src/generated/` is skipped by path and again by extension, so the largest runtime artifact in the
  package is inspected by no source-level control at all.
- The set of host couplings the sources actually exercise is not written down anywhere, so no reviewer
  can tell an intentional coupling from an accidental one.
- The command the issue names as the verification entry point runs none of the above.

Candidate approaches — one `direct_implementation` (a role-keyed declared-coupling policy inspected
through the TypeScript AST inside the existing gate, failing closed, with mutation and negative
controls), and at least one `alternative` to reject on force. The obvious alternative is "extend the
existing source-content regexes with the Node global names". Reject it on the measured force: a regex
over raw text matches comments and string literals, and the measured `globalThis["fe" + "tch"](u)`
arm evades any name-based pattern, so the alternative buys false positives and false negatives at
once. A second alternative worth naming and rejecting is "site-bound coupling declarations" — rejected
because an enumeration of call sites drifts on every legitimate refactor and has no precedent here
(F11).

Suggested `implementation_invariant_ids`: `implementation-coupling-classified-by-role`,
`implementation-coupling-fails-closed`, `implementation-coupling-no-false-positive`,
`implementation-coupling-diagnostics-bounded`. These are per-change ids under the
`implementation-` namespace — `invariant-registry.json`'s `implementation_invariant_namespace` says
they are declared in the assessment and never registered.

Commit P as `docs(openspec): propose undeclared platform coupling rejection` with an explicit staged
allowlist of the six change-directory files. Stage nothing else.

## Task 5: RED — prove every arm before the control exists

**File:** `packages/security-audit-sdk-core/tests/verification/platform-coupling-mutations.test.mjs` (new)

A new file, not an addition to `mutations.test.mjs` (F19/D18). Model it on
`tests/verification/packed-completeness-mutations.test.mjs`: one `mkdtemp` suite root removed in
`test.after`, one `runCase(name, mutate)` that copies the package and runs the real gate from the
copy, one `assertFailure` that checks status, class code, named artifact, named identifier, absence of
a planted source marker, control-character escaping, and a total output bound.

Write the arms first and watch each fail for its intended reason, then implement.

Harness, per arm:

1. `mkdtemp` a suite root; copy `packages/security-audit-sdk-core` into
   `<suite>/packages/security-audit-sdk-core`, filtering `node_modules`, `dist`, `dist-tests`,
   `dist-examples`, `coverage`, `.verification-output`.
2. Symlink the live `node_modules` into the copy — the module imports `typescript`, and without the
   symlink resolution walks out of the copy and fails. `check-scope.mjs` shells out to nothing, so the
   copy carries none of the `npm ls` noise that made a null control mandatory for
   `check-dependencies.mjs` (F6). Prove that with the null arm anyway.
3. Apply the mutation to the copy — never to the working tree.
4. Run `node scripts/check-scope.mjs` from the copy.
5. Assert on exit status **and** the diagnostic text.
6. Clean up in `test.after`.

The arms:

| Arm | Mutation | Must show |
| --- | --- | --- |
| **null control** | none | exit 0, and the inventory line names both roles — this is what makes the rest mean something |
| **M-71-A** authored global | `process.env.X` in a new authored function | exit non-zero, `[platform-coupling:undeclared-global]`, names the artifact and `process` |
| **M-71-B** evasion | `globalThis["fe" + "tch"](u)` in a new authored function | exit non-zero, names `globalThis` — this is the arm that justifies D3 over the regex alternative |
| **M-71-C** generated global | `Buffer.byteLength(t, "utf8")` prepended to `src/generated/schema-validator.generated.cjs` | exit non-zero — `Buffer` is declared for `authored`, not for `generated`; this is what proves role keying is real |
| **M-71-D** generated specifier | `require("ajv/dist/runtime/ucs2length")` prepended to the same artifact | exit non-zero, `[platform-coupling:undeclared-specifier]` |
| **M-71-E** negative control | an authored function with a parameter named `process` and a block-scoped `const Buffer` | **exit 0** — proves the scan reads lexical scope, not raw text |
| **M-71-F** negative control | an authored type alias referencing `Uint8Array` and a TypeScript utility type in type position only | **exit 0** — proves type positions are excluded |
| **M-71-G** fail closed | a `src/generated/` artifact whose bytes cannot be parsed into a syntax tree | exit non-zero, parse-failure class |
| **M-71-H** fail closed | an unreadable artifact under `src/`, and separately an empty `src/` | exit non-zero, read-failure and empty-inventory classes |
| **M-71-I** distinguishability | `src/transport.ts` added, matching the existing forbidden-filename rule | exit non-zero with the **existing** `forbidden production integration filename` diagnostic and **no** `[platform-coupling:` code — acceptance criterion 4 |

Assertions common to every failing arm, mirroring `packed-completeness-mutations.test.mjs:123-131`:

- exit status is non-zero;
- the diagnostic names the artifact and the identifier or specifier;
- a source marker planted next to the mutation does **not** appear in the output;
- control characters in any interpolated value are escaped, not echoed;
- total output stays length-bounded (4 KiB is the established figure).

**M-71-E and M-71-F are the two arms that will actually be tempting to weaken.** They are negative
controls: they fail if the *implementation over-reports*. A naive file-local scan produced six false
positives on the unmutated tree (F7), so this is not a hypothetical failure mode. If either arm cannot
be made to pass without loosening the classifier into uselessness, the scope-tracking implementation is
wrong — fix the visitor, do not add an exception list.

## Task 6: GREEN — the coupling policy module, then wire the gate

**Files:** `packages/security-audit-sdk-core/scripts/platform-coupling-policy.mjs` (new),
`packages/security-audit-sdk-core/scripts/check-scope.mjs` (modified)

`platform-coupling-policy.mjs` carries one frozen policy constant and two functions. Written without
the leading keyword, because a plan file is `documentation_only` and the perimeter's
hidden-implementation signals match at any indentation (F20):

- `PLATFORM_COUPLING_POLICY` — frozen. `roles.authored` = prefix `src/`, excluding `src/generated/`.
  `roles.generated` = prefix `src/generated/`. Each role declares `hostGlobals` (each entry an object
  carrying the name, the reason it is admitted, and the boundary it sits behind) and `specifiers`
  (`node:async_hooks`, `node:crypto` for `authored`; none for `generated`). A shared `languageGlobals`
  set holds the ECMAScript names from F7 and is not role-keyed. `globalThis` appears in no set (D8).
  Include a documented, non-detected entry for the `Timeout.unref()` member coupling (D14/F10) so the
  policy is a complete inventory even where the control is not.
- `collectCouplingReferences(artifactPath, sourceText)` — `ts.createSourceFile` with
  `setParentNodes: true` and `scriptKindFor(artifactPath)`, returning
  `{ specifiers, identifiers, failures }`. Reuse `shipped-import-policy.mjs`'s specifier collection
  *shape* — static import, export, `import =`, import type, dynamic `import()`, `require()` — but do
  not import from it or modify it; it is #69's territory and its role table is about `dist/`, not
  `src/`.
- `inspectPlatformCoupling({ packageRoot, sourceRoot })` — walks the source root, classifies, returns
  `{ inspected, references, inventory, violations }` with violations sorted by code point for
  determinism.

The identifier collector is the part that has to be right. It needs a real scope stack, not a
file-local name set: variable declarations including binding patterns and defaults, parameters
including rest and defaults, function and class declarations, named function and class expressions,
import clauses and specifiers and namespace imports, catch-clause variables, and `for…of` / `for…in`
bindings. It must skip identifiers in property position — property access, property assignment,
property and method names, qualified-name right sides, enum members, binding-element property names,
import-specifier property names, export specifiers — and skip type positions entirely. Keep each of
those concerns in its own small function; a single large visitor is what will fail `codescene delta`
(F19).

`check-scope.mjs` keeps its filename regex, its `forbiddenSource` array, its import loop, and its
manifest assertions **verbatim** (D10). It adds the coupling stage, merges the coupling violations into
the same `violations` array with the `[platform-coupling:<code>]` prefix (D11), and extends the summary
line to report the inventory (D12). The `src/generated/` skip at line 30 stays for the *existing*
stages — the filename and content regexes were never meant for generated output — and the coupling
stage is what stops skipping it. Say that in `design.md`; a reviewer will otherwise read the surviving
`continue` as an oversight.

Now re-run Task 5 and require the null control and both negative controls to pass, and all six
positive arms to fail with the signals recorded there.

## Task 7: Record the inspection

- `packages/security-audit-sdk-core/CONTEXT.md` (D11/F10): three glossary entries appended to the
  existing file. **Platform coupling**: a dependence on a capability the host runtime provides that is
  not part of the ECMAScript language. **Declared coupling**: a platform coupling the policy names for
  that artifact's role, with a reason. **Undeclared coupling**: anything else, which fails closed.
  Note explicitly that *allowed* and *forbidden* are not this project's words for these states — the
  scope gate binds them to the production-integration surface — and that "scope" is overloaded here:
  the gate's name means the authorization boundary, while the classifier also uses it in the lexical
  sense.
- `docs/adr/0004-declare-platform-coupling-at-the-scope-gate.md` (D3/D7/D15/D17): status Accepted, and
  the sections the sibling ADRs use. Context: the SDK's Node coupling was real, small, and written down
  nowhere; the gate that names the authorization boundary could not see it. Decision: coupling is
  declared data keyed by artifact role, admitted by name, inspected through the AST, and failing
  closed. Consequences: `test:scope` now needs `node_modules` and costs ~0.2 s in both `validate` and
  `test:matrix`; adding a host capability now needs a policy edit with a recorded reason; the policy is
  the inventory a future Core-extraction change would act on. Alternatives rejected: banning Node
  coupling outright (would force removing `Buffer`, which #71 puts out of scope, and would decide the
  Core-extraction question by side effect); site-bound declarations (drift); extending the content
  regexes (measured evasion).
- `CLAUDE.md` and `.hermes.md` (D16/F15): the `test:scope` line in each gate list gains the coupling
  clause. Nothing else in either file moves. Keep the two consistent — CLAUDE.md says so itself.
- `README.md:117` and `README.md:47`: the same clause, in the repository's voice.
- `packages/security-audit-sdk-core/README.md`: touch only if a `docs-*` coherence substring
  (`check-coherence.mjs:205-214`) would otherwise go stale. Verify before editing, and drop it from
  `owned_paths` if it does not change.
- `openspec/changes/reject-undeclared-platform-coupling/design.md`: record D3 (AST, not regex, with
  the measured evasion), D5 (role keying), D7 (name-bound, not site-bound), D8 (`globalThis` banned),
  D9 (fail-closed classes), D13 (why no engine check), D14 (the member-access gap), D15 (why `Buffer`
  stays), and the surviving `src/generated/` skip on the legacy stages.
- `tasks.md`: tick the implementation group.

Mind F20 throughout: no line in any added Markdown may begin with `export function`, `export class`,
`export const NAME = (`, `module.exports =`, or `exports.NAME =` at any indentation.

## Task 8: Full read-only verification (empty index, BEFORE staging T)

Run the Stage 1 battery from Task 10. `test:git` requires an **empty** Git index, so verification runs
before `git add`, never after. It also rejects a missing final newline, any CR byte, and any trailing
whitespace in every file changed since the baseline — untracked Markdown included, which covers this
plan file and the brief.

Then prove both directions once more on the exact tree that will be committed:

```sh
cd packages/security-audit-sdk-core
npm run build
npm run test:scope                                # expect PASS, with the inventory on the summary line
node --test tests/verification/platform-coupling-mutations.test.mjs
node --test tests/verification/mutations.test.mjs # the existing scope arms must be untouched
```

Also re-measure the gate cost and record it, since the PR body will quote it:

```sh
for i in 1 2 3; do /usr/bin/time -p node scripts/check-scope.mjs >/dev/null; done
```

## Task 9: Commit T, push, PR 1

Stage an explicit allowlist: the new module, the modified gate, the new test file, `CONTEXT.md`,
`CLAUDE.md`, `.hermes.md`, `README.md`, `docs/adr/0004-…`, the change's `design.md`/`tasks.md`
updates, and this plan file. Nothing else. Leave unrelated untracked paths alone.

Commit as `feat(sdk): reject undeclared platform coupling in the scope gate`. Conventional Commits are
validated on the PR title **and every commit subject**. Open the PR against `main` from
`feat/reject-undeclared-platform-coupling`. The body states the F3/F4 scoping correction (the
generated-import and engine criteria were already satisfied elsewhere; this change closes the
global-identifier class and the named gate's blind spot), the measured F2/F5/F7 results, the
acceptance criteria mapped to their evidence, the four assurance limitations, and that `Buffer` is
deliberately retained.

Rebase onto `main` if it moves; never `git merge main` into the branch — a `Merge branch 'main' into …`
subject has no exemption from the conventional-commits check and blocks the PR.

Expect analyser follow-ups. #70's implementation PR needed three (`f64b1d0`, `70b6cd6`, `6cbcbff`)
after its push, and this change's visitor is exactly the shape CodeScene scores hardest. Those
follow-ups are normal; each still needs its own conventional-commit subject and its own green
post-commit governance run.

Do not couple this work to PR #182 (F22).

## Task 10: The gate battery (run for every PR)

**Stage 1 — before `git add`** (`test:git` requires an empty index):

```sh
npm run check:generated --prefix packages/security-audit-sdk-core   # before validate, which regenerates
npm run validate --prefix packages/security-audit-sdk-core
npm run validate --prefix contracts/security-audit
openspec validate --specs
openspec validate reject-undeclared-platform-coupling --strict
openspec validate --all --strict
openspec validate --all --archived --strict
node --test openspec/tests/design-pattern-governance/*.test.mjs
git diff --check
git status --porcelain=v1 --untracked-files=all
```

**Stage 2 — after the commit.** These read `HEAD`. Before the commit they are vacuously green:
`check-design-pattern-governance.mjs:322` short-circuits with `if (base === head) return;` and exits 0
reporting "passed in final phase" without inspecting anything. **Never record a pre-commit final-phase
result as evidence.**

```sh
node openspec/scripts/check-design-pattern-governance.mjs --phase final --base origin/main ; echo "exit=$?"
node openspec/scripts/check-design-pattern-governance.mjs --phase final --base origin/main --json   # rangePaths must NOT be null
node openspec/scripts/run-governance-dual-check.mjs ; echo "exit=$?"
```

Never judge a checker through a `sed` or `grep` pipe — that reports the filter's exit status. Read the
exit code directly. When reading `run-governance-dual-check.mjs` itself, use
`command grep --binary-files=text`: it contains literal NUL bytes, so plain `grep` treats it as binary
and returns silence rather than no-match.

The perimeter unions paths across every commit in the range, so deleting an offending file in a later
commit does **not** clear a `path-unclassified` finding — rewrite the introducing commit or classify
the path.

**Stage 3 — the commit tree** (PR 3 especially):

```sh
git show --name-status --no-renames HEAD     # a move shows A and D lines, not A alone
git ls-tree --name-only HEAD openspec/changes/
git status --porcelain
```

Green in Stage 2 authorises the push. Red means `git reset --soft HEAD~1`, fix, repeat — the candidate
is not frozen until it is pushed. After the push, preserve it byte-for-byte: no regeneration, no
reformatting, no rerunning tests on an already-verified candidate.

If `sonar` is red, read its "Explain quality gate failure" step before assuming the code is at fault —
the self-hosted server is the more common cause and the job already retries once after 30 s. The
server is reachable from this workstation, so a real finding can be read and the fix proved locally
rather than by pushing again.

## Task 11: PR 2 (spec fold), then PR 3 (archive)

**PR 2 — fold the delta into the canonical spec.** Branch `docs/sync-platform-coupling-requirement`.
Use `openspec-sync-specs`. Two files only, exactly as `6d3e39b` did: the canonical
`openspec/specs/security-audit-sdk-core/spec.md` gains the requirement, and the change's `tasks.md`
ticks the fold task. Commit as
`docs(openspec): fold platform coupling verification into the canonical SDK spec`.

**PR 3 — archive as a complete relocation.** Branch
`docs/archive-reject-undeclared-platform-coupling`. Use `openspec-archive-change`. Perform the move
with `git mv` so the commit carries both the additions and the deletions — the relocation checker
rejects an archive whose active directory still exists at `HEAD`, and `git add <destination>` alone
commits additions only, which passes locally and in CI while leaving the move half-done. Add
`archive-evidence.md` in the archive directory, following
`openspec/changes/archive/2026-08-20-verify-packed-artifact-completeness/archive-evidence.md`. Commit
as `docs(openspec): archive reject-undeclared-platform-coupling`.

Order is not negotiable: the fold must land **before** the relocation (F14).

## Task 12: Close #71 and report

Close **after PR 2 and before building the archive candidate**, so the archive lands at full task count
in one commit — the precedent is
`openspec/changes/archive/2026-08-20-verify-packed-artifact-completeness/tasks.md:4.2`. Post the
archive permalink as a follow-up comment after PR 3 merges.

```sh
gh issue close 71 --repo nandohdc/bloodtrail --comment "<evidence>"
```

The evidence comment states: the merge commits of all three PRs, the acceptance criteria mapped to the
controls that prove them, the measured mutation results, the F3/F4 scoping correction, the four
assurance limitations, and what was not verified.

Then:

```sh
openspec list                                   # expect: No active changes found.
openspec validate --all --strict
openspec validate --all --archived --strict
git status --short --branch
```

---

## Validation matrix

| Acceptance criterion (#71, as restated in the brief) | Evidence |
| --- | --- |
| The approved coupling set passes | `npm run test:scope` green on the live tree, reporting the inventory per role; null control passes in the package-copy harness |
| An unauthorized Node-global mutation fails | M-71-A (`process` in authored source) and M-71-C (`Buffer` in generated source, declared for the other role) |
| An unauthorized generated import mutation fails | M-71-D at the scope gate — and, already true before this change, `check-dependencies.mjs` and `check:generated`, both measured (F3) |
| Diagnostics distinguish scope defects from provisional Node binding code | `[platform-coupling:<code>]` prefix on the new classes; M-71-I asserts a forbidden-filename mutation still yields the existing diagnostic and no coupling code |
| Fail closed when coupling cannot be assigned to an approved boundary | M-71-G (unparseable), M-71-H (unreadable, empty inventory), and the undeclared-identifier default |
| The gate does not over-report | M-71-E (lexically bound `process` and `Buffer`) and M-71-F (type-position reference) both pass |
| Existing scope behaviour is preserved | `mutations.test.mjs:598/627/639` pass unchanged; the filename regex, content regexes, import loop, and manifest assertions are byte-identical |
| A gate proved able to fail (PLAN-074) | Six failing arms, two passing negative controls, one null control, all in the same harness |
| All six coupling classes accounted for (PLAN-014) | F10's table: two added here, three already gated and cited by file and line, one declared but not detected and stated as a limitation |
| Cost is acceptable in `validate` and `test:matrix` | Measured 0.03 s → ~0.20 s on this workstation; re-measured in Task 8 and again on the CI runner before it is quoted |

---

## Risks, tradeoffs, and open questions

- **The dominant risk is a false positive, not a false negative.** A naive file-local scan reported six
  bound identifiers as coupling on the unmutated tree (F7). A gate that cries wolf in `validate` — which
  every contributor runs — gets an exception list bolted on within a week, and then it enforces nothing.
  M-71-E and M-71-F exist to make that failure loud. Do not weaken them.
- **The scope-tracking visitor is the whole implementation.** Everything else is data and plumbing. It
  is also the part CodeScene will score hardest and the part most likely to need follow-up commits
  (F19). Decompose it before pushing, not after the first red check.
- **`test:scope` gains a `node_modules` dependency.** It has none today; after this change it imports
  `typescript`. Every context that runs it already runs `npm ci` first — `validate`, `test:matrix`,
  `verify`, and the `sdk` job — and `check-dependencies.mjs` already imports `typescript` from inside
  `test:matrix`, so there is precedent in the same subset. It is still a real change in the gate's
  preconditions and belongs in the ADR's consequences.
- **The declared policy will be read as an authorization.** It is not. Declaring `Buffer` records that
  the SDK uses it and why; it authorizes nothing that was not already true. Say that in the policy
  file's header comment and in `CONTEXT.md`, or the first reader will infer that new Node coupling is
  now cheap to add.
- **Two of the four acceptance criteria were already met.** That makes this change smaller than the
  issue reads, and the honest framing is a scope narrowing plus a genuinely new class — not a repair.
  If the PR body claims to fix a generated-import hole, a reviewer who runs `check-dependencies.mjs`
  will find the claim false and will be right.
- **The member-access gap is permanent for this change** (D14/F10). `timer.unref()` stays undetected.
  State it three times — requirement, ADR, closing comment — because a partial control described as a
  complete one is exactly what PLAN-074 exists to prevent.
- **PLAN-014's six classes are inferred, not read.** The source plan is not in this repository, and its
  identifiers appear only in issue bodies (F10). The six in the table are what the tree exhibits. If
  the owner has the plan document, reconcile before the fold, because the requirement text will outlive
  the issue.
- **Exit status alone is not detection in a package copy** (F6). Every arm asserts the diagnostic.
- **Sonar `new_violations = 0` is the likeliest CI surprise**, and the second likeliest is a trailing
  space in Markdown failing `test:git`.
- **Open question for the owner:** should the source-content regexes be retired now that a sound stage
  exists beside them? They are measurably both over- and under-inclusive (F9), and keeping them means
  the gate has one stage that can be trusted and one that cannot. Left in place by this change —
  removing them would change what `test:scope` rejects, which is a separate decision with its own
  evidence. Worth its own issue.

## What this does not authorize

Nothing here authorizes Core extraction, a multi-package topology, publication, registry upload,
production deployment, real-user data, framework instrumentation, transports, exporters, collectors,
queues, outboxes, storage, SIEM integration, analytics, detection, browser telemetry, or cryptographic
audit-log chaining. It adds no runtime dependency, adds no npm script, changes no public API, changes
no `src/` runtime code, leaves `files`, the export map, and `engines` untouched, and leaves contract
`1.0.0` alone. The package stays `private: true` and `UNLICENSED`. Declaring a platform coupling
records that it exists; it grants nothing.

## What this plan did not verify

- Behaviour on Node 24. Only Node v26.7.0 was available on this workstation. `test:scope` **is** in
  `test:matrix`, so unlike #70's gate this one will run on both majors in CI — which makes Node 24 a
  real exposure rather than a theoretical one, and the AST pass is the new part.
- Whether `sonar` and `codescene delta` accept the new module and test file — only knowable from a real
  pushed commit, and F19 says to expect follow-ups.
- The CI runner's cost for the AST pass; every timing above is from this workstation with a warm cache.
- The exact shape of the scope-tracking visitor. The probe that produced F7 was a deliberate
  over-approximation and had six false positives; a correct implementation was not written during
  triage. Task 5's negative controls are where it is proved.
- Whether `check-scope.mjs` importing `typescript` interacts badly with any consumer of `test:scope`
  that runs before `npm ci`. None was found, but the search was for callers, not for every invocation
  context.
- PLAN-014's actual six classes (F10), and PLAN-015's and PLAN-091's exact wording. All are cited from
  issue bodies; the source plan is not in the repository.
- Whether `packages/security-audit-sdk-core/README.md` needs any edit at all. The `docs-*` coherence
  rules were read, not exercised against a draft.
