# Stage 2 run ledger

Authorization: `../proposal.md#run-authorization` at each run's exact approved head, under
[G42](https://github.com/nandohdc/bloodtrail/issues/795#issuecomment-6346915049) as amended by [G46](https://github.com/nandohdc/bloodtrail/issues/833#issuecomment-6449640834). This ledger grants no
approval.

G42 limits, as amended by G46, are shared across every Stage 2 probe ticket (#836–#842): **16 runs**, at most **50,000 SDK calls per run** (accepted or refused; delivery attempts are recorded but not capped), within **14 days** of the first Stage 2 S1. The limit was 12 until the head that merges the G46 amendment; runs 1–7 executed under it, which their results pin (`executed_file_hashes` for `lib/results.mjs`). Expiry needs an authorization amendment, never a window extended by convention. Run slots: runs 1–9 as used (rows below); then, per G46 Q74, 10–12 #841 and 13–16 reserve. A reserve slot is used only under an owner disposition recorded on the probe ticket (G46, Q68). A reserve run's row cites its owner disposition beside the S1.

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

An owner disposition is an unedited comment on the probe ticket:

```
Owner disposition: <probe> run <N> for #<ticket>
```

The harness checks this line's form, not who posted it: every Stage 2 comment, including delegated S1s, is posted from the owner's account. Q68 requires the comment to record the owner's decision, audited from the ticket.

Run numbers are shared across the probes, 1 to 16. Every run claims its once-marker `run-<N>` in the one pinned
control directory, `~/.bloodtrail/stage-2/once-markers/`, so a run number cannot be spent twice. Dry runs are build-only: they are not
Stage 2 executions, consume no run number and create no row. Before each
S1, reconcile this ledger: runs used, ledger calls used (SDK calls, plus composition deliveries where a row records them), and time left in the window. For a rerun or a reserve slot, also confirm the owner disposition on the probe ticket (Q68). A failed run whose
results carry `occurrence_count: null` is entered at its `call_bound`. An S2 stop halts the run
and goes to the owner.

| Run | Probe | Ticket | Approved head | S1 comment | Calls | Result | Scratch deleted |
|---|---|---|---|---|---|---|---|
| 1 | S2-tracer | #836 | 693c18d671e4cfdc685c0b95930bb4be1eaf63c9 | https://github.com/nandohdc/bloodtrail/issues/836#issuecomment-6365806337, delegated (G44) | 1 | 7 of 7 cases matched, no invalidations: `results/tracer-run-1.json` | yes, `recursively_absent: true` |
| 2 | S2-outages | #837 | c23b98388f8b3e33159d2ca0d350e63587481047 | https://github.com/nandohdc/bloodtrail/issues/837#issuecomment-6372110299, delegated (G44) | 510 | 14 of 14 cases matched (small pass gated the volume pass, which completed), no invalidations: `results/outages-run-2.json` | yes, `recursively_absent: true` |
| 3 | S2-load | #838 | 1949518c5501f40482ec489fca86f9ad1b678e69 | https://github.com/nandohdc/bloodtrail/issues/838#issuecomment-6390168250, delegated (G44) | 46 | 7 of 17 cases matched; 4 executed small cases mismatched (L-04, L-07, L-10, L-11), 6 volume cases unexecuted; no invalidations: `results/load-run-3.json`. Strict timing finding #890; absence-evaluator defect #889. | yes, `recursively_absent: true` |
| 4 | S2-load | #838 | 9b3b91e54c1966b6da2c885c39eb80d5bce67192 | https://github.com/nandohdc/bloodtrail/issues/838#issuecomment-6433189870, delegated (G44) | 1456 | 17 of 17 cases matched (all 11 small-pass cases and all 6 volume-pass cases), no invalidations: `results/load-run-4.json` | yes, `recursively_absent: true` |
| 5 | S2-copies | #839 | e71716ed75a27f67d9fbf9ec05cdce0f2f4dfa72 | https://github.com/nandohdc/bloodtrail/issues/839#issuecomment-6445622978, delegated (G44) | 145 | 0 of 11 cases matched; 1 invalidation (sender process error: planted-defect control failed before traffic: copies_checks due to missing holds property, #902): `results/copies-run-5.json` | yes, `recursively_absent: true` |
| 6 | S2-copies | #839 | ac6c5516cca96ea3f70cd054541415160598a9d7 | https://github.com/nandohdc/bloodtrail/issues/839#issuecomment-6447734314, delegated (G44) | 45 | 8 of 11 cases matched (small pass mismatched C-06 and C-10; C-11 volume pass skipped), no invalidations: `results/copies-run-6.json`. Port continuity and isolation evaluator finding #905. | yes, `recursively_absent: true` |
| 7 | S2-copies | #839 | 707b1dc9abc67fb8b58d5564d5727dbbbda74f00 | https://github.com/nandohdc/bloodtrail/issues/839#issuecomment-6465595030, delegated (G44); body sha256 `f1c359a6f6b90ded3e5a2a643b82741b0b4754a198be9a23ad61667566a4b257`, byte-exact | 147 | 11 of 11 cases matched (copies.v2.json), no invalidations: `results/copies-run-7.json`. Disclosures: the S1 listed storage_less under the volume pass, but copies.v2.json freezes it in the small pass, where it ran; C-08 measures the 32-identity capacity and its at-capacity outcome, while the five-minute retention is the collector's documented bound, not measured (frozen 120 s deadline); the accounting identity is reported for consumer_restart only (finding #910); port continuity across the collector restart holds by construction (one listening server) and is not separately recorded. Run 6's C-04 and C-07 matches were false positives (Q99; #839 issuecomment-6450407160, #905 issuecomment-6453644518). | yes, `recursively_absent: true` |
| 8 | S2-chains | #840 | 2aa872fd7bb0cb9539dad47338e7535851cda25a | https://github.com/nandohdc/bloodtrail/issues/840#issuecomment-6484929790, delegated (G44); body sha256 `dfadd8f2e48242b6c2a85db8ebfc6573109970aa79b69a8f011f04bcbb5a1adc`, byte-exact | 792 | 11 of 11 cases matched (chains.v1.json; small and volume pass completed), no invalidations: `results/chains-run-8.json`. The 792 SDK calls include the operation calls of the transaction-bound events. The run had 396 occurrences (36 small, 360 volume). R-01 to R-05's evaluated counts are the small pass's; R-02's merged count and R-11's unexplained total sum both passes. Every comparison held for both passes; R-09's evaluator reads the small pass, and the volume pass's planted controls also hold in the raw results. | yes, `recursively_absent: true` |
| 9 | S2-outbox | #842 | 3360e7fbcb28ebc9850667b9beae12108dae653e | https://github.com/nandohdc/bloodtrail/issues/842#issuecomment-6525476160, delegated (G44); body sha256 `230b036b8d8c7b1b7c114d46aa9dc2af8472618bb564368f0e4d188781804845`, byte-exact | 539 | 11 of 11 cases matched (outbox.v1.json; small and volume passes completed), no invalidations: `results/outbox-run-9.json`. The 539 ledger calls comprise 402 SDK calls and 137 composition deliveries, including 12 to recording-stub controls. The relay restart is in-process. The SDK operation is marked committed while the SQLite transaction remains open; the host subsequently commits it in commit phases and rolls it back in the rollback phase (Q245, #921). Harness basis citations resolve at the approved run head, not the frozen base (#921). H-06 observes an event-ID duplicate and transaction IDs correlated with host rows; it does not establish an independently effective transaction-ID deduplication key (#921). The raw result declares `codex` and `gpt-6-family (exact identifier unavailable)`; after execution, the Codex session's turn metadata identifies the model as `gpt-6.1-terra` (https://github.com/nandohdc/bloodtrail/issues/842#issuecomment-6531178575). The raw result and S1 remain unchanged. The S1 records the specified Claude review of the final head as `NOT_PERFORMED`, with Codex analysis in its place, although G44 names review as a precondition of a delegated S1. The Codex driver lane rests on the continuation record merged by #924, which states that it is not a separately authored owner approval. A later evidence review does not retroactively satisfy that precondition. | yes, `recursively_absent: true` |

After run 9: **9 of 16 runs used, 3681 ledger calls recorded**: 3544 SDK calls or charged bounds, including run 5's 145-call bound, and 137 composition deliveries. Runs 1–8 contain SDK-call counts or charged SDK-call bounds only; run 9 records both kinds. Seven slots remain: 10–12 for #841 and 13–16 as reserve, with owner disposition required for reserve use (G46 Q68). Raw results for runs 1–9 are preserved.
