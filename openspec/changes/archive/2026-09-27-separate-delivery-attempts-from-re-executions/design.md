## Context

See `proposal.md` for why. The current state that shapes the approach:

- **The handoff rewrites one field.** It builds its request body by spreading the occurrence and overriding
  `correlation.retry_attempt` with the attempt ordinal. The bounded retry passes the ordinals `0` to
  `n - 1` to it. The HTTP audit sink (#578) already sends the validated event unchanged, and is untouched.
- **The SDK core already separates the two concepts.**
  - A **re-execution** calls a named method again with `retry: { retry_attempt, original_event_id,
    causation_id }` and gets a new event ID (`API.md`).
  - A **redelivery** resends one validated occurrence unchanged (`redeliver()`, and the named-redelivery
    path).
- **The collector's key tolerates the rewrite.** Its canonical deduplication key excludes
  `correlation.retry_attempt`, a rule added by `fix-collector-dedup-retry-conflict` (#391). The storage
  record carries the same key. The collector validates structure only, so it cannot detect the
  `BAD_CAUSALITY` bodies the rewrite produces.
- **The fold trips the pin set.** The CB-018 pin set `current-pre-fold-cb-018` pins the delivery-conformance
  capability by blob. This was checked in a disposable clone of `f40e2cb`:
  - a delta under an active change passes both `check-normative-precedence.mjs` and the design-pattern
    governance checker;
  - folding changes the blob, and every later precedence run fails at both stages with
    `fold-pin-set-missing`;
  - CI runs that checker with `continue-on-error` (#570), so the failure would be masked rather than
    reported.

## Goals / Non-Goals

**Goals:**

- Every delivery attempt of one occurrence sends the same bytes. The attempt ordinal stays observable
  locally.
- Any difference under a live collector identity is a conflict.
- The three capabilities agree with each other, with the frozen contract and with the code. The pin set
  rebinds to the folded state.

**Non-Goals:**

- No contract change: no delivery-attempt field, and no contract version move.
- No wire header or other transport metadata for the delivery attempt.
- No validation inside the handoff, and no semantic validation in the collector (the known issue
  "Collector Validates Structure Only").
- No change to the HTTP audit sink, sdk-core, or the evaluation kit that is already identified.
- No migration of existing non-production stores.

## Decisions

**1. `correlation.retry_attempt` counts re-executions only. Delivery attempts never enter the event.**

Evidence for this reading of the frozen contract:

- The event contract's "Duplicate event is retried" scenario retries "the same immutable event".
- ADR-003: "Event ID remains stable on redelivery".
- The contract's design: "Retransmitting identical event bytes keeps the event ID".
- The authority matrix validates correlation fields for "retry stability".
- The contract validator rejects `retry_attempt > 0` without `original_event_id`.
- The core's `redeliver()` resends identical bytes.

Evidence against:

- The archived contract design's row calls `retry_attempt` "Which delivery/execution attempt is this?".
- The event contract's "Queue retry redelivers a message" says "message and retry metadata identify the
  delivery attempt".

This change reads the second line as transport metadata outside the event. The first is design prose that
the contract's own validator contradicts.

Alternatives:

- **An optional delivery-attempt field (contract 2.2.0).** Rejected. It moves every pin in the version
  table, needs CB-018's version conflict resolved, and blocks at the release stage. Copies would still
  differ byte for byte, so the collector would keep excluding a field.
- **`retry_attempt` as a delivery-only counter (3.0.0).** Rejected. The compatibility policy calls that
  semantic reuse, a major change.

**2. The attempt ordinal stays local.** It remains in the request descriptor, the handoff result, the
retry result's `attempts`, and the `onAttemptScheduled` and `onExhausted` callbacks. Nothing on the wire
carries it. The alternative, an HTTP header, was rejected for three reasons:

- it adds a wire contract;
- the conformance capability is platform-neutral and cannot name one;
- no consumer needs it, because the collector deduplicates on identity and content.

The conformance requirement still lets a future transport carry the ordinal as its own metadata. It only
forbids writing it into the event.

**3. The handoff serializes the occurrence as supplied, the way the sink does.** The handoff is not a
validation boundary. The SDK validates before the sink boundary, and the handoff sends what it is given.
Adding validation there would create a new outcome and a new failure mode, which is beyond #577.

**4. The attempt ceiling keeps its value and changes its reason.** The handoff still rejects an ordinal
outside `0..1000`. The bound now caps the delivery attempt ordinal, matching the retry's `maxAttempts`
ceiling. It is no longer described as the wire ceiling on `correlation.retry_attempt`.

**5. The collector's key is the canonical serialization of the whole submission.** The key-sorted
canonicalization from #391 stays, and only the exclusion goes. The design of #391 names "a future contract
change to attempt identity" as the trigger to revisit that exclusion, and this is that change.

Alternatives:

- **Keep the exclusion.** Rejected. A same-identity body that differs only in `retry_attempt`, which a
  conforming producer never sends, would be acknowledged silently.
- **Compare raw bytes.** Rejected. Key-order differences would become conflicts, and that is a separate
  decision from #577.

**6. The delta shapes are decided by what strict validation accepts.** Probed with `openspec validate
--strict`:

- A `MODIFIED` requirement cannot drop or rename a scenario, and neither can `RENAMED` plus `MODIFIED`.
- `REMOVED` plus `ADDED` under the same name is rejected.
- `REMOVED` plus `ADDED` under a new name validates, and archives with the new requirement appended at
  the end of the capability.

A requirement with a scenario that becomes false therefore takes the new-name route. The others stay
`MODIFIED`.

**7. The fold adds a new `CURRENT` pin set.** Alternatives:

- **Fold without one.** Rejected. Every later precedence run fails, and #570 masks it.
- **Leave the delta unfolded until CB-018 resumes.** Rejected. The change could never archive, and the
  code would contradict a current capability, which an active delta cannot override.

The new file is `governance_core` under a directory the preserved `define-normative-precedence-lifecycle`
change owns. The owner's approval of this proposal authorizes that one file, and the existing pin sets stay
byte-identical.

**8. Where the vocabulary lives.** It goes in new glossaries for the Node binding and the collector,
registered in `CONTEXT-MAP.md`, with a system-wide ADR. It does not go in:

- sdk-core's glossary, because the collector capability forbids a collector change range from modifying
  sdk-core;
- `openspec/CONTEXT.md`, which `define-normative-precedence-lifecycle` owns;
- the contract's directory, which is frozen.

**9. Two test seams, both existing.**

- **The Node binding's public delivery API.** The bounded retry is composed over the real handoff, with
  a recording exchange.
- **Collector ingress**, with and without storage configured.

A mutation check proves the Node tests catch a projection that rewrites a correlation field. No
cross-package seam is added. The kit gate never drives the collector today, and the two seams meet at
the request body.

## Risks / Trade-offs

- **[Mixed kit versions]** An old handoff against a new collector sees its delivery retries rejected as
  conflicts. → The fix ships in one kit identity carrying both packages.
- **[Existing non-production stores]** A store written before this change keys records without
  `retry_attempt`, so an upgraded collector reports a canonical redelivery of such a record as a storage
  conflict. → Stores are synthetic and non-production by authorization (#343, #115). Discard them before
  upgrading. No migration is provided.
- **[A `governance_core` write into a preserved workstream's directory]** → The owner authorizes it in
  this proposal. The write adds one file and mutates none, and the change carries a full assessment.
- **[The contract text stays ambiguous]** The archived design row and the "Queue retry" scenario are frozen
  and unchanged. → This change's reading is recorded in the ADR and flagged to CB-018 on #577.
- **[Requirement relocation]** Four requirements move to the end of their capability at the fold. → Order
  in a capability carries no meaning.

## Migration Plan

1. The proposal, then the implementation: commits on one branch, landing through the owner's approval.
2. The fold, in its own PR: the canonical specs plus the new pin set.
3. The archive, in its own PR.

Rollback is a revert of the implementation commit. The collector's exclusion must return in the same
revert, or old producers' delivery retries become conflicts.
