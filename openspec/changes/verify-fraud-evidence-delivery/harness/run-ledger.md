# Stage 2 run ledger

Authorization: `../proposal.md#run-authorization` at each run's exact approved head, under
[G42](https://github.com/nandohdc/bloodtrail/issues/795#issuecomment-6346915049). This ledger grants no
approval.

G42 limits are shared across every Stage 2 probe ticket (#836–#842): **12 runs**, at most **50,000 SDK calls per
run**, accepted or refused (delivery attempts are recorded but not capped), within **14 days** of the first Stage 2
S1. Expiry needs an authorization amendment, never a window extended by convention. The planned budget is: six
runs for the single-run probes, three for #841, and three spare.

Window: not yet opened. It opens at the first Stage 2 S1 comment's `createdAt`, and that value is passed as
`--window-opened-at` for every run after it. The first claimed run records it in its once-marker, and the
harness refuses any later run that passes another value.

S1 is delegated under G44. Each approval is a comment on the probe's ticket naming the exact head:

```
S1 approval: <probe> run <N> for #<ticket> at <HEAD>
Delegated S1 under G44
```

An S1 the owner posts directly omits the delegation line; its results record `delegation: null`, and its row
names the owner as the approver.

Run numbers are shared across the probes, 1 to 12. Every run claims its once-marker `run-<N>` in the one pinned
control directory, `~/.bloodtrail/stage-2/once-markers/`, so a run number cannot be spent twice. Dry runs are build-only: they are not
Stage 2 executions, consume no run number and create no row. Before each
S1, reconcile this ledger: runs used, SDK calls used, and time left in the window. A failed run whose
results carry `occurrence_count: null` is entered at its `call_bound`. An S2 stop halts the run
and goes to the owner.

| Run | Probe | Ticket | Approved head | S1 comment | SDK calls | Result | Scratch deleted |
|---|---|---|---|---|---|---|---|
