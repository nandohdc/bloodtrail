# Stage P authorization ledger

Authorization: `../proposal.md#run-authorization` at each run's exact approved head.
[G38](https://github.com/nandohdc/bloodtrail/issues/795#issuecomment-6219739604)
supersedes G15. This ledger grants no approval.

G20/G34 limits are shared across all Stage P tickets: **10 runs**, at most
**5,000 occurrences per run**, within **7 days** of the owner's first run-approval
comment. Expiry requires an authorization amendment, never an extended window
by convention. The P-ids implementer-default accounting model and its 1,393-call
plan are frozen in `expectations/p-ids.v1.json`; accepted and refused calls count.

Window: **not yet opened**. Task 1.1's one build/install-only dry run is not a
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

| run number | probe | ticket | approved head | approval URL | approval sha256 | occurrences | status |
|---|---|---|---|---|---|---|---|

Pi and Tamandua transcripts persist outside the repository. They contain only
synthetic data. Kit, own service, builder archive and harness logs are disposable
scratch and are recursively deleted even on failure; the once-marker is retained
outside that scratch to prevent reuse of the same approval.
