## Why

The SDK MVP evaluation alpha (#575) needs events to leave the process over HTTP. The existing pieces don't
provide that:

- Nothing implements the SDK's sink boundary over HTTP. The Node binding has a single-attempt handoff and
  the governed fetch adapter, but no sink that connects the SDK to them.
- The one existing composition, the delivery handoff, overwrites `correlation.retry_attempt` (#577), so it
  cannot carry the validated event byte for byte.

A sink that sends events over HTTP is a transport. `CONTRIBUTING.md` says each transport "requires its own
OpenSpec change and explicit authorization". This is that change. The evaluation-alpha umbrella,
`deliver-sdk-evaluation-alpha`, depends on it for every milestone that sends events over HTTP.

## Authorization

- The owner approves this change through the same act that approves the umbrella, on the pull request that
  proposes both:
  1. an approval comment naming this change, the umbrella, and the exact head commit SHA;
  2. the owner's own merge of that commit.

  `CONTRIBUTING.md` says merged state alone is never approval, so the comment is required. No agent merges
  that pull request or arms auto-merge on it.
- The act authorizes implementing the HTTP audit sink for **non-production evaluation only**:
  - developer machines, CI, loopback or private networks, and evaluators' own non-production services;
  - synthetic data only.
- Who may receive the sink in an evaluation kit, and when, is governed by the umbrella's
  `evaluation-authorization.md`, and nothing here widens it.
- It authorizes no production deployment, publication, license change, delivery infrastructure, or any
  other transport, exporter, queue or storage.

## What Changes

- **One shared response classifier.** The delivery handoff's response classification moves into one
  internal classifier. The handoff and the new sink both use it, so their rules cannot drift. The handoff's
  observable outcomes do not change.
- **`createHttpAuditSink(options)`.** The Node binding gains a sink that implements the existing sink
  interface:
  - It sends one POST per event, and the body is exactly the bytes the SDK validated.
  - It reaches the network only through the governed fetch adapter, and never follows a redirect.
  - Invalid options fail construction.
  - Caller headers go only to the configured origin.
- **Rejected versus failed.** A permanent 4xx is a rejection. Everything else that is not the exact
  acknowledgment is a failure.
- **An optional `onOutcome` callback.** It reports each request's event identifier, the classifier's code
  and the HTTP status. This is how developers correlate a failed send, because the core's sink-failure
  results carry no event identifier.
- **Lifecycle.** `flush` waits for in-flight sends, and SDK shutdown drains them within its bound. The sink
  does no retry, batching, queueing, backpressure or ordering, and claims no delivery-class conformance.
- **An additive widening of the frozen Node surface.** It adds the factory, its options type and its
  outcome type. The widening is recorded in the frozen lists, in a freeze-record amendment, and in a new
  ADR-NODE-004.
- **Sink tests and mutation checks.**

This change follows the umbrella's deviations from #575, which are recorded in one place: the umbrella's
`proposal.md`. Deviation 2 (outcome codes) and deviation 6 (#581 withdrawn) are implemented here.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-node`: ADDED requirements for:
  - the HTTP audit sink;
  - its shared response classification;
  - its outcome callback;
  - its flush and shutdown behaviour;
  - the additive widening of the frozen surface.

The umbrella adds separate requirements to the same capability, for the error catalog, the evaluation kit
and the evaluator documentation.

## Impact

- **`packages/security-audit-sdk-node/`.** The work is confined to eleven files:
  - two new source files, plus `index.ts`, `http-handoff.ts`, the export check and `compatibility.json`;
  - ADR-NODE-004, plus a pointer in ADR-NODE-003;
  - the scope-mutation pins, and two new test files.

  The exact paths are in `assessment.json`.
- **Nothing else is touched:**
  - no core, contract, collector or workflow file;
  - no governance-core file;
  - no CB-018-owned file;
  - no `package.json`.
- **Evaluator-facing material stays in the umbrella:** the README, the wire-protocol page, the kit
  failure-path tests, and the evaluator docs.
- **Fold and archive.** This change stays active until the evaluation closes, because a blocking re-issue
  may touch the sink. It is then folded and archived together with the umbrella, by #606 and #607.
