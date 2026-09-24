## Why

Bloodtrail has a frozen canonical contract (`2.1.0`), a platform-neutral SDK core, a Node binding and a
non-production collector ingress. No developer outside this repository has used them, and nothing proves
one can. #575 records the owner's decision to find out before investing further in governance, deployment
or enterprise enforcement: ship a non-production **evaluation alpha**, run a structured evaluation with
fresh developers, and then decide whether to continue, change direction or stop.

This change is the umbrella for that work. It owns every path the evaluation alpha touches, so each
implementation PR (the sub-issues of #575) passes association without a proposal of its own. It also
carries the evaluation authorization, which the owner approves by merging this proposal.

## Authorization

- The owner confirmed #575's planning decisions in the 2026-09-23 planning session. Confirming a plan
  is not an authorization.
- An agent drafted `evaluation-authorization.md`. The owner authorizes it with one act, made of two
  parts:
  - an approval comment on this proposal PR that names the head commit SHA being approved;
  - the owner's own merge of that commit.

  `CONTRIBUTING.md` says merged state alone is never approval, and `.hermes.md` binds approval to an
  exact commit hash. That is why the comment is required, and why no agent merges this PR or arms
  auto-merge on it. Nothing in this change claims approval before that act.
- The act authorizes the implementation tasks in `tasks.md`. Once kit v1's identity is recorded, it also
  authorizes distributing the evaluation kit to the evaluators named in the authorization. It authorizes
  nothing else; the authorization's "Not authorized" section lists the exclusions.
- The HTTP audit sink below is added under this explicit authorization, for non-production evaluation
  only. It is not an incidental transport.
  - `CONTRIBUTING.md` asks for each transport to have "its own OpenSpec change". #575 instead placed
    the sink in this umbrella, as the owner decided. The sink still gets its own requirements, its own
    ADR and its own tickets.
  - The owner's approval of this proposal confirms that reading. A reviewer who wants the stricter
    reading should split the sink into its own change before approving.
  - The governance-core boundary statements that do not yet mention the sink (`CLAUDE.md`, `.hermes.md`,
    `AGENTS.md`) go to one later batched documentation change, as #575 decided.

## What Changes

- **HTTP audit sink.** The Node binding gains `createHttpAuditSink`. It implements the existing sink
  interface as one byte-exact POST per event, sent through the governed fetch delivery adapter.
  - Its response classification is extracted from the delivery handoff into one internal classifier
    that both use, so the two rule sets cannot drift.
  - It retries nothing, queues nothing, and claims no delivery-class conformance.
  - It is an additive widening of the frozen Node surface, recorded in a new ADR-NODE-004.
- **Error catalog.** A catalog in the Node binding documents every exported SDK and contract error code:
  meaning, causes, fix, and the mappings that mislead. A test keeps it complete against the core's
  exported code lists.
- **`authoritativeTenant` input type.** The constructor's input type becomes a union that encodes its
  existing runtime rule. Runtime behaviour is unchanged.
- **Conformance suite.** A table-driven suite in the core's runtime tests proves type/runtime agreement
  and exact diagnostics for all 24 named events.
- **Evaluation kit and its gate.**
  - A kit builder packs the three packages, together with an example service, an example receiver, a
    generated consumer manifest and the evaluator docs.
  - A gate in the Node binding's validation chain installs the kit with npm and pnpm outside any
    workspace root. It type-checks the kit, runs it end to end over loopback, and proves that one core
    copy resolves. It also proves each of its checks fails on a planted defect.
- **Documentation.**
  - In the Node binding: a quickstart, the wire protocol and failure table, privacy guidance, a
    supported-versus-planned table, known issues, and evaluation materials.
  - Corrections to the core, Node binding and root READMEs.
- **Kit identity.** Each kit is identified by its commit SHA, the SHA-256 of each packed artifact, and a
  kit digest.
  - There is no tag and no version move: the core stays 0.4.0, the Node binding 0.4.0 and the collector
    0.1.0.
  - Every package stays `private` and `UNLICENSED`.

### Deviations from #575

The sub-issues of #575 are the plan of record. #575's body stays unchanged. Where the sub-issues differ
from it, the differences are these:

1. **The declared consumer TypeScript range stays `>=5.9.2 <6`.** It is pinned in sdk-core's
   `scripts/check-coherence.mjs`, which the active CB-018 change `define-normative-precedence-lifecycle`
   owns. The kit gate type-checks with TypeScript 6 and 7 as measured compatibility outside the declared
   range, and the docs describe it in exactly those terms.
2. **The sink's outcome callback reuses the shared classifier's existing codes.** Those codes are
   `acknowledged`, `http_permanent`, `http_retryable`, `timeout`, `transport_failure`,
   `malformed_acknowledgment` and `unexpected_response`. #575 proposed `rejected_4xx`, `failed_5xx`,
   `network` and `protocol` instead, but 408, 425 and 429 are 4xx statuses that classify as failures.
3. **The error catalog and evaluator docs live in the Node binding package**, outside its packed files.
   That keeps them clear of sdk-core's pinned package checks.
4. **No workflow edit.** Both CB-018 changes own `.github/workflows/ci.yml`. The kit gate therefore runs
   in the Node binding's `test` and `validate` scripts, which the required `sdk` context already runs.
5. **The delivery order ends final kit → evaluation → fold → archive.** #575 ordered it "fold, archive,
   then kit v1 and evaluation". This order lets evaluation re-issue fixes land under an active, unfolded
   change, so the canonical specs are written once.
6. **Sink failures do not gain the event identifier, and #581 is withdrawn.** The owner chose this on
   2026-09-23, when the conflict surfaced while this proposal was being drafted.
   - The ratified requirement "Every delivery intent retains lifecycle and bounded sink behavior" says
     sink diagnostics SHALL NOT serialize event IDs, and `tests/f11-delivery-intent.test.ts` asserts it.
   - `check-coherence.mjs` freezes that requirement byte for byte. Adding the identifier would therefore
     either contradict a frozen requirement or need a CB-018-owned edit.
   - Instead, a developer correlates a failed send through the HTTP sink's outcome callback, which
     carries the event identifier. That is how #575's user story 36 is met.
   - Two other tickets change to match:
     - #583 no longer tells developers to read `eventId` from a result;
     - #598 asserts the event identifier on every `onOutcome` call, not on every result.
   - Nothing here sides with either side of the existing inconsistency. The core spec's founding "Sink
     fails" scenario says a sink failure preserves the event ID, which already disagrees with F-11.
     `design.md` records that inconsistency.

`tasks.md` accounts for every sub-issue of #575. Three appear as notes rather than tasks: #581, which is
withdrawn, and #608 and #609, which write nothing to the repository. A task on either of those two would
leave the fold and archive waiting on an issue-only decision.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-node`: ADDED requirements for:
  - the HTTP audit sink and its shared response classification;
  - the error catalog and its completeness;
  - the evaluation kit, its gate and its identity;
  - the evaluator documentation;
  - the additive widening of the frozen surface.
- `security-audit-sdk-core`: one ADDED requirement, for the `authoritativeTenant` input type. No founding
  or remediation requirement is modified.

The canonical contract, the collector package and the `delivery-conformance-contract` capability are
untouched.

## Impact

- **`packages/security-audit-sdk-node/`:**
  - two new source files;
  - `index.ts`, the export and scope pins, `compatibility.json`, ADR-NODE-004 and the README;
  - new tests and kit scripts;
  - `examples/` and `docs/`, which are outside the packed files;
  - `package.json` scripts.
- **`packages/security-audit-sdk-core/`:**
  - `src/context.ts` (type only) and the type tests;
  - new conformance tests, plus the two tests that already consume the contract's examples;
  - `API.md` and `README.md`;
  - one verification pin that counts `context.ts` declarations.
- **The root `README.md`.**
- **Nothing else.** No contract, collector, workflow, governance-core or CB-018-owned path is touched.
  `assessment.json` lists every owned path exactly.
- **The preserved Candidate B workstream** (CB-018 #544, CI570 #570) is not touched and does not block this
  change. A product-only probe run on 2026-09-23 against `main` at `73493c5` failed only
  `openspec-association-unrelated`, which this change's ownership resolves.
- **Boundaries.** This change does not authorize production, publication, browser telemetry, or any
  transport other than the non-production HTTP audit sink. `evaluation-authorization.md` holds the full
  list, and it is the only place that list is kept.
