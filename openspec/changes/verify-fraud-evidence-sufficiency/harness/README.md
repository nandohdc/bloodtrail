# Stage P tracer — build only (#800 task 1.1)

**No Stage P probe has executed. Task 1.2 and S1 remain future work.** Stock
repository gates are routine CI, not Stage P runs. Tests here use only fixtures,
public-shape doubles and one dummy ESM package; they never import a kit package,
invoke the real pipeline or execute `probe-process.mjs`.

The seam is the packed public API installed outside the repository as an own
service, never repository dist imports or the kit examples. See
`../proposal.md#run-authorization`, [G38](https://github.com/nandohdc/bloodtrail/issues/795#issuecomment-6219739604)
and `run-ledger.md`. The owner's workstation is macOS/Apple Silicon with external
Node 26, driven by Tamandua/pi. G38 names no model; every driver lane is recorded.

## Build-only verification

One clean-tree pipeline dry run was performed at the preceding environment-only
commit, with harness source kept outside the repository. It built the governed
**distributable** kit, installed both SDK tarballs with an identical npm core
override, inspected both packed manifests for lifecycle scripts, and checked one
core real path through npm-ls and a recursive filesystem scan. Installed packed
`.d.ts` files were read **as text**, not imported. The exact identity commit,
digests, declaration hashes, runtime, single-copy paths and recursive deletion
proof are in the external task completion report, not a fabricated probe result.
Executed probe-file evidence in that dry run is explicitly not applicable.

The invocation form used from external source (do not repeat during task 1.1):

```bash
node "$EXTERNAL_SOURCE/kit-cli.mjs" --dry-run --repo "$REPO" \
  --approved-head "$CLEAN_ENVIRONMENT_COMMIT" \
  --driver-run-id "$TAMANDUA_RUN_ID" --driver-harness pi \
  --driver-provider "$PROVIDER" --driver-model "$MODEL" --driver-thinking "$THINKING"
```

It asserts a clean tree, HEAD equality and Node 26, invokes only the builder CLI
as a child, runs npm install without audit/fund, reads identity and declaration
text, and deletes its kit/service/archive/logs ancestor in `finally`. Its kit
digest is the SHA-256 of `checksums.sha256`, **not** the archive digest. SQLite
version and availability of `DatabaseSync.isTransaction` are checked with an
in-memory database that is closed immediately. No kit code or example is run.

The declarations cover core's factory, system identifier provider, four context
constructors, error/result and handle types/getters, named authentication method,
testing capturing sink/retention inspector, and the Node factory. Runtime error
codes/check order come from source, not declarations. Every case's `basis` lists
re-derived file:line ranges at the frozen `corrected_at` base, not draft line
numbers. Declaration reading is not execution evidence.

## Future execution — only after S1

An owner must first approve the **exact technical head** in an unedited comment.
The orchestrator fetches the comment's REST `body`, `html_url`, `created_at` and
`updated_at`, then confirms with the owner **in session** that the comment is
theirs. That out-of-band authentication is not performed or claimed by the
harness: its run/head/text binding is only a consistency check, with no GitHub
network calls. Reconcile the shared ten-run ledger and 5,000-occurrence limit.
Preserve the exact UTF-8 body without adding a newline; supply its original URL
and timestamps. An edited comment is invalid. The body must contain this exact
trimmed whole line (substitute the run number and lowercase 40-hex head):

```text
S1 approval: P-ids run <N> for #800 at <HEAD>
```

`--window-opened-at` is the first approval's `createdAt` across the Stage P
sequence, including for that first run. Approval creation may not predate it;
execution may not start later than seven days after it. Expiry needs an
authorization amendment. Never infer approval from green CI or proposal merge.

Reproduce from the result's `kit_identity.commit`; that commit must be the
approved head. For a new execution, obtain a **new** approval, never reuse a
once-marker under another path. Use a durable outside-repository control directory
(one marker path per approval hash), separate from the kit's disposable scratch.
No approval values are supplied by this build-only work.

```bash
git checkout --detach "$APPROVED_HEAD"
test -z "$(git status --porcelain)"
node --version
HARNESS=openspec/changes/verify-fraud-evidence-sufficiency/harness
node "$HARNESS/p-ids/run-p-ids.mjs" --repo "$PWD" \
  --approved-head "$APPROVED_HEAD" \
  --approval-body-file "$CONTROL/approval-body.txt" --approval-url "$APPROVAL_URL" \
  --approval-created-at "$CREATED_AT" --approval-updated-at "$UPDATED_AT" \
  --approval-sha256 "$APPROVAL_SHA256" --window-opened-at "$WINDOW_OPENED_AT" \
  --once-marker "$CONTROL/$APPROVAL_SHA256" \
  --run-number "$LEDGER_RUN_NUMBER" --results "$CONTROL/p-ids-results.json" \
  --driver-run-id "$TAMANDUA_RUN_ID" --driver-harness pi \
  --driver-provider "$PROVIDER" --driver-model "$MODEL" --driver-thinking "$THINKING"
```

Before claiming, preflight checks, in order: exact approval bytes/line, unedited
timestamps and window; clean repository and approved HEAD; the running
entrypoint's own Git checkout equals real `--repo`; an absent results path with
an existing writable parent; the marker naming/location; then every tracked
harness file's working bytes against the approved Git blob. The marker basename
must be exactly the approval body's SHA-256 (64 lowercase hex), with no prefix
or suffix; its real parent must be outside the real repository, resolving
symlinks. Refusals print a reason and create neither marker nor results, leaving
any existing result untouched. Only then is the once-marker exclusively created
(`wx`), before any kit build/probe spawn. The complete Git-blob/SHA-256 inventory
includes parent modules, entrypoints, tests, docs and expectations; copying probe
support does not replace it with a subset.

A claimed marker survives every later failure. After cleanup, the results write
is attempted once with `wx`; on write failure the complete JSON, including
provenance and observations, goes to stderr and the run exits nonzero, without
retrying that write. Cleanup failure preserves evidence and records an
invalidation with `scratch_deletion.recursively_absent: false`. Install lifecycle,
single-core and declaration evidence and identity artifacts survive in results.
The governed identity verifier runs in a child from the approved checkout;
the parent never imports the builder. The pipeline invokes:

```bash
node packages/security-audit-sdk-node/scripts/build-evaluation-kit.mjs --dest "$SCRATCH/evaluation-kit"
# Inside the sibling own-service, with two file: tarball dependencies and core override:
npm install --no-audit --no-fund
npm ls @bloodtrail/security-audit-sdk-core --all --json --long
# Each role, copied with all support files verified against approved Git blob bytes:
node --permission --allow-fs-read="$SCRATCH/own-service" \
  "$SCRATCH/own-service/harness/p-ids/probe-process.mjs" --role "$ROLE" --budget "$ROLE_BUDGET"
```

The last line is a future permission-constrained subprocess, **not** an instruction
to execute during this task. There is no network, child-process or fs-write grant.
Core's reported `import.meta.resolve` path must be within the own service. All
executed/support files have both approved Git-blob identity and SHA-256 recorded.
Harness logs are scratch-only. The builder's npm ci may use registry/cache;
probes and self-tests never use network, including loopback.

A refused P-ids-00 positive construction or core-A/core-B P-ids-01 emission
stops locally and prevents every later role spawn. Other SDK refusals retain raw
outcomes, end only their role and give their case an explained mismatch; later
roles still run. Budget exhaustion remains sticky through SDK provider-throw
containment: the triggering observation is attributed to a harness fault, not an
SDK finding, and stops the run. Process crashes, non-JSON/protocol errors and
resolution/copy failures also invalidate globally. Partial observations and invalidations are
written **after cleanup**, with a nonzero exit. Mismatches are findings, not run
failures: absent an invalidation, exit is zero regardless of mismatches. Never
repair one by changing v1 or rerunning under the same approval. Record the
actual count and run in the shared ledger during task 1.2, then commit only the
synthetic result inside this change, following owner review. S2/S3 still apply.

## Frozen plan and observations

`expectations/p-ids.v1.json` is immutable after this build commit. A correction
requires v2 and a new owner-approved execution. P-ids-04/09 are included and
P-ids-11 is analysis only by **owner decision, 2026-10-16**. Every other additional
choice is labelled an implementer default in the definitions. Cases 02/06 reuse
01; 05 is the original direct-provider/two-instance within-process control.
There are no added cases, fixed-seed predictions, clock-inequality promises,
collector imports or live exchange in P-ids. Boundary 3 is fixture-tested only.

The counting model includes every direct SDK/public factory, context constructor,
testing helper and direct provider call, plus every harness identifier-provider
callback, accepted or refused. SDK-internal default-provider invocations and
property reads are not additional harness calls. No shutdown or diagnostic SDK
calls are hidden. Successful fixture sequences consume the exact frozen budgets:

| process | occurrences |
|---|---:|
| setup | 28 |
| core-A / core-B | 107 / 106 |
| core-C / core-D | 12 / 12 |
| core-E / core-F | 9 / 10 |
| core-G / controls | 11 / 36 |
| node-A / node-B | 116 / 116 |
| node-C / node-D | 9 / 9 |
| core-H / core-I | 406 / 406 |
| total | 1393 |

Each process enforces its own allowance before every counted call; the parent
mechanically sums the plan and refuses totals over 5,000. Results preserve raw
per-process/per-field arrays, public call outcomes, captures, timestamps, actual
counts, approval metadata, runtime/environment, permission flags, file hashes and
scratch-deletion proof. They contain observations, not copied expected thresholds.
Factories/handles are represented by their public state/getters because functions
and private state are not JSON observations. No private inspection is performed.

## Fixture checks (no Stage P execution)

```bash
node --test openspec/changes/verify-fraud-evidence-sufficiency/harness/tests/
find openspec/changes/verify-fraud-evidence-sufficiency/harness -name '*.mjs' -exec node --check '{}' \;
```

The permission negative control installs a dummy package by writing fixture files,
proves its import succeeds, `process.permission.has("net")` is false, loopback
`net.connect` emits `ERR_ACCESS_DENIED` without a connection (with a failing timeout),
and DNS lookup rejects with `ERR_ACCESS_DENIED`, then proves deletion. The denial
is asynchronous on Node 26.11.1, not a synchronous throw (orchestrator brief
correction, 2026-10-16; not an owner decision). All data is opaque synthetic; the measured
address is documentation-range `203.0.113.10`. Pi/Tamandua transcripts persist
outside the repository with synthetic data only. This work claims no run, owner
approval, ledger entry, fraud verdict or deployment readiness.
