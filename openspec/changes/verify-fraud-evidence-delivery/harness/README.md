# Stage 2 harness: delivery and per-source evidence

Authorization: `../proposal.md#run-authorization` at each run's exact approved head, under
[G42](https://github.com/nandohdc/bloodtrail/issues/795#issuecomment-6346915049) (environment and limits) as amended by [G46](https://github.com/nandohdc/bloodtrail/issues/833#issuecomment-6449640834) and
G44 (delegated S1). See `run-ledger.md` for the shared run budget.

**Six Stage 2 probes have executed:** the tracer, as run 1 (`results/tracer-run-1.json`), the outages
probe, as run 2 (`results/outages-run-2.json`), the load probe, as runs 3 and 4 (`results/load-run-3.json`;
`results/load-run-4.json` matched all 17 cases of `load.v2.json`), the copies probe, as runs 5, 6 and 7
(`results/copies-run-5.json` was invalidated before traffic; `results/copies-run-6.json`; `results/copies-run-7.json`
matched all 11 cases of `copies.v2.json`), the chains probe, as run 8 (`results/chains-run-8.json` matched all 11 cases of `chains.v1.json`), and the outbox probe, as run 9 (`results/outbox-run-9.json` matched all 11 cases of `outbox.v1.json`). Run 9 used an in-process relay restart; its H-06 observation does not establish an independently effective transaction-ID deduplication key (#921). Self-tests here use fixtures and public-shape doubles only.
They never import a kit package or execute a harness role; fixture subprocesses, temporary files and loopback sockets are permitted.

Run 3 matched seven cases. Four executed small-pass cases mismatched (L-04, L-07, L-10 and L-11); all six volume cases were unexecuted. The 200 ms shutdown reports returned in 200.77874999999997 ms and 201.91920900000002 ms (#890). L-11's absence counter expected `not_found`, while the collector's public result and all four final read-backs say `absent` (#889). All 46 executed occurrences were accounted for, with zero unexplained; the original JSON still records L-11 as a mismatch. Run 4, under `load.v2.json`, then matched all 17 cases, and #838 was accepted.

Run 3 declares driver lane `codex` and model `gpt-5`. The actual model identity has not been independently verified; retain this as declared provenance, with any later correction recorded separately from the raw JSON.

Each run's results pin every harness file's git blob and sha256 at that run's approved head
(`executed_file_hashes`, `role_files`). A later build may change a shared file without altering that evidence:
a run is checked and reproduced against its approved head, never against the current tree.

## Probes

| Probe | Ticket | Directory | Expectations | What one run does |
|---|---|---|---|---|
| S2-tracer | #836 | `tracer/` | `expectations/tracer.v1.json` | one occurrence through the reference composition into the collector |
| S2-outages | #837 | `outages/` | `expectations/outages.v1.json` | a small pass, then a volume pass, of the ten outage scenarios below |
| S2-load | #838 | `load/` | `expectations/load.v1.json` | bursts against backpressure and shutdown, and `best_effort` drops, in the phases below |
| S2-copies | #839 | `copies/` | `expectations/copies.v2.json` | redeliveries, duplicates, conflicts, re-executions, collector and consumer restarts, and storage-less capacity (v2 supersedes v1) |
| S2-chains | #840 | `chains/` | `expectations/chains.v1.json` | account-takeover chain reconstruction across tenants, sessions, and shared-source addresses |
| S2-outbox | #842 | `outbox/` | `expectations/outbox.v1.json` | host-outbox relaying across transactions, rollbacks, crashes, and outages |

The outages probe reuses the tracer's two role processes unchanged: `outages/sender-process.mjs` and
`outages/ingress-process.mjs` import the role guard, then the tracer's role. Each pass is one exchange between a
fresh ingress, with its own SQLite file and the pass's scheduled fault plan, and a fresh sender, which the
session hands that pass's occurrences and call budget (`outages/session.mjs` `senderInput`).

The ten scenarios, one per occurrence in schedule order, each a list of per-attempt fault rules
(`lib/faults.mjs` `scheduledFaultPlan`), with any other attempt acknowledged:

| Scenario | Faults | Expected end |
|---|---|---|
| `clean` | none | acknowledged, 1 attempt |
| `status_503`, `status_408` | the status on attempt 0 | acknowledged, 2 attempts |
| `status_429` | 429 on attempts 0 and 1 | acknowledged, 3 attempts |
| `timeout` | stored, then answered after the 1000 ms exchange deadline | acknowledged as a duplicate, 2 attempts |
| `transport_failure` | socket destroyed before ingest | acknowledged, 2 attempts |
| `lost_acknowledgment` | stored, then the socket destroyed | acknowledged as a duplicate, 2 attempts |
| `exhausted` | 503 on all 4 attempts | reported `exhausted`, with an exhaustion alert |
| `permanent_400` | 400 on attempt 0 | reported `non_retryable`, no retry |
| `malformed_acknowledgment` | stored, then a 202 that acknowledges nothing | reported `protocol_error`, no retry, yet persisted |

The small pass runs the schedule once (10 occurrences). Only if all eight small-pass cases match does the volume
pass repeat it 50 times (500 occurrences); otherwise the volume pass does not run and its six cases observe
nothing. Each volume occurrence is compared with its scenario's frozen small-pass profile.

The load probe has its own sender (`load/sender-process.mjs`); its ingress loads the tracer's. Each phase is one
exchange, sequenced by `lib/gated-session.mjs` as the outages passes are. Burst phases submit every occurrence at
once against answers the ingress holds, so each meets the admission gate before any held delivery can settle:

| Phase | Pass | What it does | Frozen end |
|---|---|---|---|
| `overload` | small | 10 at once, capacity 4, answers held 300 ms, shutdown after settling | 4 admitted; 6 rejected with depth and capacity 4/4, never reaching the exchange |
| `drain` | small | 8 at once, capacity 16, held 300 ms; shutdown (deadline 5000 ms) as soon as all met the gate; 2 submitted after | 8 drained and acknowledged; the 2 rejected while shutting down |
| `abandon` | small | 6 at once, held 3000 ms; shutdown deadline 200 ms | report 6 accepted, 0 completed, 6 abandoned; each settles later and was stored |
| `best_effort` | small | 8 `authorization.allowed` in sequence through the `best_effort` class, 5 answered 503, loss ceiling 3 | 3 delivered, 5 dropped with loss counts 1, 2, 3, 3, 3; the ceiling signal fires once |
| `retry_shutdown` | small | 10 at capacity 4; every attempt receives pre-ingest 503; retry waits held across a 200 ms shutdown, then released; 2 later submissions | report 10 accepted, 6 completed overload decisions, 4 abandoned; 8 admission signals, 4 final storage absences, 8 scheduled retries and 4 late exhaustion alerts |
| `overload_volume` | volume | 1000 at once, capacity 100, held 500 ms | 100 admitted, 900 rejected |
| `drain_volume` | volume | 200 at once, capacity 1000, held 500 ms; shutdown (deadline 5000 ms) as soon as all met the gate; 10 submitted after | 200 drained; the 10 rejected while shutting down |
| `best_effort_volume` | volume | 200 in sequence, every second one 503, loss ceiling 50 | 100 dropped; the count saturates at 50 and the ceiling signals once |

The load call bound is **1,456**: 46 small and 1,410 volume. All eleven small cases must match before the six volume cases execute. A genuine mismatch is retained and leaves #838 open; it is not an automatic reason to spend a replacement run.

Shutdown time covers the composition's report return, including bookkeeping, measured monotonically without rounding or a grace margin. Primitive timing is recorded separately. Shutdown stops waiting rather than cancelling work: late acknowledgments or exhaustion remain separate observations, and cannot rewrite the report's abandoned classification. A found byte-matching stored copy retains terminal-bucket priority; an abandonment claim alone proves no storage absence.

Backpressure callbacks, operation starts, exchanges and results carry an occurrence-attributed sequence trace. Each rejected overload must have its callback before the result, and its operation must never start. Drop callbacks must cover dropped event IDs bijectively, including after saturation. Accounting results retain the full planned denominator.

Every load sender runs deterministic planted/null accounting controls before constructing the SDK. The runtime control checks include missing/duplicate drops, omitted admission, missing occurrence, strict deadline, rejection ordering, retry delay/exhaustion reporting and storage absence. These consume no SDK calls. Final read-back follows actual sender closure and ingress quiescence, including pending fault tasks; both role closes are recorded. Closure failure invalidates the run and never masks an S2 condition.

### Copies probe (S2-copies, #839)

`expectations/copies.v2.json` supersedes `copies.v1.json` for new runs. `copies.v1.json` and historical runs 5-6 are retained unchanged. The rebuilt v2 probe spans five phases across an upper bound of 149 planned calls: `identities` (3 distinct occurrences: clean, clean, retry_once, including a sanctioned re-execution preserving original event correlation), `collector_restart` (2 distinct occurrences across an in-process SQLite reopen with restart boundary tracking recording storage closure, reopening, and before-restart record counts), `consumer_restart` (4 distinct occurrences with mid-burst retry shutdown, post-shutdown fencing, timer release to fence, and byte-identical unacknowledged redelivery via the core SDK redelivery path with total accounting), `storage_less` (33 distinct occurrences enforcing the in-memory ledger's 32-record admission bound and capacity rejection), and `duplicates_volume` (50 distinct occurrences sent twice, totaling 100 calls). Workload generators determine distinct occurrences per phase independent of retry attempts. HTTP status mappings (including storage-less admitted → 202 and conflict → 409) are harness-owned transport behavior from `lib/ingress.mjs` `statusFor`, not product behavior; the collector package is transport-neutral. Eleven cases (C-01 to C-11) verify byte identity, attempt ordinal exclusion with constant `correlation.retry_attempt`, duplicate acknowledgment without readmission, schema-valid storage conflict rejection (`COLLECTOR_STORAGE_CONFLICT`), sanctioned re-execution persistence with original event ID correlation, post-restart duplicate retention with restart boundary and durable read-back, total consumer restart accounting across redeliveries, storage-less capacity rejection (`COLLECTOR_DEDUPLICATION_CAPACITY`), pre-traffic planted controls exercising real observers, pre-traffic isolation controls (exact 192.0.2.1 violation), and volume duplicate inflation freedom.

Role logic is partitioned into kit-free role modules (`copies/ingress-role.mjs`, `copies/sender-phases.mjs`) driven by thin process shells (`copies/ingress-process.mjs`, `copies/sender-process.mjs`). Process shells install `lib/role-guard.mjs` and wire resolved kit dependencies, while role modules remain pure and testable under in-process doubles. Composition and SDK adapters reside in `copies/sender-phases.mjs` as `senderFactories({ sdkNode, senderSdk })` and `senderRun({ deps, message })`, allowing both the governed run and in-process rehearsals to exercise the pure role logic, call plan, and composition structure. During collector restart, the sender and orchestrator coordinate via an explicit `{ step: "ingress_restart" }` IPC handshake: the sender requests the restart, pauses traffic until acknowledged, and validates continuity.

An in-process rehearsal gate (`tests/copies-session-rehearsal.test.mjs`) exercises the pure role logic, the call plan, the evaluation, the IPC sequencing and the composition structure over a fake SDK, a fake Node binding, a fake collector and in-process loopback HTTP, validating submitted events against the real generated JSON schema. The rehearsal fakes the Node binding and SDK primitives, and clones IPC messages via JSON serialization in both directions. Seam defect tests prove the rehearsal fails closed: roleExchange dropping restarts causes a C-06 mismatch (`restart_count === 0`); a sender dropping `request_ingress_restart` on IPC stops on deadline; a composition with a retry wait that never resolves stops on deadline (with a null control completing under the same 15000 ms deadline); and a schema-invalid conflicting copy causes a C-04 mismatch. C-07's shutdown arm requires matching exchange counts at shutdown and is verified with a forwarding fence plant.

**Residual risks:** The rehearsal does not cover:
- Real OS child processes, IPC channels, and stdio streams;
- Runtime permission models (`--permission --allow-net --allow-fs-read`);
- Native SQLite file storage and cross-process filesystem locking;
- Real SDK event construction beyond the generated JSON schema validation check;
- Real collector behavior beyond schema validation, deduplication and storage-conflict handling;
- Real controls producers executing in a live environment;
- Kit installation into the own service under npm/tarball packaging;
- `lib/sender-role.mjs` and `lib/role-guard.mjs`;
- The S2 halt path;
- The bodies of both process shells (`copies/sender-process.mjs`, `copies/ingress-process.mjs`), which are only pinned as text.

### Chains probe (S2-chains, #840)

`expectations/chains.v1.json` governs the Stage 2 chains probe (#840, Q201–Q242). The probe exercises account-takeover chain reconstruction across two passes: a small pass (`chains_small`, 6 chains, 3 tenants, 2 shared-source pairs, 6 failed authentications, 72 planned calls) and a volume pass (`chains_volume`, 60 chains, 10 tenants, 60 failed authentications, 720 planned calls) across an upper bound of 792 planned calls. Each chain spans five lifecycle events per account (`authentication.succeeded`, `session.created`, `authentication.mfa.removed`, `account.password_reset.completed`, `session.revoked`), plus independent `authentication.failed` events. Per transaction-bound event, 3 SDK calls are planned and executed (`beginOperation`, `markCommitted`, and emit); per non-bound event, 1 call is planned. Workload generators use opaque synthetic IDs (`syn-account-...`), documentation addresses (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`), keyed session fingerprints (`syn-handle-...` hashed under an in-memory HMAC key), and a seeded submission permutation giving an arrival order that differs from event-time order.

For `passwordResetCompleted`, causation and original event IDs carry a deterministic, opaque, per-chain synthetic recovery-request ID (`syn-recovery-…`). This refers to an out-of-band recovery request that the run does not emit (it does not claim to point at an emitted event).

Round 3 incorporates decisions Q231–Q242:
- Every SDK call is counted in the ledger with its own label: `beginOperation`, `markCommitted`, and event emission. `beginOperation` is taken from the ledger before it runs. The call plan and budget freeze at 72 small and 720 volume (792 total), and results record the measured ledger count (Q231).
- The operation handle setup fails closed: `sdk.beginOperation` is required to be a function (throwing otherwise); if `beginOperation` or `markCommitted` returns `ok: false`, the event call is omitted, the failure is recorded with the SDK error code in the ledger, and the run continues without optional chaining `?.()` (Q232).
- The expectations validator strictly ties occurrences, distinct occurrences, and schedule lengths to submission steps (36 small, 360 volume), and per-phase budgets to derived call plans (72 small, 720 volume, 792 total) (Q233).
- `passwordResetCompleted` carries required catalog recovery policy authorization evidence, and its causation/original event IDs refer to deterministic synthetic out-of-band recovery requests (`syn-recovery-…`) (Q234).
- The evaluator and observers iterate `expectations.phases` dynamically without hardcoding phase names; missing observations or ground truth yield named mismatches, and volume comparisons apply only when the gate admitted the volume pass (Q235).
- The fake SDK uses real SDK error codes (`SDK_SEMANTIC_VALIDATION_FAILED` at `/subject/type` for non-credential targets) instead of invented codes; builds resources directly from input rather than keeping canonical example resources; and enforces `TENANT_RESOURCE_CONFLICT` against the scope tenant (Q236).
- R-05 failed authentications count is derived from reconstruction; the G13 check enforces that no failed body names targets in `resource.id`, `authorization.resource_context`, or `authenticated_principal` unless `resource.type` is "credential"; and the unlinked check verifies that no failed event ID or event name appears in any reconstructed chain (Q237).
- Planted mismatches for round 2/3 decisions verify: failed body with account actor or credential reference mismatches R-05; volume-only reconstruction defects mismatch R-01 to R-05 and R-08; and an extra chain mismatches R-01 (Q238).
- R-07 scans the entire serialized body of every persisted event for the raw session handle value prefix (`syn-handle-…`), catching leaks in credential references (Q239).
- The call plan is derived directly from `generateWorkloadDefinition` using the frozen seed without fallback seeds, and is used by the sender (Q240).
- One shared fixture builder (`makeControlsBodiesFixture` in `chains/controls.mjs`) produces run-shaped bodies across planted controls and evaluate tests (Q241).
- Session accounting uses `roleExchange`'s returned `occurrence_count` directly without recomputation or `?? 0`; single shared `codePointCompare` is imported across probe modules; tasks.md task 6.1 references Q201–Q242 (Q242).

Reconstruction (`chains/reconstruct.mjs`) is pure, kit-free, and rule-free. It produces no thresholds, scores, flags, or verdicts. The collector has no list API; the ingress role finalizer reads persisted bodies by admitted event ID using `storage.get(scope, eventId)`. Reconstruction reads persisted bodies only, grouping occurrences by tenant, account opaque ID, and session fingerprint, and ordering strictly by event timestamp (`event.timestamp`), with failed authentications grouped by observed source and event time, unlinked to accounts.

Eleven cases (R-01 to R-11) verify exact chains matching ground truth, no shared-source merge, source counts, tenant partitions, failed authentications grouped by source and timestamp without account linkage, opaque non-email identifiers with documentation-range addresses, keyed session fingerprints without raw handles, event-time ordering independent of arrival order, pre-traffic planted controls exercising real observers (merge-by-source defect and arrival-order defect detected, null controls passed), pre-traffic isolation controls (loopback guard, writes outside grant, synthetic data), and total accounting identity across both passes.

An in-process rehearsal gate (`tests/chains-session-rehearsal.test.mjs`) exercises the pure role logic, the call plan, the evaluation, and the reference composition over a fake SDK (supporting all six methods with real SDK semantic validation matching contract catalog data), a fake Node binding, a fake collector (`FakeSqliteStorage` with `storage.get` and schema rejection), and in-process loopback HTTP. Seam defect tests prove the rehearsal fails closed: dropped `persisted_bodies` fails R-01 and gates the volume pass; and an arrival-order reconstruction fails R-08 under the same shortened deadline (25000 ms), with a null control completing cleanly.

**Residual risks:** The rehearsal does not cover:
- Real OS child processes, IPC channels, and stdio streams;
- Runtime permission models (`--permission --allow-net --allow-fs-read`);
- Native SQLite file storage and cross-process filesystem locking;
- Real collector behavior beyond schema validation, deduplication and storage-conflict handling;
- Real controls producers executing in a live environment;
- Kit installation into the own service under npm/tarball packaging;
- `lib/sender-role.mjs` and `lib/role-guard.mjs`;
- The S2 halt path;
- The bodies of both process shells (`chains/sender-process.mjs`, `chains/ingress-process.mjs`), which are only pinned as text.

### Outbox probe (S2-outbox, #842)

`expectations/outbox.v1.json` governs the Stage 2 outbox probe (#842, Q243–Q258). The probe exercises host-outbox relaying across transactions, rollbacks, in-process relay crashes, and downstream collector outages. The workload spans five phases across an upper bound of 539 planned calls: `commit_relay` (6 business changes, 6 committed outbox rows, 6 relayed, 24 calls), `rollback` (4 changes rolled back, 0 outbox rows, 0 relayed, 12 calls), `crash_restart` (6 changes committed, crash after 3rd acknowledgment, resume and redeliver row 3, 25 workload calls plus 23 planted-control and 25 null-control calls, 73 total), `outage_defer` (6 changes committed, deferred across 503 outage, delivered from durable record on recovery, 30 calls), and `commit_relay_volume` (100 changes, 100 relayed, 400 calls). Both H-08 controls run only in `crash_restart` and spend the run ledger, including every SDK and composition call.

The host database is a harness-local `node:sqlite` `DatabaseSync` file in a declared directory under scratch (`--allow-fs-read=<dir> --allow-fs-write=<dir>`); neither the database nor the outbox is Bloodtrail storage or a Bloodtrail outbox product (Q244, Q257). Each business change runs `BEGIN`, inserts the business row, and emits its audit event through a transaction-bound sink that inserts the outbox row inside the open transaction, followed by `COMMIT` or `ROLLBACK` (Q245). Contract cells measured from `delivery-policy.md` (`transaction_critical`): "persistent retry after commit" and "defer downstream delivery from durable record"; H-06 also observes downstream deduplication by event id and transaction id.

The relay crash is in-process and disclosed (ADR 0015): the relay is abandoned after the collector acknowledges row k but before marking it, the database handle is closed, and a fresh relay over a fresh `DatabaseSync` on the same file resumes (Q248).

Eleven cases (H-01 to H-11) verify commit atomicity with SQLite `isTransaction` state recording for both inserts between the same begin and commit, rollback discard with zero rows relayed or persisted after a drain attempt, at-least-once relay with exact persisted acknowledgment, crash persistence identity with exactly one stored copy per event and redelivered row k arriving as duplicate, deduplication downstream by event id and transaction id matching the business row bound by business id, deferral during collector 503 outage and delivery of the failed ids re-read from durable host records with no rows pending after recovery, pre-traffic planted controls (mark-before-ack relay defect fails H-04, null control passes), pre-traffic host-database grant isolation (planted sibling write inside scratch refused under `--permission`), pre-traffic runtime isolation controls, and total accounting identity across every phase, including rollback.

An in-process rehearsal gate (`tests/outbox-session-rehearsal.test.mjs`) exercises the pure role logic, call plan, host transactions, relay drain, and composition over a scoped fake SDK (modeling the two workload events’ branded context, selected catalog-required context, operation authority and sink refusals; it does not model the full SDK), fake Node binding, and fake collector. The fake never uses canonical examples as templates. The outage composition uses one attempt per delivery; both relay passes re-read SQLite pending rows. Reports include every SDK/composition call, sink insertion state, transaction order, pending rows after the outage and crash/resume evidence. H-08 executes both relay algorithms on dedicated control files only in the crash phase, with fresh DatabaseSync handles after the planted crash, a recording stub composition and the run ledger. Seam defect tests prove the rehearsal fails closed: dropped `persisted_bodies` fails H-04 and gates the volume pass; missing host observations fails H-01; plain context fails H-01; a binding retry absorbing the outage fails H-07; constant H-08 claims fail H-08; and empty rollback fails H-02. Each gates volume under the same 25000 ms deadline as its honest null control. Evaluator fixtures are produced by the rehearsal; field-read parity checks every observation read against those fixtures.

**Residual risks:** The rehearsal does not cover:
- Real OS child processes, IPC channels, and stdio streams;
- Runtime permission models (`--permission --allow-net --allow-fs-read --allow-fs-write`);
- Native cross-process filesystem locking;
- Real collector behavior beyond schema validation, deduplication and storage-conflict handling;
- Real controls producers executing in a live environment;
- Kit installation into the own service under npm/tarball packaging;
- `lib/sender-role.mjs` and `lib/role-guard.mjs`;
- The S2 halt path;
- The bodies of both process shells (`outbox/sender-process.mjs`, `outbox/ingress-process.mjs`), which are only pinned as text.

## The seam

The kit's packed core, Node binding and collector are installed as an evaluator's own service outside the
repository, the same seam Stage P used. Repository `dist/` output, the kit examples, and repository sources are
never executed. Every symbol the harness uses is checked against the installed `.d.ts` files as text before
expectations are frozen and before every run (`lib/install.mjs` `SYMBOLS`).

## Processes

| Process | Runs | Permissions |
|---|---|---|
| orchestrator (`<probe>/run-<probe>.mjs`) | the kit pipeline, the approval checks, the session, the evaluation | unrestricted; loads no SDK |
| sender (`<probe>/sender-process.mjs`; the outages shim loads `tracer/sender-process.mjs`) | the SDK, the reference composition, the in-process controls; outbox also owns the host database and relay | `--permission --allow-net --allow-fs-read=<own service>`; outbox alone adds `--allow-fs-read=<scratch>/host-database --allow-fs-write=<scratch>/host-database` |
| ingress (`<probe>/ingress-process.mjs`; the outages shim loads `tracer/ingress-process.mjs`) | the kit collector with SQLite storage, behind the fault injector | `--permission --allow-net --allow-fs-read=<own service>`, plus read and write on `<scratch>/collector-storage` |

The orchestrator forks both roles with an IPC channel. The ingress token is generated per run, held only in
memory, and never recorded. Both roles import `lib/role-guard.mjs` first, so the loopback guard
(`lib/loopback-guard.mjs`) is installed before any kit module evaluates; any non-loopback connection or datagram
halts the run under S2, and an uncaught failure is reported to the orchestrator rather than lost.

## The reference composition

```
createDeliveryShutdown            deadline-bounded shutdown admission
  └─ createBoundedDeliveryBackpressure   an admission gate, not a queue
       └─ createBoundedDeliveryRetry     bounded retry, injected gated timers, seeded jitter
            └─ createHttpDeliveryHandoff one attempt per call
                 └─ createFetchHttpExchange  loopback origin only
```

`lib/composition.mjs` records each attempt's ordinal and body hash, and every retry and backpressure callback.

## Planted-defect controls

Each check is proven able to fail. Each has a planted defect that must fire and a null control that must stay
silent. A live control that does neither stops its role before any traffic, and the run is invalidated:

| Check | Planted defect | Where |
|---|---|---|
| accounting identity | a silently dropped occurrence; one lost before the sink; a delivery that throws | `tests/accounting.test.mjs`, `tests/tracer-evaluate.test.mjs`, `tests/composition.test.mjs` |
| byte identity | one changed stored byte; two invalid byte sequences that decode alike | `tests/tracer-evaluate.test.mjs`, `tests/ingress.test.mjs` |
| delay identity | an unreported retry | `tests/accounting.test.mjs`, `tests/tracer-evaluate.test.mjs` |
| loopback guard | `fetch` to `192.0.2.1:80`; a numeric-string port; a datagram | `tests/loopback-guard.test.mjs`, and live in each sender before traffic |
| writes outside the grant | a write into the own service; null control: a read inside the sender's read grant, a write inside the ingress storage | `tests/permissions.test.mjs` under a real `--permission` grant, and live in both roles before traffic |
| synthetic data | an email-like identifier | `tests/workload.test.mjs`, and live in the sender |
| persistence of the sender's copy | a conflicting copy under another tenant scope | `tests/ingress.test.mjs`, `tests/tracer-evaluate.test.mjs` |
| one claim per run number | a second approval naming a claimed run; a spent run limit; a restarted window | `tests/approval.test.mjs` |
| live controls stop traffic | a control that does not hold | `tests/loopback-guard.test.mjs` |
| bounded commands | a stalled child command | `tests/limits.test.mjs` |
| refusal before the claim | expectations the sender or the kit would reject after it | `tests/tracer-plan.test.mjs`, `tests/outages-plan.test.mjs` |
| accounting identity, on the run's own data | the first occurrence's result and stored copy dropped from a copy of the run's observations: proves the identity fails on this data (the check itself is O-03 and O-10) | `outages/evaluate.mjs` (case O-04), `tests/outages-evaluate.test.mjs` |
| retry predicates | an unplanned retry; a delay off the seeded draw; a delay past its cap; an exhaustion without its alert | `tests/outages-evaluate.test.mjs` |
| redelivery | a redelivery admitted as a second write; a redelivery whose bytes changed; a volume occurrence unlike its scenario | `tests/outages-evaluate.test.mjs` |
| pass sequencing | a small-pass mismatch (the volume pass must not run); a failed volume pass (the small pass's observations must survive); a deadline during the small pass (no further pass may start); a halt while an ingress starts (no sender may spawn) | `tests/outages-evaluate.test.mjs`, `tests/load-evaluate.test.mjs`, `tests/session.test.mjs` |
| load, on the run's own data | a shutdown report that leaves one admitted operation out; a drop with no drop callback (`load/evaluate.mjs` case L-06) | `tests/load-evaluate.test.mjs` |
| load predicates | missing, late or misattributed overload callbacks; rejected operations starting; unexplained ingress attempts; incomplete shutdown reports; fractional deadline overruns; post-shutdown admission; missing/duplicate drop IDs; wrapped counts; silent ceilings; hidden retry delays/exhaustion; uncertain storage absence | `tests/load-evaluate.test.mjs` |
| shutdown labels | a submission rejected while shutting down relabelled abandoned; a delivery held at the deadline left pending | `tests/composition.test.mjs` |
| frozen expectations (load) | admission, shutdown and loss values that do not follow from the frozen phases; a held answer that cannot beat its deadline; a phase or case of the wrong kind or pass; a sender field the phase view lacks | `tests/load-plan.test.mjs` |
| frozen expectations | delays that are not the seeded draws; a profile its scenario's rules do not produce (refused before the claim, `outages/expectations.mjs` `derivedProfile`); a rule no attempt reaches; a sender field the pass view lacks | `tests/outages-plan.test.mjs` |

## Dry run (build only)

```bash
node openspec/changes/verify-fraud-evidence-delivery/harness/kit-cli.mjs --dry-run \
  --driver-lane claude-code --driver-model "$MODEL"
```

G46 Q94 originally required `--driver-lane claude-code`. After the Codex-continuation amendment merges, slots 9–16 also accept `--driver-lane codex` with the actual model; all S1, reserve disposition, budget, window and S2 gates still apply. Runs 3 and 4 recorded lane `codex` under the earlier #838 addendum. See `design.md`; no amendment by itself approves a run.

It requires a clean tree. It builds the governed kit from HEAD, verifies the kit identity, refuses kit
manifests that declare install lifecycle scripts, installs the own service with `--ignore-scripts`, proves a
single core copy, checks every harness symbol against the packed declarations as text, and deletes its scratch.
It runs no kit code and spends no run.

## Approved run

Only after a delegated S1 under G44 names the exact head, and, for a rerun after a harness defect or any reserve slot (13–16), after an owner disposition recorded on the probe ticket (G46, Q68):

```bash
node openspec/changes/verify-fraud-evidence-delivery/harness/$PROBE/run-$PROBE.mjs \
  --approved-head "$HEAD" --run-number "$N" --window-opened-at "$OPENED" \
  --approval-body-file "$BODY" --approval-url "$URL" --approval-created-at "$CREATED" \
  --approval-updated-at "$UPDATED" --approval-sha256 "$BODY_SHA256" \
  --disposition-body-file "$DISPOSITION_BODY" \
  --disposition-url "$DISPOSITION_URL" \
  --disposition-created-at "$DISPOSITION_CREATED" \
  --disposition-updated-at "$DISPOSITION_UPDATED" \
  --disposition-sha256 "$DISPOSITION_SHA256" \
  --once-marker "$HOME/.bloodtrail/stage-2/once-markers/run-$N" --results "$CHANGE/harness/results/$PROBE-run-$N.json" \
  --driver-lane claude-code --driver-model "$MODEL"
```

They are required for runs 13–16 and recorded whenever given.

`$PROBE` is `tracer`, `outages`, `load` or `copies`. `--window-opened-at` is `2026-10-23T13:18:26Z` for every run (`run-ledger.md`).

`results/` is created empty before the run; an empty directory leaves the tree clean. The once-marker lives in
the one pinned control directory `~/.bloodtrail/stage-2/once-markers/` (created once, mode 700), shared by every
Stage 2 run: the marker is `run-<N>`, so a run number is claimed at most once whatever approval names it, and the
directory never holds more than the 16 runs G42 allows as amended by G46. The run ledger is the cross-check. Each
marker records the head, the approval body sha256 and the G42 window opening; the first claim declares the
opening, and every later run must pass the same `--window-opened-at`, so no run restarts the 14 days. The
approval, clean tree, HEAD, expectations, results path and once-marker are checked before the marker is
claimed, so a refusal spends nothing. After the claim the run is spent: its results are written even when it
fails, a failed role's bounded stderr, with the run's token redacted, travels with the invalidation, and every
child command is killed after 10 minutes. `occurrence_count` is the sender ledger's exact count, or null when
the run failed before the sender reported; `call_bound` is the planned budget the ledger hard-caps at. A
mismatch is a finding and exits 0; only an invalidation exits nonzero. Scratch (kit, own service, collector
storage, logs) is deleted recursively once every role has closed, and the deletion is recorded in the results.
