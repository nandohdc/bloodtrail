## Context

This proposal is bounded to the Node binding's non-production evaluation kit. The active candidate modifies
five existing Node binding requirements, while the future fold replaces their canonical blocks only after the
implementation tickets have merged. It uses the vocabulary in `packages/security-audit-sdk-node/CONTEXT.md`:
a **kit gate** produces a **verification summary**; a **planted-defect control** measures one defect and
proves its named check fails closed; a **verification kit** is distinct from a **distributable kit**; and a
**kit identity**, **kit digest**, and **archive digest** identify no release.

The candidate is security-sensitive and declares only `security-audit-sdk-node`. It neither implements a
fix nor changes the canonical specification in this proposal. The five deltas will each replace one complete
canonical requirement block and retain every scenario that they do not deliberately change.

## Governance Metadata

```yaml
security_sensitive: true
capabilities: [security-audit-sdk-node]
modified_requirements: 5
```

## Design Pattern Assessment

### Classification, scope, and forces

This is a full, direct-implementation assessment against proposal baseline
`0f3f8a4eb9dac6768cb02581e2c4b07389e6419b`. It declares only
`security-audit-sdk-node`, is security-sensitive, and matches the `integration`,
`lifecycle_or_state`, `security_sensitive_behavior`, and
`canonical_capability_requirement` triggers. The candidate changes complete
canonical requirement blocks for the non-production kit, identity, evaluator
documentation, receiver, and governed fetch adapter; it therefore has material
capability impact.

The direct approach responds to six coupled forces:

1. the kit gate and planted-defect controls can make an unproved fail-closed
   claim;
2. format-2 identity and a distributable build can be relabelled or vary without
   binding the full kit;
3. the receiver can read after deciding a rejection or pass an SDK-invalid event
   to ingress;
4. document, answer-key, installer, and synthetic-value gaps can misstate the
   evaluated kit without a gate failure;
5. a non-deadline response-body read error currently cannot compose with the
   existing delivery retry; and
6. #702 through #719 share implementation and verification paths, while the CI
   workflow and `openspec/CONTEXT.md` remain outside this candidate.

`assessment.source.json` is the authored assessment record and
`assessment.json` is its generated form. Its exact owned paths cover the
proposal directory, canonical fold target, Node package test script, affected
kit builder, gate, controls, helpers, receiver and examples, the relevant
Node documents and facilitator key, fetch adapter, and focused verification.
The verification paths include `tests/scope-mutations.test.ts`, which pins the
scope inventory, and `tests/http-audit-sink-mutations.test.ts`, which pins
fetch-adapter mutants and their count. It owns no directory prefix other than
`openspec/changes/harden-evaluation-kit-gate/`, and expressly excludes
`.github/workflows/ci.yml` and `openspec/CONTEXT.md`.

### Candidate approaches and selection

- **`approach-direct-ticket-bounded-hardening` (selected):** one active change
  gives the related fixes exact ownership, preserves five complete requirement
  replacements, maps each ticket to an implementation invariant, then folds and
  archives separately.
- **`approach-per-ticket-proposals` (rejected):** the tickets repeatedly change
  the same gate, builder, controls, receiver, and document inventory. Separate
  active changes would overlap exact ownership and could not preserve one
  ordered fold and archive record.
- **`approach-amend-archived-kit-change` (rejected):** an archived change cannot
  acquire new implementation ownership or rewrite its historical requirements,
  so it cannot associate the fixes that need an active candidate and later
  fold.
- **`approach-ci-workflow-control-surface` (rejected):** a workflow-only command
  would leave the Node binding's per-version `test` surface incomplete and
  requires the excluded governance-core workflow path. The selected approach
  makes the controls runtime gates through that package script.

The selection introduces no catalog-pattern claim, new production integration,
storage, release, publication, or delivery substrate. It keeps the settled
fetch-adapter scenario name `A redirect is never followed` exactly once in the
delta.

### Security and correctness consequences

- **Audit integrity:** verification compares the bytes the SDK handed to the
  HTTP audit sink, gates checks by stable identity, and binds format-3 kit
  identity material.
- **Authentication or authorization:** the receiver authenticates before body
  interpretation and only sends an SDK-valid event to collector ingress.
- **Authority provenance:** the correction retains SDK validation before
  ingress; it does not alter authority constructors, brands, or provenance.
- **Concurrency:** no concurrent delivery mechanism is introduced; receiver and
  gate controls must preserve the existing bounded request and disposable-work
  behavior under their existing asynchronous execution.
- **Confidentiality:** answer-key material is detected in every kit file and
  artifact text entry, credentials are not exposed, and examples use synthetic
  values.
- **Cryptography:** the SHA-256 checksum list, kit digest, and archive digest
  identify material without acting as a signature or release authority.
- **Error disclosure:** receiver statuses reveal no body detail on
  authentication failure, and gate diagnostics identify checks rather than kit
  content or credentials.
- **External security integration:** loopback receiver and HTTP audit sink
  checks remain non-production; package installation is verification-time only
  and introduces no runtime dependency.
- **Fail posture:** each measured planted defect must fail at its named stable
  check identity, and unlisted installer settings, answer-key material, or
  non-synthetic values fail the gate.
- **Lifecycle:** a bounded receiver stops reading after the limit, a
  distributable kit is built from a clean clone, and the fold and archive remain
  separate lifecycle steps.
- **Mutation ownership:** exact paths confine each ticket, with D1 requiring an
  amendment to carry only that ticket's work; no CI workflow or OpenSpec context
  path is acquired.
- **Privacy transformation:** no transformation hook changes; the kit and
  receiver continue to use synthetic data in non-production evaluation.
- **Resource retention:** the receiver bounds request consumption, and kit
  builds, installs, and controls use disposable locations outside the live
  repository.
- **Retry or redelivery:** only a non-deadline response-body read error changes
  to `transport_failure`, allowing the existing delivery retry to redeliver the
  unchanged occurrence; deadlines and malformed acknowledgments remain
  distinct.
- **Trust boundary:** the receiver validates before ingress admission, and the
  fetch adapter retains its configured-origin and no-redirect boundary.

### Implementation invariants and evidence

| Invariant | Ticket tasks | Planned evidence |
| --- | --- | --- |
| `implementation-verification-summary-and-isolated-controls` | 1.1, 2.1, 3.1 | Stable check identities name only executed work; each measured plant fails at its own identity and fails the control when that check is disabled. |
| `implementation-format-three-identity-and-deterministic-kit` | 4.1, 5.1, 6.1 | Format 3 includes `identity.json` in the checksum list, records the outside-list kit digest, rejects format 2, and rejects clean-build variation or non-regular input. |
| `implementation-bounded-receiver-and-sdk-admission` | 7.1, 8.1, 9.1 | Receiver probes cover the bound, 401, 413, 404, 405 with `Allow: POST`, strict Bearer credentials, abort handling, SDK rejection, and corrected same-identity admission. |
| `implementation-document-and-answer-key-gates` | 10.1–15.1 | Controls prove answer-key, fence, reference, planned-feature, installer-warning, and synthetic-value failures at their named checks. |
| `implementation-response-body-failure-redelivery` | 16.1 | Fetch-adapter, HTTP-sink, retry, scope-inventory, and mutation evidence distinguishes deadline and malformed-acknowledgment paths from non-deadline `transport_failure`. |
| `implementation-folds-five-complete-requirements` | 17.1 | The fold has five complete replacement blocks only, with retained canonical scenarios and unique headings. |
| `implementation-archives-after-the-fold` | 18.1 | A separate archive follows the fold, moves the candidate without a canonical write, and keeps its task unchecked until that work begins. |

The assessment's `verification_task_ids` names every unchecked group from 1.1
through 18.1. It must be re-evaluated if a ticket needs an unowned path, an
additional capability, a different security trigger, a new API or delivery
mechanism, a different fold ordering, or a change to the settled redirect
scenario name.

## Goals / Non-Goals

**Goals:**

- Make every gate claim and planted-defect control evidence-bearing and fail closed.
- Bind a format 3 kit identity to its checksum list without treating a digest as an authorization.
- Check every kit document, answer-key representation, document claim, and synthetic value required by the
  settled scope.
- Specify a receiver that never reads past its body bound, regardless of the response it sends.
- Map non-deadline response-body read failures so the existing delivery retry can redeliver the identical
  occurrence.

**Non-Goals:**

- Authorizing a release, publication, production deployment, storage, or a new delivery substrate.
- Editing the contract, Core, collector, a CI workflow, or a governance-core path.
- Adding a sixth requirement or changing the HTTP audit sink requirement.
- Reopening the settled non-deadline response-body classification.

## Decisions

### D1. One active change has exact ownership, with ticket-bounded amendments

The assessment will list exact repository-relative paths. An amending pull request carries only its own
ticket's work; it updates the candidate's owned paths only when that ticket proves the listed set is
insufficient. The owner merges any pull request that amends owned paths. A later ticket does not fold,
archive, or absorb another ticket's implementation work.

The fold is #718 and changes the canonical Node binding spec only after every implementation ticket merges.
The archive is #719, follows the fold, and remains a separate unchecked task. This preserves the active
delta as the candidate record until the canonical replacement is complete.

### D2. Five full replacements, not appended obligations

The delta contains exactly these MODIFIED requirement headings:

1. `The evaluation kit installs and runs outside any workspace and its gate fails closed`
2. `The evaluation kit has a reproducible identity and authorizes no release`
3. `Evaluator documentation states the alpha's boundaries and is checked`
4. `The example receiver models a careful ingress`
5. `The governed fetch delivery adapter maps native outcomes onto the handoff's closed outcome set`

Each delta copies and replaces the whole canonical block. It preserves every unchanged canonical scenario
once, changes a scenario only where the settled scope requires it, and leaves no appended or contradictory
SHALL. The fetch-adapter delta keeps its canonical scenario `A redirect is never followed`, once, and does not
modify the HTTP audit sink requirement, whose scenario shares that name. The 2026-10-03 decision was to rename
the adapter's scenario to `The adapter never follows a redirect`. OpenSpec 1.14.0 rejects a MODIFIED block
that omits a canonical scenario and offers no scenario rename, so after strict validation rejected the
rename, the owner chose on 2026-10-03 to keep the canonical name.

### D3. The kit gate proves the checks it claims

Every check has a stable identity and contributes to the verification summary only when it ran, whether the
gate built a verification kit or checked an existing kit. Each planted-defect control makes one measured
change, asserts failure at that identity, and fails when disabling the named check allows the plant through.
The applied count comes from measured plants rather than a list of control names.

The kit gate, its controls, and the builder must run when invoked through a symlink. The Node binding's
`test` script, rather than `.github/workflows/ci.yml`, runs the kit controls on each supported Node version.
These controls are runtime gates.

### D4. Kit documents, answer-key material, and wording are all checked

The kit documents are the 13 files in `docs/`, including copied READMEs. The answer-key scan covers every
kit file and every text entry in the packed artifacts. It recognizes each fix by its code and every expected
code-and-path pair.

A TypeScript fence matches its language name in any letter case and may have an info string after the
language. Every fence names an allowlisted language. A block without `declare` runs. Every
identifier-shaped span resolves against installed declarations unless it appears on a reviewed exception
list. `occurred_at` on the known-issues page is replaced by `event.timestamp` and `event.observed_at`.

Every planned row names its feature in glossary terms. The planned delivery wording is `Delivery retry by the
HTTP audit sink, in process or durable`. The check flags any sentence, in any verb form, that names a planned
feature without a planned marker. A reviewed file-and-heading list exempts the Node README sections on frozen
primitives and the Core README sections on re-execution. Kit prose uses `re-execution`, never `retry`.

The builder stops shipping the root README. Every host, email address, IP address, and environment name in
kit documents and examples, including links, is synthetic or occurs on a reviewed gate list, which starts
empty.

### D5. Format 3 identity has one checksum-list digest

Format 3 puts `identity.json` in `checksums.sha256`. The **kit digest** is the SHA-256 of
`checksums.sha256`, remains outside that list, and is written in `kit-digest.sha256` in `shasum -c` format.
The identity includes the checksum-list material without recursively listing the digest file. The gate
refuses format 2 by name. Where entries occur inside an artifact, their order retains npm's measured-stable
order; other identity ordering remains explicit and deterministic.

The evaluation facilitator publishes the kit digest and archive digest. Neither digest authorizes a release.

### D6. Receiver read and routing decisions occur before more reading

A body within the bound is read before the receiver answers. Once a body is past the bound, the receiver
answers, closes the connection, and reads nothing more. That rule applies whatever the answer: 401, 413, and
wrong-path responses included. It prevents an unauthenticated client from causing unbounded reads after a
401 as well as closing the former post-413 gap.

A POST to another path is 404. Any other method is 405 with `Allow: POST`. The receiver continues to apply
its authentication, validation, and collector-ingress ordering without storing events or becoming a
collector deployment.

### D7. Response-body failures preserve the existing retry composition

An error while reading a response body, other than the deadline, maps to `transport_failure`. The existing
delivery retry therefore retries it. The deadline remains `timeout`, and empty, malformed, shapeless, and
over-bound acknowledgment bodies retain their protocol-error path. This is a classification correction in
the governed fetch delivery adapter; it introduces no new delivery mechanism.

### D8. Runtime-gate classification conflict

The settled scope treats the kit controls as runtime gates because the Node binding's `test` script runs them
per supported Node version. `openspec/CONTEXT.md` currently conflicts with that classification. That context
is owned by `define-normative-precedence-lifecycle` and is not changed here.

## Ticket Path, Check, and Control Plan

The table records planned ownership for one ticket at a time. Paths are repository-relative; a listed check or
control is part of that ticket's evidence, not permission for another ticket to combine work with it.

| Ticket | Planned paths | Check and control ownership |
| --- | --- | --- |
| #702 | `packages/security-audit-sdk-node/scripts/build-evaluation-kit.mjs`, `scripts/check-evaluation-kit.mjs`, `scripts/check-evaluation-kit-controls.mjs`, `docs/quickstart.md`, `docs/evaluation-guide.md` | Give each executed check an identity and compose the verification summary from checks that ran; prove symlink invocation and the no-rebuild existing-kit case. |
| #717 | `packages/security-audit-sdk-node/package.json` | Add the existing kit-control command to `test`; prove the controls run under each supported Node version without a CI-workflow edit. |
| #703 | `packages/security-audit-sdk-node/scripts/check-evaluation-kit.mjs`, `scripts/check-evaluation-kit-controls.mjs` | Isolate each named planted defect, reseal disposable copies where needed, measure changed plants, and assert the named check identity. |
| #704 | `packages/security-audit-sdk-node/scripts/build-evaluation-kit.mjs`, `scripts/evaluation-kit-checksums.mjs`, `scripts/check-evaluation-kit.mjs`, `scripts/check-evaluation-kit-controls.mjs`, `docs/evaluation-guide.md` | Build and refuse identity formats by name; prove changed commit and distributable flag fail, and recompute format 3 values. |
| #705 | `packages/security-audit-sdk-node/scripts/build-evaluation-kit.mjs`, `scripts/evaluation-kit-source-copy.mjs`, `scripts/check-evaluation-kit.mjs`, `scripts/check-evaluation-kit-controls.mjs` | Build a distributable kit from a disposable clean clone, compare it with a verification kit, and prove a real dirty tree and dropped source path fail. |
| #706 | `packages/security-audit-sdk-node/scripts/build-evaluation-kit.mjs`, `scripts/evaluation-kit-source-copy.mjs`, `scripts/evaluation-kit-checksums.mjs`, `scripts/check-evaluation-kit.mjs`, `scripts/check-evaluation-kit-controls.mjs` | Prove attributes, filters, line endings, umask, and symlinks cannot vary a distributable kit; measure and retain npm's stable artifact-entry order. |
| #707 | `packages/security-audit-sdk-node/examples/evaluation-receiver.ts`, `scripts/evaluation-kit-delivery-checks.mjs`, `scripts/check-evaluation-kit.mjs`, `scripts/check-evaluation-kit-controls.mjs` | Measure bytes consumed after the 401 and 413 decisions; a receiver that reads past the bound fails its named control. |
| #708 | `packages/security-audit-sdk-node/examples/evaluation-receiver.ts`, `scripts/evaluation-kit-delivery-checks.mjs`, `scripts/check-evaluation-kit.mjs`, `scripts/check-evaluation-kit-controls.mjs` | Use a structurally valid but SDK-invalid event, prove it is rejected before ingress admission, and prove a corrected event with the same identity is admitted. |
| #709 | `packages/security-audit-sdk-node/examples/evaluation-receiver.ts`, `scripts/evaluation-kit-delivery-checks.mjs`, `scripts/check-evaluation-kit.mjs`, `scripts/check-evaluation-kit-controls.mjs`, `docs/wire-protocol.md` | Drive Bearer-scheme, wrong-path, method, and client-abort cases; assert 404 for another POST and 405 plus `Allow: POST` otherwise. |
| #710 | `packages/security-audit-sdk-node/facilitator/seeded-invalid-calls-answer-key.md`, `scripts/evaluation-kit-answer-key.mjs`, `scripts/evaluation-kit-doc-blocks.mjs`, `scripts/check-evaluation-kit.mjs`, `scripts/check-evaluation-kit-controls.mjs`, `docs/seeded-invalid-calls.md`, `examples/seeded-invalid-calls.ts` | Type-check every answer-key fix; scan every kit file and artifact text entry for fix code and expected code/path pairs. |
| #711 | `packages/security-audit-sdk-node/scripts/evaluation-kit-doc-blocks.mjs`, `scripts/check-evaluation-kit.mjs`, `scripts/check-evaluation-kit-controls.mjs` | Extract case-insensitive TypeScript fences with info strings, require an allowlisted language on every fence, and run every block without `declare`. |
| #712 | `packages/security-audit-sdk-node/scripts/evaluation-kit-doc-references.mjs`, `scripts/check-evaluation-kit.mjs`, `scripts/check-evaluation-kit-controls.mjs`, `docs/known-issues.md` | Resolve every identifier-shaped span except reviewed exceptions and prove the corrected `event.timestamp` and `event.observed_at` references. |
| #713 | `packages/security-audit-sdk-node/scripts/evaluation-kit-doc-claims.mjs`, `scripts/check-evaluation-kit.mjs`, `scripts/check-evaluation-kit-controls.mjs`, `docs/supported-and-planned.md`, `README.md` | Check glossary-named planned features in rows and prose; preserve the reviewed Node-README and Core-README exemptions and prove unmarked verb forms fail. |
| #714 | `packages/security-audit-sdk-node/scripts/evaluation-kit-installers.mjs`, `scripts/check-evaluation-kit.mjs`, `scripts/check-evaluation-kit-controls.mjs` | Fail an installer warning that names a shipped setting and prove the pnpm-only setting control fails at that check. |
| #715 | `packages/security-audit-sdk-node/scripts/build-evaluation-kit.mjs`, `scripts/evaluation-kit-doc-claims.mjs`, `scripts/check-evaluation-kit.mjs`, `scripts/check-evaluation-kit-controls.mjs`, `examples/evaluation-service.ts`, `examples/evaluation-driver.ts`, `examples/evaluation-receiver.ts`, `examples/first-event.ts`, `examples/seeded-invalid-calls.ts` | Stop copying the root README; scan document and example hosts, emails, IPs, environments, and links against a reviewed list initially empty, with planted synthetic-value controls. |
| #716 | `packages/security-audit-sdk-node/src/fetch-exchange.ts`, `tests/fetch-exchange.test.ts`, `tests/delivery-retry.test.ts`, `tests/http-audit-sink.test.ts`, `tests/http-handoff.test.ts`, `scripts/evaluation-kit-failure-paths.ts`, `scripts/evaluation-kit-peer.mjs`, `scripts/check-evaluation-kit.mjs`, `scripts/check-evaluation-kit-controls.mjs`, `docs/wire-protocol.md` | Drive reset, short-body, malformed-chunk, and failure-table outcomes; assert non-deadline body reads become `transport_failure` and the delivery retry redelivers them. |
| #718 | `openspec/specs/security-audit-sdk-node/spec.md`, `openspec/changes/harden-evaluation-kit-gate/specs/security-audit-sdk-node/spec.md`, `openspec/changes/harden-evaluation-kit-gate/tasks.md` | Fold the five complete delta blocks only after all implementation tasks; prove canonical heading and scenario uniqueness. |
| #719 | `openspec/changes/harden-evaluation-kit-gate/` and its dated archive destination | Archive only after the fold, preserving an unchecked archive task until the archive pull request. |

Every kit document is owned, not only the ones these rows name. #711, #712, #713 and #715 check all 13 kit
documents, so a ticket may have to correct any of them when its check lands. For example,
`docs/error-catalog.md` says the SDK "never retries", and `docs/integration-and-testing.md` and `docs/privacy.md`
use `127.0.0.1`. The assessment therefore also owns `docs/error-catalog.md`, `docs/evaluation-questionnaire.md`,
`docs/integration-and-testing.md`, `docs/privacy.md` and `packages/security-audit-sdk-core/README.md`, whose copy
ships as a kit document. The root `README.md` is not owned: it is documentation-only, and #715 stops shipping it.

## Alternatives Beyond the Assessment Candidate Cap

- Put the controls back in `.github/workflows/ci.yml`. Rejected because the settled scope makes the Node
  binding's `test` script the per-version control surface, and the workflow is outside this change.
- Continue accepting format 2 while adding format 3. Rejected because the gate must refuse format 2 by name.
- Limit answer-key scanning to Markdown marker lines. Rejected because copied or renamed answer-key content
  must fail wherever it appears in kit files or artifact text.
- Drain a request after replying 401, 413, or a wrong-path answer. Rejected because the receiver must read
  nothing more past the bound.
- Treat response-body read failures as malformed acknowledgments. Rejected because a non-deadline read
  failure is a transport failure and must compose with delivery retry.

## Risks / Trade-offs

- The gate becomes broader and more controls run under Node `test`; each ticket records its own measured
  cost rather than treating it as a threshold.
- Some document terminology and copied README sections need reviewed exceptions. Exceptions are a
  file-and-heading list, not a global wording bypass.
- Format 3 changes identity material. The separate kit digest and archive digest avoid a self-referential
  checksum list without turning either digest into a release signal.

## Migration Plan

There is no deployment or release migration. Implementation tickets land in native blocker order. #718 folds
the five deltas into the canonical Node binding spec; #719 archives the candidate afterwards.

## Open Questions

- Should the runtime-gate definition in `openspec/CONTEXT.md` be reconciled by its owning
  `define-normative-precedence-lifecycle` change so it agrees that per-version kit controls in the Node
  binding's `test` script are runtime gates?
