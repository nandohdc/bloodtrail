## Context

`proposal.md` explains why this change exists. #575 is the spec, and its sub-issues are the tickets.
This document records the decisions that shape every implementation PR under this change: the paths
each ticket owns, where new files go, and the repository constraints the tickets must work within.

The HTTP audit sink is its own change, `add-sdk-node-http-audit-sink`. Its `design.md` records the
sink's decisions: how it composes the fetch adapter, the shared classifier, and the outcome callback.

State at `main` `73493c5`, relevant to the approach:

- **The core.** It returns `AuditResult` values and funnels every sink outcome through one mapping:
  `rejected` becomes `SDK_SINK_REJECTED`; anything else becomes `SDK_SINK_FAILURE`, carrying only the
  event name.
  - The ratified F-11 requirement "Every delivery intent retains lifecycle and bounded sink behavior"
    forbids event IDs in those diagnostics.
  - Coherence freezes that requirement byte for byte.
- **The Node binding.** Its public surface is frozen (ADR-NODE-001) and widens only additively. It has
  no sink that connects the SDK to its HTTP delivery pieces; the transport change adds one.
- **The Node binding's CI wiring.** The required `sdk` job runs Node binding `validate` on Node 26.5.0
  only. On the Node 24.2.0 leg it runs only `npm run test`, and it installs the collector only after the
  Node binding has validated.
- **`owned_paths`.** Two CB-018 changes are active and own `.github/workflows/ci.yml`, sdk-core's
  `verification-lifecycle.json`, `contract-provenance.json`, `scripts/check-coherence.mjs`,
  `scripts/check-changed-paths.mjs`, and the governance scripts and policy. `owned_paths` holds at most
  60 entries.

## Goals / Non-Goals

**Goals:**

- Every implementation PR passes association through one of the two changes, and never touches a
  CB-018-owned or governance-core path.
- Parallel tickets never edit the same file, except where the blocking graph already serializes them.
- The kit gate runs on both CI Node versions without a workflow edit.

**Non-Goals:**

- Resolving the internal inconsistency in the canonical core spec, described under Risks.
- Changing the delivery handoff's `retry_attempt` behaviour, which is #577.
- Reconciling the governance-core documents (`CLAUDE.md`, `.hermes.md`, `AGENTS.md`) with the HTTP audit
  sink. That is a later batched documentation change.

## Decisions

### D1. Two changes, exact paths, amended in place

Each change's `assessment.json` lists exact file paths, with no directory prefix except the change's own
directory. Every file a ticket will create is listed in advance, in the path plans here and in the
transport change's design. No path is owned by both changes, except the canonical Node spec, which each
owns through its declared capability.

A ticket that proves it must touch an unlisted path amends its own change's `owned_paths` in the same PR:

1. edit that change's `assessment.source.json`;
2. run `node openspec/scripts/generate-assessment.mjs --change <change>`;
3. say why in the PR body.

The amendment rules:

- An amendment never adds a directory prefix, a CB-018-owned path or a governance-core path.
- The 60-entry cap leaves room for about nine amendments.
- A ticket that would exceed the cap stops and reports instead of widening a path to a directory.

*Alternative: one change per feature.* Rejected. Each would need its own proposal PR and assessment, and
#575 chose an umbrella so that implementation PRs carry no per-feature ceremony. The one exception is the
transport, which `CONTRIBUTING.md` requires to have its own change (D2).

### D2. The HTTP audit sink is its own change

`CONTRIBUTING.md` says every transport "requires its own OpenSpec change and explicit authorization". The
sink is therefore `add-sdk-node-http-audit-sink`, which owns:

- the shared classifier, the sink, and the outcome callback;
- the flush and shutdown behaviour;
- the export widening, and ADR-NODE-004;
- the sink tests and mutation checks.

This change keeps everything evaluator-facing: the README, the wire-protocol page, the kit's failure-path
tests, and the error catalog. The catalog points developers to the sink's `onOutcome` for the event
identifier (deviation 6).

**How the changes relate.**

- Both are proposed in one PR, and one owner act approves them.
- Both stay active until the evaluation closes, because a blocking re-issue may touch either.
- #606 folds them together and #607 archives them together.
- The kit tasks here that send events over HTTP wait for the sink's tickets. The ticket graph already
  records that: #594 waits for #589, #598 for #591, #601 for #590, and #604 for #592.

*Alternative: keep the sink in this umbrella as a documented exception.* Rejected after adversarial
review. It would knowingly start the MVP with a process exception to the repository's own transport rule.

### D3. `authoritativeTenant` narrows through a union parameter, not overloads

`tests/verification/authority-scope.test.mjs` pins exactly 35 `export function` declarations in
`src/context.ts`. A union input type on the one existing declaration keeps that pin.

If overloads prove unavoidable, re-derive the pin by measuring both sides with the rest of the tree held
constant. Never relax it to a range. The file is in `owned_paths` for that reason.

### D4. Conformance tests are split by event family

The harness and one test file per event family sit directly in `tests/`, so #586, #587 and #588 can run
in parallel without editing one file:

- `conformance-harness.ts`
- `conformance-account-authentication-session.test.ts`
- `conformance-authorization-administration.test.ts`
- `conformance-data-configuration-tenant.test.ts`
- `conformance-invalid-cases.test.ts`

**The layout must stay flat.** `test:runtime` and `test:coverage` pass `dist-tests/**/*.test.js` through
`sh`, where `**` is not recursive.

- Today `dist-tests/` has no subdirectory. The pattern therefore matches nothing, reaches `node --test`
  unexpanded, and Node globs it recursively.
- Once any subdirectory exists, `sh` expands the pattern to that subdirectory's files only, and every
  top-level runtime test is silently skipped.
- Measured on 2026-09-23 with `sh -c 'echo dist-tests/**/*.test.js'` in a scratch tree.
- The Node binding's `test:runtime` uses the same pattern, so its new tests stay flat too.

`tsconfig.test.json` compiles the harness because the test files import it, and it lands flat in
`dist-tests/`.

#588 extends the existing consumption of the contract's examples in two files, instead of
duplicating it:

- `tests/pass1.test.ts`, which consumes the positive examples;
- `tests/pass2.test.ts`, which consumes the negative examples.

A divergence fix in core source amends `owned_paths` under D1. A new, uncommitted file under sdk-core's
`src/` also fails `test:changed-paths`, because the reviewed-new-source list lives in the CB-018-owned
`verification-lifecycle.json`. Such a file must therefore be committed before `validate` runs.

### D5. The kit: builder, gate, controls and helpers are separate scripts

Everything lives under `packages/security-audit-sdk-node/scripts/`:

| File | Role |
|---|---|
| `packed-install.mjs` | Pack-and-install harness (#580). The existing packed-install check calls it. |
| `build-evaluation-kit.mjs` | Builds the kit directory and archive, the consumer manifest, the overrides and the identity file. |
| `check-evaluation-kit.mjs` | The gate: installs, type-checks, runs end to end, drives the failure paths, checks completeness. |
| `evaluation-kit-doc-blocks.mjs` | Extracts TypeScript code blocks from the kit's documents. |
| `evaluation-kit-peer.mjs` | The controllable loopback peer for failure paths. |
| `check-evaluation-kit-controls.mjs` | The planted-defect controls. Each must fail the gate. |

**Wiring.** `package.json` adds `build:kit`, `test:kit` and `test:kit-controls`:

- `test:kit` joins both `test` and `validate`, because CI's Node 24.2.0 leg runs only `npm run test` for
  this package.
- `test:kit-controls` joins `validate` only.
- The kit gate stays out of `test:coverage`.

**Two build modes.** The repository verifies before it commits, so the gate cannot require a clean tree.

- `build:kit` produces a **distributable** kit, and refuses a dirty tree.
- The gate builds a **verification** kit from the working tree, marked non-distributable in its identity
  file.
- Only a distributable kit's identity is recorded on #605.

**Placement rules:**

- The harness and the builder write only outside the repository tree.
- The harness builds the collector itself, in a temporary copy, because CI installs the collector after
  the Node binding validates. The collector has no runtime dependencies, so a temporary `npm ci` and build
  are enough.
- The TypeScript 6 and 7 releases and pnpm are pinned and fetched from the npm registry at gate time.
  None becomes a dependency of the package. When the registry is unreachable, the gate fails closed and
  never skips a leg.

*Alternative: run the gate as a compiled runtime test.* Rejected. It would also run in the coverage job,
and would mix a minutes-long packed-install gate into the unit-test signal.

### D6. Examples and documents are unpacked sources inside the Node binding

`examples/` and `docs/` sit beside `src/`, and neither is in the `files` list, so the packed Node artifact
does not change. The kit builder copies them into the kit.

**Examples:**

- They are TypeScript that Node runs directly through type stripping.
- They import the kit-installed packages, never repository-relative paths.
- They carry no tracked manifest.

**File names.** Every file name avoids the scope gate's forbidden tokens: `evaluation-receiver.ts`, not
`collector`.

### D7. The delivery order ends with the evaluation, then the fold, then the archive

- Kit identity (#604) comes before the evaluation (#605).
- Re-issue fixes land as sub-issues of #575, each adding its task to `tasks.md` in the PR that lands it.
- The evaluation (#605) starts only after the evaluator amendment (task 7.1) is approved and merged.
- The fold (#606) starts only when #605 is closed as completed. It is its own PR, with one fold commit
  per change.
- The archive (#607) is another PR, cut from `main` after the fold merges. It relocates both changes and
  is merged as a merge commit.
- The decision brief (#608) and the decision (#609) write nothing to the repository. They run alongside
  the fold and archive, and have no task.

## Path plan

Paths are relative to `packages/security-audit-sdk-node/` (N), `packages/security-audit-sdk-core/` (C),
or the repository root. Every one of them is in `owned_paths`. The one exception is #607's dated archive
directories, which the governance checker grants to each relocation itself.

| Ticket | Paths |
|---|---|
| #578 | this change directory, and the transport change's directory |
| #579, #589–#592 | see `add-sdk-node-http-audit-sink`'s path plan |
| #580 | N `scripts/packed-install.mjs` (new), N `scripts/check-package-contents.mjs`, N `scripts/verification-helpers.mjs` |
| #581 | withdrawn, no paths |
| #582 | C `src/context.ts`, C `tests/types/index.ts`, C `tests/verification/authority-scope.test.mjs`, C `API.md` |
| #583, #584 | N `docs/error-catalog.md` (new), N `tests/error-catalog.test.ts` (new) |
| #585–#588 | C `tests/conformance-*` (the five files in D4, new), C `tests/pass1.test.ts`, C `tests/pass2.test.ts` |
| #593 | N `scripts/build-evaluation-kit.mjs`, N `scripts/check-evaluation-kit.mjs`, N `scripts/check-evaluation-kit-controls.mjs`, N `examples/first-event.ts` (all new), N `package.json` |
| #594 | N `examples/evaluation-service.ts`, N `examples/evaluation-receiver.ts` (new) |
| #595–#597 | N `docs/quickstart.md` (new), N `scripts/evaluation-kit-doc-blocks.mjs` (new), the examples |
| #598 | N `docs/wire-protocol.md` (new, holds the failure table), N `scripts/evaluation-kit-peer.mjs` (new) |
| #599, #600 | the kit scripts, N `docs/quickstart.md` |
| #601 | N `README.md`, C `README.md`, root `README.md` |
| #602 | N `docs/privacy.md`, N `docs/supported-and-planned.md`, N `docs/known-issues.md` (new) |
| #603 | N `docs/evaluation-guide.md`, N `docs/evaluation-questionnaire.md`, N `docs/seeded-invalid-calls.md`, N `examples/seeded-invalid-calls.ts` (new) |
| #604 | the kit scripts |
| 7.1 (owner) | `evaluation-authorization.md` in this change directory |
| #606 | `openspec/specs/security-audit-sdk-node/spec.md`, `openspec/specs/security-audit-sdk-core/spec.md`, with both changes' deltas |
| #607 | both change directories and their dated archive directories |

**Shared files.** Several tickets edit the same files, but the blocking graph orders every such pair:

- `docs/quickstart.md` is edited by #595 onwards.
- The kit scripts are edited by #593 onwards.
- The Node README is edited only by #601. No sink PR edits it.

Rebase onto `main` and re-diff after every merge. Parallel chains in this repository have silently
reverted each other.

## Risks / Trade-offs

- [The canonical core spec already contradicts itself.] The founding scenario "Sink fails" says a sink
  failure preserves the event ID. F-11 says sink diagnostics never serialize event IDs. The code and
  `tests/f11-delivery-intent.test.ts` follow F-11.
  → Neither change takes a side. Resolving the conflict needs a MODIFIED delta plus a
  `check-coherence.mjs` edit, which a CB-018 change owns, so it waits for a governed follow-up after
  CB-018.
- [Evaluators have not been recruited.]
  → The authorization names none and forbids distribution. Implementation proceeds, and task 7.1's
  amendment, approved by the owner's own act, must land before #605 starts.
- [The gate needs the npm registry: TypeScript 6 and 7, pnpm, and the collector's temporary `npm ci`.]
  → Versions are pinned, and the gate fails closed when the registry is unreachable. A local run needs
  network access. CI already has it.
- [The kit gate adds minutes to the `sdk` job on both Node versions.]
  → The controls run only in `validate`. Each kit PR states the time it adds.
- [An evaluator puts real data through the kit.]
  → The authorization's stop-and-purge condition applies, the documents repeat the synthetic-data rule,
  and every example value is synthetic.
- [`owned_paths` turns out to be incomplete.]
  → Amend it in the same PR, under D1.

## Migration Plan

Nothing is deployed, published or version-moved, so there is nothing to migrate or roll back beyond
reverting a PR.

A kit defect found during the evaluation is fixed under whichever change owns the defective path, and
the kit is re-issued with a new identity, at most twice.

## Open Questions

None. Evaluator handles are added later, through the owner's amendment (task 7.1).
