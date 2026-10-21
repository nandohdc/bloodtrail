# Stage P authorization ledger

Authorization: `../proposal.md#run-authorization` at each run's exact approved head.
[G38](https://github.com/nandohdc/bloodtrail/issues/795#issuecomment-6219739604)
supersedes G15. This ledger grants no approval.

G20/G34 limits are shared across all Stage P tickets: **10 runs**, at most
**5,000 occurrences per run**, within **7 days** of the owner's first run-approval
comment. Expiry requires an authorization amendment, never an extended window
by convention. The P-ids implementer-default accounting model and its 1,393-call
plan are frozen in `expectations/p-ids.v1.json`; accepted and refused calls count.

Window: opened at **2026-10-17T02:22:47Z**; closes at **2026-10-24T02:22:47Z** (UTC). Task 1.1's one build/install-only dry run is not a
Stage P execution, consumes no run number and creates no row below. Before task
1.2, the operator must reconcile this shared ledger with all probe tickets,
verify the first approval's window and the next run number, and obtain S1's
owner comment naming the exact head. S2 stops immediately on non-synthetic data
or a critical security defect. S3 reserves merge to the owner.

For each future execution, the exact trimmed approval line is
`S1 approval: P-ids run <N> for #800 at <HEAD>`. The orchestrator supplies the
REST body, URL and original creation/update timestamps, and the owner confirms
in session that the comment is theirs. Harness checks are consistency checks,
not author authentication, and make no network calls. Edited comments refuse.

Pass `--window-opened-at` equal to the first approval's `createdAt` throughout
the sequence. Results carry this window; approval creation before it or a start
after its seven-day boundary refuses before claiming. Reconcile the shared run
number out of band; ten runs and 5,000 occurrences per run remain the limits.
The once-marker basename is exactly the approving UTF-8 body's SHA-256, 64
lowercase hex without prefix/suffix. Its real parent is outside the real repo
and outside disposable scratch, including through symlink aliases.

Approval, repository/head, executing checkout, results destination, marker
location and complete tracked-harness byte verification all precede claiming.
A post-claim write failure emits complete result JSON to stderr once and exits
nonzero; cleanup failure records recursive absence as false without discarding
install evidence or observations. Neither permits reuse of the retained marker.

Under G39, #801–#804 approvals may be delegated, and each such row is marked `delegated (G39)`.

| run number | probe | ticket | approved head | approval URL | approval sha256 | occurrences | status |
|---|---|---|---|---|---|---|---|
| 1 | P-ids | #800 | ec192a5977e079089cb76b3595631dcb7d62aca3 | https://github.com/nandohdc/bloodtrail/issues/800#issuecomment-6228450746 | 988e6a8a26696a3b4e9f48450b873d94855902e1c8c6343136a0c24fc5c33e0c | 1393 | completed |
| 2 | P-D | #801 | 09847df832a0691152db290920c151152780ac33 | https://github.com/nandohdc/bloodtrail/issues/801#issuecomment-6231926171 | b13e97b32055f4c1c7ca3a189767900368c02fde3b6d7ceb8c6d50de9beca93f | 371 | completed, delegated (G39) |
| 3 | P-attr | #802 | 03d9df47675b611f051ae0938f0eef1f8b4cbe78 | https://github.com/nandohdc/bloodtrail/issues/802#issuecomment-6290595161 | e265daa97da1bd1978a16ad1bf64c60282d26784c04bd2f9d332af521993b973 | 2305 | completed, delegated (G39) |
| 4 | P-E | #803 | 9afdcb53bd8f73e5753bbd8daecb0f2f3ab63b03 | https://github.com/nandohdc/bloodtrail/issues/803#issuecomment-6308449511 | ab85ea0190938726389c0a91ba931f9ca2e5d5bd1031b17b263b2ce8f33288fe | 802 | completed, delegated (G39) |
| 5 | P-map | #804 | 18efa6d57756976c0973c7d28ecf91f68cce941b | https://github.com/nandohdc/bloodtrail/issues/804#issuecomment-6327356873 | 56d6e2587523e2355b17f75ca22d2a925fa6a164059595a739dd7e477f007332 | 623 | completed, delegated (G39) |

Pi and Tamandua transcripts persist outside the repository. They contain only
synthetic data. Kit, own service, builder archive and harness logs are disposable
scratch and are recursively deleted even on failure; the once-marker is retained
outside that scratch to prevent reuse of the same approval.
