## Why

The SDK evaluation alpha (#575) built the kit it promised, but it has not answered its question: would a
developer new to Bloodtrail choose this SDK over emitting their own audit JSON? The evaluation (#605) had one
evaluator, the project owner. The owner's decision on #609 is "CONTINUE, limited to completing independent
developer validation".

The readiness review of 2026-09-29, at `main` `ad894df`, found that the kit would break or distort the very
metrics an independent evaluation measures:

- **pnpm 11 and 12 cannot install it.** They no longer read the `pnpm` field in `package.json`, so the
  kit's pnpm override is dropped. pnpm 12 is npm's `latest`. The gate pins pnpm 10, so CI stays green.
- **The example receiver misbehaves.**
  - One event that the collector ingress admits and SDK validation rejects crashes it.
  - It answers a byte-identical redelivery with 400, which the sink reports as `SDK_SINK_REJECTED`.
  - It answers every ingress rejection with 401.
  - It serves every accepted event body on an unauthenticated health endpoint.
- **The M3 materials are compromised.** The seeded invalid-call document ships its answers. Two of its fixes
  and the questionnaire name methods that do not exist, and it shows an error field that `SafeAuditError`
  does not have.
- **The documents contradict the code.** The context-scope section overstates what a scope removes. The
  Node binding README says "provisional". The supported-versus-planned table lists retry as supported. The
  integrity steps name files the kit does not ship.
- **The identity does not bind the artifacts.** The builder packs whatever ignored build output is on
  disk. A stale build yields a kit marked distributable, with the right commit and a different core digest.
  The identity covers no document or example.
- **Four checks are weaker than their ratified requirements.**
  - "Byte-identical" compares the receiver's input with its own re-serialization.
  - A deadline during the response body is reported as a malformed acknowledgment, not `timeout`.
  - Several gate checks have no planted-defect control.
  - The kit digest sorts with a locale-dependent comparison.

Kit v1 (`e64fdb9`) also no longer matches `main`, because the #577 fix changed the Node binding after it.
An independent evaluation therefore needs kit v2, with a new identity and a new evaluation authorization.
#575's authorization was archived with `deliver-sdk-evaluation-alpha`, so it cannot be amended.

#649 is the spec, and its sub-issues #650–#670 are the tickets. This change is the governed lane for all of
them.

- It owns every path the #649 tickets touch, so each implementation PR passes association without a
  proposal of its own.
- It carries the new evaluation authorization, and orchestrates the final kit, the evaluator amendment, the
  evaluation, the fold and the archive.

## Authorization

- An agent drafted this change and `evaluation-authorization.md` for #650. The owner authorizes both with
  one act in two parts:
  - an approval comment on this proposal PR that names `deliver-sdk-evaluation-kit-v2` and the head commit
    SHA being approved;
  - the owner's own merge of that commit.

  `CONTRIBUTING.md` says merged state alone is never approval, and `.hermes.md` binds approval to an exact
  commit hash. That is why the comment is required, and why no agent merges this PR or arms auto-merge on
  it. Nothing in this change claims approval before that act.
- **What the act authorizes:**
  - the implementation tasks of this change (#651–#663);
  - building and verifying kit v2 (#664), without distributing it.
- **What it does not authorize:**
  - evaluators: this version of the record names none;
  - distributing kit v2, or starting the evaluation (#666).

  Both need an amendment to the authorization that names the evaluators by handle and kit v2's identity,
  and takes effect through the same two-part act. That amendment is task 6.1 (#665).

## What Changes

- **Installers.** The kit's pnpm override moves into a generated pnpm settings file, and the consumer
  manifest drops its `pnpm` field. The gate installs with npm and with one pinned release of each supported
  pnpm major: 10, 11 and 12.
- **Identity.**
  - The builder builds every packed artifact from a clean copy of the tracked sources.
  - A checksum list covers every kit file, and the identity gains an identity-format version.
  - Every ordering in the identity is code-point order.
- **Delivery checks.**
  - The gate compares the bytes the SDK validated at the sender with the bytes the receiver received.
  - The failure-path program becomes a real, type-checked file.
  - A deadline during the response body is reported as `timeout`, fixed in the governed fetch delivery
    adapter.
  - Every gate check gains a planted-defect control.
- **Example receiver and service.**
  - The receiver authenticates, bounds the body and runs SDK validation before the collector ingress sees
    the event. It answers each case with a status that names it, acknowledges a duplicate, and keeps
    serving after any rejection.
  - The service becomes a real `node:http` service with request handlers and a driver.
- **Evaluator documents.**
  - The M3 answer key moves to a facilitator-only document that the kit never contains.
  - The gate checks that inline API references exist, and that planned features are never described as
    supported.
  - Incorrect statements are corrected, and a new known issue discloses the over-required input types.
  - #575's stories 49–51 are restored: framework wiring, the test sinks, and deterministic clock and
    identifier injection.
- **Kit v2 and the evaluation.** Kit v2 is built from a clean commit and its identity is recorded before any
  distribution. The owner's amendment names the evaluators, and the evaluation runs with #575's metrics,
  thresholds and rules unchanged.
- **No release.** Package versions stay core 0.4.0, Node binding 0.4.0 and collector 0.1.0. Every package
  stays `private` and `UNLICENSED`, with no tag and no publication.

### Deviations from #649

None. A later ticket that must deviate from #649 records the deviation here, in the PR that lands it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-node`:
  - MODIFIED *The evaluation kit installs and runs outside any workspace and its gate fails closed*;
  - MODIFIED *The evaluation kit has a reproducible identity and authorizes no release*;
  - MODIFIED *Evaluator documentation states the alpha's boundaries and is checked*;
  - ADDED *The example receiver models a careful ingress*.

The fetch delivery adapter's requirement is not modified. It already maps "a deadline to `timeout`"; the
response-body case is brought into conformance with it.

The canonical contract, the core package, the collector package and every other capability are untouched.

## Impact

- **`packages/security-audit-sdk-node/`:**
  - the kit builder, the gate, the controls, the doc-block helper and the loopback peer, plus new check
    modules beside them;
  - the examples and the evaluator documents, which sit outside the packed files;
  - a facilitator-only answer key, outside `docs/`;
  - the README;
  - the fetch delivery adapter's response-body read, its test, and the scope test that pins its coupling
    inventory.
- **The canonical Node binding spec**, through the fold.
- **Nothing else.** No contract, core, collector, CI workflow, governance-core or CB-018-owned path is
  touched. `assessment.json` lists every owned path exactly.
- **Boundaries.** This change does not authorize production, publication, a release, browser telemetry, or
  any transport other than the existing non-production HTTP audit sink. `evaluation-authorization.md` holds
  the full list, and it is the only place that list is kept.
