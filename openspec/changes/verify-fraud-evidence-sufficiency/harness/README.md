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

## P-E database scratch permission planning (#803 build only)

Plan/proposal: the synthetic host database is harness-local `node:sqlite`, not
Bloodtrail storage or a Bloodtrail outbox, and is deleted with pipeline scratch.
Only a plan declaring `databaseScratch: true` opts in. Implementer defaults:
allocate `<scratch>/host-database`, a sibling of `own-service`; pass its canonical
path as `--database-directory` to that plan's child processes. Real-path checks
refuse protected trees, overlapping roots, traversal and symlink escapes before
launch. This declaration accepts no directory list or arbitrary permission grant.

The exact opted-in flags are `--permission`, `--allow-fs-read=<own-service>`,
`--allow-fs-write=<database-directory>`, in that order. The write grant confines
only the harness's `fs` reserve (`openSync(..., "wx")`) and unlink operations.
On Node 26.12.0, `node:sqlite` file access is not enforced by the permission
model; database placement rests on `p-e/host.mjs` path checks before SQLite
opens a file. Native fixtures commit, roll back and reopen without a database
read grant, so none is added (implementer default). No network, child-process or
native-addon grant is added. P-ids, P-D and P-attr keep their original two flags.
Actual flags remain in provenance/results; the existing evidence-preserving
scratch finalizer removes the database ancestor on success or failure. These are
fixture-only checks, not authorization or P-E run evidence.

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

## P-D build only — #801 task 2.1

P-ids run 1 is now historical evidence in `results/p-ids-run-1.json`; the earlier
sections describe its original build handoff. **P-D has not executed.** Only task
2.1 is completed here; task 2.2 needs a new exact-head S1 approval. No P-D result
or execution-ledger row is created. Expectations are hypotheses, never measurements.

The single P-D build/install-only dry run occurred at the clean G39 documentation
commit, before any P-D edits. This is its reproduction form, **not permission to
repeat it during this build**:

```bash
node openspec/changes/verify-fraud-evidence-sufficiency/harness/kit-cli.mjs --dry-run --repo "$PWD" --approved-head "$(git rev-parse HEAD)" --driver-run-id run-306a948c-b2f7-4412-b3f9-db4c647ce36d --driver-harness pi --driver-provider openai-codex --driver-model gpt-6.1-sol --driver-thinking high
```

It built/installed only; installed `.d.ts` text was observed externally before
scratch deletion, without importing or executing installed kit/SDK code. Identity,
digests, single-core manifests/realpath, declaration text/hashes and recursive
scratch absence are in the external completion evidence. No dry-run artifact is
committed. Declaration inspection includes Node factory/provider; core constants,
catalog/methods, constructors, frame helpers, error/result/configuration types,
validators; testing capturing sink; all 15 transaction-bound methods and the
operation APIs/getters/reflection methods. No public package is imported by the
fixture tests, evaluator, expectation validator or parent runner.

### Future P-D execution, only after exact-head S1

[G39](https://github.com/nandohdc/bloodtrail/issues/795#issuecomment-6228616880)
allows the orchestrator to post a delegated approval for #801–#804 only after
head verification (full TEST_CMD, 10/10 CI, review and frozen expectation hash).
The new unedited comment contains these exact whole lines, substituting the run
number and exact lowercase 40-hex head:

```text
S1 approval: P-D run <N> for #801 at <HEAD>
Delegated S1 under G39
```

Both whole lines trim surrounding whitespace and accept LF or CRLF; the hash
still covers the exact original UTF-8 bytes. The approval URL must name a comment
on the probe's own ticket (#801 for P-D), whether an issue or PR URL. A delegation
line is refused before claim outside #801–#804: G39 does not cover #800 or any
other ticket. Results record `delegation: "G39"` when that line is present on a
covered ticket, otherwise null. Near-match text does not delegate. The operator verifies
authority out of band; the harness performs no GitHub/network authentication.
Exactly one execution per approval; reconcile the shared ledger first. The G34
window opened 2026-10-17T02:22:47Z and closes 2026-10-24T02:22:47Z; expiry needs an
amendment, never an extended timestamp. S2 and all volume/data limits remain.

From that verified approved head, a future authorized operator supplies **all**
arguments (the values below are placeholders, not approval):

```bash
git checkout --detach "$APPROVED_HEAD"
test -z "$(git status --porcelain)"
HARNESS=openspec/changes/verify-fraud-evidence-sufficiency/harness
node "$HARNESS/p-d/run-p-d.mjs" --repo "$PWD" \
  --approved-head "$APPROVED_HEAD" \
  --approval-body-file "$CONTROL/approval-body.txt" --approval-url "$APPROVAL_URL" \
  --approval-created-at "$CREATED_AT" --approval-updated-at "$UPDATED_AT" \
  --approval-sha256 "$APPROVAL_SHA256" --window-opened-at "$WINDOW_OPENED_AT" \
  --once-marker "$CONTROL/$APPROVAL_SHA256" \
  --run-number "$LEDGER_RUN_NUMBER" --results "$CONTROL/p-d-results.json" \
  --driver-run-id "$TAMANDUA_RUN_ID" --driver-harness pi \
  --driver-provider openai-codex --driver-model gpt-6.1-sol --driver-thinking high
```

The shared session runner preserves P-ids' complete preclaim checks, full tracked
Git-blob inventory, retained once-marker, child-process governed identity check,
single-core install evidence, permission-constrained child and evidence-preserving
write/deletion failure handling. There is no probe network, filesystem-write or
child-spawn permission. The runner copies only approved bytes into the installed
outside-repository own service. No change to P-ids run-1 evidence or v1 expectations.

### Frozen P-D plan

`expectations/p-d.v1.json` is frozen in this build commit before any execution.
After this handoff, corrections require v2 and a new approval/run; never change v1
to match observations. Its 66 cases preserve comment transcription order,
including all appended review cases and 148 uniquely keyed steps. Every basis was
re-derived at the pinned `corrected_at` base. The static B-MR baseline is justified
by the accepted `mfaRemoved` conformance row and its fixtures, schema and semantic
rules; no trial execution or runtime repair was used.

| correction | draft | frozen hypothesis and reason |
|---|---|---|
| PD-C9 | Non-success with no handle accepted with inferred committed state (gap) | Returned PREMATURE_SUCCESS/validation at /operation/state, no sink; #797 owner decision, all 35 supported combinations across 15 events, including partial/cancelled |
| PD-C11 basis | Could imply the custom invalid-receiver message | Raw native V8 TypeError name/message; the draft skeptic explained why the private-brand check runs first |
| check ordering | Missing semantic prechecks/derived provenance | Include skeptic correction, #811 provider containment, #816 configured runtime and #812 final outcome consistency |

C2–C5/C10/C12/C13 retain their drafted outcomes after explicit #812 review; their
earlier checks still win or their accepted committed success remains consistent.
No new #812 case or deliberate two-copy installation is added. A7 uses core's
free helper with the Node provider explicitly. D3 b2 and D10 remain bypass
observations; all prohibited keys/values are labelled synthetic marker recipes,
assembled from fragments only at runtime, including expected diagnostic paths.
The complete eleven corrected limits and case mappings are in
`p-d/cannot-establish.md` (including host non-empty presence, corrected commit
truth, and unbranded client-evidence/event/retry fields).

One **integrity** process executes sequentially because Node shares one ALS
provider. PD-00 and PD-01 run first; refusal or absent capture invalidates/stops.
PD-01's exact completed handle/SDK are retained for C12/C13. Every other SDK
acceptance/refusal/raw reflection throw is an observation, not a stop; harness
faults and sticky provider-callback budget exhaustion invalidate globally.
Captured events are cloned before mutation. Evaluation deep-strict-compares exact
diagnostics, surfaces, sink deltas/frozen state and drafted event/callback/handle
assertions, keyed by harness step id, and quotes observed/expected mismatches.

The implementer-default accounting model counts every direct SDK/testing factory,
constructor, context/frame helper, validator, named/generic call, operation or
reflection invocation, error toJSON and harness transformation callback, before
invocation, including refusals. SDK-internal calls/default providers and property
reads do not count again; there are no hidden teardown calls. Descriptor counts
sum mechanically to a **371-call prediction**; per-case predictions remain
frozen in `calls_by_case` and `predicted_total`. The integrity process and total
allowance is **742**, twice the prediction and below 5,000, to provide headroom
for unexpected outcomes. Results place observed ledger-label counts beside each
case's prediction. A count deviation is a mismatch note, never an invalidation
unless the process allowance is exceeded; exhaustion remains sticky. Public-shape
fixtures reproduce the predictions, including callback and error-method calls.

Evaluation uses real runtime-assembled synthetic markers in memory. Only at results
serialization, every occurrence in nested keys and values (including retained
processes, diagnostic paths and mismatch notes) becomes `<synthetic-marker:NAME>`.
Longest complete markers are replaced first, without partial overlapping matches.
The `synthetic_markers` table records each recipe name, actual length and SHA-256,
not its assembled value. The same serialization protects write-failure stderr
evidence; observations and evaluation inputs are never rewritten. P-ids evidence
and serialization are unchanged.

New offline tests cover all frozen expectations, A–F negative evaluator mutations,
missing/duplicate/wrong-surface records, baseline stop/ordinary continuation,
sequential shared-provider/retained-handle dependencies, exact budgets and sticky
exhaustion, P-D approvals/delegation/preflight/once semantics, evidence-preserving
failures, runtime marker recipes and static literal hygiene. They execute no
probe, installed SDK or real pipeline and use no network.

## P-attr build only — #802 task 3.1

P-ids run 1 and P-D run 2 are historical evidence in `results/`; the earlier
sections describe their build handoffs. **P-attr has not executed.** Only task
3.1 is completed here; task 3.2 (the run) needs a new exact-head S1 approval,
delegated to the orchestrator under G39. No P-attr result or execution-ledger
row is created, and no historical result, expectation or ledger row changes.

### Sole dry run — history, not permission

The single P-attr build/install-only dry run occurred at the clean pinned base
`cc4fdf5a3309db5077b85c4954c916b9ba902b8e`, before any P-attr edit. This is its
reproduction form, **not permission to repeat it during this build**:

```bash
node openspec/changes/verify-fraud-evidence-sufficiency/harness/kit-cli.mjs --dry-run --repo "$PWD" --approved-head "$(git rev-parse HEAD)" --driver-run-id run-90407814-cdd4-41fd-899f-124a5b90e7ad --driver-harness pi --driver-provider openai-codex --driver-model gpt-6.1-sol --driver-thinking high
```

It built/installed only; installed packed `.d.ts` files were read as text
externally before scratch deletion, never imported or executed. Evidence:
`identity.commit` is `cc4fdf5a3309db5077b85c4954c916b9ba902b8e` (the base),
`distributable` true, kit digest
`6c62fbfe5e558631af3eebfc07f86aa3a867cf40b61a643b858bd5331c97c992`, package-set
digest `612a1f1c986163eae51879af37be5f68857f50a1c6b0024a1996930685ef45c6`,
exactly one core copy under both npm-ls and a recursive filesystem scan, and
scratch recursively absent after deletion. No dry-run artifact is committed.

The 32 declaration symbols checked against the retained `.d.ts` text (not
imports): CONTRACT_VERSION, createNodeSecurityAuditSdk,
createCapturingAuditSink, anonymousActor, claimedActor, authoritativeActor,
authenticatedHumanActor, authenticatedPrincipal, authoritativeSubject,
credentialReference, authoritativeTenant, claimedTenant, authoritativeResource,
authenticationEvidence, authorizationEvidence, sessionEvidence, observedSource,
authenticationFailed, authenticationSucceeded, passwordResetRequested,
accountRegistrationAttempted, AuditContextFrameInput, AuthoritativeActorInput,
SecurityAuditSdk, NodeSecurityAuditSdkConfiguration, AuditResult,
SecurityAuditSdkError, CapturingAuditSink, AuditTransformationInput,
AuditTransformationOutput, AuditFieldTransformationHook,
SecurityAuditSdkConfiguration.

G38 names no model, so every driver lane is recorded. The sole dry run used
`openai-codex`/`gpt-6.1-sol` with thinking high. This build ran US-001 through
US-007 on `openai-codex`/`gpt-6.1-sol` (thinking high) and US-008/US-009 on pi
with `deepseek/deepseek-v4-pro` (thinking max).

### Build-only fixtures

Every P-attr test is offline and uses public-shape doubles; no test imports a
kit/SDK package, executes a probe entrypoint, runs the real pipeline or uses
network. The only harness files that may import `@bloodtrail/*` packages are the
three future permission-constrained probe processes
(`p-ids/p-d/p-attr/probe-process.mjs`). Static scope tests pin: entrypoint
imports are local harness modules only; no test imports or spawns a probe/CLI
entrypoint; every address literal in P-attr sources, P-attr tests and the
P-attr expectations is documentation range (192.0.2.0/24, 198.51.100.0/24,
203.0.113.0/24, 2001:db8::/32) and every identifier opaque synthetic; the
P-attr expectations hold no serialized HMAC key or digest; the explicit
inventory covers every lib/p-attr module; and historical results, expectations
and the ledger keep frozen digests.

### Frozen P-attr plan

`expectations/p-attr.v1.json` is frozen in this build commit before any
execution. Its SHA-256 is
`2954363d03a7e321c0ca379963eb554deedc3a6489b71b4432b5166749777887`. After this
handoff, corrections require v2 and a new approval/run; never change v1 to
match observations. It holds 73 case ids in documented #802 comment order (62
drafted + 10 review-added + 1 implementer-default AF-F4), 149 matrix steps with
exact surface/diagnostic or acceptance plus sink count plus axes, and 16
`corrected_from` entries; every basis is re-derived at the frozen `corrected_at`
base. The four axes are provenance ambiguity, resource-rule class
(conforms/circumvents/violates), existence disclosure and field-meaning misuse;
the in-occurrence flag is scoped as corrected (actor.id policy compared with
in-event trust only when actor.id is present), and linkage runs over the eleven
declared join pairs in the header. Every synthetic value is tagged with its
true origin — CP client-presented, SR server-resolved or SC server-computed —
and provenance ambiguity compares that origin against the published
field-policy trust/authority for present fields only.

The counting model predicts 2,305 public calls (1,199 matrix + 1,106 linkage,
plus 31 linkage-setup calls inside the linkage budget) with an explicit
one-process allowance of 4,610, at most 5,000. Every public call counts before
invocation, including refusals. A deviation within the allowance is a note,
never an invalidation; allowance exhaustion is sticky and stops the run. One
sequential matrix process runs; captured events are cloned before mutation and
fresh SDK instances are used as cases need. The seven positive controls (AF
ex/nx, AS ex, PR ex/nx, RA ex/nx) run first: any baseline refusal, throw or
absent capture invalidates the global precondition and stops the run. The
deliberate hook preconditions (an async hook refused with
SDK_UNSUPPORTED_HOOK_RESULT, a hook instance with no tenant refused with
SDK_HOOK_FAILURE) and every other acceptance, refusal or throw are
observations.

Per-run HMAC keys come from crypto.randomBytes, exist only in a closure, and
are never written to the kit, a database, logs or results. Results record only
the key's purpose and a key id that is not derived from the key. Expectations
hold keyed targets structurally (`{key_scope, input_origin, digest_format}`),
never digests; the probe reports `matches_declared_input` booleans plus the
format, and the evaluator compares structure and booleans. Mismatches are
findings, not run failures: absent an invalidation, exit is zero regardless of
mismatches, and a mismatch never repairs v1 or reruns under the same approval.

### Future P-attr execution, only after exact-head S1

[G39](https://github.com/nandohdc/bloodtrail/issues/795#issuecomment-6228616880)
allows the orchestrator to post a delegated approval for #801–#804 only after
head verification (full TEST_CMD, 10/10 CI, review and frozen expectation
hash). The new unedited comment contains these exact whole lines, substituting
the run number and exact lowercase 40-hex head:

```text
S1 approval: P-attr run <N> for #802 at <HEAD>
Delegated S1 under G39
```

Both whole lines trim surrounding whitespace and accept LF or CRLF; the hash
covers the exact original UTF-8 bytes. The approval URL must name a comment on
#802. Results record `delegation: "G39"`. The G34 window is unchanged: opened
2026-10-17T02:22:47Z, closes 2026-10-24T02:22:47Z, with the shared ten-run and
5,000-occurrence-per-run limits; expiry needs an amendment, never an extended
timestamp. S2 and all volume/data limits remain.

From that verified approved head, a future authorized operator supplies **all**
arguments (the values below are placeholders, not approval):

```bash
git checkout --detach "$APPROVED_HEAD"
test -z "$(git status --porcelain)"
HARNESS=openspec/changes/verify-fraud-evidence-sufficiency/harness
node "$HARNESS/p-attr/run-p-attr.mjs" --repo "$PWD" \
  --approved-head "$APPROVED_HEAD" \
  --approval-body-file "$CONTROL/approval-body.txt" --approval-url "$APPROVAL_URL" \
  --approval-created-at "$CREATED_AT" --approval-updated-at "$UPDATED_AT" \
  --approval-sha256 "$APPROVAL_SHA256" --window-opened-at "$WINDOW_OPENED_AT" \
  --once-marker "$CONTROL/$APPROVAL_SHA256" \
  --run-number "$LEDGER_RUN_NUMBER" --results "$CONTROL/p-attr-results.json" \
  --driver-run-id "$TAMANDUA_RUN_ID" --driver-harness pi \
  --driver-provider "$PROVIDER" --driver-model "$MODEL" --driver-thinking "$THINKING"
```

The shared session runner preserves P-ids/P-D's complete preclaim checks, full
tracked Git-blob inventory, retained once-marker, child-process governed
identity check, single-core install evidence, permission-constrained child and
evidence-preserving write/deletion failure handling. There is no probe network,
filesystem-write or child-spawn permission. No change to P-ids run-1 or P-D
run-2 evidence, their v1 expectations or the ledger's existing rows; this
build-only handoff claims no run, approval, ledger entry, fraud verdict or
deployment readiness.

## P-E build only — #803 task 4.1

P-ids run 1, P-D run 2 and P-attr run 3 are historical evidence in `results/`;
the earlier sections describe their build handoffs. **P-E has not executed.**
Only task 4.1 is completed here; task 4.2 (the run) stays gated behind a new
exact-head S1 approval, delegated to the orchestrator under G39. No P-E result,
expectation-hash observation or execution-ledger row is created, and no
historical result, expectation or ledger row changes.

### Sole dry run — history, not permission

The single P-E build/install-only dry run occurred at the clean pinned base
`abcbefa03d5b0afc610deb712d7f4ded5a9e82be`, before any P-E edit. This is its
reproduction form, **not permission to repeat it during this build**:

```bash
node openspec/changes/verify-fraud-evidence-sufficiency/harness/kit-cli.mjs --dry-run --repo "$PWD" --approved-head "$(git rev-parse HEAD)" --driver-run-id run-29cdaf98-9cf3-4d7b-9633-059867ffa795 --driver-harness pi --driver-provider openai-codex --driver-model gpt-6.1-sol --driver-thinking high
```

It built/installed only; installed packed `.d.ts` files were read as text
externally before scratch deletion, never imported or executed. Evidence:
`identity.commit` is `abcbefa03d5b0afc610deb712d7f4ded5a9e82be` (the base),
`distributable` true, kit digest
`ccdf852af37efc02b828f7d21bc7cda1cf825b4348e904692aafc3df0e4ca26e`, package-set
digest `612a1f1c986163eae51879af37be5f68857f50a1c6b0024a1996930685ef45c6`,
exactly one installed core copy under both npm-ls and a recursive filesystem
scan, and scratch recursively absent after deletion. All 34 observed packed
declaration text hashes match the pipeline's installed evidence. No dry-run
artifact is committed; the full declaration audit lives in the external
completion evidence.

The 62 symbols checked as retained `.d.ts` text (not imports): CONTRACT_VERSION,
createNodeSecurityAuditSdk, NodeSecurityAuditSdkConfiguration, SecurityAuditSdk,
NamedSecurityAuditApi, AuditResult, AuditDeliveryResult, SafeAuditError,
SecurityAuditSdkError, createCapturingAuditSink, CapturingAuditSink,
CapturingAuditSinkOptions, AuditEventSink, authenticatedHumanActor,
authoritativeTenant, authoritativeSubject, authenticationEvidence,
authorizationEvidence, authoritativeResource, anonymousActor, observedSource,
beginOperation, mfaRemoved, authenticationFailed, redeliver, AuditOperationInput,
AuditOperationHandle, AuditOperationSnapshot, AuditOperationState, operationId,
transactionId, correlationId, boundEvent, transactional, state, snapshot,
markCommitted, markNotCommitted, markPartiallyCommitted, markCompensated,
markCancelled, MfaRemovedEventInput, AuthenticationFailedEventInput,
RetryRelationshipInput, RedeliveryInput, createTransactionCriticalDelivery,
TransactionCriticalDelivery, TransactionCriticalDeliveryOptions,
TransactionCriticalDeliveryResult, BusinessCommitGate, DeliveryClassGuarantees,
durabilityProbe, createHttpDeliveryHandoff, HttpDeliveryHandoff,
HttpDeliveryHandoffOptions, HttpDeliveryHandoffResult, HttpExchange,
HttpExchangeRequest, HttpExchangeOutcome, HttpAcknowledgment, handoff, deliver.

G38 names no model, so every driver lane is recorded. The sole dry run used
`openai-codex`/`gpt-6.1-sol` with thinking high. This build ran US-001 through
US-004 on `openai-codex`/`gpt-6.1-sol` (thinking high); US-004 verification,
US-005, US-006 and US-007 up to its interruption on `deepseek/deepseek-v4-pro`
(thinking max); US-007 from its resumption through US-010, and US-011 up to its
interruption, on `openai-codex`/`gpt-6.1-sol`; and US-011 from its resumption
and every later story on `deepseek/deepseek-v4-pro`. No single lane is claimed
for the whole build.

- review fixes G3, G5, G6 and the probe side of G1 (Tamandua run-7ba34714-6905-4883-a37c-dd1d25f9e7cd): `deepseek/deepseek-v4-pro, thinking max`.
- review fixes: the evaluator side of G1, G2, G4, G7 and the fixup verification (Tamandua run-7ba34714-6905-4883-a37c-dd1d25f9e7cd): `openai-codex/gpt-6.1-sol, thinking high`.
- review fix G8: the P-E-6 parking flag left unfrozen (Tamandua run-231ec5fd-ae55-4a37-b420-bb0ed167693f): `openai-codex/gpt-6.1-sol, thinking high`.

### Frozen P-E plan

`expectations/p-e.v1.json` is frozen in this build commit before any execution.
Its SHA-256 is recorded in the results at run start, never before. After this
handoff, corrections require v2 and a new approval/run; never change v1 to match
observations. It holds all 32 case ids in #803 comment 6137619745 transcription
order (23 drafted plus 9 review-added, ending with P-E-x3), 232 uniquely keyed
planned steps, per-step result shapes/counters/assertions and per-case summary
aggregates. Every basis is re-derived at the frozen `corrected_at` base; changed
line numbers live in `basis`, never in `corrected_from`.

| correction | draft | frozen hypothesis and reason |
|---|---|---|
| P-E-1f | Accepted handle-less failure with outcome-derived `committed` | Returned PREMATURE_SUCCESS/validation at /operation/state, no sink; #797 removed the outcome-derived commit default |
| P-E-4 | Nothing links a corrective record to the false one | A fresh handle can carry the false handle's transactionId/correlationId and a retry's original_event_id can point at the false occurrence; the SDK just never requires or checks the link |
| P-E-10b(ii) | Retry on the rolled-back handle accepted | Sequenced after P-E-10 the handle is compensated: PREMATURE_SUCCESS/validation at /event/commit_state; options (i), both (iii) paths and (iv) unchanged |
| P-E-adm | Admission used P-E-1f's handle-free occurrence | Legitimate handle-backed occurrence with explicit undefined/empty caller ids; refusal outcomes unchanged |

P-E-6's parking deferred is created before d1 starts and released explicitly in
a finally (the skeptic's harness hazard); gate/exchange timing at d2 resolution
stays an observation. The parking flag `exchange_entered_after_release` is
recorded raw and never frozen; `parking.released` and the final 1/1/1 totals
stay frozen. Its d2 step
explicitly marks `counters`, `callback_order` and `exchange` metadata as
`observed_not_frozen`: d1 can enter its exchange before d2's refusal settles.
The refusal result, immediate synchronous probe count and final totals remain
checked; the overlapping exchange attempts stay in raw observations. The four
expected findings are P-E-x2 (the gate fails open on anything but exactly
"declined"), P-E-9c (a deferred insert past synchronous ROLLBACK persists an
orphan row), P-E-6c (two occurrences sharing one transaction id run the gate
twice) and P-E-3a (`committed_and_durable` labels a `not_committed` occurrence).
The observation that `durabilityAttempted` can be true without an exchange call
is recorded as a note for a later Node-binding change, not as a case.

The counting model predicts **802 public calls**; every per-case prediction is
frozen in the case's `predicted_calls`, and they sum mechanically to
`predicted_total`. One sequential process runs with an allowance of **1,604**
(twice the prediction) and the shared 5,000-occurrence cap. A deviation within
the allowance is a note, never an invalidation; allowance exhaustion is sticky
and stops the run. Baselines P-E-g and P-E-adm run first: a guarantees or
construction/capture refusal there invalidates the precondition and stops every
remaining case. Evaluation is layered-total: malformed planned rows become
mismatch notes, raw observations are always retained, and an inconclusive row
never voids an unrelated verdict. Expected findings and mismatch notes are
observations, not expectation edits.

The synthetic host database is harness-local `node:sqlite` under the pipeline
scratch (`<scratch>/host-database`), neither Bloodtrail storage nor a Bloodtrail
outbox, and it is deleted with the scratch in a finally. The exact planned
child flags, in order, are `--permission`, `--allow-fs-read=<own-service>`,
`--allow-fs-write=<pipeline-scratch>/host-database`; no network, child-process,
native-addon or database-read grant is added. This write grant confines only
the harness's `fs` reserve and unlink, not SQLite. On Node 26.12.0, `node:sqlite`
file access is not enforced by the permission model; database placement rests
on `p-e/host.mjs` path checks. Neither SDK package imports `node:sqlite`.
The provenance recorder confirms `db.isTransaction` on the Node 26 runtime
through `lib/runtime-facts.mjs`. All data is opaque synthetic, addresses stay
in the documentation ranges, and no
per-run HMAC key, secret or prohibited marker is persisted.

### Future P-E execution, only after exact-head S1

[G39](https://github.com/nandohdc/bloodtrail/issues/795#issuecomment-6228616880)
allows the orchestrator to post a delegated approval for #801–#804 only after
head verification (full TEST_CMD, 10/10 CI, review and frozen expectation
hash). The new unedited comment contains these exact whole lines, substituting
the run number and exact lowercase 40-hex head:

```text
S1 approval: P-E run <N> for #803 at <HEAD>
Delegated S1 under G39
```

Both whole lines trim surrounding whitespace and accept LF or CRLF; the hash
covers the exact original UTF-8 bytes. The approval URL must name a comment on
#803. Results record `delegation: "G39"` when the line is present. The G34
window is unchanged: opened 2026-10-17T02:22:47Z, closes 2026-10-24T02:22:47Z,
with the shared ten-run and 5,000-occurrence-per-run limits; expiry needs an
amendment, never an extended timestamp. S2 and all volume/data limits remain.

From that verified approved head, a future authorized operator supplies **all**
arguments (the values below are placeholders, not approval):

```bash
git checkout --detach "$APPROVED_HEAD"
test -z "$(git status --porcelain)"
HARNESS=openspec/changes/verify-fraud-evidence-sufficiency/harness
node "$HARNESS/p-e/run-p-e.mjs" --repo "$PWD" \
  --approved-head "$APPROVED_HEAD" \
  --approval-body-file "$CONTROL/approval-body.txt" --approval-url "$APPROVAL_URL" \
  --approval-created-at "$CREATED_AT" --approval-updated-at "$UPDATED_AT" \
  --approval-sha256 "$APPROVAL_SHA256" --window-opened-at "$WINDOW_OPENED_AT" \
  --once-marker "$CONTROL/$APPROVAL_SHA256" \
  --run-number "$LEDGER_RUN_NUMBER" --results "$CONTROL/p-e-results.json" \
  --driver-run-id "$TAMANDUA_RUN_ID" --driver-harness pi \
  --driver-provider "$PROVIDER" --driver-model "$MODEL" --driver-thinking "$THINKING"
```

The shared session runner preserves the complete preclaim checks, full tracked
Git-blob inventory (every P-E module plus the shared lib chain, including
`lib/import-closure.mjs`, verified by `validateProbeInventory` **before** any
claim or marker), retained once-marker, child-process governed identity check,
single-core install evidence, permission-constrained child with the exact
database-write grant above, and evidence-preserving write/deletion failure
handling. There is no probe network or child-spawn permission. The write grant
confines only the harness's `fs` operations to the declared database directory;
`node:sqlite` file access is not enforced by the Node 26.12.0 permission model,
so database placement rests on `p-e/host.mjs` path checks, not the grant.
No change to P-ids run-1, P-D run-2 or P-attr run-3 evidence, their v1
expectations or the ledger's existing
rows; this build-only handoff claims no run, approval, ledger entry, fraud
verdict or deployment readiness, and task 4.2 remains unexecuted.

## P-map — #804 build-only handoff (task 5.1)

The P-E section above is its historical build handoff; its inherited run-4
result and task 4.2 tick are preserved at this build's pinned base
`8e6cdf781445574c67883a465eb37581ca14b5ab` (same tree as the reachable
gate base `0f3e02a7f50aed916ea0fd1e717330f0632db317`).
**P-map has not executed.** Only task 5.1 is completed here. Task 5.2 is ticked
exactly when `results/p-map-run-5.json` exists, never by a build or approval.
No P-map result or ledger row is created by this build. Handoff checks preserve
every inherited expectations/results blob and every inherited ledger byte.
Only `results/p-map-run-5.json` and exactly one paired ledger row starting
`| 5 | P-map | #804 | ` may later be added; neither may exist without the other.
Checks use the full reachable gate-base SHA, not a local ref or moving main.
No claim about #805's verdict, #806's
consumer policy, fraud detection or deployment readiness is made.

### P-map sole dry run and declaration audit (history only)

Before any edit, the one build/install-only dry run exited 0 at the clean base.
The following records that invocation; **do not repeat it during this build**:

```bash
node openspec/changes/verify-fraud-evidence-sufficiency/harness/kit-cli.mjs --dry-run --repo "$PWD" --approved-head "$(git rev-parse HEAD)" --driver-run-id run-a668e11c-1be0-4418-813c-edc3bea8f70c --driver-harness pi --driver-provider openai-codex --driver-model gpt-6.1-sol --driver-thinking high
```

Identity commit: `8e6cdf781445574c67883a465eb37581ca14b5ab`, distributable true;
kit digest `0a3c636f6f4c63ec79d4b62165662fdd428d8b0b656d0c759d90043a0869ee0f`;
package-set digest `612a1f1c986163eae51879af37be5f68857f50a1c6b0024a1996930685ef45c6`.
Both npm-ls and recursive filesystem evidence showed exactly one installed core.
All 34 packed `.d.ts` text hashes matched installed evidence. Scratch
`bloodtrail-stage-p-5Cn2k0` was recursively removed in finally and its absence
independently verified. No installed code was imported or executed. The full
symbol/text audit and dry-run evidence are retained **externally**, under this
Tamandua run's `p-map-build-audit/`, not committed as run observations.

Symbols checked as packed declaration **text**: CONTRACT_VERSION;
createNodeSecurityAuditSdk and NodeSecurityAuditSdkConfiguration;
SecurityAuditSdkConfiguration, SecurityAuditSdk, NamedSecurityAuditApi and
NamedAuditEventInputMap; AuditResult, AuditDeliveryResult, SafeAuditError and
SecurityAuditSdkError; createCapturingAuditSink, CapturingAuditSink and
AuditEventSink; anonymousActor, authenticatedHumanActor, administratorActor,
serviceAccountActor, workloadIdentityActor, scheduledProcessActor,
authenticatedPrincipal, authoritativeSubject, authoritativeTenant,
authoritativeResource, authenticationEvidence, authorizationEvidence,
sessionEvidence, credentialReference and observedSource, with their context
input types; authenticationSucceeded, authenticationFailed, sessionCreated,
sessionRevoked, mfaEnrolled, mfaRemoved, passwordResetRequested,
passwordResetCompleted, sensitiveResourceModified, securityConfigurationChanged,
authorizationDenied, roleAssigned and their generated input types; beginOperation,
AuditOperationInput/Handle/Snapshot/State, operationId, transactionId,
correlationId, boundEvent, transactional, state, snapshot, markCommitted,
markNotCommitted, markPartiallyCommitted, markCompensated and markCancelled;
SecurityAuditEvent, event lifecycle/outcome/commit/delivery fields and correlation
causation/original-event fields. Named methods return status, not an event ID:
causal links read the captured event. Objects in change_categories are allowed
at runtime; the intentional object-with-kind variant exceeds its TS item type.

### Frozen P-map hypotheses, not measured verdicts

`expectations/p-map.v1.json` is frozen in this build commit **before** a run.
It pins #804 comment 6137646538 at `5d931ad`, corrected against the base above:
39 ordered headings, seven computed S rows (no separate SDK calls), 32 concrete
cases, 59 emissions plus handle steps, and two positive controls. Its hash is
recorded at the future run start; never edit v1 to match observations. A later
post-run correction requires v2, a new exact-head approval and a new run.
The pre-run review revision below retains v1: no run has used it, and no public
outcome, diagnostic, sink count, prediction, budget or verdict default changed.

Every source citation was re-derived. Only L5a changes an expected SDK outcome:

| case | draft | frozen hypothesis and reason |
|---|---|---|
| L5a | Accepted denied/committed without a handle | Returned PREMATURE_SUCCESS/validation at /operation/state, zero sink; #797 removed catalog-first terminal fallback |

L5b's direct terminal-state refusal remains `/event/commit_state`; explicit
L5c denied/not_committed remains accepted. All other no-handle non-success
transaction-bound constructions use the same #797 rule; events with
not_applicable in their catalog (M1, K1, K4) retain no-handle acceptance.
#812-sensitive M4, U2 and R1–R3 retain the draft outcomes: failure/pending
refuses; nontransactional failure accepts; compensation is partial/compensated;
missing causality refuses; genuine and wrongly typed linked originals accept.
#796, #811 and #816 change no expected outcome here. Citation drift alone is
not a correction. Source-cited independent hand-written fixtures cover every
emission; tests mutate each family and report both owner-review alternatives.

Expected rubric classifications (not run results): logout/MFA **FITS**;
contact/lockout/release/rotation **STRAINED**; criterion 2 conditionally **PASS**.
The G-log factory default uses the Node binding. G36 is an owner decision:
second-factor/per-account lockout reasons are allowed, still targetless, so the
account-attribution limitation is a later contract-field design input.
Everything else in this plan is labelled **implementer default**:

- K2a treats threshold policy evaluation as a genuine authorization decision.
  Alternative: MISREPRESENTS and criterion-2 failure on lockout, owner review
  required. R2 reads authenticated actors plus takeover/credential lifecycle as
  covering a password change. Alternative: reset only, MISREPRESENTS and failure
  on password-change coverage, owner review required. API/factor rotation cannot
  substitute for password change. Results report default and alternative.
- change_categories has no registry, enum or item maxLength and admits objects.
  No vocabulary is defined; maxItems 16 and the 8192-byte input scan are separate.
- `host_linkage_preserved` measures the SDK preserving host-supplied request
  and correlation IDs on both K1 and K2a captures. That permits a **host-side
  join**, not SDK account attribution. Missing either capture makes only this
  finding null: K2a runs independently of K1. Whether such joins are forbidden
  belongs to #806. Login accepts tenantless but the best logout/contact/lockout/
  release/rotation expressions do not; this is recorded, not resolved here.
- Logout versus administrator revocation uses actor/subject equality and policy
  fields; per-path hook keying can destroy equality. session.revoked fail-closed
  posture can keep a compromised session alive; this is a containment finding,
  not a measured delivery guarantee. Lazy expiry has no commit point: analysis
  only, unlike U1's explicitly committed scheduled release.

The baseline-inclusive prediction is **623 public calls** (601 concrete + 22
controls). Each case freezes its predicted_calls; the seven S rows use zero.
One sequential process has allowance **1,246**, twice the prediction, capped at
5,000. Constructors, factories, methods and sink callbacks all count. Count
drift within allowance is only a note; exhaustion is sticky. Baseline refusal
stops the run as a precondition invalidation. Ordinary unexpected case throws
become owned case_aborted mismatches and later cases continue. Malformed planned
steps never throw from the evaluator, unrelated verdicts remain independent,
and evaluation faults retain every observation. Each row reports per-step
matches and mismatches as well as its unchanged whole-row result. Signal
conclusiveness rests on the matched steps of the accepted expression, not
incidental control variants. Findings read only their own matched source step.
Aborts, malformed rows, duplicate/unowned records and accounting integrity
faults still make every candidate of the affected case inconclusive; the
couldImprove rule and owner alternatives are unchanged. Runtime identities
compare structurally; no random ID, digest, clock or scheduling-dependent value
is frozen.

### Pre-run review fixes V1–V8

Review-fix provenance: Tamandua run-8f715dad-cf14-4131-b943-da210a77a12b, pi on openai-codex/gpt-6.1-sol, thinking high.

Authorization policies now use semantic `policy_version: "1.0.0"`. The offline
`tests/p-map-schema-inputs.test.mjs` reads the contract JSON schema as data,
resolves local references and checks supplied scalar patterns, enums/constants
and length limits, with Unicode regexes. Existing public-shape doubles build
all 59 planned emissions and both controls: 15 constructors, 62 canonical scalar
paths and 2,291 scalar leaves across 756 constructor/property inputs. Exact
exemptions are C2a/bytes-8193 `/resource/change_categories/0` (intentional byte
scan refusal) and C2b/items-17 `/resource/change_categories` (intentional array
bound refusal; its scalar items are still checked). A copied policy version of
`"1"` must fail at `/authorization/policy_version`; no SDK validator is imported.

Reviewed v1 SHA-256: `a63e26fb8f30b1cf4ed3419affee0564152f149d485529254470703e44caca27`.
It retains 134 planned steps, with 749 concrete and 25 aggregate assertions.
The single `revisions` entry records the pre-run assertion audit:
- K2a/policy's seven `join.*` assertions move off the step to S-LOCK's honest
  host-linkage finding; they can no longer make K2a depend on K1.
- L3/tenantless drops `handle_state_unchanged`; acceptance at L3/usable-handle
  proves usability instead. U2/same-instance drops
  `compensation.original_still_committed`, an immutable earlier clone.
- M4/nontransactional and U2/same-instance drop emission `handle.state`
  assertions: an emission does not transition the handle.
- C5/enrolled drops `replacement.removed_resource_type` and
  `replacement.removed_credential_type`, which read only the earlier clone.
- R1/unlinked drops always-false `causality.complete` (no original supplied).
  R2/pair-completed and R3/completed drop both `causality.original_is_*` fields,
  which read only the earlier precursor. The rotation finding now reads the
  independently matched R2/pair-request occurrence name.

Missing target, handle and shared-control dependencies fail before entering a
public step. A throwing begin/mark prerequisite retains its own public throw
and aborts with the prerequisite-refused message, never a secondary TypeError.
L3's missing login control is a harness abort, never an SDK session outcome.
The workloads were audited for later variants consuming earlier assignments.
P-E's unchanged handle/ownership helpers are reused directly; capture reading
is consolidated and the explicit import inventory is exactly the new closure.
No probe, pipeline, dry run, SDK or kit import/execution occurred in this review
work; required routine stock CI gates are distinct from Stage P execution.

### Future P-map execution — documentation only, after new #804/G39 S1

After the full TEST_CMD, 10/10 CI, code review and frozen-expectations hash are
verified, G39 permits the orchestrator to post a **new, unedited** #804 comment
with these exact whole lines and the exact lowercase 40-hex head:

```text
S1 approval: P-map run <N> for #804 at <HEAD>
Delegated S1 under G39
```

The URL is bound to #804, and the exact UTF-8 approval body is hashed. The G34
window remains 2026-10-17T02:22:47Z through 2026-10-24T02:22:47Z, shared ten-run
and per-run 5,000 limits. Expiry needs an amendment. G38 and S2 still apply;
this build approves no run. The later task 5.2 operator supplies all arguments:

```bash
git checkout --detach "$APPROVED_HEAD"
test -z "$(git status --porcelain)"
HARNESS=openspec/changes/verify-fraud-evidence-sufficiency/harness
node "$HARNESS/p-map/run-p-map.mjs" --repo "$PWD" \
  --approved-head "$APPROVED_HEAD" \
  --approval-body-file "$CONTROL/approval-body.txt" --approval-url "$APPROVAL_URL" \
  --approval-created-at "$CREATED_AT" --approval-updated-at "$UPDATED_AT" \
  --approval-sha256 "$APPROVAL_SHA256" --window-opened-at "$WINDOW_OPENED_AT" \
  --once-marker "$CONTROL/$APPROVAL_SHA256" \
  --run-number "$LEDGER_RUN_NUMBER" --results "$CONTROL/p-map-results.json" \
  --driver-run-id "$TAMANDUA_RUN_ID" --driver-harness pi \
  --driver-provider "$PROVIDER" --driver-model "$MODEL" --driver-thinking "$THINKING"
```

The shared runner validates runtime, budget and each prediction **before claim**,
then approval/head/clean checkout/free results path, full tracked-harness Git
inventory (including fixtures), explicit transitive import closure, marker and
G39 delegation, without weakened protections. The governed identity verifier
requires the kit commit to equal approved HEAD; results retain distributable
identity/digests, single-core install evidence, approval hash/delegation, runtime
and environment, model lane, expectations hash and every raw observation.

The exact child flags are `--permission`, `--allow-fs-read=<own-service>` only:
no extra write, network, spawn, native-addon or database grant. P-map creates no
host database and measures no exchange. Observations cover returned/thrown public
surfaces and frozen sink captures; P-E owns delivery guarantees. The pipeline
removes kit/host/log scratch in finally and retains evidence if evaluation,
writing or cleanup fails. Self-tests use only injected public-shape doubles,
never SDK/kit imports, guarded probe entrypoints, network or a real pipeline.
