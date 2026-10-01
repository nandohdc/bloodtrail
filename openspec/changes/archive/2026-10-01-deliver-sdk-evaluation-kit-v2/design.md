## Context

`proposal.md` explains why this change exists. #649 is the spec, and its sub-issues #650–#670 are the
tickets. This document records the decisions that shape every implementation PR under this change: the
paths each ticket owns, where new files go, and the repository constraints the tickets must work within.

The previous program, `deliver-sdk-evaluation-alpha`, is archived. Its design, at
`openspec/changes/archive/2026-09-26-deliver-sdk-evaluation-alpha/design.md`, still describes the kit's
structure. This change keeps that structure and changes only what #649 decides.

State at `main` `ad894df`, relevant to the approach:

- **The kit gate.** It is `check-evaluation-kit.mjs` in the Node binding's `scripts/`, at 708 lines. It
  drives the HTTP audit sink's failure paths through a program held in a template string of about 250
  lines. The controls are `check-evaluation-kit-controls.mjs`, at 243 lines.
- **The builder.** It packs the core and the Node binding with `npm pack --ignore-scripts` from their
  ignored `dist/` directories, and never rebuilds them. It hard-codes artifact versions in
  `REQUIRED_KIT_ITEMS`, and sorts the package-set lines with `localeCompare`. It writes the pnpm override
  into the manifest's `pnpm` field, which pnpm 11 and later ignore.
- **The CI wiring.** The required `sdk` job runs Node binding `validate` on Node 26.5.0, and only
  `npm run test` on Node 24.2.0. `test:kit` is in both scripts, and `test:kit-controls` is in `validate`
  only. No workflow edit is needed.
- **Other active changes.** The two CB-018 changes own `.github/workflows/ci.yml`, sdk-core's
  `verification-lifecycle.json`, `contract-provenance.json`, `scripts/check-coherence.mjs`,
  `scripts/check-changed-paths.mjs`, and the governance scripts and policy. Neither owns a Node binding
  path.
- **The normative-precedence pins** cover only the capabilities under `contracts/`.
  `security-audit-sdk-node` is not among them, so folding this change needs no new pin set.

## Goals / Non-Goals

**Goals:**

- Every #649 implementation PR passes association through this change, and never touches a contract,
  core, collector, workflow, governance-core or CB-018-owned path.
- New gate checks never push a gate file past CodeScene's file-size limit.
- Parallel tickets conflict only where rebasing resolves the conflict mechanically.

**Non-Goals:**

- Relaxing the named-method input types. The mismatch is disclosed as a known issue and left for the
  evaluation to measure, as #575's "API weight" trigger.
- Making the core's conformance suite prove type and runtime agreement. That is a follow-up issue.
- The code smells the review found outside the touched paths: the duplicated mutation-test helpers, and the
  request projection that the sink and the handoff each implement.
- Adding the glossary terms #649 lists (evaluation kit, evaluator, facilitator, answer key, example
  receiver, sink versus handoff) to the Node binding's `CONTEXT.md`. They go to a later `/domain-modeling`
  session, not to this change.

## Decisions

### D1. One change, exact paths, amended in place

`assessment.json` lists exact file paths, with no directory prefix except this change's own directory.
Every file a ticket will create is listed in advance, in the path plan below.

A ticket that proves it must touch an unlisted path amends `owned_paths` in the same PR:

1. edit `assessment.source.json`;
2. run `node openspec/scripts/generate-assessment.mjs --change deliver-sdk-evaluation-kit-v2`;
3. say why in the PR body.

The amendment rules:

- An amendment never adds a directory prefix. It never adds a contract path, a path in the core
  package's `src/`, a collector path, a CI workflow file, a governance-core document or a CB-018-owned
  path.
- The schema caps `owned_paths` at 60 entries. The list starts at 34.
- A ticket that would exceed the cap stops and reports, instead of widening a path to a directory.
- A planned path that its ticket turns out not to need stays listed. It grants nothing beyond this change's
  lifetime.

*Alternative: one change per defect.* Rejected. Each would need its own proposal PR, assessment, fold and
archive. The tickets also share the gate, the builder and several documents, so parallel changes would each
claim the same paths and collide in the union.

### D2. New gate checks live in their own modules

`check-evaluation-kit.mjs` is 708 lines, and `codescene delta`, a required context, fails any change to a
file over 1000 lines. #649 adds about ten checks. Each goes in its own module beside the gate, named
`evaluation-kit-<check>.mjs`. The gate imports it and only orchestrates.

The modules are listed in advance, in the path plan, so that parallel tickets never race to amend
`assessment.source.json`. The controls stay in `check-evaluation-kit-controls.mjs`, one function per
control, unless that file nears the limit. A ticket that needs to split it amends under D1.

*Alternative: keep every check in the gate file.* Rejected. The gate would cross 1000 lines partway through
the ticket graph, and every later ticket would fail a required context for a reason unrelated to its code.

### D3. The failure-path program becomes a gate-only TypeScript file (#651)

The program that drives the sink's failure and lifecycle paths moves out of its template string into
`scripts/evaluation-kit-failure-paths.ts`.

- The gate copies it into the installed kit, and type-checks it there, with the kit's other sources, under
  TypeScript 5.9.2 and the pinned 6.0.x and 7.0.x releases.
- It imports the kit-installed packages, never repository-relative paths.
- It is not in `REQUIRED_KIT_ITEMS`, so no evaluator receives it.
- The Node binding's `tsconfig.json` includes only `src/`, so the repository build does not see the file.

#658 extends it with the mid-body stall.

### D4. Installers: a generated pnpm settings file, and one pinned release per major (#652)

- **The settings file.** The builder writes a pnpm settings file beside the consumer manifest, carrying the
  core override. The manifest keeps its npm `overrides` and drops its `pnpm` field. On 2026-09-29, this
  prototype installed cleanly, ran the first event and resolved one core copy under pnpm 10.17.0, 11.28.2
  and 12.8.1:

  ```yaml
  overrides:
    "@bloodtrail/security-audit-sdk-core": ./<core tarball file name>
  ```

- **The workspace root.** The settings file makes the kit directory its own pnpm workspace root. The
  modified requirement therefore defines "outside any workspace root" as outside this repository's
  workspaces.
- **The gate.** It pins one release of each supported pnpm major (10, 11 and 12), fetched from the npm
  registry at gate time and never a dependency. It asserts that no installation reports an ignored setting.
  #652 records the pinned releases, and the time the pnpm legs add to `validate`, as a measurement.
- **Unchanged.** The npm installation is unchanged. Yarn, and the Node binding installed on its own, stay
  unsupported. The Node binding's dependency on the core stays repository-relative, for the same
  dependency-confusion reason as #575.

### D5. Identity: tracked sources, a checksum list, code-point order (#653, #654)

- **Tracked sources only (#653).**
  - The builder builds the core and the Node binding from a clean temporary copy of the tracked files, as
    it already does for the collector.
  - A distributable kit copies from the identity commit. A kit the gate builds copies from the working
    tree's tracked files, because the ratified requirement lets the gate run on uncommitted work.
  - Ignored build output on disk therefore never reaches a tarball.
- **Names and ordering (#653).** Artifact file names come from each package's `package.json`, so the builder
  never hard-codes a version. Every ordering is code-point order.
- **The checksum list (#654).**
  - It covers every kit file except the identity file and itself, in the format `shasum -a 256 -c`
    verifies.
  - The identity gains an identity-format version, and the kit digest commits to the checksum list.
  - The per-artifact SHA-256, the package-set digest and the manifest digest keep their current meaning,
    per the package-set hash convention, so kit v1 and v2 digests are never compared as like for like.
- **The archive.** It cannot contain its own digest, so the facilitator records the archive's SHA-256 on
  the evaluation issue (#666) at distribution. The evaluation guide says so, and its integrity steps name
  only shipped files and use only `shasum`.

### D6. The example receiver checks, then admits (#656)

It stays a thin `node:http` wrapper around the existing collector ingress, and the collector package is
unchanged.

- **Order.** It authenticates, bounds the body and runs SDK validation, all before it submits to the
  ingress. An SDK-invalid event therefore never takes an identity, and an unauthenticated caller learns
  nothing about the body.
- **Statuses.** 401 for authentication, 413 for size, 400 for a malformed body, 409 for a conflict, 422 for
  SDK validation or an unsupported version, and 500 for an unexpected error. A duplicate gets 2xx with
  exactly one `accepted` acknowledgment, following the collector glossary: "acknowledged and never
  admitted twice".
- **Liveness.** No request handler rethrows. The process keeps serving after any rejection.
- **Output.** Each accepted event is printed in full, exactly as received. `/health` returns status and
  counts only.

The byte comparison (#655) lands first, so the gate stops reading event bodies from `/health` before
#656 removes them.

### D7. The facilitator answer key lives outside `docs/` (#660)

The expected codes, paths, diagnoses and fixes move to
`packages/security-audit-sdk-node/facilitator/seeded-invalid-calls-answer-key.md`.

- The builder copies only the explicit `REQUIRED_KIT_ITEMS`. A separate directory keeps the answer key out
  of any later copy of `docs/`.
- The gate type-checks every fix in it against the installed kit.
- The gate fails when the answer key's content appears in the kit.

### D8. No delta for the fetch delivery adapter (#658)

The ratified requirement "The governed fetch delivery adapter maps native outcomes onto the handoff's closed
outcome set" already says the adapter SHALL map "a deadline to `timeout`". A deadline that fires while the
response body is being read is therefore a conformance fix, not a new behaviour.

- The fix is in the adapter's bounded body read.
- The HTTP audit sink and the delivery handoff both get it through the shared adapter. No classification
  moves out of the shared classifier, per ADR-NODE-004.
- `tests/scope-mutations.test.ts` pins the adapter's platform-coupling inventory, so it is owned as a
  derived control. It changes only if the fix changes that inventory.

### D9. The delivery order ends with the evaluation, then the fold, then the archive

This is the order #575 used. Re-issue fixes land under an active, unfolded change, so the canonical spec is
written once.

- The implementation tickets (#651–#663) run in parallel where the ticket graph allows.
- Kit v2 (#664) is built from a clean commit on `main` after all of them have merged. Its identity and
  archive digest are recorded on #666, and it is not distributed.
- The owner's amendment (#665) names the evaluators by handle, together with kit v2's identity. It takes
  effect only through the owner's SHA-bound approval comment and the owner's own merge.
- The evaluation (#666) starts only after that amendment has merged. Re-issue fixes land as sub-issues of
  #649, each adding its task in the PR that lands it.
- The fold (#667) starts only when #666 is closed as completed. It is its own PR, and it changes only the
  canonical spec and this change's lifecycle state.
- The archive (#668) is another PR, cut from `main` after the fold merges. It stages both paths of the move
  and is merged as a merge commit.
- The decision brief (#669) and the decision (#670) are recorded on #649. They write nothing to the
  repository and have no task.

### D10. Parallel tickets share files, and rebase

The approved graph runs #652, #653, #655, #660, #662 and #663 in parallel after this proposal. They share
the builder, the gate, the controls and several documents. D2 and the path plan keep their hunks mostly
disjoint.

- Rebase onto `main` and re-diff after every merge, never `git merge main`. Parallel chains in this
  repository have silently reverted each other.
- #663's content goes in a new document, so that it never edits the quickstart that #652 and #662 edit in
  parallel.

## Path plan

Paths are relative to `packages/security-audit-sdk-node/`, unless they start with `openspec/`. Every one of
them is in `owned_paths`. The one exception is #668's dated archive directory, which the governance checker
grants to the relocation itself.

| Ticket | Paths |
|---|---|
| #650 | this change directory |
| #651 | `scripts/evaluation-kit-failure-paths.ts` (new), `scripts/check-evaluation-kit.mjs`, `scripts/check-evaluation-kit-controls.mjs` |
| #652 | `scripts/evaluation-kit-installers.mjs` (new), `scripts/build-evaluation-kit.mjs`, the gate and controls, `docs/quickstart.md`, `docs/known-issues.md` |
| #653 | `scripts/evaluation-kit-source-copy.mjs` (new), `scripts/build-evaluation-kit.mjs`, the gate and controls |
| #654 | `scripts/evaluation-kit-checksums.mjs` (new), `scripts/build-evaluation-kit.mjs`, the gate and controls, `docs/evaluation-guide.md` |
| #655 | `scripts/evaluation-kit-delivery-checks.mjs` (new), `examples/evaluation-service.ts`, `examples/evaluation-receiver.ts`, the gate and controls |
| #656 | `examples/evaluation-receiver.ts`, `scripts/evaluation-kit-delivery-checks.mjs`, `docs/wire-protocol.md`, the gate and controls |
| #657 | `examples/evaluation-service.ts`, `examples/evaluation-driver.ts` (new), `scripts/evaluation-kit-delivery-checks.mjs`, `scripts/build-evaluation-kit.mjs`, `docs/quickstart.md` |
| #658 | `src/fetch-exchange.ts`, `tests/fetch-exchange.test.ts`, `tests/scope-mutations.test.ts`, `scripts/evaluation-kit-failure-paths.ts`, `scripts/evaluation-kit-peer.mjs`, `docs/wire-protocol.md`, the controls |
| #659 | `scripts/check-evaluation-kit-controls.mjs`, `scripts/check-evaluation-kit.mjs` |
| #660 | `facilitator/seeded-invalid-calls-answer-key.md` (new), `scripts/evaluation-kit-answer-key.mjs` (new), `docs/seeded-invalid-calls.md`, `examples/seeded-invalid-calls.ts`, `docs/evaluation-questionnaire.md`, `docs/evaluation-guide.md`, `docs/error-catalog.md`, `scripts/evaluation-kit-doc-blocks.mjs`, the builder, the gate and controls |
| #661 | `scripts/evaluation-kit-doc-references.mjs` (new), `scripts/evaluation-kit-doc-blocks.mjs`, `docs/privacy.md` and any other kit document it finds an offender in, the gate and controls |
| #662 | `scripts/evaluation-kit-doc-claims.mjs` (new), `README.md`, `docs/quickstart.md`, `docs/supported-and-planned.md`, `docs/known-issues.md`, the gate and controls |
| #663 | `docs/integration-and-testing.md` (new), `scripts/build-evaluation-kit.mjs` |
| #664 | this change's `tasks.md` only; the kit is built outside the repository |
| #665 (owner) | this change's `evaluation-authorization.md` |
| #666 | nothing: the evaluation is recorded on the issue, and the fold PR ticks its task |
| #667 | `openspec/specs/security-audit-sdk-node/spec.md`, with this change's deltas |
| #668 | this change directory and its dated archive directory |

"The gate and controls" means `scripts/check-evaluation-kit.mjs` and
`scripts/check-evaluation-kit-controls.mjs`.

## Risks / Trade-offs

- [The pnpm and TypeScript legs need the npm registry.]
  → Versions are pinned, and the gate fails closed when the registry is unreachable. A local run needs
  network access, and CI already has it.
- [Three pnpm legs add minutes to the `sdk` job on both Node versions.]
  → #652 measures and records the time. The figure is a measurement, never a threshold.
- [The kit also copies the core README and the root README. The API-reference check (#661) may find an
  offender in one of them.]
  → #661 amends `owned_paths` under D1 to add that README. Neither is core source, and both were owned by
  the previous umbrella.
- [Planned new modules could be the wrong shape for a ticket.]
  → A ticket may leave its planned module uncreated (D1), or amend `owned_paths` for a different one.
- [No evaluator has been recruited.]
  → The authorization names none and forbids distribution. Implementation proceeds, and #665's amendment,
  approved by the owner's own act, must land before #666 starts.
- [An evaluator puts real data through the kit.]
  → The authorization's stop-and-purge condition applies. The documents repeat the synthetic-data rule, and
  every example value is synthetic.
- [`owned_paths` turns out to be incomplete.]
  → Amend it in the same PR, under D1.

## Migration Plan

Nothing is deployed, published or version-moved, so there is nothing to migrate or roll back beyond
reverting a PR.

A kit defect found during the evaluation is fixed under this change, and the kit is re-issued with a new
identity, at most twice.

## Open Questions

None. Evaluator handles, and kit v2's identity, are added later through the owner's amendment (#665).
