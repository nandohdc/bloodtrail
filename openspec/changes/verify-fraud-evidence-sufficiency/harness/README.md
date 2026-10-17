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
