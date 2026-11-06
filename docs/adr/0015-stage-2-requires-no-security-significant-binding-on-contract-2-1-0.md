# ADR 0015: Stage 2 requires no security_significant binding on contract 2.1.0

- Status: Accepted
- Date: 2026-11-06
- Decision owners: Project owner
- Decision source: the owner's approval of this ADR, given as an approval comment on #843 that names the exact
  head commit (G43, following G6). The decisions it applies are in the decision logs on #795 (G1–G45) and #833
  (G46–G48), the owner addendum for #838 in the change's `design.md`, and the owner's H-06 disposition on #842.

## Context

Stage P (ADR 0014) answered the in-process questions and found that synthetic fraud-evidence sufficiency is
**not met on contract 2.1.0**, because no existing field honestly carries a failed login's target (criterion
1). It left three criteria to Stage 2 (#833, G22):

3. **Chain reconstruction.** Every ground-truth account-takeover chain is reconstructed through join
   identifiers, from successful authentication onward.
4. **Counts, per-source half.** Per-source counts equal ground truth after delivery.
5. **Host-composed delivery.** Under every fault plan there is zero silent loss, and every undelivered
   occurrence is reported. Every scheduled delay is reported. Shutdown drains within its deadline and accounts
   for every admitted occurrence.

G4 adds an architectural question that only Stage 2 can answer. The host owns durability for
`security_significant` evidence, and a `security_significant` binding is added only if Stage 2 shows that the
hand composition fails the delivery-policy row's in-process half.

That row (`contracts/security-audit/docs/delivery-policy.md`) asks for:
- bounded retry with jitter, with a retry-exhaustion alert;
- an alert before silent loss;
- bounded flush or durable handoff;
- delay accounting and an operator alert.

The hand composition is the **reference composition** (`docs/fraud-evidence/CONTEXT.md`):

```text
createDeliveryShutdown                  deadline-bounded shutdown admission
  └─ createBoundedDeliveryBackpressure   admission gate, not a queue: admits or rejects, holds no backlog
       └─ createBoundedDeliveryRetry     bounded retry with an injected jitter source and timer provider
            └─ createHttpDeliveryHandoff  exactly one exchange per delivery attempt
                 └─ createFetchHttpExchange  the governed fetch adapter, loopback origin only
```

Two trust boundaries apply:
- Every primitive above is a Bloodtrail package export. **Composing them, choosing their parameters, and
  turning their callbacks into operator alerts is host work.**
- The collector is the kit's collector with SQLite storage on a scratch file. The host database and outbox in
  #842 are harness-local synthetic stores. Neither is Bloodtrail storage or a Bloodtrail outbox product.

## Scope and method

Stage 2 ran under the OpenSpec change `verify-fraud-evidence-delivery`, inside the run authorization in its
`proposal.md` (G42 as amended by G46).

- **Seam.** The evaluation kit's packed public API: core, the Node binding and the collector. The kit was
  built by the governed kit builder from each run's exact approved head and installed outside the repository
  as an evaluator's own service.
- **Transport.** Loopback HTTP only, with a guard that refuses any other connection.
- **Data.** Synthetic opaque identifiers and documentation-range addresses only.
- **Expectations before results.** Each probe froze and hashed its hypotheses, fault plans, workload ground
  truth and thresholds before its S1. A mismatch was reported, never fixed by editing expectations.
- **Observation boundaries.** Four were recorded:
  - every public call's outcome;
  - the delivery primitives' results and callbacks;
  - each delivery attempt's ordinal and body hash at the injected exchange;
  - the ingress's received body hash, the collector's outcome, and the persisted record read back through
    the collector's storage port.
- **Accounting identity.** Every generated occurrence must land in exactly one terminal bucket, with the
  unexplained bucket empty. The buckets are: persisted, reported undelivered, admission signal, abandoned in
  the shutdown report, and unexplained. Expected losses count in the denominator, and a persisted copy takes
  accounting priority.
- **Environment.** One workstation: Darwin 27.0.0 on arm64. Node 26.12.1 for runs 1–9 and 26.13.0 for runs
  10–12. No throughput or latency figure here is a service level.

## Evidence

Every results file and expectations file lives in
`openspec/changes/verify-fraud-evidence-delivery/harness/`, under `results/` and `expectations/`.

For every run below:
- the kit identity commit equals the approved head;
- every expectations hash recorded in the results equals the committed file;
- scratch was deleted (`recursively_absent: true`);
- the S1 comment is unedited.

The ledger (`harness/run-ledger.md`) holds 12 of the 16 authorized runs, all inside the window
2026-10-23T13:18:26Z to 2026-11-06T13:18:26Z, for 15,708 ledger calls. Every S1 was a delegated approval
under G44.

Between the approved heads of runs 1 and 12, core, the collector, the contract source and every primitive of
the reference composition are unchanged. The only package-source change is #896's transaction-critical hunk
in `packages/security-audit-sdk-node/src/delivery-classes.ts`. It changed the package-set digest between runs
3 and 4, and no probe calls that binding.

| Run | Probe | Ticket | Approved head | Cases | Ledger calls | Driver (declared) | Use here |
|---|---|---|---|---|---|---|---|
| 1 | S2-tracer | #836 | `693c18d671e4cfdc685c0b95930bb4be1eaf63c9` | 7 of 7 | 1 | claude-code, `claude-opus-5-5` | Positive |
| 2 | S2-outages | #837 | `c23b98388f8b3e33159d2ca0d350e63587481047` | 14 of 14 | 510 | claude-code, `claude-opus-5-5` | Positive |
| 3 | S2-load | #838 | `1949518c5501f40482ec489fca86f9ad1b678e69` | 7 of 17 | 46 | codex, `gpt-5` | **Negative only** |
| 4 | S2-load | #838 | `9b3b91e54c1966b6da2c885c39eb80d5bce67192` | 17 of 17 | 1,456 | codex, `gpt-5` | Positive, qualified |
| 5 | S2-copies | #839 | `e71716ed75a27f67d9fbf9ec05cdce0f2f4dfa72` | 0 of 11; 1 invalidation | 145 (bound) | claude-code, `claude-opus-5-5` | **Not evidence** |
| 6 | S2-copies | #839 | `ac6c5516cca96ea3f70cd054541415160598a9d7` | 8 of 11 | 45 | claude-code, `claude-opus-5-5` | **Not evidence** |
| 7 | S2-copies | #839 | `707b1dc9abc67fb8b58d5564d5727dbbbda74f00` | 11 of 11 | 147 | claude-code, `claude-opus-5-5` | Positive |
| 8 | S2-chains | #840 | `2aa872fd7bb0cb9539dad47338e7535851cda25a` | 11 of 11 | 792 | claude-code, `claude-opus-5-5` | Positive |
| 9 | S2-outbox | #842 | `3360e7fbcb28ebc9850667b9beae12108dae653e` | 11 of 11 | 539 | codex, "gpt-6 family" | Positive, narrowed |
| 10 | S2-counts | #841 | `cf3696a55a2dc6b3a5b35a101bf16a3782a9de8d` | 10 of 10 | 4,009 | claude-code, `claude-opus-5-5` | Positive |
| 11 | S2-counts | #841 | `cf3696a55a2dc6b3a5b35a101bf16a3782a9de8d` | 10 of 10 | 4,009 | claude-code, `claude-opus-5-5` | Positive |
| 12 | S2-counts | #841 | `cf3696a55a2dc6b3a5b35a101bf16a3782a9de8d` | 10 of 10 | 4,009 | claude-code, `claude-opus-5-5` | Positive |

| Results file | sha256 | Expectations file | sha256 |
|---|---|---|---|
| `tracer-run-1.json` | `fc82baa0b3e4c7778fbaa780efc8c32f37a489c2953b27d5713665f76e891c04` | `tracer.v1.json` | `03e01328cdf83bda6b280eaf48c4413e8ccb1eb04c07939a819f7194843957d9` |
| `outages-run-2.json` | `06d3a284d8a74e50c893e08b8275f6ee37573d90fe8ed9125e14f97262f6556f` | `outages.v1.json` | `9e26e1ca16aa78b7dd1d3506fbb173935a32d30ab6aa5ea43feae4697af2c6e3` |
| `load-run-3.json` | `c3c23c99f2bb163f959e473ee8a0945cdbfeade53ba6d7740cd4d0d3a22a7088` | `load.v1.json` | `6d279b19eaa9118c29b0cbc95e9fe073327086d185042a0ddeac2b815646d970` |
| `load-run-4.json` | `a7ffa45a9ee28a4acf25c804197aed5ecf4534b0455ddb51dc29a2207eb295d0` | `load.v2.json` | `4639afcc6ab53aa1223222b960fa45c3bca8bda9f1e8998bed6ca2fe0a3a6bec` |
| `copies-run-5.json` | `1225d795b0c54bcea65ec51712fc4311d1f2a9ceefc4f43209d10d8ccccd8106` | `copies.v1.json` | `60e701ca2b8d473592cd2b695b425889d3d66980e18891edc85675b795a9ec60` |
| `copies-run-6.json` | `62e838ba96b905c2d0aedf74427166ddc2537b8f5cfd8db3cad3b9f6befc8091` | `copies.v1.json` | `60e701ca2b8d473592cd2b695b425889d3d66980e18891edc85675b795a9ec60` |
| `copies-run-7.json` | `1b006e9a9f0afe10848097236a4c111941bff56c0a563a146fa31b057a6c7909` | `copies.v2.json` | `450a4e044d0e71dd99ca1c6055f5e0f38a764570b1819977ba24c99ba81bfc56` |
| `chains-run-8.json` | `56705f08058d65017f24504ee22d0fcf4960bcbc9e8f1f138e738c3f4d1b7390` | `chains.v1.json` | `3483be7f48b3509c2f347bb2523cdbbfb49c46676f74996260f535aeffed5695` |
| `outbox-run-9.json` | `5ee92c1be27222074a233c2d9bd2788b8b8912629c27d667380727fea63cfefc` | `outbox.v1.json` | `0f3bffd620324ef7ba4d6d5701d92da6ee7e40503870ad832de5c960b81e1a8b` |
| `counts-run-10.json` | `44db7aa17687669d4cbef1549dadc71347c54fdbe11361a6d3c8dadfe0c65bad` | `counts.v1.json` | `44e230aaa2a732b21e506b68098cfe9089e922932768ac34eb6487f56d9080d0` |
| `counts-run-11.json` | `1a4c081d5549385c299fa44d26e68ba83b87d899a8e8b0d8781d5b77c556b618` | `counts.v1.json` | `44e230aaa2a732b21e506b68098cfe9089e922932768ac34eb6487f56d9080d0` |
| `counts-run-12.json` | `a269f74d8e989886c89c8de1f424a38c5d0d6ddd2961913dea4dc564b5db780a` | `counts.v1.json` | `44e230aaa2a732b21e506b68098cfe9089e922932768ac34eb6487f56d9080d0` |
| `counts-spread.json` | `e35fe7def7d6f16071b3aa1568b18ecbc1effbe545797851ad56cc2aaca62208` | — | — |

## Decision

### Verdict

| Criterion | Result | Evidence | Limits | Gap owner |
|---|---|---|---|---|
| 3. Chain reconstruction | **Passed** for fault-free delivery (Q209). See the detail below the table. | `chains-run-8.json`: `cases.evaluations` R-01 to R-11; `observations.phases.chains_small` and `chains_volume`, `.reconstruction` and `.ingress.read_back` | Disclosed under "Observer and coverage limits" | None |
| 4. Per-source counts | **Passed, qualified.** Under the frozen reconciliation rule, persisted distinct occurrences plus the itemized reported-undelivered remainder equal ground truth per source, under 20 of the 23 plans frozen in the outages, load and copies expectations, in each of runs 10–12. See the detail below the table. | `counts-run-{10,11,12}.json`: `cases.evaluations` N-01 to N-10 (each records `holds: true`); the figures are in `observations.phases.<plan>.reconciliation` | Persisted counts alone do not equal ground truth under plans that report losses. Three plans are excluded. Per-target counts are not attempted | Per-target counts and account attribution: Bloodtrail contract (#863) |
| 5. Host-composed delivery | **Passed, qualified.** Every accounting identity measured in an accepted run holds, with none unexplained; the copies phases' coverage is partial (#910). Every non-delivery is reported with its reason. Every scheduled delay the retry observers checked was reported (O-02, O-05, O-11, L-11). Every shutdown report accounts for everything admitted, within the composition's deadline. Plan by plan below | The plan table below | Shutdown is bounded at the composition's deadline, not the primitive's own (G48 D1, #932). Restarts are in-process only. H-06 is narrowed | Host (durability, crash recovery, alerting, shutdown budget); Bloodtrail package (#932) |

**Criterion 3 in detail.** Every ground-truth post-authentication chain was reconstructed from
collector-persisted bodies: 6 chains in the small pass, and 60 chains across 10 tenants in the volume pass.
- The join runs tenant, then opaque account ID, then keyed session fingerprint, in event-time order.
- Accounts sharing an observed source were never merged: 2 shared-source pairs, 0 merged chains.
- Every one of the 36 and 360 read-backs was persisted.
- Failed authentications were grouped by observed source and event time and linked to no account.
- The planted merge-by-source and arrival-order defects were both detected.

**Criterion 4 in detail.** Each run accounted for 1,968 occurrences: **888 persisted distinct plus 1,080
reported undelivered, with 0 unexplained**.
- 1,052 raw persisted sightings show that duplicates were present, and they did not inflate the counts.
- 86 occurrences were persisted even though their delivery reported a failure. Each is itemized:
  - `outages_malformed_acknowledgment`: 54 `protocol_error`;
  - `load_abandon`: 16 `abandoned`;
  - `copies_consumer_restart`: 8 `abandoned` and 8 `rejected_overload`.
- The planted raw-duplicate counter fails, and its distinct null control passes.
- `per_target` is `not_attempted` (G33).

**Synthetic evidence-sufficiency remains not met on contract 2.1.0.** Criterion 1 failed in ADR 0014, and
nothing in Stage 2 changes that. Criteria 3, 4 and 5 judge synthetic evidence that crossed a real loopback
transport into a collector with storage. This verdict makes no claim that Bloodtrail is ready for production
or that it detects fraud. Production authorization is unchanged, and the contract version does not move.

**The reconstruction step holds no rules.** `chains/reconstruct.mjs` is a pure, kit-free step. It reads only
persisted bodies, fetched with `storage.get` for each event id the ingress admitted, because the collector has
no list API (Q215). It holds no thresholds, flags, scores or verdicts.

It reconstructs the **post-authentication** chain only:
- successful authentication;
- session creation;
- MFA removal;
- password-reset completion;
- session revocation.

Failed authentications carry no target (G13), so grouping them by source is not account attribution.

### Criterion 5, plan by plan

| Fault plans | Runs and cases | Accounting identity | Reporting | Result |
|---|---|---|---|---|
| Tracer, one clean occurrence | 1: T-01 to T-07 | T-02 holds | — | Passed |
| `outages.v1.json`: 503, 429, 408, timeout after ingest, transport failure, lost acknowledgment, exhaustion, permanent 400, malformed acknowledgment, clean | 2: O-01 to O-14; replayed by runs 10–12 | O-03: 10 = 8 persisted + 2 reported undelivered. O-10: 500 = 400 + 100. The O-04 planted drop breaks the identity | Retryable faults retried within a budget of 4 attempts. Exhaustion and the permanent 400 are reported. The malformed acknowledgment is reported as `protocol_error`. A timeout after ingest or a lost acknowledgment is redelivered byte-identically and stored once, as a duplicate | Passed |
| `load.v1.json` | 3 | Holds: 21 persisted, 5 reported undelivered, 16 admission signals, 4 abandoned, 0 unexplained | The composition's report returned in 200.779 ms and 201.919 ms against 200 ms (L-04, L-07, L-10). L-11 was a harness defect (#889). The volume pass did not run | **Failed** |
| `load.v2.json`: overload, drain, abandon, retry_shutdown and their volume variants | 4: L-01 to L-17; replayed by runs 10–12 | L-02, L-04, L-10, L-13 and L-14 hold, with overload, shutdown and abandonment counted | L-01: 6 of 10 rejected. L-12: 900 of 1,000 rejected. Each rejection was reported with depth and capacity before its result, and none reached the exchange. Shutdown stopped admission. Every report satisfies accepted = completed + abandoned | Passed, qualified (see G4) |
| `best_effort` (`authorization.allowed`) | 4: L-05, L-15 | L-05: 8 = 3 + 5. L-15: 200 = 100 + 100 | Every drop reported with the saturating loss count. The ceiling was signalled once (ceiling 3, then 50) | Passed (the `best_effort` row) |
| `copies.v2.json`: identities, collector_restart, consumer_restart, storage_less, duplicates_volume | 7: C-01 to C-11; replayed by runs 10–12 except `storage_less` | Run 7 reports it for `consumer_restart` only (C-07). Runs 10–12's N-10 covers all four replayed phases. `storage_less` has none (#910) | Every copy is byte-identical. A duplicate is acknowledged and not readmitted (C-03). A conflicting copy is rejected with `COLLECTOR_STORAGE_CONFLICT`, leaving the original intact (C-04). A re-execution is stored separately (C-05). Duplicate decisions survive one storage close and reopen (C-06). The consumer restart redelivers every unacknowledged occurrence (C-07). The storage-less collector admits 32 identities, then refuses with `COLLECTOR_DEDUPLICATION_CAPACITY` (C-08). 100 deliveries became 50 stored (C-11) | Passed, qualified |
| `outbox.v1.json`: commit, rollback, relay restart, outage deferral, commit at volume | 9: H-01 to H-11 | H-11 holds for every phase | A rollback leaves no outbox row, and nothing is relayed or persisted (H-02). Across the relay restart, 6 of 6 are persisted exactly once by identity (H-04). The redelivery is a duplicate (H-05). 6 rows are deferred during a 503 window and then delivered from the host database (H-07) | Passed, narrowed (H-06) |
| Chains workload, fault-free | 8: R-11 | Holds for both passes | — | Passed |

**Zero silent loss is not zero delivery failure.** Under the outage and load plans, 1,080 of each counts run's
1,968 occurrences were not delivered. Each one was reported by a delivery result, an admission signal or the
shutdown report. That reporting is what criterion 5 requires.

**The durability boundary.** Stage 2 measured six things:
- in-process delivery retry;
- the collector's storage across an **in-process** close and reopen of SQLite (G46 Q51, G47 Q100);
- an **in-process** consumer restart;
- an **in-process** relay restart over a fresh `DatabaseSync` on the same host database file (Q248);
- business atomicity in a harness-local SQLite transaction;
- relaying from that synthetic host outbox.

**None of these is a process crash.** Recovery from an operating-system crash is not measured and not claimed.
The outbox, its persistent retry and its relay are host code.

### G4: the hand composition meets the in-process half of the security_significant row

| Predicate (`design.md`, the G4 test) | Evidence | Shown | Limits | Result |
|---|---|---|---|---|
| 1. Bounded retry with jitter, with delay accounting | Run 2: O-02, O-03, O-05, O-10, O-11. Run 4: L-11 | `attempts_within_budget` (4 in outages, 3 in load). `every_delay_reported`: each `onAttemptScheduled(next, delayMs)` carries the ordinal of the attempt it precedes. `delays_within_cap`. `jitter_reproduced`. The delay identity holds over 10 and 500 scheduled delays. The observer computes these from the recorded callbacks and exchanges (`harness/outages/evaluate.mjs`, `retryPredicates`) | The jitter source is seeded and injected, as the Node binding requires. A host's random source is the host's choice. The retry timer provider is the probe's own, so a reported delay is the computed delay, not a wall-clock measurement | **Holds** |
| 2. Retry-exhaustion alert | O-05, O-11; L-11 | Every exhausted occurrence produced `onExhausted(attempts)`, with attempts equal to `maxAttempts` | Routing the callback to an operator alert is host work | **Holds** |
| 3. Alert before silent loss | L-01, L-09, L-12; L-07 and L-16 | Each overload rejection produced exactly one `onRejectedOverload(depth, capacity)`, at depth equal to capacity, before its result. None started an operation or reached the exchange. `no_backlog` holds. The observer reads the sequenced trace (`harness/load/evaluate.mjs`, `alertsBeforeLoss`) | — | **Holds** |
| 4. Bounded flush | L-02, L-03, L-04, L-10, L-13, L-14; L-07 and L-16 | Every report satisfies accepted = completed + abandoned. Composition report return: abandon 182.698 ms and retry_shutdown 182.272 ms against 200 ms; drain 329.901 ms and drain_volume 584.663 ms against 5,000 ms | Holds at the composition's deadline only. Shutdown runs on the binding's real Node timers, so these times are wall-clock. See the shutdown timings below | **Holds**, under the reading in G48 D1 |

**The outcome.** The reference composition, as parameterized by the frozen expectations, meets the in-process
half of the `security_significant` row on synthetic evidence. In particular, `load.v2.json` gives the shutdown
primitive a 180 ms drain budget and keeps a 20 ms report reserve inside a 200 ms outer deadline. **G4's rule
therefore calls for no new `security_significant` binding**, and none is proposed.

This outcome does not establish four things:
- the row's other cells, "durable or protected bounded queue" and "durable handoff", which stay host-owned
  (G4);
- crash durability;
- any delivery guarantee outside these parameters and this workstation;
- production readiness.

**The bounded-flush reading.** The owner decided (G48 D1, #833) that bounded flush, and criterion 5's "drains
within its deadline", are judged at the reference composition's outer deadline. That follows the #838 owner
addendum, which assigns the strict deadline to the composition's report return and treats primitive time as a
separate observation.

The primitive itself returned its report **after its own configured deadline in all 10 samples**, recorded as
`observations.phases.<phase>.sender.shutdown_primitive_elapsed_ms`:

| Run | Phase | Primitive deadline (ms) | Primitive returned (ms) | Over (ms) | Composition returned (ms) | Report (accepted / completed / abandoned) |
|---|---|---:|---:|---:|---:|---|
| 3 | `abandon` | 200 | 200.684 | 0.68 | 200.779 | 6 / 0 / 6 |
| 3 | `retry_shutdown` | 200 | 201.845 | 1.84 | 201.919 | 10 / 6 / 4 |
| 4 | `abandon` | 180 | 182.534 | 2.53 | 182.698 | 6 / 0 / 6 |
| 4 | `retry_shutdown` | 180 | 182.176 | 2.18 | 182.272 | 10 / 6 / 4 |
| 10 | `load_abandon` | 180 | 180.579 | 0.58 | 180.702 | 24 / 8 / 16 |
| 10 | `load_retry_shutdown` | 180 | 181.854 | 1.85 | 182.031 | 22 / 18 / 4 |
| 11 | `load_abandon` | 180 | 182.733 | 2.73 | 182.888 | 24 / 8 / 16 |
| 11 | `load_retry_shutdown` | 180 | 181.988 | 1.99 | 182.118 | 22 / 18 / 4 |
| 12 | `load_abandon` | 180 | 182.119 | 2.12 | 182.288 | 24 / 8 / 16 |
| 12 | `load_retry_shutdown` | 180 | 182.079 | 2.08 | 182.202 | 22 / 18 / 4 |

Runs 10–12 recorded these timings but did not assert on them. The composition's own bookkeeping took 0.07 to
0.18 ms in every sample, so the overrun is the primitive's.

Run 3's `load.v1.json` handed the primitive the whole 200 ms deadline, and that composition failed (#890). The
fix (#899) was a host-composition choice, not a package change: keep a report reserve beyond the primitive's
deadline.

The Node binding's specification states no bound on when the shutdown report returns. #932 tracks that as a
Bloodtrail package documentation and requirement gap. **Under G48 D1 it is not a G4 failure.**

### What the hand composition leaves to the host

- Durability for `security_significant` evidence, including a durable or protected queue and a durable
  handoff (G4).
- Crash recovery, and any persistent retry after a business commit (G5, #870).
- The jitter source, the timer provider and every composition parameter.
- Reserving shutdown report time beyond the primitive's deadline (#932).
- Routing `onExhausted`, `onRejectedOverload`, `onDropped` and `onLossCeilingReached` to operator alerts.
- Sizing the listen backlog and host load for bursts. `load_drain_volume` sends 194 occurrences at once
  against a macOS backlog of 128 (#926).
- For `transaction_critical` evidence, writing the audit record inside the business transaction and relaying
  it from the host's own outbox. Run 9 measured that pattern, not a Bloodtrail product.
- Storage at volume. The storage-less collector refuses the 33rd live identity (C-08).

The engine deduplicates on `event.id`, and owns detection, scoring, verdicts and any cross-tenant join.

### Evidence integrity

**Runs that are not positive evidence.**
- **Run 3** is a genuine measurement of the `load.v1.json` composition failing its 200 ms deadline (L-04, L-07,
  L-10). Its L-11 mismatch was an evaluator defect (#889). Run 4 measures a different, re-parameterized
  composition.
  - #890's record attributed the overrun to bookkeeping. The primitive's own times show that the primitive
    overran (#914).
- **Run 5** was invalidated before traffic, because a planted control was missing a property (#902).
- **Run 6** matched 8 of 11 on harness defects (#905). Its C-04 match is a false positive: the conflicting copy
  failed the schema check with 422, while the observer hard-coded 409 (Q99, G47). C-07's match was a false
  positive too.
  - No owner disposition is recorded for run 6 as a replacement for run 5.
- **`copies.v1.json`** was found unsound as a whole (G47) and was rebuilt as `copies.v2.json`. The files and
  results of runs 3, 5 and 6 are unchanged.

**Approval records.**
- Runs 5 and 6 record an S1 body hash that equals the posted comment plus one trailing newline, not the
  comment byte for byte (#907). The other ten match exactly.
- Run 10's S1 said #927's pre-merge script had passed. It never ran, as ledger row 10 corrects.

**Reviews.**
- Review was not performed (G46 Q50) for:
  - #896 (the sdk-node change in every kit from run 4 on);
  - #899 (the `load.v2.json` remedy run 4 used);
  - #901 and #904 (the copies builds behind runs 5 and 6).

  The later `/code-review xhigh` passes are recorded in #913 and #914. They are not retroactive approval.
- Run 4's S1 was posted two minutes after #899 merged, with no review recorded (#914), although G44 requires
  review first.
- For run 9, the specified Claude review of #923's final head was not performed, and Codex analysis took its
  place (ledger row 9).
- #927's `counts/execution.mjs` refactor had no independent reviewer.

**Drivers.** Runs 3 and 4 declare `codex` and `gpt-5`, independently unverified. Run 9 declares the Codex lane
and "gpt-6 family". Codex's session metadata later identified the model as `gpt-6.1-terra` (#842). The raw
results are unchanged.

**This ADR.** Claude Code (`claude-opus-5-5`) wrote this ADR under G48 D3. **Independent review of it was not
performed.**

**Observer and coverage limits.**
- **Chains (run 8)** (#918, #920):
  - Run 8 ran with no fault plan (Q209). Chain reconstruction under the outage, load and copies plans was not
    measured; runs 10–12 measured per-source counts under them, not chains.
  - R-01 to R-05's evaluated counts are the small pass's (6 chains, 4 sources, 3 tenants). The volume figures
    (60 chains, 58 sources, 10 tenants) are in `observations`.
  - R-08's `arrival_order_differed` is true if either pass arrived out of order.
  - R-05's `unlinked_from_accounts` cannot fail on real data.
  - The planted controls use the small fixture in both passes.
- **Copies (run 7)** (C-08, C-07, C-06, #909, #910):
  - The five-minute deduplication retention is the collector's documented bound. It is not measured, because
    the frozen deadline is 120 s.
  - C-07's redelivered set is not cross-checked against the unacknowledged occurrences.
  - Port continuity across the collector restart holds by construction.
  - Under G48 D2, the accounting identity is accepted through run 7's C-07 plus runs 10–12's N-10, which
    covers `identities`, `collector_restart`, `consumer_restart` and `duplicates_volume`. `storage_less` has
    no terminal bucket for occurrences acknowledged without storage. Per-phase buckets under a new
    expectations version are the remedy if a later stage needs them.
- **Outbox (run 9)** (#842 disposition, #921):
  - **H-06 is narrowed.** Redeliveries arrive as collector duplicates. With storage, a duplicate shares both
    `event.id` and `correlation.transaction_id`, because the collector requires whole-body equality. Every
    persisted transaction id equals its host row's and is unique.
  - Pair-keyed deduplication in the Node binding's sense is **not demonstrated**. Neither is the case of two
    events sharing one transaction id: every run-9 transaction carries one event, so that case is untested.
  - The SDK operation is marked committed while the SQLite transaction is still open.
  - H-07's durable re-read is true by construction. H-04's fresh `DatabaseSync` is the stronger evidence.
  - Basis citations resolve at the approved head, not at the frozen base.
  - The 539 ledger calls are 402 SDK calls and 137 composition deliveries.
  - No probe exercised `createTransactionCriticalDelivery` or `deliverWithCommit` (Q257). Its open defects
    (#913) bear on no result here.
- **Counts (runs 10–12)** (#926):
  - The N-cases record only `holds`; the figures are in `observations`.
  - "Raw persisted" means one read-back per acknowledged sighting.
  - `load_abandon` is not asserted to have abandoned anything.
  - `load_drain_volume` delivered all 194 occurrences on the first attempt in all three runs, on a quiet host.
    That is three samples, and the rehearsal lost first attempts under heavy contention.
  - Three plans are excluded with frozen reasons:
    - `best_effort` and `best_effort_volume`, because no chain event is `best_effort`;
    - `storage_less`, because it has no persisted acknowledgment.
- **Throughput and latency** (`counts-spread.json`):
  - They are observations of one environment (darwin, 10 CPUs, Node 26.13.0), with no thresholds.
  - Ingress throughput varied between runs, from 182 to 239 persisted events per second in
    `copies_duplicates_volume` and from 226 to 277 in `outages_clean`.
  - 12 of the 80 latency and throughput metrics have no samples. They are the latency metrics of four plans in
    which no delivery ended in a persisted acknowledgment: `outages_exhausted`, `outages_permanent_400`,
    `outages_malformed_acknowledgment` and `load_retry_shutdown`.
  - The spread file does not record host load.
  - **No service level follows from these figures.**

### Findings and their owners

| Finding | Evidence | Kind | Owner | Pointer |
|---|---|---|---|---|
| The shutdown primitive returns its report after its configured deadline (10 of 10 samples, +0.58 to +2.73 ms), and the specification states no bound | The shutdown timings table above | requirement gap | Bloodtrail package | #932; #914 |
| Bounded flush holds only when the host reserves report time beyond the primitive's deadline | Runs 3 and 4, L-04, L-07, L-10 | host obligation | Host | #890, #899 |
| The transaction-critical binding over-claims commit for unlisted commit states. No Stage 2 probe exercised it | #913 | defect | Bloodtrail package | #913 |
| There is no durability-only retry after a business commit | #870 | gap | Bloodtrail package or host, by governed decision | #870 |
| Pair-keyed and shared-transaction deduplication are not demonstrated | `outbox-run-9.json` H-06; #842 disposition | limitation | Host (outbox design); a later probe | #921 |
| Copies accounting covers 4 of 5 phases. `storage_less` has no bucket | `copies-run-7.json` C-07; `counts-run-{10,11,12}.json` N-10 | limitation | Harness | #910 |
| A burst above the listen backlog can lose first attempts under contention | `counts-run-{10,11,12}.json`, `load_drain_volume`; #841 | host composition hazard | Host | #926 |
| No failed-login target, so no per-target counts and no account attribution of pre-authentication failures | ADR 0014; N-06 | gap | Bloodtrail contract | #863 |
| Harness robustness and test strength in the copies, chains, outbox and counts probes | #909, #918, #920, #921, #926 | hardening | Harness | those issues |
| An S1 body hash covers a trailing newline | `copies-run-5.json`, `copies-run-6.json` | record defect | Harness | #907 |
| `load.v2.json` is not bound to the load S1, and the primitive deadline is not recorded | #914 | hardening | Harness | #914 |

## Alternatives

- **Require a `security_significant` binding now.** Rejected. All four G4 predicates hold for the reference
  composition (G48 D1), and G4 adds a binding only when the hand composition fails. The primitive's late
  report is a documentation and requirement gap (#932). A binding would not close it.
- **Judge bounded flush at the primitive's own deadline.** Rejected by the owner (G48 D1). That reading would
  fail G4, and this ADR would then state the requirement for a separate governed Node-binding change.
- **Rerun to widen H-06 or the copies accounting.** Rejected. The owner accepted both limits (#842; G48 D2).
  A rerun would need a new expectations version, an owner disposition for a reserve slot, an S1, and a window
  amendment once 2026-11-06T13:18:26Z passes.
- **Treat Stage 2 as reversing ADR 0014.** Rejected. Criterion 1 failed on 2.1.0, and no Stage 2 measurement
  bears on it.

## Consequences

- Criteria 3, 4 (per source) and 5 are recorded as met on synthetic evidence within the limits above. G4 is
  answered: no `security_significant` binding is required. Synthetic fraud-evidence sufficiency on contract
  2.1.0 stays **not met** (ADR 0014).
- #844 rewrites the consumer integration profile's delivery table from this record:
  - **Demonstrated:** byte-identical redelivery, duplicate and conflict outcomes, loss reporting, overload
    rejection, bounded flush with a host reserve, `best_effort` loss visibility, and outbox relaying as a host
    pattern.
  - **Host-composed only:** everything under "What the hand composition leaves to the host".
  - It states the 32-identity storage-less bound, and that storage is needed at volume.
- #845 closes as not planned, because the change carries no spec deltas. #846 archives the change with its
  harness and result bytes unchanged.
- #932, #913 and #870 are Bloodtrail package work, each through its own governed change. #863 is the contract
  change that criterion 1 and per-target counts wait for. #907, #909, #910, #914, #918, #920, #921 and #926
  are harness work. Any later rerun of a probe owes those items first.
- Four authorized runs (13–16) go unused. They lapse with the window at 2026-11-06T13:18:26Z, and no further
  Stage 2 run is planned.
- Production deployment, real-user data and every other item outside the authorization boundary remain
  unauthorized.
