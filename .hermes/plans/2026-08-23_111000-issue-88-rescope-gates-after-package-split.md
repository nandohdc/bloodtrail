# Issue #88 — Re-scope Portability and Production-Scope Gates After the Package Split — Plan

> **For Hermes:** Blocked on #85, #86, #87. This is the gate that makes #86's neutrality claim mean
> something, and it should land **immediately behind** #86 — a window where Core is "neutral" and nothing
> enforces it is exactly how neutrality rots. The instrument already exists and is well-shaped: #71's
> `platform-coupling-policy.mjs` is *already* role-based, with declared `hostGlobals` per role. Re-scoping
> is adding roles, not writing a new gate. Note #201 may have deleted the legacy regex stage by then; read
> `check-scope.mjs` at the time rather than from this plan.

**Goal:** Core rejects Node and binding code; the Node binding permits only approved Node capabilities;
moving Node code into Core fails; moving transport/browser/collector code into any SDK package fails.

**Status at this baseline:** BLOCKED ON #85, #86, #87.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #88, OPEN, labels `security-audit-sdk` `verification` `area:core` `needs-triage` |
| Declared dependencies | #85, #86, #87 — all blocked |
| Native GitHub blockers | `blocked_by` is `0` |
| Existing instrument | `packages/security-audit-sdk-core/scripts/platform-coupling-policy.mjs` — `PLATFORM_COUPLING_POLICY` is **already role-based** with per-role `hostGlobals` |
| Roles today | `authored`, `generated` |
| Diagnostics today | `undeclared-specifier`, `undeclared-global`, `read-failure`, `directory-read-failure` |
| Filename rule | `check-scope.mjs` — 18 forbidden production-integration terms |
| Manifest rules | dependency emptiness + forbidden export substrings |
| Related in-flight | **#201** retires the legacy regex stage; read `check-scope.mjs` fresh |
| Language globals | `LANGUAGE_GLOBALS` in `platform-coupling-policy.mjs` — the set that couples to nothing |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The gate is already role-based; this is a configuration change plus new roles

`PLATFORM_COUPLING_POLICY` declares `hostGlobals` per role, and `inspectPlatformCoupling` classifies each
free identifier and specifier against the role of the artifact it appears in. Adding a `core` role with
**empty** `hostGlobals` and no Node specifiers, and a `node-binding` role with the approved set, is the
whole of the coupling half of #88.

### F2 — The role must be derived from the artifact's package, not from a hard-coded path list

Today role assignment is `authored` vs `generated` inside one package. After the split it must be
`core-authored`, `core-generated`, `node-authored`, `node-generated`. Derive it from the **package
manifest** the artifact belongs to, so a file moved between packages changes role automatically. A
hard-coded path list would pass a moved file under its old role — which is precisely the mutation #88's
third acceptance criterion demands must fail.

**This is the single most important design decision in the issue and it is not in the body.**

### F3 — Core's `hostGlobals` is empty, and that is the definition of neutral

Not "Node globals excluded" — **empty**. Core may use `LANGUAGE_GLOBALS` (which couple to nothing) and
nothing else. `Buffer`, `process`, `setTimeout`, `module`, `window`, `document`, `fetch` are all
undeclared in Core by construction. That single line is the neutrality gate.

### F4 — The Node binding's approved set is small and must be enumerated, not described

From #86/#87: `Buffer`, timers with `unref`, `module` (for the CJS validator), plus specifiers
`node:crypto` and `node:async_hooks`. Five entries. Enumerate them with a `reason` each, exactly as the
existing policy does for `module` ("CommonJS wrapper export for schema-validator.generated.cjs").

### F5 — The filename rule must apply per package, and it is currently written for one

`check-scope.mjs` reads one `packageRoot`. After the split there are two (or more). Either the script takes
a package argument and CI runs it per package, or it discovers packages. **Prefer the explicit argument** —
a discovery glob that finds nothing and exits 0 is this repository's recurring failure (see #85's F2).

### F6 — The cross-package movement mutations are the acceptance evidence

#88's four criteria are four mutations. Each needs a disposable fixture and a null control:

| Arm | Mutation | Expected |
| --- | --- | --- |
| M1 | `Buffer.byteLength` added to a Core source file | `[platform-coupling:undeclared-global] …: Buffer` in role `core-authored` |
| M2 | `import { AsyncLocalStorage } from "node:async_hooks"` in Core | `undeclared-specifier` |
| M3 | a Node-binding file moved into Core's `src/` unchanged | fails **because the role changed** (F2) |
| M4 | `src/transport.ts` created in **either** package | forbidden production-integration filename |
| M5 | `"./browser"` added to either package's export map | forbidden export |
| M6 | an approved Node capability used in the Node binding | **passes** — the negative control that proves the gate is not just "reject everything" |
| N0 | unmutated tree, both packages | passes; inventories match the recorded baseline |

M6 is the arm that distinguishes a working policy from a broken one, and it is the arm most likely to be
skipped.

### F7 — Land close behind #86

A neutrality claim with no gate is a claim. #86's fourth acceptance criterion ("Neutrality mutations
fail") is literally satisfied by this issue, so the two are a pair. Recommend: #86 lands the `core` role
with an empty `hostGlobals` as part of its own change, and #88 adds the cross-package movement mutations
and the per-package filename/manifest wiring. That closes the window.

---

## Task 0: The gate

- [ ] 0.1 **Confirm #86 and #87 are complete** and #85's CI model is known. If any is open, stop.
- [ ] 0.2 Read `check-scope.mjs` and `platform-coupling-policy.mjs` **fresh** — #201 may have removed the
      legacy regex stage by then.
- [ ] 0.3 Capture both packages' current coupling inventories as the baseline.

## Task 1: Propose

- [ ] 1.1 OpenSpec change `rescope-gates-after-package-split`.
- [ ] 1.2 The design's core decision is F2 — role derived from the package manifest. State it first.
- [ ] 1.3 Enumerate the Node binding's approved set with a reason per entry (F4).
- [ ] 1.4 Record that Core's `hostGlobals` is **empty** (F3).

## Task 2: RED — all seven arms before any change

- [ ] 2.1 Build each fixture in a disposable clone. Confirm M1–M5 currently **pass** (wrongly).
- [ ] 2.2 Confirm M6 passes and N0 passes. **If N0 fails, the harness is broken** — fix it before reading
      any other arm.

## Task 3: GREEN

- [ ] 3.1 Add the four roles; derive role from the package manifest (F2).
- [ ] 3.2 Core: empty `hostGlobals`, no Node specifiers.
- [ ] 3.3 Node binding: the five approved entries, each with a reason.
- [ ] 3.4 Make the filename and manifest rules take an explicit package argument (F5).
- [ ] 3.5 Wire both packages into CI per #85's model.
- [ ] 3.6 Re-run all seven arms. M1–M5 fail with named diagnostics; M6 and N0 pass.

## Task 4: Verify, commit, PR, close

- [ ] 4.1 `check:generated` before `validate`; both chains; `test:matrix` on both Node majors.
- [ ] 4.2 Index empty; governance verified after the commit (#191).
- [ ] 4.3 Closing comment: the seven-arm table with diagnostics, and both packages' inventories.
- [ ] 4.4 Close #88; tick it in #132's Wave 2 checklist — **this closes Wave 2**.

---

## Validation matrix

| Acceptance criterion (#88) | Arm |
| --- | --- |
| Core rejects Node/binding code | M1, M2 |
| sdk-node permits only approved Node capabilities | M6 passes; an unapproved global fails |
| Moving Node code to Core fails | M3 |
| Moving transport/browser/collector code into SDK packages fails | M4, M5 |

## Risks and open questions

- **Hard-coding roles by path (F2)** would pass a moved file under its old role and silently defeat M3.
- **A discovery glob that finds no packages** exits 0 and proves nothing (F5).
- **Skipping M6** produces a gate that rejects everything, which is indistinguishable from a correct gate
  until the first legitimate Node capability is added and rejected.
- **Open question:** does the coupling policy live in one shared script consumed by both packages, or is
  it duplicated per package? Shared is correct and creates a cross-package dependency between build
  scripts — which #80's topology answer may or may not make easy. Raise it in the design.

## What this does not authorize

Any new capability, package implementation, browser/transport authorization, or weakening of neutrality.

## What this plan did not verify

Whether `platform-coupling-policy.mjs` can derive a role from a package manifest without reading the
filesystem in a way the gate's own rules forbid. It is a build script, not `src/`, so it may — but check.
