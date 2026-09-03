## Context

See `proposal.md` for motivation and the delta specification for the normative behavior. Repository evidence, verified read-only on 2026-09-02 against `origin/main` `c6a4b74`: `src/context.ts` keeps `brandRegistry` as a module-level `WeakMap<object, AuditBrandKind>` at line 41; `brand()` writes to it and `isBranded()` reads it, neither takes an SDK instance, and `SecurityAuditSdk` never touches the registry. The rejection sites are `context.ts:363` (`failure("AUTHORITY_ESCALATION", "authority", ...)`) and `context.ts:407` (a thrown `SecurityAuditSdkError` with the same bounded shape). The file's own header comment already records that casts and plain objects cannot enter the registry and that the symbol approach was abandoned because `structuredClone` silently drops non-enumerable symbols. ADR-SDK-004 and root ADR 0010 already carry the settled option-C scope selection; the canonical capability spec already carries the ratified authority requirement.

The canonical audit contract is frozen and unaffected. The SDK remains an isolated technical candidate; this change authorizes no production integration.

## Goals / Non-Goals

**Goals:**

- Turn module-copy scope into a chosen, named invariant in `src/context.ts` — comments only, no runtime change.
- Regression-guard the ratified authority invariants with a mutation-sensitive arm matrix in the SDK verification suite.
- Pin the insertion surface with an enumeration control that asserts both the 35 exported brand constructors and the 19 `AuditBrandKind` members.
- Prove cross-copy rejection with a genuine second installed copy in an isolated `mkdtemp` fixture.
- Classify the formalization in `compatibility.json` so a future reader cannot mistake it for a behavioral tightening.

**Non-Goals:**

- No registry relocation, no public API change, no runtime behavior change, no new diagnostic path.
- No implementation of #79's distinct duplicate-Core diagnostic; #79 stays as written.
- No single-copy Core proof: that is #86's obligation, stated and pointed to here, not performed.
- No global fallback, ambient authority, delivery, browser, or collector work; no contract or generated-artifact change.
- The instance-scope model appears only as rejected history.

## Decisions

### D1 — The invariant is named in code, not re-established

`src/context.ts` gains a comment naming module-copy scope as a **chosen** invariant: `brandRegistry` is a module-private identity-keyed `WeakMap`, only the exported brand constructors in this file can insert entries, and the scope is deliberate (recorded by ADR-SDK-004's scope selection and root ADR 0010), not an accident of module resolution. The comment preserves the existing `structuredClone`/symbol reasoning. Nothing else in `src/` changes: no runtime code, no registry relocation, no public API change.

The rejected alternative is rewriting the mechanism — for example moving the registry into instances or onto global state. Both were measured and rejected under the settled option C, and re-establishing them here would change behavior and public API.

### D2 — The authority-scope matrix has nine arms, each null-controlled and mutation-sensitive

The verification suite gains an authority-scope matrix with the following arms, expected results recorded **before** any implementation change:

| Arm | Fixture | Expected result |
| --- | --- | --- |
| `same` | one SDK instance, one module copy | branded value accepted |
| `foreign` | two SDK instances, one module copy | accepted — settled under the adopted module-copy scope (F7), not a pending measurement |
| `forged` | plain object cast to `Brand<...>` | rejected — non-negotiable |
| `cloned` | `structuredClone` of a branded value | rejected — non-negotiable |
| `copy` | two genuine installed copies | rejected with `AUTHORITY_ESCALATION` before the sink |
| `nested` | nested AsyncLocalStorage scopes | isolation preserved, unchanged |
| `concurrent` | concurrent AsyncLocalStorage scopes | no leakage, unchanged |
| `cleanup` | scope exit | no retention, unchanged |
| `null` | unmutated package | full `validate` passes |

The duplicate-Core arm ("nested dependency producing two copies, distinct diagnostic per #79") is deliberately **not** one of the nine: its diagnostic is #79's ownership and is not implemented here. Cross-copy rejection itself is covered by the `copy` arm.

Every arm carries a null control, and the suite proves mutation sensitivity: a fixture mutation that violates an arm's guarded invariant must fail that arm. The `forged` and `cloned` arms must already fail before this change; if either passes during the RED record, that is a live vulnerability and the work stops. The `foreign` arm especially must be shown red-able under a cross-copy mutation, because its green result is settled and could otherwise never have been red.

The rejected alternative is recording the settled `foreign` arm without a red-able control. A green arm that could never fail proves nothing — the recurring defect class this design guards against.

### D3 — Enumeration control asserts both counts, never conflated

The insertion surface is enumerated from `src/context.ts` itself: the `export function` declarations (the same counting method as ADR 0010 F3) and the `AuditBrandKind` union members. The control asserts **both** counts — exactly 35 exported brand constructors and exactly 19 brand kinds — and fails loudly when either drifts. Conflating the two numbers is what under-sized the rejected instance-scope model, so the two counts are asserted independently and named separately in every diagnostic.

The rejected alternative is asserting a single derived count. It would reproduce the exact conflation the owner corrected on 2026-08-23.

### D4 — The copy arm uses a genuine two-copy fixture in an isolated `mkdtemp` fixture

The `copy` arm is built with **two genuinely, independently installed copies** of the package — each resolved from its own installation, never one module imported twice through aliased resolution. The fixture is isolated in its own `mkdtemp` root, built by the test-local `copyPackageStable` helper, never the live tree, because sibling verification tests snapshot the live package in parallel. `tests/verification/disposable-git.mjs` supplies Git identity/environment helpers only; this fixture invokes no Git commands. The fixture asserts the two resolved module copies are distinct before it records rejection evidence, and verifies the rejection carries the bounded `AUTHORITY_ESCALATION` shape.

The rejected alternative is importing the built package twice under two paths and calling that "two copies". Module resolution would collapse that to one instance and the arm would silently stop exercising the cross-copy boundary.

### D5 — Compatibility classification records a no-op formalization honestly

`compatibility.json` gains an authority-scope classification against `semverClassification`: no public API change, no runtime behavior change, no new SDK error code. The classification records the bounded module-copy scope decision, the settled same-copy cross-instance acceptance, and the future obligations owned by #79 (distinct duplicate-Core diagnostic) and #86 (single-copy Core proof and dependency-gate rescoping) without authorizing either. The bounded `AUTHORITY_ESCALATION` shape — code, category, bounded path only, never caller data — is preserved and restated.

The rejected alternative is classifying the formalization as a behavioral security tightening. That would be wrong under option C (behavior does not change) and would let a future reader mistake documentation and tests for a semantic change.

## Migration Plan

1. Land the proposal, full assessment, delta, design, and all-unchecked tasks as a proposal-only commit.
2. After the required exact-commit owner authorization, execute the apply phase: RED record of all nine arms, comment-only invariant naming, the matrix and enumeration tests, the two-copy fixture, and the `compatibility.json` classification — each verified against the checked tasks before they are ticked.
3. Fold the capability delta into `openspec/specs/security-audit-sdk-core/spec.md` in a separate active-change canonical-fold commit, proving a second semantic application is a no-op.
4. After identity-preserving merge and all required approval evidence, archive in a separate byte-preserving relocation commit.

Rollback before implementation is removal of the unmerged proposal. After the delta is folded, a different authority-scope treatment requires a new governed change rather than an edit to this record.

## Risks / Trade-offs

- [An arm's test cannot be made red] → Treat the arm as unproven; fix the fixture rather than shipping a green-only arm.
- [The forged or cloned arm passes during the RED record] → A live forgeability vulnerability outranks this issue; stop and report it before any formalization work.
- [The two-copy fixture collapses to one instance] → The distinct-copy assertion fails the fixture; no rejection evidence is recorded from an aliased import.
- [Enumeration counts drift silently] → Both counts are asserted from source; drift fails the suite and names the drifted count.
- [A reader mistakes the formalization for a behavior change] → The `compatibility.json` classification states the no-op nature explicitly.
- [The duplicate-Core diagnostic sneaks into this change] → Task boundaries name #79 as owner; tasks.md and this design exclude the diagnostic path.
- [Prose is mistaken for implementation approval] → Implementation, review, merge, and archive tasks stay unchecked until their exact-commit gates fire.

## Open Questions

None. The owner-selected model (option C), the settled `foreign` result (F7), the 35/19 correction, and the #79/#86 ownership boundaries are all settled by the 2026-08-23 decision and its recorded corrections. Test file placement and fixture mechanics within the isolated `mkdtemp` fixture are left to the implementer under the constraints above.
