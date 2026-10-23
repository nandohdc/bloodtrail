## Context and scope

This change is the Stage 2 that #795 defers, specified by #833 and ticketed as #835–#846.
- **Base.** It starts from `main` at `91afc83fbfe2e5524c36f107997d2beedbbf28e7`, on contract 2.1.0.
- **What Stage P settled.** The in-process questions: target carriers, signal fit, the integrity matrix,
  transaction-critical ordering and host-outbox commit inside the transaction. ADR 0014 records them, and this
  change does not reopen them.
- **What Stage 2 measures.** Delivery across a real loopback transport, into a collector with storage, under
  faults, at volume.

**Authority.** The decision log is #795's G1–G37 comment, plus the later owner decisions recorded as their own
comments on #795: G38–G40 and G41–G45. Where #833's body and the log differ, the log wins. The grilling
decisions taken with the owner on 2026-10-22, in Claude Code session
https://claude.ai/code/session_012Y6oT9KjPZ1BMvT63hU3ay, are recorded below with that source. No table entry
grants a run approval.

## Seam and observation boundaries

**The seam.** It is the evaluation kit's packed public API: core, the Node binding and the collector. It is
consumed as an evaluator's own service, installed outside the repository from the kit's tarballs. These are not
permitted:
- new seams in Bloodtrail;
- inspecting internal registries, operation authority or private state;
- in-repository package tests.

Harness source and results live inside this change; execution uses only the outside-repository installation.

**Four observation boundaries:**

1. **The outcome of every public call.** Recorded as code, category and path, with explicit acceptance recorded
   for every attempt.
2. **The delivery primitives' results and observability callbacks:**
   - retry `onAttemptScheduled(next, delayMs)` and `onExhausted(attempts)`;
   - backpressure `onAdmitted`, `onRejectedOverload(depth, capacity)` and `onReleased`;
   - the `best_effort` `onDropped` and `onLossCeilingReached`;
   - the shutdown report (`accepted`, `completed`, `abandoned`).
3. **The injected exchange.** Each delivery attempt's ordinal and the sha256 of the body sent. This is Stage P's
   third boundary.
4. **The harness-local loopback ingress.** It records:
   - the sha256 of the body received;
   - the collector's outcome: admitted, persisted, duplicate, conflict, or rejected with its bounded diagnostic
     triple;
   - the persisted record, read back through the collector's public storage port.

## Reference composition

Every probe sends through one composition, frozen in each probe's expectations file with its parameters:

```text
createDeliveryShutdown            deadline-bounded shutdown admission
  └─ createBoundedDeliveryBackpressure   admission gate, not a queue: admits or rejects, holds no backlog
       └─ createBoundedDeliveryRetry     bounded retry with an injected jitter source and timer provider
            └─ createHttpDeliveryHandoff  exactly one exchange per delivery attempt
                 └─ createFetchHttpExchange  the governed fetch adapter, loopback origin only
```

`authorization.allowed`, the catalog's only `best_effort` event, does not go through this stack. It goes
through the binding's `best_effort` class (`createBestEffortDelivery`) over the same governed exchange: one
attempt, no retry, a drop on any non-acknowledgment, and a saturating loss counter with a ceiling signal (#838).

The consumer is the kit's collector, configured with SQLite storage on a scratch file, so identity is decided
durably. One phase of #839 runs it without storage, to measure the in-memory bound of 32 identities for five
minutes. The harness's HTTP wrapper around the ingress owns fault injection only, never acceptance logic.

## Harness architecture (grilling, 2026-10-22: Q14–Q16, Q32–Q35, Q39–Q43)

**Files.**
- **`harness/lib/`** holds adapted copies of Stage P's modules:
  - kit-pipeline, install, identity, import-closure, repository and preflight;
  - ledger and results;
  - runtime-facts, approval, arguments, plan, io, launcher and orchestrate.

  Nothing imports from the archived change. Stage P's `observe` and `metrics` are adapted when a probe first
  needs them, and each probe validates its own expectations in its own directory.
- **New modules:** `ingress`, `faults`, `composition`, `accounting`, `workload`, `clock`, `loopback-guard`,
  `role-guard` (imported first by each role), `controls` (the in-process planted-defect controls), `deadline`,
  `permissions` and `probe-runner`.
  `reconstruct` arrives with #840.
- **Per-probe directories**, plus `tests/`, `expectations/`, `results/`, `run-ledger.md` and `README.md`.

**Processes and permissions.**
- An unrestricted **orchestrator** spawns the other two and loads no SDK.
- The **sender** runs the SDK and the composition under `node --permission --allow-net
  --allow-fs-read=<own-service>`, with no child-process rights.
- The **ingress** runs the kit collector with SQLite storage. Its `--allow-fs-write` is limited to the storage
  directory.
- They talk over loopback HTTP and IPC. IPC under `--permission` was verified on Node 26.12.1.

**Loopback guard.**
- **What it watches:** every outbound socket, before it connects. The guard wraps `net.Socket.prototype.connect`,
  which both raw sockets and `fetch` (undici) reach, and refuses any target that is not literally `127.0.0.1` or
  `::1` by destroying the socket before the connection is attempted. A host name, `localhost` included, is
  refused, because it could resolve off-host. A `diagnostics_channel` `undici:client:connected` subscriber
  re-checks each connected socket's remote address. Both were verified on Node 26.12.1 for `net` and `fetch`. The
  composition also refuses a non-loopback exchange origin before it builds anything.
- **When it is installed:** each role imports `lib/role-guard.mjs` first, so the guard is in place before any kit
  module evaluates. A violation recorded while the modules loaded is reported as soon as the role body runs.
- **What else it refuses:** UDP, outright, because the roles send no datagrams. Direct `node:dns` queries are not
  intercepted; the roles make none, and every connection target is a literal address.
- **What it does:** any other address halts the run under S2.
- **Why it is needed:** `--allow-net` cannot restrict hosts.
- **Planted control:** inside each live sender, before any probe traffic, a `fetch` to `192.0.2.1:80` must be
  refused and recorded as exactly one violation, and a null-control connection to the ingress must pass silently.
  Port 80 is used because `fetch` refuses some ports itself, port 9 among them, which would hide whether the guard
  fired.

**Time.**
- Workload event times come from an injected synthetic clock through the Node binding's platform provider, so
  they are ground truth.
- Retry uses an injected `AuditTimerProvider` and a fixed `jitterSource`.
- Restarts are deterministic. `onAttemptScheduled` signals the orchestrator, and the injected timer fires only
  after the orchestrator acknowledges that the restart is complete.
- #841's volume pass uses real timers with a fixed seed, because latency needs real time. It keeps the same
  restart gate.

**Faults.** The ingress injector reads the frozen fault plan and decides by event id and attempt ordinal. It makes
no random choices. Its fault types are:
- a status code;
- a delay beyond the exchange timeout;
- socket destruction before ingest (transport failure);
- socket destruction after ingest (a lost acknowledgment);
- a malformed acknowledgment after ingest: a 202 that acknowledges nothing, once the collector has decided the body;
- a restart with storage persisted.

A probe may freeze named scenarios (per-attempt rules) and a schedule naming one scenario per occurrence; the
injector receives the schedule expanded into per-occurrence rules.

**Accounting identity.** Every generated occurrence ends in exactly one terminal bucket:
1. persisted at the collector;
2. reported undelivered by a delivery result (`non_retryable`, `protocol_error`, `exhausted`, or a
   `best_effort` drop);
3. reported by an admission signal (`rejected_overload`, rejected while shutting down);
4. abandoned in the shutdown report;
5. unexplained.

Unexplained must be 0. Expected losses stay in the denominator, and every count carries an explicit numerator and
denominator. The denominator is the frozen workload's planned occurrences, not what reached the composition: an
occurrence refused or dropped before the sink, or a delivery that settles by throwing, counts as unexplained.

**Workload and ground truth.** A seeded PRNG generates the workload. The seed is frozen in the expectations file,
along with the ground truth: chains, per-source counts and per-tenant partitions. Event identifiers come from the
Node binding's identifier source. The evidence shape follows the `fraud-evidence-profile` capability:
- failed authentication carries an anonymous actor and no target (G13);
- account join identifiers are internal opaque IDs, and session identifiers are host-computed keyed fingerprints
  under one per-run in-memory key scope (G29);
- the observed source address is exact and comes only from documentation ranges (G3).

**Reconstruction.** The reconstruction step is harness code with no rules, thresholds, flags, scores or verdicts.
It reads persisted records, by event time and occurrence fields and never by arrival time. It computes:
- chains;
- per-source counts;
- pre-authentication groupings, which are reported only and never linked to an account.

**Host outbox (#842).**
- A harness-local `node:sqlite` database. The business change and the audit record are written in one transaction
  through a transaction-bound sink.
- A relay drains committed records through the reference composition.
- Relay crash and restart, and rollback, are separate phases.
- The recorder confirms transaction state on the Node 26 runtime.

## The G4 test (grilling Q36)

G4 asks whether the hand composition meets the `security_significant` row's in-process half. The answer is yes
only if all four predicates hold under every fault plan:

1. **Bounded retry with jitter.** Attempts stay within `maxAttempts`, and every scheduled delay is reported
   through `onAttemptScheduled(next, delayMs)` with its ordinal.
2. **Retry-exhaustion alert.** Every occurrence that exhausts its budget produces `onExhausted`.
3. **Alert before silent loss.** Every overload rejection is reported through `onRejectedOverload(depth,
   capacity)` before any loss.
4. **Bounded flush.** The shutdown report accounts for every admitted occurrence (`accepted = completed +
   abandoned`), within its deadline.

If any predicate fails, ADR 0015 states the requirement for a separate governed Node-binding change. This change
does not build that binding.

## Expectations and results

Before each run, the probe's `expectations/<probe>.v<n>.json` freezes:
- the hypotheses;
- the fault plans and composition parameters;
- the workload seed and ground truth;
- the acceptance thresholds.

It is committed and hashed before the run, and never edited after the run starts.

**Thresholds** exist only for the accounting identity (unexplained = 0) and for criteria 3, 4 and 5. Throughput and
p50/p95/max latency are labelled observations of one environment, with run-to-run spread, and never service
levels (Q17).

**Results** are raw observations, tagged with provenance:
- kit identity commit, package-set digest and kit digest;
- Node version, environment, authoring lane;
- authorization reference and approving-comment hash.

A mismatch is reported, never fixed by editing expectations. An invalidation needs a fix, a new head, a new S1
and a new run number. Reproduction starts from the kit identity commit and the committed harness.

**Controls.** Before any traffic, each stop condition and each accounting check must fire on a planted defect and
stay silent on its null control:
- a dropped occurrence breaks the accounting identity;
- a copy with one changed byte is classified as a conflict;
- a reconstruction that merges two accounts sharing a source fails the chain check;
- a count that includes duplicates fails the per-source check;
- the non-loopback guard fires.

**One execution per run (Q19).** Each probe's run does a small deterministic pass first and the volume pass
second. It stops before the volume pass on any mismatch.

## Budget

- **Runs:** at most 12 under G42: one each for #836, #837, #838, #839, #840 and #842; three for #841, for
  run-to-run spread; three spare for invalidations.
- **The cap:** it counts SDK calls, accepted or refused, at most 50,000 per run (Q35). Delivery attempts are
  recorded but not capped; the retry budget bounds them.
- **Before each S1:** the orchestrator checks runs used, occurrences used and window time left. If the window
  would lapse, it stops and asks.

## Probes and hypotheses

Serial PRs, each a build commit followed by an evidence commit after its S1 (Q18).

- **#836, the tracer bullet.** One synthetic occurrence goes from the Node SDK through the full reference
  composition, over loopback, into the collector with storage, and comes back as a provenance-tagged result. The
  shared modules and the loopback guard are built here.
- **#837, outages.**
  - The retryable statuses (503, 429, 408), timeouts and transport failures produce delivery retries within the
    budget, ending in an acknowledgment or a reported exhaustion.
  - Permanent 4xx and malformed acknowledgments stop retrying at once and are reported.
  - A lost acknowledgment is redelivered as a duplicate that the collector acknowledges and never admits twice.
  - The probe reuses the tracer's two role processes unchanged. Its small pass runs one occurrence per scenario;
    only if every small-pass case matches does the volume pass repeat the same schedule.
- **#838, load and shutdown.** Overload through the backpressure gate is reported with depth and capacity.
  Deadline-bounded shutdown mid-burst accounts for every admitted occurrence. `best_effort` drops are visible
  through the loss counter and the loss-ceiling signal.
  - The probe has its own sender role. Its ingress is the tracer's.
  - Each phase is one exchange. The small pass has four phases: overload, drain, abandon and `best_effort`.
    The volume pass has three: overload, drain and `best_effort` at volume.
  - A burst submits every occurrence at once, against answers the ingress holds. Each occurrence therefore
    meets the admission gate before any held delivery can settle, and the gate's decisions are deterministic.
- **#839, copies, duplicates, conflicts and restarts:**
  - every copy is byte-identical, compared by body hash at the exchange and at the ingress;
  - the attempt ordinal stays out of the occurrence;
  - collector duplicate and conflict outcomes are measured;
  - a re-execution counts as a new occurrence;
  - storage decides identity durably across a restart;
  - the storage-less bound of 32 identities is measured.
- **#840, account-takeover chains (criterion 3).** Ground-truth chains are reconstructed through join
  identifiers: successful authentication → session creation → MFA removal → password-reset completion → session
  revocation. Chains that share a source address are never merged.
- **#842, host outbox.** A rolled-back transaction leaves nothing to relay, and a committed one is relayed at least
  once. A relay crash and restart deduplicates by event ID and transaction ID.
- **#841, per-source counts and performance (criterion 4).** Runs last, because it depends on #837–#840.
  Per-source counts equal ground truth under every fault plan, with duplicates not inflating them. Throughput and
  latency are recorded as labelled observations, with spread across at least three runs.

## Verdict and later records

**#843: system ADR 0015**, approved by the owner against a named head, with no contract version move (G6).
- **Per criterion:** a verdict for 3, 4 (per source) and 5, with its evidence. Every unmet criterion names its gap
  and fix owner (Bloodtrail contract, Bloodtrail package, host or engine).
- **G4:** the answer, by the four predicates.
- **Defects:** found in passing, they are filed as issues first (G37).
- **Wording:** never "production-ready" or "detects fraud".

**#844** rewrites the consumer integration profile's delivery-guarantees table from the measurements.

**#845:** there are no spec deltas, so it closes as not planned, citing this proposal's declaration.

**#846** archives the change, using a pure move with the UTC date. The harness bytes stay unchanged, because the
results pin their blobs.

## Implementer defaults — not owner decisions

- The tracer's single occurrence is a `security_significant` event (`authentication.succeeded`), because the
  composition is exercised for that row.
- Composition parameters per fault plan (attempt budget, base and maximum delay, capacity, deadline) are chosen in
  each probe's expectations, before its run.
- Each probe's volume stays within the cap and is set in its expectations.
- #837's malformed acknowledgment is answered after the collector has stored the occurrence, so the run shows a
  protocol error that follows a durable write: the occurrence is persisted, and the disagreement with its
  reported `protocol_error` is kept as an observation. A malformed answer to an unstored body would only repeat
  the permanent 4xx's accounting.
- #837's timeout also follows ingest: the ingress stores the body, then answers after the exchange deadline, so
  the redelivery is a duplicate as with a lost acknowledgment.
- #838's held answers also follow ingest. An occurrence the abandoning shutdown reports abandoned has
  therefore already been stored, and it settles after the report. It is persisted, and the disagreement with
  its abandoned label is kept as an observation: shutdown reports what it could not finish, not what was lost.
- The reference composition records, inside the operation the lifecycle tracks, which occurrences the
  lifecycle ran and which of them settled. An occurrence settles before the lifecycle releases it. So when
  the drain returns, exactly the started and unsettled occurrences were in flight, and only those are
  labelled abandoned. A submission rejected while shutting down never ran and keeps its own status.
- The assessment declares the `fraud-evidence-profile` capability, the one whose criteria Stage 2 measures, with
  `material_capability_modification: false`. Harness files under `openspec/changes/` are governed implementation,
  and design-pattern governance associates them only with a change that declares a capability. The declaration
  modifies no requirement: the change still carries no spec deltas. The trade-off: while the change is active,
  the association also counts `openspec/specs/fraud-evidence-profile/` as covered by it. Canonical edits to that
  spec arrive only through a fold, and this change plans none (#845).

## Decision register — verbatim provenance

These rows reproduce the decision text verbatim. G4 and G5 are copied from the archived Stage P design's register.
G41–G45 come from https://github.com/nandohdc/bloodtrail/issues/795#issuecomment-6346915049.

### Carried decisions that bound Stage 2

| ID | Decision | Status |
|---|---|---|
| G4 | The **host owns durability** for security-significant evidence. Bloodtrail owns honest conformance claims, visible loss, and a measured reference composition. A security-significant binding is added only if Stage 2 shows the hand composition fails the row's in-process half. | **Stands** |
| G5 | If P-E confirms the ordering hypothesis, test the **host-outbox pattern**: emit through a transaction-bound sink inside the business transaction, then relay. The transaction-critical binding is later documented as not providing atomicity, in a separate Node-binding change. | **Stands** |
| G22 | Stage 2 (HTTP, outages, duplicates, restart, storage, throughput, reconstruction at scale) is proposed only after the owner reviews Stage P's results. | **Stands** |
| G13 | Failed authentication carries **no target**: no subject, no credential reference, no presented identifier in any server-authoritative field. | **Stands** (broadened from "omit subject") |
| G3 | Send the **exact observed source address**. Exactness is necessary because geo, network-owner and reputation enrichment run in the engine, never in Bloodtrail. Record the purpose justification. Real-user use needs a DPIA. Trusted-hop extraction stays with the host. | **Stands** |
| G29 | Post-authentication join identifiers. Internal opaque account IDs are sent directly under a recorded direct-reference exception, identical on every occurrence. Session IDs are host-computed keyed fingerprints of the server session handle under one key scope shared by the chain, never bearer values. | **Stands** (refined by review) |
| G33 | Stage P's carrier matrix **proves or refutes the gap**: does any existing field carry a failed login's target without misrepresentation? If the gap is proven, a **separate governed contract minor version**, sequenced after the active normative-precedence change, adds a keyed presented-identifier reference with client-claim trust that never reveals whether an account exists. | **Stands** (owner) |

### Stage 2 owner decisions (2026-10-22)

| ID | Decision |
|---|---|
| G41 | **G22 is satisfied.** The owner's approval of ADR 0014 at `c20dd5c` (recorded on #805: https://github.com/nandohdc/bloodtrail/issues/805#issuecomment-6341006392) is the owner's review of Stage P's results. The Stage 2 proposal (#835) may now be opened. Merging the proposal still authorizes no run. |
| G42 | **Stage 2 environment and limits.** Stage 2 runs on this workstation (macOS, Apple Silicon) under G38's environment terms: Node 26 installed outside the repository, the kit built by the governed builder from the exact approved head, and probe traffic on loopback only. Limits: at most **12 runs**, shared across the probe tickets as in G34; at most **50,000 SDK calls per run**, accepted or refused, with delivery attempts recorded but not capped; a **14-day window** from the first Stage 2 S1. |
| G43 | **Verdict ADR and change name.** The Stage 2 verdict is recorded in a **new system ADR 0015**, approved by the owner against a named head, with no contract version move (the G6 precedent). The change is named **`verify-fraud-evidence-delivery`**. |
| G44 | **Stage 2 S1 is delegated under the G39 rule.** For each run, the orchestrator posts a new, unedited comment on the probe's ticket. It contains the exact approval line plus `Delegated S1 under G44`, and is posted only after the full TEST_CMD, all-green CI, review and the expectations hash are verified. It is recorded as delegated in the ledger and the results. Any S2 halt stops the run and goes to the owner. No run follows an S2 halt without the owner. |
| G45 | **Authoring lane.** As G40a did for #805–#808, Stage 2 and the SDK/Node fixes (#859–#862) are written by the orchestrator (Claude Code, `claude-opus-5-5`) without Tamandua or pi. Every PR is reviewed read-only by the AGY CLI, run as `agy --dangerously-skip-permissions --model "gemini-3.8-flash-high"` in plan mode and sandboxed, and told not to execute harness, SDK or kit code. Build PRs also get `/code-review high`. After each review the orchestrator verifies that HEAD and the tree are unchanged. The orchestrator merges on all-green (the ten required contexts and DeepScan) as a **merge commit**, and closes each ticket after its PR shows MERGED. |

### Stage 2 design decisions (grilling, 2026-10-22, this session)

The owner accepted the recommended option on each:

- **Q14:** copy and adapt Stage P's harness modules; never import from the archive.
- **Q15 and Q43:** the loopback guard, using `diagnostics_channel` plus a URL allow-list, with a planted
  `192.0.2.1:9` control. *Build note (#836, task 2.1):* the decision holds, and the mechanism is refined as
  described under **Loopback guard**. A pre-connect wrap refuses the connection, because on Node 26.12.1 destroying the
  socket from a `net.client.socket` subscriber does not stop it: the peer still accepted both a raw and a `fetch`
  connection. The planted control moves to port 80, because `fetch` refuses port 9 itself.
- **Q16:** the kit collector's SQLite storage on scratch, plus one storage-less phase in #839.
- **Q17:** no performance thresholds.
- **Q18:** serial probe PRs, #836 → #837 → #838 → #839 → #840 → #842 → #841.
- **Q19:** one execution per run, the deterministic pass before the volume pass.
- **Q32:** three processes, orchestrator, sender and ingress, under the permission model.
- **Q33 and Q40:** deterministic restarts, timed by an injected timer that waits for the orchestrator's
  acknowledgment, including in #841.
- **Q34:** synthetic clock and injected timers everywhere except #841's volume pass.
- **Q35:** the cap counts SDK calls; delivery attempts are recorded but not capped.
- **Q36:** the four G4 predicates.
- **Q37:** the three glossary terms.
- **Q38:** `security_sensitive: true`.
- **Q39:** the harness layout above.
- **Q41:** a deterministic fault injector keyed by event id and attempt ordinal.
- **Q42:** a seeded PRNG for ground truth, with the seed frozen.
