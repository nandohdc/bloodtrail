# Issue #121 — Obtain Owner Authorization for Client-Evidence Implementation — Plan

> **For Hermes:** `P3_DEFERRED`, blocked on #120. This is the **owner gate** — the artefact that turns a
> valid proposal into permitted work — and it has no equivalent anywhere in Wave 4, which is a gap worth
> noting on #132. An agent can assemble the packet and prepare the decision form; an agent cannot grant
> the authorization. The most consequential field is not the verdict: it is the **scope**. An authorization
> that says "AUTHORIZE" without naming platforms, data categories, environments and the exact task range
> authorizes everything downstream, which is the opposite of what a bounded capability needs.

**Goal:** A recorded owner decision — AUTHORIZE / REJECT / REVISE — referencing the exact versions of
#117's purpose, #118's metrics, #119's review and #120's proposal, and naming the precise authorized
platforms, data categories, environments and task range.

**Status at this baseline:** DEFERRED. Blocked on #120 → #119 → #118 → #117.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #121, OPEN, labels `documentation` `enhancement` `openspec-change-needed` `area:device` `needs-triage`; `P3_DEFERRED` |
| Declared dependency | #120 — blocked |
| Native GitHub blockers | `blocked_by` is `0` |
| Precedent record shape | `signed-governance-record.schema.json` — `reviewer{name,role,signed_at}`, `signed`, `authorizations.granted`/`.withheld`, `assurance_limitations`, `activation_authorized`, `reviewed_content` binding a **tree**, not a commit alone |
| Mandatory withheld authorizations | `package-publication`, `production-deployment`, `production-collection`, `real-user-processing`, `framework-integration`, `delivery-infrastructure` |
| Binding rule | "A commit hash alone does not satisfy the binding, because a commit cannot record its own identifier and can be orphaned" |
| Prior owner-decision precedent | `research/browser-telemetry/reviews/final-project-owner-outcome.md` |
| Wave 4 analogue | **none** — the delivery chain has no owner-authorization issue |
| Downstream | #122, #124 declare #121 |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The repository already knows how to bind a decision to content, and a commit hash is explicitly not enough

`signed-governance-record.schema.json`'s note: a record binds a **content object** — a tree or subtree —
and additionally names the technical commit, because "a commit cannot record its own identifier and can be
orphaned". #121's first acceptance criterion asks for "exact versions" of four artefacts. Use tree/blob
object ids, per that schema's `reviewed_content.entries`, not branch names or bare commit hashes.

Note the schema's other constraint: **no reviewed path may contain the record**, because signing a record
stored inside the reviewed content would change that content. That applies here too.

### F2 — The withheld list is where a bounded authorization actually gets bounded

Six mandatory withheld authorizations already exist. A client-evidence authorization must withhold at
minimum: production collection, real-user processing, production deployment, package publication. #121's
fourth criterion says production, publication and deployment remain separately unauthorized — the schema
already enforces that shape, so **reuse it rather than restating it in prose**.

### F3 — Scope is four fields and each one closes a specific door

- **Platforms** — browser only, or browser and React Native? #120's structural decision (separately
  sequenced) means these can be authorized independently, and probably should be.
- **Data categories** — must match #117's minimum-necessary-data statement exactly.
- **Environments** — non-production only; naming it prevents a later "the authorization did not say not to".
- **Task range** — which task groups in #120's change may execute. This is the field that makes an
  authorization *bounded* rather than open-ended.

### F4 — Staleness is a real failure mode and the schema names it

`record-stale-after-normative-change` (R15): changing a planning artefact after signing makes the signed
record stale. So if #120's proposal is edited after #121 is signed, the authorization no longer covers it.
**Freeze the proposal before signing**, and re-sign after any edit.

### F5 — This gate has no Wave 4 equivalent, and that asymmetry should be reported

#103–#116 implement transports, collectors and storage — all unauthorized capabilities — with no
owner-authorization issue between the proposal and the code. Wave 5 has #121. Report the asymmetry on
#132 and ask whether Wave 4 needs its own gate.

### F6 — An agent prepares; an agent does not authorize

Same posture as #119. The packet, the form, the binding computation and the staleness check are all
agent work. The signature is not.

---

## Task 0: The gate

- [ ] 0.1 **Confirm #120's change exists, passes strict validation, and is frozen for review.** If it is
      still being edited, wait — signing a moving target produces a stale record immediately (F4).
- [ ] 0.2 Confirm #117, #118 and #119 all recorded affirmative outcomes.

## Task 1: Assemble the packet (agent-completable)

- [ ] 1.1 Compute the **content binding**: tree/blob object ids for #117's record, #118's criteria, #119's
      review and #120's change directory, plus the technical commit (F1).
- [ ] 1.2 Prepare the decision form in `signed-governance-record.schema.json`'s shape, with the four
      mandatory withheld authorizations plus client-specific ones (F2).
- [ ] 1.3 Pre-fill the four scope fields with the narrowest defensible values (F3), for the owner to widen
      rather than narrow.
- [ ] 1.4 State the assurance limitation: authorization accepts bounded implementation risk and cannot make
      client claims trustworthy.

## Task 2: The decision (not agent-completable)

- [ ] 2.1 The owner records AUTHORIZE / REJECT / REVISE, with the scope fields completed.
- [ ] 2.2 The record is stored **outside** the reviewed paths (F1).

## Task 3: Route and enforce the scope

- [ ] 3.1 AUTHORIZE → comment on #122 and #124 with the **exact** authorized scope. Any downstream issue
      outside that scope stays blocked and must say why.
- [ ] 3.2 REJECT → close #122–#131 with the reasoning; write the `.out-of-scope/` entry.
- [ ] 3.3 REVISE → return to #120 with the specific gap.
- [ ] 3.4 Verify every dependent issue falls **inside** the authorized scope — #121's own verification step.
- [ ] 3.5 Close #121; tick it in #132's Wave 5 checklist.

## Task 4: Report the Wave 4 asymmetry

- [ ] 4.1 Post on #132: Wave 5 has an owner gate; Wave 4's transport/collector/storage chain does not (F5).
      Ask whether one should be filed.

---

## Validation matrix

| Acceptance criterion (#121) | Where satisfied |
| --- | --- |
| Decision references exact versions of purpose, metrics, review, proposal | Task 1.1, content binding |
| Outcome explicitly AUTHORIZE / REJECT / REVISE | Task 2.1 |
| Authorization states platforms, data categories, environments, task scope | Task 1.3, 2.1 |
| Production, publication, deployment remain separately unauthorized | Task 1.2, withheld list |
| Records future governance only | throughout |

## Risks and open questions

- **An unbounded AUTHORIZE** (F3) is the failure this gate exists to prevent, and it happens by omission
  rather than by intent.
- **Signing a moving proposal** (F4) produces a record that is stale on arrival.
- **An agent recording the authorization** (F6).
- **Open question for the owner:** should browser and React Native be authorized separately? #120's
  structural decision makes them independently sequenceable, and authorizing only the browser branch first
  would keep #129–#131 closed while #124 proceeds — a smaller bet.

## What this does not authorize

Implementing code or schemas, authorizing production collection, publication or deployment, or expanding
the purpose or data set.

## What this plan did not verify

#120's proposal, because it does not exist.
