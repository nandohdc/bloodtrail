# Issue #86 — Extract a Platform-Neutral security-audit Core — Plan

> **For Hermes:** The largest single refactor in the backlog, blocked on four things (#76, #78, #83, #71 —
> only #71 is done). **Do not start it as a refactor.** Start it as a measurement: the SDK's platform
> coupling is already enumerated by machine, because #71 built exactly that instrument, and
> `npm run test:scope` prints the declared coupling inventory on every passing run. Read that inventory
> before designing an SPI. Two things the issue does not say: `src/providers.ts` **already exists** and is
> the first two-sevenths of the PlatformProvider SPI (clock + identifiers), and it is also the file that
> imports `node:crypto` — so the seam is already half-cut. **Authority scope was decided on 2026-08-23
> (#77, option C) and it lands two new obligations directly on this issue:** Core must resolve to exactly
> one module instance in any supported consumer graph, proved by a duplicate-Core fixture that fails
> closed; and the zero-runtime-dependency gate must be rescoped to "no *third-party* runtime dependencies"
> so the Node binding may declare Core. See F5.

**Goal:** A Core with no Node imports, no Node globals, no Node engines constraint and no undeclared
runtime dependencies, retaining audit semantics and ambient-context abstraction behind SPIs, validated
against Node and one paper second consumer.

**Status at this baseline:** BLOCKED ON #76, #78, #83. #71 is complete.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #86, OPEN, labels `enhancement` `security-audit-sdk` `openspec-change-needed` `area:core` `needs-triage` |
| Declared dependencies | #76 (blocked), #78 (blocked), #83 (blocked), **#71 CLOSED** |
| Native GitHub blockers | `blocked_by` is `0` |
| SDK source files | 19 under `src/`, including `generated/contract.generated.ts` and `generated/schema-validator.generated.cjs` |
| Permitted non-relative imports in `src/` | **only** `node:async_hooks` and `node:crypto` |
| `node:crypto` site | `src/providers.ts:1` — `import { randomUUID } from "node:crypto"` |
| `node:async_hooks` site | `src/context.ts:1` — `import { AsyncLocalStorage } from "node:async_hooks"` |
| Node host global in use | `Buffer` — `src/errors.ts`, `src/validation/prohibited.ts` (`Buffer.byteLength(…, "utf8")`) |
| Universal timer globals | `setTimeout`, `clearTimeout` in `src/sdk.ts`, with `unref()` per `compatibility.json.shutdownTimerOwnership` |
| CommonJS wrapper global | `module` in `src/generated/schema-validator.generated.cjs` |
| Existing SPI seed | `src/providers.ts` — `AuditClock`, `AuditIdentifierProvider`, `systemAuditClock`, `systemAuditIdentifiers` |
| Coupling instrument | `scripts/platform-coupling-policy.mjs` + `test:scope`'s inventory line (#71) |
| Coupling classes named by PLAN-014 | ids, clock, byte length, timer, schema runtime, Node engine support |
| Engines pin | `check-compatibility.mjs` asserts the literal; `check-coherence.mjs` cross-checks `compatibility.json` |
| Catalog pins | `catalogEventCount: 24`, `namedEventApiCount: 24`, both asserted against `dist/index.js` |
| New `src/` file rule | fails `test:changed-paths` unless pre-declared in `ownership.reviewedNewSdkSourcePaths` |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The coupling inventory is already machine-generated; do not re-derive it by reading code

#71 built `platform-coupling-policy.mjs`, which walks `src/` with the TypeScript AST, collects free
identifiers in value position and module specifiers in every import/export/require position, and
classifies each against a declared policy per role (`authored` / `generated`). `test:scope` prints the
result. **That inventory is the extraction's specification.** Every entry is either moved behind an SPI or
declared as permitted in Core.

Known contents from the policy: about two dozen ECMAScript language globals (which couple to nothing and
stay), `setTimeout`/`clearTimeout`, `Buffer`, and `module` in the generated CJS validator.

### F2 — The seam is already half-cut, in `src/providers.ts`

`AuditClock` and `AuditIdentifierProvider` are already interfaces; `systemAuditClock` and
`systemAuditIdentifiers` are already the Node bindings of them, and `randomUUID` is already isolated to
that one file. **Two of PLAN-045's five capabilities are done.** The extraction moves the interfaces to
Core and the `system*` constants to the Node binding (#87). That is a file split, not a redesign.

### F3 — The three remaining capabilities are unequal in difficulty

| Capability | Current coupling | Difficulty |
| --- | --- | --- |
| ids | `node:crypto` `randomUUID` in `providers.ts` | **easy** — interface exists |
| clock | none — `new Date()` | **easy** — interface exists |
| byte length | `Buffer.byteLength(…, "utf8")` at 2 sites | **easy** — `TextEncoder().encode(s).length` is a language-level equivalent; measure the perf delta |
| timer | `setTimeout`/`clearTimeout` + **`unref()`** | **medium** — `unref` is Node-only and load-bearing (`shutdownTimerOwnership` says idle-process retention must not occur) |
| schema runtime | `src/generated/schema-validator.generated.cjs` — a **CommonJS** artifact using `module` | **hard** — see F4 |
| Node engines | `>=24 <25 \|\| >=26 <27`, pinned twice | **policy, not code** — already covered by `check-compatibility.mjs` |

The timer one is the interesting one: the SPI must express "a timer that does not retain the process",
which some hosts cannot provide. Core must therefore treat `unref` as an **optional capability** and
degrade explicitly rather than assume it.

### F4 — The schema runtime is the real extraction problem

`schema-validator.generated.cjs` is a 248 KB standalone Ajv-generated CommonJS artifact, byte-compared by
`check:generated`, and `modulePolicy` is `esm-public-cjs-standalone-validator`. It is generated by the
contract pipeline, it is CommonJS, and it uses the CJS wrapper global `module`.

A platform-neutral Core cannot require a CommonJS loader. So either the validator becomes an SPI
(`SchemaRuntime` with `validate(event): Result`, implemented by the Node binding), or the generator gains
an ESM output mode. **The SPI is the smaller change and the one PLAN-045 names** ("schema runtime" is
listed as a provider interface). Choose it, and record that the generator is unchanged — the fix is never
in generated output, and here it is not in the generator either.

### F5 — `AsyncLocalStorage` is the ContextProvider, and PLAN-016 already decides its shape

Core keeps ambient context **behind a `ContextProvider` SPI**; Node supplies `AsyncLocalStorage`; other
bindings use explicit context. That is PLAN-016 verbatim. So `src/context.ts` splits: the brand registry,
the 19 brand kinds and the validation logic stay in Core; the ALS frame becomes a provider.

**This is where #78 bites — and the 2026-08-23 decision changes the answer.** The earlier version of this
finding said extraction under module-copy scope would require a cross-package brand mechanism that nobody
had scoped. It does not, provided the split is done one specific way.

Option C's mechanism: **the Node binding depends on Core and re-exports it; it never duplicates
`context.ts`.** One resolved copy means one registry, so a value branded in Core and read through the Node
binding is the *same* copy's value and is not foreign. No cross-package brand mechanism is needed, and no
public API changes.

That makes the property load-bearing, so #86 must prove it rather than assume it:

- **New acceptance criterion.** Core resolves to exactly one module instance in any supported consumer
  graph.
- **New fixture.** A deliberately duplicated Core must fail closed with a diagnostic that names
  deduplication as the remediation — wording aligned with #79, which stays in scope under option C.
- **Null control.** The same fixture without duplication must pass. A duplicate-Core arm that could never
  have been red proves nothing.

**And the dependency gate must be rescoped in this change.** `check-dependencies.mjs` and
`check-coherence.mjs`'s `lock-runtime-dependencies` rule both assert an **empty** `dependencies` object.
That rule was written for a single package. The Node binding needs Core as a first-party runtime
dependency, so the gate becomes "no third-party runtime dependencies" implemented as an allowlist of
exactly one first-party specifier — not as a relaxed check. **Prove the rescoped gate still fails on a
third-party dependency before trusting it.**

### F6 — "Neutrality mutations fail" needs a gate, and #88 is that gate

#86's fourth acceptance criterion asks that neutrality mutations fail. The instrument is #88 (rescoping
the coupling policy per package). So #86 and #88 are a pair: #86 moves the code, #88 proves it stayed
moved. Sequencing them apart means a window where neutrality is claimed and unenforced. **Land the Core
policy in #86 and let #88 add the cross-package placement mutations** — that is the smallest safe split.

### F7 — The paper second consumer is a real deliverable, not a thought experiment

#86 requires validation "against Node and a paper second consumer". The cheapest honest version: write the
provider implementations a hypothetical browser or Deno consumer would need, as **types only**, and prove
Core compiles against them. If Core cannot be typed against a non-Node provider set, it is not neutral.
`npm run test:types` is the existing instrument for compile-only assertions.

### F8 — The pinned counts do not move, and that is a useful check

`catalogEventCount: 24`, `namedEventApiCount: 24`, delivery classes, extension namespaces — all asserted
against `dist/index.js`. A correct extraction changes **none** of them. If any moves, semantics moved with
the code, which the issue forbids.

---

## Decisions taken

1. **Read the coupling inventory first**; it is the specification (F1).
2. **Schema runtime becomes an SPI**, not an ESM generator mode (F4).
3. **`unref` is an optional capability** with explicit degradation, not an assumption (F3).
4. **Core keeps: catalog, field policy, authority, lifecycle, prohibited-data, bounds, privacy-transform
   application** — PLAN-046, verbatim, non-negotiable.
5. **Node binding takes: `randomUUID`, `AsyncLocalStorage`, `Buffer` byte length, `unref` timers, the
   generated CJS validator** — PLAN-014/PLAN-016.
6. **The paper consumer is types-only and must compile** (F7).
7. **The pinned counts must not move** (F8).

---

## Task 0: The gate, then the measurement

- [ ] 0.1 **Confirm #76, #78, #83 are all resolved.** If any is open, stop. #78 in particular decides
      whether extraction is even coherent (F5).
- [ ] 0.2 `npm run test:scope --prefix packages/security-audit-sdk-core` — capture the coupling inventory
      verbatim. This is the extraction's checklist (F1).
- [ ] 0.3 For each inventory entry, classify: stays in Core (language global), moves behind an SPI, or
      moves to the Node binding. Record the full table before designing anything.
- [ ] 0.4 Measure `TextEncoder().encode(s).length` against `Buffer.byteLength(s, "utf8")` on realistic
      inputs. If the delta is material, that is a design input, not a surprise.

## Task 1: Propose

- [ ] 1.1 OpenSpec change `extract-platform-neutral-core`.
- [ ] 1.2 **Full assessment.** `public_api`, `integration`, `lifecycle_or_state`, `concurrency` and
      `security_sensitive_behavior` all plausibly fire. Justify all fifteen dimensions.
- [ ] 1.3 Design carries: the Task 0.3 table, the five SPIs, the ContextProvider shape, the schema-runtime
      SPI (F4), the `unref` degradation rule (F3), and the paper consumer (F7).
- [ ] 1.4 Spec delta on `security-audit-sdk-core`, one requirement per SPI boundary.
- [ ] 1.5 Enumerate every new `src/` path for `ownership.reviewedNewSdkSourcePaths` — a move is a new path.

## Task 2: RED — prove neutrality is currently violated

- [ ] 2.1 Run the coupling policy with a hypothetical `core` role declaring **no** host globals and **no**
      Node specifiers. Every current violation is the work list.
- [ ] 2.2 Write the paper consumer's provider types; confirm Core does **not** compile against them today.
- [ ] 2.3 Null control: the unmodified package still passes `validate`.

## Task 3: GREEN — move, in dependency order

- [ ] 3.1 Extend `providers.ts` into the full `PlatformProvider` SPI: ids, clock, byte length, timer,
      schema runtime.
- [ ] 3.2 Split `context.ts`: registry + kinds + validation in Core; ALS behind `ContextProvider`.
- [ ] 3.3 Replace `Buffer.byteLength` with the SPI call at both sites.
- [ ] 3.4 Route timer use through the SPI, with `unref` optional.
- [ ] 3.5 Route validation through the schema-runtime SPI; the generated CJS artifact moves to the Node
      binding (#87), and Core depends only on the interface.
- [ ] 3.6 Re-run Task 2.1 and 2.2 — zero violations, paper consumer compiles.

## Task 4: Prove no semantic change

- [ ] 4.1 `check:generated` **before** `validate`; both `validate` chains; `test:matrix` on both Node
      majors.
- [ ] 4.2 Assert the pinned counts unchanged (F8).
- [ ] 4.3 Context isolation and cleanup tests pass unchanged — nested, concurrent, cleanup.
- [ ] 4.4 Full verification suite; every arm in a disposable clone.

## Task 5: Commit, PR, hand off

- [ ] 5.1 Index empty; governance verified after the commit (#191).
- [ ] 5.2 Update `compatibility.json` with the compatibility impact of the SPI surface.
- [ ] 5.3 Comment on #87 (Node binding) and #88 (rescoped gates) — #88 must land close behind (F6).
- [ ] 5.4 Comment on #131, which declares #86.
- [ ] 5.5 Close #86; tick it in #132's Wave 2 checklist.

---

## Validation matrix

| Acceptance criterion (#86) | Arm |
| --- | --- |
| Core has no Node imports/globals/engines/undeclared runtime deps | Task 3.6, coupling policy with the `core` role |
| Audit semantics/compatibility preserved or migrated | Task 4.2, pinned counts + `compatibility.json` |
| Context isolation/cleanup tests pass | Task 4.3 |
| Neutrality mutations fail | Task 2.1 → 3.6, and #88's cross-package arms (F6) |

## Risks, tradeoffs, and open questions

- **The schema runtime (F4) is where this change can double in size.** If the SPI turns out to force an
  ESM generator mode, re-scope before proceeding — that is a contract-pipeline change with its own gates.
- **The single-copy Core invariant is the load-bearing assumption of the whole authority decision (F5).**
  If a supported consumer graph is found in which Core cannot be deduplicated, #77's option C fails and
  the authority scope reopens. Surface that immediately rather than working around it locally.
- **Rescoping the dependency gate is where a real weakening could slip in (F5).** An allowlist of one
  first-party specifier is the requirement; a check that merely stops asserting emptiness is a silent
  regression of the repository's core discipline.
- **`unref` has no portable equivalent.** Core must not silently retain the process on a host that lacks
  it; degradation must be explicit and observable.
- **The paper consumer can be made to pass by weakening Core's types.** Guard against it: the consumer is
  types-only and Core's public behaviour must not change (F8).
- **Open question for the owner:** does Core keep the name `@bloodtrail/security-audit-sdk-core`, with the
  Node binding taking a new name, or does Core take a new name? `check-coherence.mjs` pins the package
  name as a literal, so the answer moves a pinned constant either way.

## What this does not authorize

Transport, collector, storage, browser or React Native packages; production integration; publication; or
any change to contract semantics.

## What this plan did not verify

The `TextEncoder` vs `Buffer.byteLength` performance delta (Task 0.4), and whether the schema-runtime SPI
can be typed without leaking Ajv's shape into Core's public API — the latter is the design's hardest
question.
