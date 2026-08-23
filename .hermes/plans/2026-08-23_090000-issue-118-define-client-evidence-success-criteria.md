# Issue #118 — Define Measurable Success and Stop Criteria for Client Evidence — Plan

> **For Hermes:** `P3_DEFERRED`, NOT AUTHORIZED, blocked on #117. This issue exists so a future client
> capability can be **stopped**, not merely evaluated — and the 2026-07-31 owner decision already demanded
> exactly this class of artefact ("success and kill criteria") as a reconsideration requirement. The trap
> is named in the issue's own out-of-scope line: **vanity volume metrics are not proof of value.** "We
> collected N envelopes" is the metric this issue exists to forbid.

**Goal:** Every success metric has a definition, data source, threshold, owner and evaluation period; at
least one privacy/abuse stop criterion and one utility stop criterion; a recorded baseline and comparison
method; and a named GO/NO-GO decision authority.

**Status at this baseline:** DEFERRED — NOT AUTHORIZED. Blocked on #117.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #118, OPEN, labels `enhancement` `question` `area:device` `needs-triage`; `P3_DEFERRED`; type `RESEARCH` |
| Declared dependency | #117 — unanswered owner gate |
| Native GitHub blockers | `blocked_by` is `0` |
| Prior demand for this artefact | 2026-07-31 outcome's reconsideration requirements — "success and kill criteria" among eight named items |
| Sibling reconsideration items | measurable detection lift, false-positive limits, performance and conversion-impact limits, physical-device coverage, misuse resistance, dependency and outbound-network review, privacy restrictions |
| Downstream | #119, and #128 (Mode A PoC) declares #118 directly |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — Half the criteria are already named by the prior decision, and reusing them is free

The 2026-07-31 outcome lists eight reconsideration requirements. #118 must define criteria for a
*different* purpose, so detection lift does not apply (that is #117's supersession) — but **performance
limits, misuse resistance, dependency and outbound-network review, and privacy restrictions all still
apply**, because they are purpose-independent. Start from that list rather than a blank page, and mark
explicitly which items #117's supersession removed and why.

### F2 — A stop criterion needs an evaluable predicate, an owner, and a pre-committed threshold

A criterion phrased as "if privacy risk becomes unacceptable" cannot fire. The shape that works:
*signal · threshold · evaluation cadence · named owner · action on breach*. #118's first criterion asks
for definition, data source, threshold, owner and evaluation period — that is the same five fields.

### F3 — The utility stop criterion is the hard one and it must be falsifiable

#118 requires at least one utility stop and one privacy/abuse stop. Privacy stops are easy to write
(a prohibited field observed; a data-subject request that cannot be honoured). A *utility* stop must say:
if client evidence has not changed a decision by date D, stop. That is falsifiable, and it is the criterion
that prevents open-ended collection — the issue's stated purpose.

### F4 — The baseline must be measurable **without** client evidence

"The baseline and comparison method are recorded." The baseline is what the current server-side audit
evidence achieves for the same purpose. If that cannot be measured, no comparison is possible and the
success criteria are unfalsifiable — which is itself a finding worth reporting to the owner before
proceeding.

### F5 — Metrics must not require more data than the purpose justifies

#118's security note. A metric such as "coverage across device models" requires device fingerprinting,
which #122 prohibits unless explicitly approved. **Check each proposed metric against #117's
minimum-necessary-data statement**; a metric that expands collection defeats the purpose it measures.

### F6 — This is a `RESEARCH`-typed artefact and it decides nothing

Meeting the metrics would support a bounded decision; it proves neither evidence authenticity nor
production readiness. #118's own assurance limitation.

---

## Task 0: The gate

- [ ] 0.1 **Confirm #117 recorded GO.** On NO-GO, close #118 with the reasoning. On REVISE, wait.
- [ ] 0.2 Read #117's record for the bounded purpose and the **minimum necessary data** — both constrain
      every metric (F5).
- [ ] 0.3 Read the 2026-07-31 outcome's eight reconsideration requirements (F1) and mark which survive.

## Task 1: Draft the criteria

- [ ] 1.1 One row per metric: **definition · data source · threshold · owner · evaluation period** (F2).
- [ ] 1.2 Cover: decision utility, coverage, validation/rejection quality, latency and cost, privacy risk.
- [ ] 1.3 At least one privacy/abuse stop and one **falsifiable** utility stop (F3).
- [ ] 1.4 Baseline: what server-side evidence achieves for this purpose today, and how it is measured (F4).
- [ ] 1.5 Non-expansion criterion — what would constitute scope growth, and that it triggers a stop.
- [ ] 1.6 Named GO/NO-GO authority.
- [ ] 1.7 Check every metric against #117's minimum-data statement (F5). Remove any that expands
      collection.

## Task 2: Review for falsifiability

- [ ] 2.1 For each metric, write down what result would **fail** it. A metric with no failing result is a
      vanity metric — delete it.
- [ ] 2.2 For each stop criterion, write down the exact observation that fires it.
- [ ] 2.3 Confirm no metric requires fingerprinting or identity attribution.

## Task 3: Record and hand off

- [ ] 3.1 Record in the same governed shape as #117's record.
- [ ] 3.2 State that implementation remains NOT AUTHORIZED (F6).
- [ ] 3.3 Comment on #119 and #128 — both consume this artefact.
- [ ] 3.4 Close #118; tick it in #132's Wave 5 checklist.

---

## Validation matrix

| Acceptance criterion (#118) | Where satisfied |
| --- | --- |
| Each metric has definition, data source, threshold, owner, evaluation period | Task 1.1 |
| At least one privacy/abuse and one utility stop criterion | Task 1.3 |
| Baseline and comparison method recorded | Task 1.4 |
| GO/NO-GO decision authority named | Task 1.6 |
| Records future work only; NOT AUTHORIZED | Task 3.2 |

## Risks and open questions

- **Vanity volume metrics** are the named failure mode.
- **An unmeasurable baseline (F4)** makes every success criterion unfalsifiable, and it is discovered late.
- **Metrics that expand collection (F5)** are self-defeating and easy to write by accident.
- **Open question:** if the baseline cannot be measured, should #118 return to #117 rather than proceed?
  Recommend yes — an unfalsifiable success criterion is worse than none, and the owner should know before
  #119's privacy review is commissioned.

## What this does not authorize

Collecting client evidence, choosing fields or SDK APIs, or treating volume as value.

## What this plan did not verify

Whether the current server-side evidence can be measured against the purpose #117 records — because #117
has no record yet.
