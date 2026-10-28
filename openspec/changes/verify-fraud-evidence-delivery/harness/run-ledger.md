# Stage 2 run ledger

Authorization: `../proposal.md#run-authorization` at each run's exact approved head, under
[G42](https://github.com/nandohdc/bloodtrail/issues/795#issuecomment-6346915049). This ledger grants no
approval.

G42 limits are shared across every Stage 2 probe ticket (#836–#842): **12 runs**, at most **50,000 SDK calls per
run**, accepted or refused (delivery attempts are recorded but not capped), within **14 days** of the first Stage 2
S1. Expiry needs an authorization amendment, never a window extended by convention. The planned budget is: six
runs for the single-run probes, three for #841, and three spare.

Window: opened at `2026-10-23T13:18:26Z`, the `createdAt` of run 1's S1 comment, the first Stage 2 S1. It
closes at `2026-11-06T13:18:26Z`. That value is passed as `--window-opened-at` for every run after it. Run 1
recorded it in its once-marker, and the harness refuses any later run that passes another value.

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
| 1 | S2-tracer | #836 | 693c18d671e4cfdc685c0b95930bb4be1eaf63c9 | https://github.com/nandohdc/bloodtrail/issues/836#issuecomment-6365806337, delegated (G44) | 1 | 7 of 7 cases matched, no invalidations: `results/tracer-run-1.json` | yes, `recursively_absent: true` |
| 2 | S2-outages | #837 | c23b98388f8b3e33159d2ca0d350e63587481047 | https://github.com/nandohdc/bloodtrail/issues/837#issuecomment-6372110299, delegated (G44) | 510 | 14 of 14 cases matched (small pass gated the volume pass, which completed), no invalidations: `results/outages-run-2.json` | yes, `recursively_absent: true` |
| 3 | S2-load | #838 | 1949518c5501f40482ec489fca86f9ad1b678e69 | https://github.com/nandohdc/bloodtrail/issues/838#issuecomment-6390168250, delegated (G44) | 46 | 7 of 17 cases matched; 4 executed small cases mismatched (L-04, L-07, L-10, L-11), 6 volume cases unexecuted; no invalidations: `results/load-run-3.json`. Strict timing finding #890; absence-evaluator defect #889. | yes, `recursively_absent: true` |
| 4 | S2-load | #838 | 9b3b91e54c1966b6da2c885c39eb80d5bce67192 | https://github.com/nandohdc/bloodtrail/issues/838#issuecomment-6433189870, delegated (G44) | 1456 | 17 of 17 cases matched (all 11 small-pass cases and all 6 volume-pass cases), no invalidations: `results/load-run-4.json` | yes, `recursively_absent: true` |
| 5 | S2-copies | #839 | e71716ed75a27f67d9fbf9ec05cdce0f2f4dfa72 | https://github.com/nandohdc/bloodtrail/issues/839#issuecomment-6445622978, delegated (G44) | 145 | 0 of 11 cases matched; 1 invalidation (sender process error: planted-defect control failed before traffic: copies_checks due to missing holds property, #902): `results/copies-run-5.json` | yes, `recursively_absent: true` |
| 6 | S2-copies | #839 | ac6c5516cca96ea3f70cd054541415160598a9d7 | https://github.com/nandohdc/bloodtrail/issues/839#issuecomment-6447734314, delegated (G44) | 45 | 8 of 11 cases matched (small pass mismatched C-06 and C-10; C-11 volume pass skipped), no invalidations: `results/copies-run-6.json`. Port continuity and isolation evaluator finding #905. | yes, `recursively_absent: true` |
| 7 | S2-copies | #839 | 707b1dc9abc67fb8b58d5564d5727dbbbda74f00 | https://github.com/nandohdc/bloodtrail/issues/839#issuecomment-6465595030, delegated (G44) | 147 | 11 of 11 cases matched (small and volume pass, under copies.v2.json), no invalidations: `results/copies-run-7.json`. Accepts #839 after the #905 rebuild; run 6's C-04 match was a false positive (Q99, #839 issuecomment-6450407160). | yes, `recursively_absent: true` |

After run 7: **7 of 12 runs used, 2350 SDK calls recorded** (147 calls consumed by run 7). #839 accepted under copies.v2.json. Raw results for run 7 preserved.
