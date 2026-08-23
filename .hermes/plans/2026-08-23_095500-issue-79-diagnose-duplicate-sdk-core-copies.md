# Issue #79 — Diagnose Duplicate sdk-core Copies Without Reporting an Attack — Plan

> **For Hermes:** #79 declares dependencies on #77 and #78, but read F1 before accepting that: **if #77
> selects instance scope, this issue as written stops making sense** — a duplicate installed copy ceases
> to be a distinguishable condition, because foreignness would be by instance rather than by copy. So the
> first action is not implementation and not waiting; it is a **triage correction on the issue itself**,
> stating that #79's content is conditional on #77's answer and naming what it becomes under each. #132's
> last sync calls #79 "the only Wave 2 item not gated by a decision" — that is true of its *subject* and
> false of its *shape*, and the difference is worth writing down.

**Goal:** A dependency-tree condition — a value from another installed copy of the package — returns a
distinct, bounded diagnostic instead of `AUTHORITY_ESCALATION`, with genuine escalation attempts keeping
the security diagnostic.

**Status at this baseline:** CONDITIONAL ON #77. Not startable as written.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #79, OPEN, labels `bug` `severity:medium` `security-audit-sdk` `area:core` `needs-triage` |
| Declared dependencies | #77, #78 — both blocked on the same unanswered owner decision |
| Native GitHub blockers | `blocked_by` is `0` |
| Current behaviour | a cross-copy branded value is rejected with `AUTHORITY_ESCALATION` at `src/context.ts:363` / `:407` |
| Origin | S-3/S-4 in the archived remediation packet; the diagnostic gap was split out as this issue |
| Error discipline | errors are safe by construction — code, category, and a bounded path only, never caller data |
| Result discipline | the public API returns `AuditResult<T>` and never throws across the boundary; construction is the sole exception |
| Error-code policy | `compatibility.json.errorCodePolicy` — **additive is minor**, removal or meaning change is major |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The issue's subject is conditional on #77, and nobody has said so

Under **module-copy scope**, "value from another installed copy" is a real, detectable category and #79 is
exactly right: add a diagnostic that distinguishes a dependency-tree fault from an attack.

Under **instance scope**, the registry belongs to the instance. A second installed copy is then no
different from a second instance in the same copy — both foreign, both rejected for the same reason. The
useful diagnostic becomes "this value was branded by a different SDK instance", which is a *different*
message with a *different* remediation ("pass the same instance" rather than "deduplicate your dependency
tree").

**Both are worth having. They are not the same issue.** Record this on #79 now, before either #77 or #78
resolves, so the answer arrives with the consequence already understood.

### F2 — Detection must not weaken the brand check, and there is only one safe place to do it

The diagnostic can only be emitted **after** the value has already failed `isBranded`. Detection is
therefore a *classification of an existing rejection*, never an alternative acceptance path. Any design
that inspects the value to decide whether to accept it has inverted the control.

The signal available at that point is limited: the value's own shape, and whatever the rejecting copy can
learn about the environment. It cannot read the other copy's registry — that is the whole point.

### F3 — The detection signal is weak, and honesty about that is the deliverable

How does copy A know that a foreign object came from copy B rather than from an attacker's hand-written
object? Candidate signals, with their weaknesses:

| Signal | How it works | Why it is weak |
| --- | --- | --- |
| A well-known non-enumerable marker on branded values | copy B stamps it; copy A reads it | **Forgeable** — an attacker can stamp it too |
| A module-level registry anchored on `globalThis` | copies register their presence | Reachable and mutable by any code in the process — the exact weakening ADR-SDK-004 rejects |
| Dependency-tree inspection at construction | read `node_modules` for duplicate installs | Filesystem access from `src/` — **forbidden**; only `node:async_hooks` and `node:crypto` are permitted imports |
| Shape heuristic | branded values have a known field set | Heuristic; false positives on hand-written lookalikes |

**The honest conclusion:** a duplicate-copy diagnostic can only ever be a *hint*, and #79's own assurance
limitation already says "the diagnostic cannot prove why duplication exists". The design must therefore
make the hint **non-authoritative by construction**: same rejection, same failure, additional *advisory*
text or an additional bounded code — never a different security outcome.

The forgeable-marker option is acceptable **precisely because** it changes nothing about acceptance. An
attacker who stamps the marker gets a friendlier error message and the same rejection.

### F4 — A new error code is additive and therefore minor

`errorCodePolicy.additive: "minor"`. So introducing `SDK_DUPLICATE_MODULE_COPY` (or, under instance scope,
`SDK_FOREIGN_INSTANCE`) is a minor-level change, not a major one — provided `AUTHORITY_ESCALATION` keeps
its exact meaning for genuine forgery. #79's third criterion ("same-copy behavior is unchanged") and second
("a forged object retains the security diagnostic") together enforce that.

### F5 — The no-leak criterion is the easy one to break

"No payload/raw-error/secret path leaks." A diagnostic that helpfully includes the offending object's keys
to explain the duplication would break the SDK's error discipline. Bound the diagnostic to a code, a
category, and a path — same as every other error.

### F6 — The remediation guidance belongs in documentation, not in the error

#79 asks for "remediation guidance". A bounded error cannot carry a paragraph. Put the code in the error
and the guidance in `API.md` / `SECURITY.md`, keyed by code. That is how every other code in this SDK
works.

---

## Decisions taken

1. **Correct the issue first** (F1) — record what #79 becomes under each #77 answer.
2. **Classification of an existing rejection, never an acceptance path** (F2).
3. **The signal is forgeable and that is acceptable**, because it changes no security outcome (F3).
4. **New additive error code**, minor-level; `AUTHORITY_ESCALATION` keeps its exact meaning (F4).
5. **Bounded diagnostic; guidance lives in docs keyed by code** (F5, F6).

---

## Task 0: Correct the issue now — this is startable today

- [ ] 0.1 Post a triage comment on #79 recording F1: the issue's content is conditional on #77, and here
      is what it becomes under each answer. Carry `> *This was generated by AI during triage.*`.
- [ ] 0.2 Record F3's honest conclusion: any duplicate-copy signal is a hint, is forgeable, and must not
      change the security outcome. This pre-empts a design review that would otherwise discover it late.
- [ ] 0.3 Keep `needs-triage`. Do **not** promote to `ready-for-agent` while #77 is open.

## Task 1: The gate

- [ ] 1.1 **Read #77's and #78's resolutions.** If either is open, stop.
- [ ] 1.2 If instance scope was selected: **rewrite #79's body** to the foreign-instance diagnostic before
      implementing anything.

## Task 2: RED — four fixtures, before any code

| Arm | Fixture | Expected after the change |
| --- | --- | --- |
| duplicate | two genuine installed copies, value crosses | **new code**, same rejection |
| forged | plain object cast to a branded type | `AUTHORITY_ESCALATION`, unchanged |
| same-copy | ordinary use | accepted, unchanged |
| nested-dependency | duplicate arising from a transitive dependency | new code, same rejection |
| **null** | unmutated copy | full `validate` passes |

- [ ] 2.1 Record all five arms **before** the change; the `duplicate` and `nested-dependency` arms must
      currently report `AUTHORITY_ESCALATION` — that is the defect.
- [ ] 2.2 The two-copy fixtures must be **genuine installs in a disposable clone**, never one module
      imported twice, and never in the live tree.

## Task 3: GREEN

- [ ] 3.1 Add the code and the classification at the rejection site only (F2).
- [ ] 3.2 Add the guidance to `API.md` and `SECURITY.md`, keyed by code (F6).
- [ ] 3.3 Update `compatibility.json` — new code, additive, minor (F4).
- [ ] 3.4 Re-run all five arms.
- [ ] 3.5 Add a test asserting the diagnostic contains **no** object keys or values (F5).

## Task 4: Verify, commit, PR, close

- [ ] 4.1 `check:generated` before `validate`; both chains; `test:matrix` on both Node majors.
- [ ] 4.2 Index empty; governance verified after the commit (#191).
- [ ] 4.3 Closing comment: the five arms, the additive classification, and F3's honesty about the signal.
- [ ] 4.4 Tick #79 in #132's Wave 2 checklist.

---

## Validation matrix

| Acceptance criterion (#79) | Arm |
| --- | --- |
| Duplicate-copy fixture returns the dedicated diagnostic | `duplicate`, `nested-dependency` |
| Forged object retains the security diagnostic | `forged` |
| Same-copy behaviour unchanged | `same-copy`, null control |
| No payload/raw-error/secret path leaks | Task 3.5 assertion |

## Risks and open questions

- **Implementing the current body under instance scope** produces a diagnostic for a condition that no
  longer exists. F1 exists to prevent that.
- **A forgeable hint could be read as a security control.** Say in the code comment, the ADR, the docs and
  the closing comment that it is not.
- **`globalThis` is the tempting shortcut** and it is the one option that actually weakens the model.
  Reject it explicitly so it is not re-proposed.
- **Open question:** should the new code be emitted at all when the SDK cannot tell duplication from
  forgery? An alternative is to keep one code and add a documentation note. That is a smaller change and a
  defensible answer — raise it with the owner rather than assuming a new code is wanted.

## What this does not authorize

Auto-hoisting, global brand sharing, stack leakage, dependency-tree mutation, filesystem access from
`src/`, or accepting foreign authority under any condition.

## What this plan did not verify

Whether a non-enumerable marker survives the SDK's own normalization (`structuredClone` + JSON round
trip). It almost certainly does **not** — which may make the marker option unusable and is worth measuring
before designing around it.
