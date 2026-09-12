# Client-Evidence Success and Stop Criteria (#118)

Status: **defined — for purpose P1 only, taken under delegation**.

- **Purpose bound to:** P1, *interaction-scoped audit correlation*, in `117-client-evidence-purpose.md`
- **Decision source:** `decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner decision"`.
  The owner has not personally reviewed this record. It is not an exact-commit authorization.
- **Replaces, for P1 only:** the 2026-07-31 outcome's detection-domain reconsideration criteria
  (detection lift, false-positive limits, conversion impact, physical-device coverage), which have
  nothing to measure for an audit-correlation purpose. Its misuse-resistance, dependency, outbound-
  network, and privacy requirements are **kept** and appear below.
- **Evaluation environment:** synthetic, non-production only — the #128 proof-of-concept harness.
  No criterion here authorizes collecting anything from a real user.

## Baseline and comparison method

**Baseline:** the best grouping achievable from evidence the server already records — `session.id`,
`correlation.trace_id` as trace context would propagate it, and timing — over the same synthetic
workload. **Comparison:** run the same workload twice, once with P1's interaction identifiers and
once without, and compare grouping accuracy against the workload's ground truth. P1 has value only
to the extent the difference is real.

The synthetic workload must include the cases that make the question hard. Concurrent interactions
in one session must interleave; one interaction must span several requests; a retry must repeat a
request; and a client must reuse one trace for several interactions, which real trace instrumentation
does.

## Success metrics

| # | Metric | Definition | Data source | Threshold | Owner | Period |
|---|---|---|---|---|---|---|
| U1 | Grouping accuracy | fraction of ground-truth interactions whose server events are grouped exactly — no event missing, no foreign event included | #128 harness ground truth | ≥ 0.99 | project owner | one #128 run of ≥ 1,000 interactions |
| U2 | Incremental utility | U1 with P1 minus U1 for the baseline | #128 harness, both arms | ≥ 0.10 absolute | project owner | same run |
| C1 | Coverage | fraction of server events from instrumented interactions that carry a valid, linked client claim | #128 harness | ≥ 0.95 | project owner | same run |
| V1 | Rejection completeness | fraction of malformed, oversized, unknown-version, forbidden-claim, and replayed envelopes rejected at ingress | #126 tests and #128 adversarial arms | = 1.00 | project owner | every CI run and the #128 run |
| V2 | False rejection | fraction of well-formed envelopes rejected | #128 harness | ≤ 0.001 | project owner | #128 run |
| L1 | Size cost | serialized envelope bytes per request | SDK bundle tests | ≤ 256 B | project owner | every CI run |
| L2 | Validation cost | ingress validation time per envelope, p95 | #128 harness | ≤ 1 ms | project owner | #128 run |
| P1-inv | Inventory conformance | fields present beyond #117's minimum inventory | schema and SDK tests | = 0 | project owner | every CI run |
| P1-link | Unlinkability | interaction identifiers repeated across distinct interactions, or persisted by the SDK in any storage API | SDK tests; #128 harness | = 0 | project owner | every CI run and the #128 run |

Volume is not a metric. The number of envelopes collected says nothing about whether P1 is useful.

## Stop criteria

Each is a **stop**: the evaluation ends, the proof of concept is not extended, and #129–#131 do not
proceed until the cause is removed and this record is revised.

- **S-privacy-1 (privacy):** any field outside #117's inventory appears in an envelope, a log, a
  metric, or a stored record.
- **S-privacy-2 (privacy):** any interaction identifier is persisted client-side (`localStorage`,
  `sessionStorage`, IndexedDB, cookies, Cache API) or is reproducible across interactions.
- **S-abuse-1 (misuse):** any client-evidence value reaches a risk-model input, an authentication
  decision, an authorization decision, or an enforcement path. This includes a `derived_from` entry
  on a risk model that declares more than `client_claim`, which contract `2.0.0` already rejects.
- **S-abuse-2 (misuse):** a replayed or substituted envelope is accepted in Mode A.
- **S-utility-1 (utility):** U2 < 0.10. Trace context already answers the question well enough, so
  P1 has no residual purpose, and the honest outcome is **NO-GO** for the wave.
- **S-utility-2 (utility):** U1 < 0.99. The grouping is not reliable enough to support a
  reconstruction a reviewer would rely on.
- **S-dependency (outbound network):** the browser package gains a runtime dependency, or makes any
  network request of its own. The host application sends the envelope with its own request; the SDK
  never transmits anything.

## Rollback and non-expansion

- **Rollback:** a stop leaves nothing deployed to roll back. The response is to revert the merge
  commits that introduced the failing behaviour and record the stop on #132.
- **Non-expansion:** meeting every threshold authorizes nothing beyond P1. A new datum, platform, or
  purpose needs a new #117-format record and a revision of this one. Mode B (#129) is judged against
  these criteria plus its own.

## Decision authority

**GO / NO-GO after #128 is the project owner's.** For this non-production phase it is delegated to
Claude under the instruction quoted in #117, and every such decision carries the `decision_source`
above. A NO-GO needs no further authority: any stop criterion, or the owner at any time, ends the wave.

## Assurance limitation

Meeting these criteria would support a bounded decision about P1's usefulness on synthetic data. It
would not prove evidence authenticity, prove behaviour on real devices, or authorize production.
