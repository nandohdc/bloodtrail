## Why

Bloodtrail has a frozen canonical contract (`2.1.0`), a platform-neutral SDK core, a Node binding and a
non-production collector ingress. No developer outside this repository has used them, and nothing proves
one can. #575 records the owner's decision to find out before investing further in governance, deployment
or enterprise enforcement: ship a non-production **evaluation alpha**, run a structured evaluation with
fresh developers, and then decide whether to continue, change direction or stop.

This change is the umbrella program for that work.

- It owns every path the evaluation alpha touches, except the HTTP transport. Each implementation PR (a
  sub-issue of #575) therefore passes association without a proposal of its own.
- It carries the evaluation authorization and orchestrates the evaluation, the fold and the archive.
- The HTTP audit sink is a transport, so it has its own change, `add-sdk-node-http-audit-sink`. That
  change is proposed in the same PR, and this change depends on it.

## Authorization

- The owner confirmed #575's planning decisions in the 2026-09-23 planning session. Confirming a plan is
  not an authorization.
- An agent drafted `evaluation-authorization.md`. The owner authorizes it, and both changes, with one act
  in two parts:
  - an approval comment on this proposal PR that names both changes and the head commit SHA being
    approved;
  - the owner's own merge of that commit.

  `CONTRIBUTING.md` says merged state alone is never approval, and `.hermes.md` binds approval to an
  exact commit hash. That is why the comment is required, and why no agent merges this PR or arms
  auto-merge on it. Nothing in this change claims approval before that act.
- **What the act authorizes:**
  - the implementation tasks of both changes, and building the evaluation kit;
  - nothing else. The authorization's "Not authorized" section lists the exclusions.
- **What it does not authorize:**
  - evaluators: this version of the record names none;
  - distributing the kit, or starting the evaluation (#605).

  Both need an amendment to the authorization that names the evaluator handles and takes effect through
  the same two-part act. That amendment is task 7.1.
- **The HTTP audit sink** is a transport, so it gets its own OpenSpec change and explicit authorization,
  as `CONTRIBUTING.md` requires. That change is `add-sdk-node-http-audit-sink`, and the owner's act above
  names it.
- **Governance-core documents.** `CLAUDE.md`, `.hermes.md` and `AGENTS.md` carry boundary statements that
  do not yet mention the sink. As #575 decided, they are updated later, in one batched documentation
  change.

## What Changes

- **Depends on the HTTP audit sink.** `add-sdk-node-http-audit-sink` adds `createHttpAuditSink`, with:
  - its shared response classifier and its `onOutcome` callback;
  - its flush and shutdown behaviour;
  - its export widening.

  The kit milestones in this change that send events over HTTP wait for that change's tickets.
- **Error catalog.** A catalog in the Node binding documents every exported SDK and contract error code,
  with its meaning, causes and fix, and the mappings that mislead. A test keeps the catalog complete against
  the core's exported code lists.
- **`authoritativeTenant` input type.** The constructor's input type becomes a union that encodes its
  existing runtime rule. Runtime behaviour is unchanged.
- **Conformance suite.** A table-driven suite in the core's runtime tests proves that types and runtime
  agree, and that diagnostics are exact, for all 24 named events.
- **Evaluation kit and its gate.**
  - A kit builder packs the three packages, together with an example service, an example receiver, a
    generated consumer manifest and the evaluator docs.
  - A gate in the Node binding's validation chain installs the kit with npm and pnpm outside any
    workspace root. It then type-checks the kit, runs it end to end over loopback, and proves that one
    core copy resolves. It also proves that each of its checks fails on a planted defect.
- **Documentation.**
  - In the Node binding: a quickstart, the wire-protocol page with its failure table, privacy guidance,
    a supported-versus-planned table, known issues, and the evaluation materials.
  - Corrections to the core, Node binding and root READMEs.
- **Kit identity.** Each kit is identified by its commit SHA, the SHA-256 of each packed artifact, and a
  kit digest.
  - There is no tag and no version move: the core stays at 0.4.0, the Node binding at 0.4.0 and the
    collector at 0.1.0.
  - Every package stays `private` and `UNLICENSED`.

### Deviations from #575

The sub-issues of #575 are the plan of record. #575's body stays unchanged. Where the sub-issues differ
from it, the differences are the ones below. This list is the only place they are recorded, and the
transport change refers to it.

1. **The declared consumer TypeScript range stays `>=5.9.2 <6`.** It is pinned in sdk-core's
   `scripts/check-coherence.mjs`, which the active CB-018 change `define-normative-precedence-lifecycle`
   owns. The kit gate type-checks with TypeScript 6 and 7 as measured compatibility outside the declared
   range, and the docs describe it in exactly those terms.
2. **The sink's outcome callback reuses the shared classifier's existing codes.** Those codes are
   `acknowledged`, `http_permanent`, `http_retryable`, `timeout`, `transport_failure`,
   `malformed_acknowledgment` and `unexpected_response`. #575 proposed `rejected_4xx`, `failed_5xx`,
   `network` and `protocol` instead, but 408, 425 and 429 are 4xx statuses that classify as failures. The
   transport change implements this deviation.
3. **The error catalog and evaluator docs live in the Node binding package**, outside its packed files.
   That keeps them clear of sdk-core's pinned package checks.
4. **No workflow edit.** Both CB-018 changes own `.github/workflows/ci.yml`. The kit gate therefore runs
   in the Node binding's `test` and `validate` scripts, which the required `sdk` context already runs.
5. **The delivery order ends final kit → evaluation → fold → archive.** #575 ordered it "fold, archive,
   then kit v1 and evaluation". This order lets evaluation re-issue fixes land under active, unfolded
   changes, so the canonical specs are written once.
6. **Sink failures do not gain the event identifier, and #581 is withdrawn.** The owner chose this on
   2026-09-23, when the conflict surfaced while this proposal was being drafted.
   - The ratified requirement "Every delivery intent retains lifecycle and bounded sink behavior" says
     sink diagnostics SHALL NOT serialize event IDs, and `tests/f11-delivery-intent.test.ts` asserts it.
   - `check-coherence.mjs` freezes that requirement byte for byte. Adding the identifier would therefore
     either contradict a frozen requirement or need a CB-018-owned edit.
   - Instead, a developer correlates a failed send through the HTTP sink's outcome callback, which
     carries the event identifier, as implemented by the transport change. That meets #575's user
     story 36.
   - Two other tickets change to match:
     - #583 no longer tells developers to read `eventId` from a result;
     - #598 asserts the event identifier on every `onOutcome` call, not on every result.
   - Nothing here takes a side in the existing inconsistency: the core spec's founding "Sink fails"
     scenario says a sink failure preserves the event ID, which already disagrees with F-11. `design.md`
     records it.
7. **Two changes, not one.** #575 decided that "one umbrella OpenSpec change owns the exact paths of every
   MVP artifact". The HTTP audit sink is instead its own change, `add-sdk-node-http-audit-sink`, because
   `CONTRIBUTING.md` requires every transport to have its own OpenSpec change and explicit authorization.
   The owner chose this split on 2026-09-23, after an adversarial review. Both changes are proposed in
   this PR, so the ticket graph is unchanged.
8. **No evaluator is authorized yet.** #575 expects the authorization to name "evaluators by handle". The
   owner has not recruited them, and the handles are not invented. This version therefore authorizes
   none, and forbids distribution until an amendment names them (task 7.1). The owner chose this on
   2026-09-23. The effect is that implementation does not wait for recruitment.

`tasks.md` accounts for every sub-issue of #575. The following appear there as notes rather than tasks:

- the HTTP-specific tickets, whose tasks live in the transport change;
- #581, which is withdrawn;
- #608 and #609, which write nothing to the repository. A task for either would leave the fold and the
  archive waiting on a decision recorded only in an issue.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-node`: ADDED requirements for:
  - the error catalog and its completeness;
  - the evaluation kit, its gate and its identity;
  - the evaluator documentation.

  The HTTP sink's requirements belong to `add-sdk-node-http-audit-sink`.
- `security-audit-sdk-core`: one ADDED requirement, for the `authoritativeTenant` input type. No founding
  or remediation requirement is modified.

The canonical contract, the collector package and the `delivery-conformance-contract` capability are
untouched.

## Impact

- **`packages/security-audit-sdk-node/`:**
  - the kit scripts and a pack-and-install harness;
  - `examples/` and `docs/`, which are outside the packed files;
  - the README, the error-catalog test, and `package.json` scripts.

  Every sink file is owned by the transport change.
- **`packages/security-audit-sdk-core/`:**
  - `src/context.ts` (type only) and the type tests;
  - new conformance tests, plus the two tests that already consume the contract's examples;
  - `API.md` and `README.md`;
  - one verification pin that counts the declarations in `context.ts`.
- **The root `README.md`.**
- **Nothing else.** No contract, collector, workflow, governance-core or CB-018-owned path is touched.
  `assessment.json` lists every owned path exactly, and no path is owned by both changes except the
  canonical Node spec.
- **The preserved Candidate B workstream** (CB-018 #544, CI570 #570) is not touched and does not block this
  change. A product-only probe run on 2026-09-23 against `main` at `73493c5` failed only
  `openspec-association-unrelated`, which this change's ownership resolves.
- **Boundaries.** This change does not authorize production, publication, browser telemetry, or any
  transport other than the non-production HTTP audit sink. `evaluation-authorization.md` holds the full
  list, and it is the only place that list is kept.
