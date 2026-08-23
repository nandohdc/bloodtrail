# Issue #120 — Propose the Governed Client-Evidence Capability — Plan

> **For Hermes:** `P3_DEFERRED`, NOT AUTHORIZED, blocked on #119. This is an **artifacts-only** issue —
> proposal, design, delta specs, tasks — and its own out-of-scope line forbids treating proposal creation
> as owner authorization. That authorization is #121, a separate gate, and the separation is deliberate.
> One structural decision this issue must take and nobody else can: **whether browser and React Native are
> one governed capability or two**. The roadmap already answers it implicitly and asymmetrically — #124
> (browser) must have **no Core dependency**, while #131 (React Native) **is** a Core binding and depends
> on #86. Two different architectures cannot be one capability without saying so.

**Goal:** A complete OpenSpec change for the bounded client-evidence capability, referencing #117's
purpose, #118's criteria and #119's review, with independent implementation, verification, owner and
archive gates preserved in its task graph.

**Status at this baseline:** DEFERRED — NOT AUTHORIZED. Blocked on #119 → #118 → #117.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #120, OPEN, labels `documentation` `enhancement` `openspec-change-needed` `area:device` `needs-triage`; `P3_DEFERRED` |
| Declared dependency | #119 — blocked, and not agent-completable |
| Native GitHub blockers | `blocked_by` is `0` |
| **Architectural asymmetry** | #124 browser: **no Core dep**, envelope is the sole contract surface (corrected 2026-08-10). #131 React Native: **is** a Core binding, depends on #86 |
| Why the asymmetry | plan §D.5/§H/§K — `@bloodtrail/client-evidence-browser (no Core dep · no transport · no collector credentials)`; the independence is what makes the two branches parallel-capable |
| Forbidden terms | `browser`, `telemetry`, `adapter`, `transport`, `collector` — filenames and exports in `check-scope.mjs` |
| Existing capabilities | `change-governance`, `security-audit-event-contract`, `security-audit-sdk-core`, `software-design-pattern-governance` |
| Downstream | #121 (owner gate) → #122 → #123 → #124/#125 → #126 → #127 → #128 → #129 → #130/#131 |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The browser/React Native asymmetry is already decided and must be stated, not rediscovered

#124's 2026-08-10 correction is explicit: requiring the browser package to consume Core contradicted
PLAN-086 and plan §D.5/§H/§K, and the `#86` dependency was deliberately **not** added to preserve
parallelism. #131 keeps its `#86` dependency. So:

- **Browser** — standalone, Web APIs only, envelope is the sole contract surface.
- **React Native** — a Core binding, reusing Core semantics plus the envelope.

#120's fifth required-work item asks whether they are one capability or separately sequenced. **The
architecture already answers: separately sequenced, sharing only the envelope (#123).** Record that as the
proposal's structural decision rather than reopening it.

### F2 — The proposal must not exceed #117's approved purpose, and that is checkable

#120's first acceptance criterion: "the change artifacts cover the exact approved purpose and no broader
collection." The check is mechanical enough to do in review: every claim the design proposes to collect
must appear in #117's minimum-necessary-data statement. Anything else is scope expansion, and it is the
most likely way a bounded capability becomes unbounded.

### F3 — Five scenario classes are required and three are adversarial

"Positive, rejection, spoofing, replay, and fabrication scenarios." Spoofing, replay and fabrication are
the ones that make the spec useful, and they map directly onto #126's ingress validation arms. Write them
here so #126 implements rather than invents.

### F4 — The task graph's gates are the deliverable, and `check-coherence` will enforce them

Task groups in an active change must complete **in order**, `check-coherence` rejects starting a later
group early, and merge/archive tasks must stay unchecked while the change is active. So the group
boundaries #120 writes become mechanical gates later. Draw them at: envelope · browser · contract ·
ingress · mapping · verification · owner · archive.

### F5 — Vocabulary must survive the scope gate

`browser` and `telemetry` are forbidden filename and export terms. A package named
`@bloodtrail/client-evidence-browser` is a **package name**, not a filename or export, so it is outside
`check-scope.mjs`'s filename rule — but any *file* named `browser.ts` inside any governed package would
fail. Settle the naming convention in the proposal, and check it against the gate rather than assuming.

### F6 — "Rollback boundaries" for a client SDK are unusual and need thought

#120's second criterion asks for rollback. For a browser SDK, rollback means: the host application stops
loading it. There is no server-side switch. So the design's rollback story is really a **kill-switch**
story, and if the answer is "the host must redeploy", say so — it is a meaningful operational limitation
that #128's PoC and #116-style pilots would inherit.

### F7 — A proposal grants nothing, and the proposal must say so in its own text

#120's assurance limitation. State it in the proposal's first paragraph, not only in the issue.

---

## Task 0: The gate

- [ ] 0.1 **Confirm #119 recorded APPROVE FOR PROPOSAL** with named reviewers. On REJECT, close
      #120–#131. On REVISE, return to #117 or #118.
- [ ] 0.2 Read #117's purpose and minimum-necessary-data statement, #118's criteria, #119's prohibited
      data and controls. These three documents are the proposal's entire input.
- [ ] 0.3 Confirm `openspec/changes/` holds only `archive/`.

## Task 1: Author the change

- [ ] 1.1 `openspec-propose`, id `client-evidence-capability`. **Do not hand-edit `openspec/changes/`.**
- [ ] 1.2 First paragraph: the proposal authorizes nothing (F7); #121 is the gate.
- [ ] 1.3 Structural decision: browser and React Native are **separately sequenced**, sharing the envelope
      (F1). State the reasoning and cite the 2026-08-10 correction.
- [ ] 1.4 Design: data minimization, prohibited data (from #119), trust boundaries, compatibility, and the
      rollback/kill-switch story (F6).
- [ ] 1.5 Delta specs with positive, rejection, spoofing, replay and fabrication scenarios (F3).
- [ ] 1.6 Task graph with eight groups (F4), merge/archive unchecked.
- [ ] 1.7 Naming convention checked against `check-scope.mjs`'s forbidden terms (F5).
- [ ] 1.8 Assessment for the change itself.

## Task 2: Prove the scope is bounded

- [ ] 2.1 Table every claim the design proposes to collect against #117's minimum-necessary-data
      statement. Any row without a match is scope expansion — remove it (F2).
- [ ] 2.2 Confirm no requirement claims a security guarantee client collection cannot provide — #120's
      security note.
- [ ] 2.3 `openspec validate --strict client-evidence-capability`.

## Task 3: Verify, commit, PR, hand off

- [ ] 3.1 Both `validate` chains; index empty; governance verified after the commit (#191).
- [ ] 3.2 One commit, `docs(openspec):`.
- [ ] 3.3 Comment on #121: the proposal exists and is awaiting the owner gate. **Do not promote #122–#131.**
- [ ] 3.4 Close #120; tick it in #132's Wave 5 checklist.

---

## Validation matrix

| Acceptance criterion (#120) | Where satisfied |
| --- | --- |
| Artifacts cover the exact approved purpose and no broader collection | Task 2.1 |
| Minimization, prohibited data, trust boundaries, compatibility, rollback specified | Task 1.4 |
| Positive, rejection, spoofing, replay, fabrication scenarios included | Task 1.5 |
| Task graph preserves independent implementation, verification, owner, archive gates | Task 1.6 |
| Passes strict validation and remains NOT AUTHORIZED | Task 2.3, 1.2 |

## Risks and open questions

- **Collecting one claim more than #117 approved** (F2) is how the boundary erodes, and it is invisible
  unless tabled.
- **Merging browser and React Native into one capability** (F1) would silently reintroduce the Core
  dependency that the 2026-08-10 correction removed.
- **A rollback story that does not exist** (F6) — better stated as a limitation than invented.
- **Open question:** does the client-evidence capability get its own `openspec/specs/` capability, or does
  it extend `security-audit-event-contract`? The envelope is deliberately independent of the audit event
  contract (PLAN-086), which argues for its own capability. Decide in the proposal and say why.

## What this does not authorize

Implementing any client-evidence code or contract field, treating proposal creation as owner
authorization, or modifying any other change.

## What this plan did not verify

#117's, #118's and #119's contents, because none exists.
