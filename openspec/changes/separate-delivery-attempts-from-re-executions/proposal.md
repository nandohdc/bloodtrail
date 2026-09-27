## Why

The Node binding's delivery handoff writes its delivery attempt number into the occurrence's
`correlation.retry_attempt` before sending, and the bounded delivery retry passes each attempt number
through it (#577). That field is the contract's re-execution counter, and the SDK validates it:

- A re-execution emitted with retry attempt `2` is sent with `0`, and still validates, so the corruption
  is silent.
- A delivery retry of a first execution is sent with retry attempt `1` and no `original_event_id`. The
  SDK's own validator rejects that as `BAD_CAUSALITY`. The collector validates structure only, so it
  accepts the body, and because its deduplication key excludes `correlation.retry_attempt` the copy reads
  as a duplicate.

The ratified specifications require this behaviour, which is why it is not a plain bug fix:

- `delivery-conformance-contract` says every attempt "SHALL advance a zero-based attempt count expressed
  through `correlation.retry_attempt`".
- `security-audit-sdk-node` says the handoff's attempt ordinal "is carried into the wire correlation".
- `security-audit-collector` excludes the field from its deduplication key "by design", to tolerate the
  rewrite (#391).

They contradict other current text:

- the event contract's "Duplicate event is retried" scenario retries "the same immutable event";
- ADR-003 keeps the event ID stable on redelivery;
- the authority matrix validates correlation fields for "retry stability";
- the Node capability's own HTTP audit sink sends `correlation.retry_attempt` "exactly as validated".

Two current capabilities that contradict each other have no automatic winner, so the reconciliation
has to be a governed change.

## Authorization

- The owner approves this change through two acts on the pull request that proposes it:
  1. an approval comment naming this change and the exact head commit SHA;
  2. the owner's own merge of that commit.

  `CONTRIBUTING.md` says merged state alone is never approval, so the comment is required. No agent
  merges that pull request or arms auto-merge on it.
- The approval also authorizes one write into a directory the preserved normative-precedence workstream
  owns. At the fold, the change adds one new `CURRENT` pin set under
  `openspec/governance/normative-precedence-pins/`, recomputed for the folded delivery-conformance
  capability. Every existing pin set stays byte-identical. The directory is `governance_core`, so this
  change carries a full assessment.
- It authorizes no contract change, no contract version move, no new wire field or header, no new
  transport, no production deployment and no publication.

## What Changes

- **Delivery attempts never enter the canonical event.** The handoff sends the occurrence exactly as it
  receives it. The body is the canonical serialization of the occurrence, with no field added, removed or
  rewritten. The attempt ordinal stays where it already is: in the request descriptor, the handoff
  result, the bounded retry's result and its `onAttemptScheduled` and `onExhausted` callbacks. Every
  delivery attempt of one occurrence therefore sends byte-identical bytes, and `correlation.retry_attempt`
  counts re-executions only.
- **The collector compares the whole submission.** Its canonical deduplication key stops excluding
  `correlation.retry_attempt`:
  - a redelivered copy that is canonically identical is a duplicate;
  - any other body under a live identity is a conflict, including one that differs only in
    `correlation.retry_attempt`.
- **Vocabulary.** The Node binding and the collector each gain a glossary that separates re-execution
  from redelivery, registered in `CONTEXT-MAP.md`. A system-wide ADR records the decision.
- **Docs.** The known issue for #577 is removed, and the Node README's retry description is corrected.
- **Not breaking.** No export, type or option changes, so the frozen Node surface is unchanged. Two
  observable behaviours do change:
  - request bodies no longer carry the delivery attempt ordinal;
  - the collector rejects a same-identity body that differs only in `correlation.retry_attempt`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

A requirement whose scenario would become false is removed and re-added under a precise name. Scenario
titles are the match key for a modified requirement, so such a requirement cannot be corrected in place.

- `delivery-conformance-contract`:
  - "Attempt identity is stable and retry attempts are zero-based" is replaced by "Attempt identity is
    stable and delivery attempts are zero-based". The old title used "retry attempts" for delivery
    attempts.
  - "Ordering scope is per-occurrence only" is modified: attempts are ordered by their delivery attempt
    ordinal.
- `security-audit-collector`:
  - "Collector-local duplicate identity and retention are bounded" is modified: the key covers the whole
    submission.
  - "Duplicate and conflicting reuse have distinct deterministic outcomes" is replaced by "Duplicate and
    conflicting reuse are decided over the whole submission". Its scenario "A retry that only advances
    the attempt counter is deduplicated" becomes false.
- `security-audit-sdk-node`:
  - "Node binding exposes deterministic single-attempt delivery handoff" is replaced by "Node binding
    exposes a deterministic single-attempt delivery handoff that sends the occurrence unchanged". Its
    scenario "Caller-supplied attempt ordinal is carried into the wire correlation" becomes false.
  - "Node binding provides bounded, jittered delivery retry scheduling" is replaced by "Node binding
    provides bounded, jittered delivery retry scheduling that redelivers the identical occurrence". Its
    scenario "Retried attempts preserve identity and advance wire correlation" becomes false.

## Impact

- **`packages/security-audit-sdk-node/`:**
  - the handoff's request projection and the attempt-ceiling comments in the handoff and the retry;
  - the handoff and retry tests, and a mutation check;
  - the README and `docs/known-issues.md`;
  - a new `CONTEXT.md`.
- **`packages/security-audit-collector/`:**
  - the deduplication key and the storage record's key comment;
  - the ingress and storage tests;
  - a new `CONTEXT.md`.
- **Repository docs:** `CONTEXT-MAP.md` and a new system-wide ADR under `docs/adr/`.
- **At the fold:** the three canonical specs, and one new pin set.
- **Untouched:**
  - `contracts/security-audit/`;
  - `packages/security-audit-sdk-core/`, because the collector capability forbids a collector change
    range from modifying it;
  - `research/`, CI, and every export, type and option.
- **Evaluation kit:** the independent evaluation distributes the kit that is already identified. This fix
  ships in the next kit identity, which must carry the Node binding and the collector together. An old
  handoff against a new collector would see its delivery retries rejected as conflicts.
- **Tracking:** Refs #577. The issue closes after the archive lands.
