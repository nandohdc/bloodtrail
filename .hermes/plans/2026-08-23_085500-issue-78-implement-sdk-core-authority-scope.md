# Issue #78 — Implement the Approved sdk-core Authority Scope — Plan

> **For Hermes:** **#77 was decided on 2026-08-23 — option C, bounded module-copy scope with a
> single-copy Core.** That collapses this issue to its smaller branch: **formalization plus #79's
> diagnostic, with no registry relocation and no public API change.** The instance-scope branch below is
> retained for the record and is now moot; do not implement it. Two corrections to the earlier framing:
> the brand constructors are **35 exported functions**, not 19 (19 is the count of brand *kinds*), and
> the `foreign` arm's expected result is now settled rather than pending a measurement (see F7).
> The invariant that must survive is one sentence long and is the reason the file exists: *a TypeScript
> cast or a hand-written plain object can claim the `Brand<...>` type but can never appear in the
> registry, because only the constructors in this file can insert entries.* Everything else is
> negotiable; that is not.

**Goal:** Brand storage and the authority APIs enforce the scope selected in #77, with same-scope brands
passing, forged/copied/foreign brands failing before the sink, and nested/concurrent contexts isolated and
cleaned up.

**Status at this baseline:** BLOCKED ON #77 (owner decision, unanswered since 2026-08-16).

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #78, OPEN, labels `security-audit-sdk` `openspec-change-needed` `area:core` `needs-triage` |
| Declared dependency | #77 — **open, unanswered** |
| Native GitHub blockers | `blocked_by` is `0` |
| Registry | `src/context.ts:41` — `const brandRegistry = new WeakMap<object, AuditBrandKind>();` |
| Brand kinds | **19** — `authoritative_actor`, `claimed_actor`, `authenticated_principal`, `subject_authority`, `credential_reference`, `delegation`, `tenant_authority`, `claimed_tenant`, `resource_authority`, `authentication_evidence`, `authorization_evidence`, `session_evidence`, `service_workload`, `observed_source`, `destination_boundary`, `data_policy`, `risk`, `integrity`, `registered_extension` |
| Why WeakMap, not symbols | `structuredClone` silently drops non-enumerable symbols — recorded in the file's own comment |
| Rejection sites | `:363` `failure("AUTHORITY_ESCALATION", "authority", "/"+field)`; `:407` `throw new SecurityAuditSdkError(...)` |
| Ambient frame | `AsyncLocalStorage` from `node:async_hooks` — one of only two permitted non-relative imports in `src/` |
| Governing ADR | `adr/004-authority-context.md` |
| Related | #79 (duplicate-copy diagnostic) declares #78 as a dependency |
| Lifecycle mode | `archived`; a new `src/` file needs an entry in `ownership.reviewedNewSdkSourcePaths` |

---

## Proven findings

### F1 — The forgeability invariant is mechanical and must be re-proved, not inherited

Registry membership is keyed by **object identity** in a module-private `WeakMap`. Two properties follow:
a cast cannot forge membership, and `structuredClone` cannot carry it (which is why the symbol approach
was abandoned — and why the SDK's normalization step, which does a `structuredClone` + JSON round trip,
does not accidentally launder a brand). Any relocation of the registry must preserve **both**.

**Under the adopted option C the registry does not move at all.** It stays a module-level `WeakMap`, and
the work is to state that as a chosen invariant rather than an accident, and to add the single-copy Core
obligation that #86 must satisfy. State that as the design's core sentence.

*(Retained for the record: under instance scope the registry would have moved to a per-instance `WeakMap`
held in a module-private field, preserving identity-keying and module-privacy and changing only which
registry a lookup consults. That branch is moot — and it was under-sized: it would also have required
changing all 35 exported brand constructors, which are public API. See #77's F3.)*

### F2 — `AsyncLocalStorage` is orthogonal to the scope question and must not be conflated

The ALS frame carries *values*; the registry decides whether a value is *authoritative*. Two different
mechanisms. A change to registry scope must not change frame inheritance, override rules, nesting, or
cleanup — all of which ADR-SDK-004 already fixes and #78's own criteria require to keep passing.

### F3 — There is a `providers.ts`, and it imports `node:crypto` — relevant to #86, not here

`src/providers.ts` defines `AuditClock` and `AuditIdentifierProvider` and binds them to `randomUUID`. It is
an SPI seed for #86's platform-neutral Core. **#78 must not touch it.** Mentioning it here only so nobody
mistakes it for the context SPI #86 will need.

### F4 — The test matrix #78 demands is seven-dimensional and needs a genuine two-copy fixture

`same / foreign / copy / duplicate / nested / concurrent / cleanup`. Only the copy and duplicate arms need
a real second installed copy of the package; the rest are in-process. **The two-copy fixture must be
genuine** — two independently installed copies, not one module imported twice — and it must live in a
disposable clone, never the live tree, because sibling verification tests snapshot the live package in
parallel.

### F5 — This change is security-classified and the errors must stay bounded

Errors are safe by construction: code, category, and a bounded path only, never caller data. A refactor
that starts including the offending value's shape in a diagnostic breaks that. #78's own criterion "no
payload/raw-error/secret path leaks" is really #79's; keep it true here too.

### F6 — #79 stands as written under the adopted scope

The earlier version of this finding said instance scope would collapse #79 into a foreign-*instance*
diagnostic and that its body should be rewritten first. **Option C keeps duplicate installed copies a
real, distinguishable condition**, so #79's current body is correct and needs no rewrite. Implement it as
written, after this issue.

*(Retained for the record: had instance scope been selected, foreignness would have been by instance
either way and #79 would have narrowed accordingly.)*

### F7 — The `foreign` arm's expected result is settled, not pending

`isBranded` reads a module-scoped `WeakMap` and takes no instance; `SecurityAuditSdk` never touches it.
Two instances in one copy therefore **accept** each other's brands today, and under option C they continue
to. Task 0.3 no longer chooses between two outcomes — it confirms one. Keep the arm and keep its null
control; a green arm that could never have been red is the repository's recurring defect class.

---

## Task 0: The gate

- [ ] 0.1 **Read #77's resolution.** If open, **stop** and record that #78 remains blocked.
- [ ] 0.2 Re-read `src/context.ts` in full. Record the current registry site, the 19 kinds, and the two
      rejection sites.
- [ ] 0.3 Reproduce, in a disposable clone: same-copy pass, cross-copy rejection with
      `AUTHORITY_ESCALATION`, and **two instances in one copy** (does the brand pass today?). That last
      measurement is #77's Task 0.4 and it decides how much work #78 is.

## Task 1: Propose

- [ ] 1.1 OpenSpec change `implement-sdk-core-authority-scope`.
- [ ] 1.2 Assessment: `security_sensitive_behavior` and `public_api` both fire — the authority
      constructors are exported. Justify all fifteen dimensions.
- [ ] 1.3 The design's first paragraph is F1's core sentence. Everything else follows from it.
- [ ] 1.4 Spec delta on `security-audit-sdk-core`, one requirement per scope invariant.

## Task 2: RED — the seven-arm matrix, before any code

| Arm | Fixture | Expected under the selected scope |
| --- | --- | --- |
| same | one instance, one copy | brand accepted |
| foreign | two instances, one copy | **accepted** — settled under the adopted module-copy scope (F7) |
| copy | two genuine installed copies | rejected under both |
| duplicate | nested dependency producing two copies | rejected; diagnostic per #79 |
| nested | nested ALS scopes | isolation preserved, unchanged |
| concurrent | concurrent ALS scopes | no leakage, unchanged |
| cleanup | scope exit | no retention, unchanged |
| forged | plain object cast to `Brand<...>` | **rejected under both — non-negotiable** |
| cloned | `structuredClone` of a branded value | **rejected under both — non-negotiable** |
| **null** | unmutated package copy | full `validate` passes |

- [ ] 2.1 Record each arm's behaviour **before** any change. The `foreign` row is the measurement that
      distinguishes the two scopes.
- [ ] 2.2 The `forged` and `cloned` arms must already fail. If either passes today, that is a live
      vulnerability and it outranks this issue — stop and report it.

## Task 3: GREEN — implement the selected scope

- [ ] 3.1 Module-copy scope: formalize. Name the invariant in code comments and in ADR-SDK-004; add the
      duplicate-copy diagnostic path #79 needs. Registry stays module-level.
- [ ] 3.2 Instance scope: move the registry into the instance as a module-private field; every constructor
      becomes instance-bound; every `isBranded` lookup consults the instance's registry. **Preserve
      identity-keying and module-privacy** (F1).
- [ ] 3.3 Re-run all ten arms. Only the `foreign` row may change.
- [ ] 3.4 `npm run test:types` — the branded types' negative assertions must still reject a cast.

## Task 4: Verify, commit, PR

- [ ] 4.1 `check:generated` before `validate`; both `validate` chains; `test:matrix` on both Node majors.
- [ ] 4.2 Index empty before verification; governance verified **after** the commit exists (#191).
- [ ] 4.3 If a new `src/` file is created, add its exact path to `ownership.reviewedNewSdkSourcePaths` in
      the same change or `test:changed-paths` rejects it.
- [ ] 4.4 Update `compatibility.json` with the compatibility impact — a scope change is at minimum a
      behavioural security tightening and must be classified against `semverClassification`.
- [ ] 4.5 Report readiness. **Do not merge.**

## Task 5: Hand off

- [ ] 5.1 **Re-scope #79 before implementing it** (F6).
- [ ] 5.2 Comment on #83 and #86 that their dependency is resolved.
- [ ] 5.3 Close #78; tick it in #132's Wave 2 checklist.

---

## Validation matrix

| Acceptance criterion (#78) | Arm |
| --- | --- |
| Approved same-scope brands pass | `same` |
| Forged/copied/foreign brands fail before sink | `forged`, `cloned`, `copy`, `foreign` |
| Nested/concurrent contexts isolate and clean up | `nested`, `concurrent`, `cleanup` |
| Compatibility/migration docs match | `compatibility.json` + ADR-SDK-004 |

## Risks and open questions

- **The single-copy Core invariant is inherited from #77 and is not provable here.** #78 states it; #86
  proves it with a duplicate-Core fixture. Do not let this issue claim the invariant holds.
- **Formalization is where a control can be written that never fires.** Every arm in the Task 2 matrix
  needs a null control, and the `foreign` arm especially: its expected result is now known (F7), so a
  passing test proves nothing unless the mutation that should break it is shown to break it.
- **35 exported brand constructors, 19 brand kinds.** If any enumeration is added, enumerate the
  constructors from the export list *and* the kinds from the `AuditBrandKind` union, and assert both
  counts, so a forgotten one fails loudly. Conflating the two numbers is what under-sized instance scope.

*(Retained for the record: instance scope would have been a breaking source-level change for any consumer
holding two instances, and a breaking change to 35 public constructors. Moot under option C.)*

## What this does not authorize

Any global fallback, ambient authority, delivery, browser, or collector work. No implicit brand sharing
between copies or instances under any circumstances.

## What this plan did not verify

Task 0.3's `foreign` arm — the single measurement that sizes this issue.
