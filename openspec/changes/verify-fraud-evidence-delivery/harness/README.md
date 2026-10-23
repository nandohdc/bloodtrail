# Stage 2 harness: delivery and per-source evidence

Authorization: `../proposal.md#run-authorization` at each run's exact approved head, under
[G42](https://github.com/nandohdc/bloodtrail/issues/795#issuecomment-6346915049) (environment and limits) and
G44 (delegated S1). See `run-ledger.md` for the shared run budget.

**No Stage 2 probe has executed yet.** Self-tests here use fixtures and public-shape doubles only. They never
import a kit package, never run a role process, and never send traffic off loopback.

## The seam

The kit's packed core, Node binding and collector are installed as an evaluator's own service outside the
repository, the same seam Stage P used. Repository `dist/` output, the kit examples, and repository sources are
never executed. Every symbol the harness uses is checked against the installed `.d.ts` files as text before
expectations are frozen and before every run (`lib/install.mjs` `SYMBOLS`).

## Processes

| Process | Runs | Permissions |
|---|---|---|
| orchestrator (`tracer/run-tracer.mjs`) | the kit pipeline, the approval checks, the session, the evaluation | unrestricted; loads no SDK |
| sender (`tracer/sender-process.mjs`) | the SDK, the reference composition, the in-process controls | `--permission --allow-net --allow-fs-read=<own service>` |
| ingress (`tracer/ingress-process.mjs`) | the kit collector with SQLite storage, behind the fault injector | the sender's, plus read and write on `<scratch>/collector-storage` |

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
| refusal before the claim | expectations the sender or the kit would reject after it | `tests/tracer-plan.test.mjs` |

## Dry run (build only)

```bash
node openspec/changes/verify-fraud-evidence-delivery/harness/kit-cli.mjs --dry-run \
  --driver-lane claude-code --driver-model "$MODEL"
```

It requires a clean tree. It builds the governed kit from HEAD, verifies the kit identity, refuses kit
manifests that declare install lifecycle scripts, installs the own service with `--ignore-scripts`, proves a
single core copy, checks every harness symbol against the packed declarations as text, and deletes its scratch.
It runs no kit code and spends no run.

## Approved run

Only after a delegated S1 under G44 names the exact head:

```bash
node openspec/changes/verify-fraud-evidence-delivery/harness/tracer/run-tracer.mjs \
  --approved-head "$HEAD" --run-number "$N" --window-opened-at "$OPENED" \
  --approval-body-file "$BODY" --approval-url "$URL" --approval-created-at "$CREATED" \
  --approval-updated-at "$UPDATED" --approval-sha256 "$BODY_SHA256" \
  --once-marker "$HOME/.bloodtrail/stage-2/once-markers/run-$N" --results "$CHANGE/harness/results/tracer-run-$N.json" \
  --driver-lane claude-code --driver-model "$MODEL"
```

`results/` is created empty before the run; an empty directory leaves the tree clean. The once-marker lives in
the one pinned control directory `~/.bloodtrail/stage-2/once-markers/` (created once, mode 700), shared by every
Stage 2 run: the marker is `run-<N>`, so a run number is claimed at most once whatever approval names it, and the
directory never holds more than the 12 G42 runs. The run ledger is the cross-check. Each
marker records the head, the approval body sha256 and the G42 window opening; the first claim declares the
opening, and every later run must pass the same `--window-opened-at`, so no run restarts the 14 days. The
approval, clean tree, HEAD, expectations, results path and once-marker are checked before the marker is
claimed, so a refusal spends nothing. After the claim the run is spent: its results are written even when it
fails, a failed role's bounded stderr, with the run's token redacted, travels with the invalidation, and every
child command is killed after 10 minutes. `occurrence_count` is the sender ledger's exact count, or null when
the run failed before the sender reported; `call_bound` is the planned budget the ledger hard-caps at. A
mismatch is a finding and exits 0; only an invalidation exits nonzero. Scratch (kit, own service, collector
storage, logs) is deleted recursively once every role has closed, and the deletion is recorded in the results.
