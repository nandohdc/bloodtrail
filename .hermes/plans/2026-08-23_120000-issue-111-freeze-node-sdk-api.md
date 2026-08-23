# Issue #111 — Freeze the Node SDK API After Vertical Evidence — Plan

> **For Hermes:** Blocked on #109 and #87. This is #110's twin for the Node binding, and the two should be
> written together and landed in sequence, because the interesting requirement lives in the seam between
> them: **"the surface reuses the core semantic types rather than duplicating them."** That is a
> structural assertion about the binding, and it is the one criterion here that #110 does not have. It is
> also testable — a duplicated type is a symbol the binding exports that Core also exports.

**Goal:** An explicit frozen Node export list and runtime support baseline, reusing Core's semantic types,
with an API-surface check detecting unapproved mutation and the record bound to #109's exact evidence.

**Status at this baseline:** DEFERRED — blocked on #109 and #87.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #111, OPEN, labels `documentation` `enhancement` `security-audit-sdk` `area:server` `needs-triage` |
| Declared dependencies | #109, #87 — both blocked |
| Native GitHub blockers | `blocked_by` is `0` |
| Provisional status | PLAN-047 — a thin binding, frozen **only after real vertical evidence** |
| Runtime baseline today | Node `>=24 <25 \|\| >=26 <27`; CI versions `24.2.0`, `26.5.0` |
| Engines pinned | `check-compatibility.mjs` (literal) and `check-coherence.mjs` (cross-check) |
| Existing surface check | `check-exports.mjs` — extended by #110 into a freeze instrument |
| Packed-closure gate | `check-package-contents.mjs` — production-only install of the tarball |
| Shipped-import gate | `check-dependencies.mjs` + `shipped-import-policy.mjs` |
| Publication | never; a freeze does not lift the boundary |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The type-reuse criterion is the distinctive one and it is mechanically checkable

"Reuses the core semantic types rather than duplicating them" fails if the binding declares its own copy of
a type Core already exports. Check: intersect the binding's exported type names with Core's. A non-empty
intersection where the binding **declares** rather than **re-exports** is a duplication. That is a small
script and it belongs in this change.

The subtler version — a structurally identical type under a different name — is not mechanically
detectable. Say so; do not claim the check covers it.

### F2 — The runtime baseline is already pinned twice, and freezing it is a third statement

`check-compatibility.mjs` asserts the engines literal; `check-coherence.mjs` cross-checks it against
`compatibility.json`. The freeze adds: *removing a supported Node major is a major version change*, which
`semverClassification.major` already says ("Node or TypeScript baseline removal"). So the freeze
**records** an existing policy rather than creating one — worth stating so the change stays small.

### F3 — The binding's surface is smaller than Core's and that is the point

Per #87, the binding implements five SPIs plus a context provider. Its export surface should be roughly:
the provider implementations, a factory, and re-exports of Core's public types. If it is much larger, #87
grew scope and the freeze is being asked to bless it.

**Use the freeze as an audit**: enumerate the surface, and question anything that is not an SPI
implementation, a factory, or a re-export.

### F4 — Packed-install evidence belongs in the freeze record

#111's verification names pack/install smoke tests. The freeze record should carry the tarball's import
result on **both** Node majors, because "runtime support baseline" is a claim about installability, not
only about `engines`.

### F5 — Provisional-to-frozen is a status transition and it must be visible

#87's package declares itself explicitly unfrozen. #111 flips that. The transition must be visible in
`compatibility.json`, in the package README, and in the ADR — three places, because a stale "provisional"
line after the freeze is worse than none.

### F6 — Do the two freezes in order, not together

#110 freezes Core; #111 freezes the binding, whose surface re-exports Core's. Freezing the binding first
would freeze a surface that references an unfrozen one. Land #110, then #111.

---

## Task 0: The gate

- [ ] 0.1 **Confirm #109's evidence exists and #87 is complete.** If not, stop.
- [ ] 0.2 **Confirm #110 has landed** (F6). If not, do #110 first.
- [ ] 0.3 Enumerate the binding's current export surface from its built `.d.ts` and audit it against F3.

## Task 1: Propose

- [ ] 1.1 OpenSpec change `freeze-node-sdk-api`.
- [ ] 1.2 Full assessment — `public_api` fires.
- [ ] 1.3 The design records: the frozen list, the runtime baseline and its removal policy (F2), the
      type-reuse check (F1) and its limitation, and the evidence binding.

## Task 2: Implement

- [ ] 2.1 Frozen export list in the binding's `compatibility.json`, classified supported/experimental.
- [ ] 2.2 Extend the surface check to assert equality, mirroring #110.
- [ ] 2.3 Add the type-duplication check (F1).
- [ ] 2.4 Record the freeze in an ADR binding #109's exact commits, and carry the packed-install results
      for both Node majors (F4).
- [ ] 2.5 Flip the provisional status in all three places (F5).

## Task 3: RED then GREEN — five arms

| Arm | Mutation | Expected |
| --- | --- | --- |
| H1 | add an unlisted exported symbol | surface check fails |
| H2 | remove a listed symbol | surface check fails |
| H3 | **declare** a type Core already exports | type-duplication check fails (F1) |
| H4 | re-export the same type from Core | **passes** — the negative control that proves H3 is not just "reject everything" |
| H5 | drop a supported Node major from `engines` | `check-compatibility.mjs` fails |
| N0 | **null control** — unmodified tree | all pass |

## Task 4: Verify, commit, PR, close

- [ ] 4.1 `check:generated` before `validate`; all chains; `test:matrix` on both Node majors.
- [ ] 4.2 Packed install on both Node majors, from a clean directory outside any workspace root.
- [ ] 4.3 Index empty; governance verified after the commit (#191).
- [ ] 4.4 Closing comment: the frozen list, the five arms, the packed-install results, and that the freeze
      authorizes no publication.
- [ ] 4.5 Comment on #112 and #113 — both declare #110 and #111 — that the freezes are complete.
- [ ] 4.6 Tick #111 in #132's Wave 4 checklist.

---

## Validation matrix

| Acceptance criterion (#111) | Arm |
| --- | --- |
| Frozen Node export list and runtime baseline explicit | Task 2.1, 2.4 |
| Surface reuses core semantic types rather than duplicating them | H3 + H4 |
| API-surface check detects an unapproved mutation | H1, H2 |
| Freeze record references the exact passing vertical-slice evidence | Task 2.4 |
| Future incompatible changes require the governance process | ADR, stated enforceably |

## Risks and open questions

- **Freezing before #110** freezes a surface referencing an unfrozen one (F6).
- **Using the freeze to bless scope creep** in #87 (F3) — audit, do not rubber-stamp.
- **A stale "provisional" line** after the freeze (F5).
- **Open question:** does the binding freeze cover the generated CJS validator's presence in the package?
  It is shipped, it is part of what installs, and it is not an exported symbol. Recommend: covered by the
  packed-install evidence (F4), not by the export list — and say which, so a later reader is not confused.

## What this does not authorize

Freezing browser or React Native APIs, publishing the Node SDK, or changing Core's API scope.

## What this plan did not verify

Whether the binding's built `.d.ts` distinguishes a declared type from a re-exported one in a way a script
can read. If it does not, H3's check needs the TypeScript AST rather than text inspection.
