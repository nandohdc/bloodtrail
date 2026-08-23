# Issue #116 — Authorize and Run a Non-Production Delivery Pilot — Plan

> **For Hermes:** `P3_DEFERRED`, NOT AUTHORIZED, blocked on #109 and #115 — and #115 is blocked on an
> unanswered decision plus privacy and legal approvals. This is the **last** item in Wave 4 and the only
> one whose deliverable is an authorization packet rather than code. Two things to hold: a pilot is
> **explicitly not production**, and running one grants nothing afterwards — #116's own assurance
> limitation says a successful bounded pilot does not authorize or prove production readiness. The
> repository's mandatory withheld authorizations already list `production-deployment`,
> `production-collection` and `real-user-processing`; a pilot does not remove them.

**Goal:** A written pilot authorization naming environment, exact versions, data classification, duration
and owners; testable stop and rollback criteria; the pilot run; and a closure report that implies no
production approval.

**Status at this baseline:** DEFERRED — NOT AUTHORIZED. Blocked on #109 and #115.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #116, OPEN, labels `documentation` `enhancement` `openspec-change-needed` `area:server` `needs-triage`; `P3_DEFERRED` |
| Declared dependencies | #109, #115 — both blocked |
| Native GitHub blockers | `blocked_by` is `0` |
| Mandatory withheld authorizations | `package-publication`, `production-deployment`, `production-collection`, `real-user-processing`, `framework-integration`, `delivery-infrastructure` — from `signed-governance-record.schema.json` |
| Governing plan obligations | PLAN-011 (private/unpublished/non-production boundaries; separate pilot/release/production authorization), PLAN-079 |
| Repository precedent for owner records | `signed-governance-record.schema.json` — `reviewer`, `signed`, `authorizations.granted` / `.withheld`, `assurance_limitations`, `activation_authorized` |
| Data boundary | synthetic / non-sensitive only; real personal or sensitive evidence needs separate authorization |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The authorization record has an existing shape and should reuse it

`signed-governance-record.schema.json` already models an owner decision: a named reviewer with a role and
a date, a `signed` boolean, `authorizations.granted` and `.withheld` arrays, `assurance_limitations` with a
minimum length per item, and `activation_authorized`. A pilot authorization is the same *kind* of artefact.
**Reuse the shape** — it already forces the withheld list to be non-empty and already mandates six
withheld authorizations that a pilot must not grant.

That single reuse satisfies most of #116's first acceptance criterion and makes "the pilot grants no
production approval" mechanically visible rather than a sentence at the bottom.

### F2 — `delivery-infrastructure` is a mandatory withheld authorization, which constrains the pilot's shape

The schema's `mandatory_withheld_authorizations` includes `delivery-infrastructure`. So a pilot cannot
stand up delivery infrastructure — it exercises the implemented delivery path in a bounded, non-production
environment. That is a real constraint on what "run the pilot" can mean, and it is not in #116's body.

Raise it: either the pilot is narrower than it sounds, or the withheld list needs an explicit, governed
exception — which is an owner decision, not an implementation detail.

### F3 — Stop criteria must be testable **before** execution, and that is the criterion most likely to be fudged

#116's second criterion. "Testable before execution" means each stop condition has a measurable signal and
a threshold that can be evaluated by looking at the pilot's telemetry, not by judgement. Write them as
predicates. A stop criterion nobody can evaluate is a stop criterion nobody will trigger.

### F4 — The evidence must record failure paths, not just success

"Pilot evidence records success **and failure-path** metrics." A pilot that only reports the happy path is
a demo. The failure paths to record map to #109's injections: retry, exhaustion, overload, shutdown
abandonment, authentication rejection, version rejection, duplicate.

### F5 — Synthetic data is a boundary that must be enforced, not asserted

"Approved synthetic/non-sensitive data only." The enforcement is the environment: a pilot environment that
*cannot* reach real user data. Asserting it in the authorization is necessary; making it structurally true
is what makes it credible. Say which it is.

### F6 — Closure must be explicit and must not drift into a production request

"Close the pilot without implying production approval." The closure report's language is part of the
deliverable. Review it the way #109's evidence language is reviewed against its exactly-once prohibition.

### F7 — This is the last Wave 4 item and it is the one an eager reader will jump to

A pilot sounds like progress. It is also the item furthest behind the most gates. Anyone proposing to
start #116 while #114 is unanswered has skipped six issues.

---

## Task 0: The gate — four rows

- [ ] 0.1 **#109's vertical-slice evidence exists and passed.**
- [ ] 0.2 **#115 is complete**, which requires #114 answered and all privacy/legal approvals affirmative.
- [ ] 0.3 **An explicit pilot authorization exists**, distinct from any implementation authorization.
- [ ] 0.4 **The `delivery-infrastructure` question (F2) is resolved** — either the pilot fits within the
      withheld authorization or a governed exception exists.

## Task 1: What is available today

- [ ] 1.1 Post on #116 the F2 finding: `delivery-infrastructure` is a mandatory withheld authorization,
      which constrains what a pilot can do. Ask the owner how a pilot fits.
- [ ] 1.2 Note F1: the authorization packet should reuse the signed-governance-record shape.
- [ ] 1.3 Carry the AI-triage disclaimer. Keep `needs-triage`.

## Task 2: When authorized — write the packet before running anything

- [ ] 2.1 The authorization packet names: environment, **exact versions of every participating package**,
      data classification, duration, and owners (F1).
- [ ] 2.2 Stop criteria as evaluable predicates, each with a signal and a threshold (F3).
- [ ] 2.3 Rollback procedure, testable before execution.
- [ ] 2.4 `authorizations.withheld` includes all six mandatory entries plus anything else the pilot must
      not do.
- [ ] 2.5 `assurance_limitations` states that pilot success proves nothing about production.

## Task 3: Run

- [ ] 3.1 Verify each stop criterion is evaluable **before** starting (F3). An unevaluable criterion
      blocks the start.
- [ ] 3.2 Verify the environment cannot reach real user data (F5).
- [ ] 3.3 Run for the authorized duration.
- [ ] 3.4 Record delivery, rejection, retry, saturation and storage evidence — success **and** failure
      paths (F4).
- [ ] 3.5 Terminate or roll back immediately on any stop condition. **Do not negotiate with a triggered
      stop criterion.**

## Task 4: Close

- [ ] 4.1 Closure report: exact interval, exact versions, the metrics, the failure-path evidence, and
      whether any stop condition fired.
- [ ] 4.2 Review the report's language against F6 — no production implication, explicit or implied.
- [ ] 4.3 Close #116; tick it in #132's Wave 4 checklist — **this closes Wave 4**.

---

## Validation matrix

| Acceptance criterion (#116) | Where satisfied |
| --- | --- |
| Written authorization naming environment, versions, data classification, duration, owners | Task 2.1 |
| Stop and rollback criteria testable before execution | Task 2.2, 2.3, verified at 3.1 |
| Evidence records success and failure-path metrics without raw leakage | Task 3.4 |
| Pilot terminated or rolled back on any stop condition | Task 3.5 |
| NOT AUTHORIZED until prerequisites and explicit pilot authorization complete | Task 0 |

## Risks and open questions

- **`delivery-infrastructure` (F2)** may make the pilot as described impossible without a governed
  exception. Resolve before authorizing, not during.
- **Unevaluable stop criteria (F3)** are the standard way a pilot runs past its own limits.
- **Closure language drifting toward production readiness (F6).**
- **Open question for the owner:** who runs the pilot, and in whose environment? #116 names owners as a
  field but the repository has no non-production environment recorded anywhere. If none exists, standing
  one up is itself unscoped work that precedes #116.

## What this does not authorize

Production deployment, use of real personal or sensitive evidence, package publication, or any inference
that a successful pilot implies production readiness.

## What this plan did not verify

Whether a non-production environment exists at all (the open question). If it does not, #116 has an
unrecorded prerequisite.
