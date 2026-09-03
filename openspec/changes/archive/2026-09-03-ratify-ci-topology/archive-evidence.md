# Archive Evidence — ratify-ci-topology

Explicit archive validation record (R24) for the archive relocation of the `ratify-ci-topology` change into `openspec/changes/archive/2026-09-03-ratify-ci-topology/`.

Archive validation is explicit and is not assumed from `openspec validate --all --strict` (R24). This file is the only new file in the archive-relocation commit; `tasks.md` is the only relocated file whose bytes changed, by exactly five checkbox flips (1.1, 1.2, 2.1, 4.1, 4.2). The exhaustive byte-change enumeration is the diff between `HEAD:openspec/changes/ratify-ci-topology/tasks.md` and the relocated file: `- [ ]` → `- [x]` on lines 1.1, 1.2, 2.1, 4.1, and 4.2. No task text was edited, added, or deleted; every other line is byte-identical. Tasks 2.2 and 3.1 remain UNCHECKED, with reasons below.

## Task completeness

- **1.1** — checked. Proposal PR **#273** landed against `origin/main` with the complete packet (six files under `openspec/changes/ratify-ci-topology/`), conventional commit `docs(openspec): propose ratify-ci-topology`, every task unchecked at proposal time, and the diff touching no `.github/workflows/`, `.github/scripts/`, `ci.yml`, or `contracts/` path. All nine required CI contexts were green at the exact head **2736ad9e79fc1f24fb76504a5f85f264cb3bbf73** (check-runs API: `ci / lint`, `ci / test`, `ci / audit`, `sonar`, `sdk`, `contract`, `conventional-commits`, `codescene delta`, `design-pattern-governance` — all success). Merged identity-preservingly as **e35e3e9381067e16d182c56aa686c404c5019d4d** (2026-09-03T18:39:30Z; two parents: bb945f30a639118a9ca3d16d8a7520807b77f7c0 + 2736ad9e), post-merge verification by integrator card t_24d68d4f confirmed exactly the six proposal files. The PR body's "Do not merge" bound the proposal stage; the merge ran after the independent review (2.1) through the sanctioned gate script, and no merge is a substitute for the owner decision of 2.2 (which remains unchecked).
- **1.2** — checked. The strict and semantic verification is recorded in PR #273's body and independently reproduced by the review (2.1): `openspec validate ratify-ci-topology --strict` and `openspec validate --all --strict` pass (9/9 items); `check-design-pattern-governance` phases `assessment` and `final` at commit 2736ad9e pass with zero failures and zero warnings and the dual check agrees; the governance suite passes 214/214; the semantic script verifies 10 requirements and 32 scenarios, all with deterministic WHEN/THEN wording, the five sub-decisions, the both-directions completeness amendment, the three rules, the mandatory per-package check set (build, typecheck, runtime tests, production-only packed install, at least one deterministic mutation control), and the failure-not-skip semantics; the provenance string `delegated to Claude by the owner, 2026-09-03; not a human owner decision` appears verbatim (proposal 1×, design, delta); and all tasks were unchecked at the proposal commit. CI's `design-pattern-governance` check is green at 2736ad9e.
- **2.1** — checked. Independent exact-commit technical review **t_cae0c1ed** of PR #273, bound to the exact head **2736ad9e79fc1f24fb76504a5f85f264cb3bbf73**: verdict approved, zero blocking findings, zero significant findings. The review explicitly recorded itself as evidence, not approval (`formal_approval: not_established`), and named the owner approval of 2.2 as the remaining precondition for merge.
- **2.2** — **UNCHECKED and intentionally so**. No project-owner exact-commit decision bound to the proposal commit exists. What exists: (a) the standing owner grant, verbatim on the #82 integrator cards, 2026-09-03, conditioned on CI green — applied by t_24d68d4f and t_958c544c as merge authorization and explicitly recorded as NOT a head-bound owner sign-off, never cited as exact-commit owner authorization; (b) the 2026-09-03 decision itself (issue comment 5530083065), which is delegated provenance — "delegated to Claude by the owner, 2026-09-03; not a human owner decision" — with the owner's delegation verbatim ("I dont have time to make decisions, you must do for me.") recorded inside that same comment. Task 2.2's wording requires a genuine human owner decision and states the delegated decision does not satisfy it. Left unchecked per the no-fabrication rule: a task requiring owner decision records stays unchecked unless such a record actually exists.
- **3.1** — **UNCHECKED**. GitHub issue **#85** ("Add CI coverage for every approved package") is still OPEN at archive-prep time and no merged commit materializing the topology exists. The `ci-topology` delta is the conformance target for #85, which runs under its own review and required gates as a later governed change; this change performs no workflow edit itself and cannot evidence work that has not landed. Nothing in this archive ticks it.
- **4.1** — checked. The canonical fold landed as dedicated commit **a3a541e3a50c688b1760e29b92ab16f46bf97934** (single file `openspec/specs/ci-topology/spec.md`, +177/−0) on PR **#276**, created while the change is active, merged identity-preservingly as **d5024f29e5266083194a2c3fccab323d7621be9f** (2026-09-03T19:42:25Z; two parents: 286927ed14873de2a9a6520e59be6510e05ed4a3 + a3a541e3) — which is this archive branch's base. The fold was independently reviewed by t_555b8c5e at the exact head a3a541e3: each requirement and scenario occurs exactly once in the canonical spec, no delta operation header reached the canonical spec, and a second semantic application of the delta is a no-op. The fold commit touched no workflow, contract, package path, or generated artifact.
- **4.2** — checked in this archive commit. The approved fold merge (d5024f29) is on main, the fold landed while the change is active, and this archive is a separate byte-preserving relocation commit that does not repeat the fold and does not touch `openspec/specs/**`. Proposal, assessment, design, delta, and metadata retain their historical bytes (byte identity table below). Strict OpenSpec validation passes (active-enforcement verification below), and the relocation changes no workflow, contract, or package path.

## Merge ordering requirement (R15 window)

This archive PR is prepared from fresh `origin/main` at the fold merge **d5024f29e5266083194a2c3fccab323d7621be9f**. The R15 critical path requires it to land back-to-back after the fold merge, with no unrelated normative merges in between. Verified at archive-prep time: live `origin/main` equals d5024f29, and the #82 chain holds no unrelated open PR — the main session holds PR #274 outside this window. A pre-merge requirement is that no unrelated normative merge lands between the fold merge and this archive.

## Lifecycle bindings

| Phase | Commit | Notes |
| --- | --- | --- |
| Proposal merge (PR #273) | e35e3e9381067e16d182c56aa686c404c5019d4d | head 2736ad9e; 9/9 required contexts green at head; review t_cae0c1ed approved |
| ADR merge (PR #275) | 286927ed14873de2a9a6520e59be6510e05ed4a3 | head 777952a2e5e2f4957ca7a16dc95f7077ba707092; review t_1a6853d1 approved |
| Canonical fold (PR #276) | d5024f29e5266083194a2c3fccab323d7621be9f | head a3a541e3; 2 parents (286927ed + a3a541e3); review t_555b8c5e approved |
| Archive relocation | this commit | byte-preserving; tasks.md +5 flips only |

The ADR PR #275 (docs/adr/0011-ci-topology.md) records the same #82 decision (five sub-decisions, three rules, mandatory per-package check set) and is part of this change's governed evidence chain.

## Governance record status

No signed governance record exists for this change: `packages/security-audit-sdk-core/verification-lifecycle.json` carries no `ratify-ci-topology` entry (its seven records belong to other changes), and `openspec/governance/` holds only the activation record, catalog, policy, invariant registry, schemas, and templates. R24's signed-record clauses are therefore vacuous for this change and are recorded as such here rather than constructed. The design-pattern-governance final phase is executed at this archive head; its result is recorded with the PR's check state, and no governance record is manufactured. `packages/security-audit-sdk-core/verification-lifecycle.json` is untouched by this commit.

## Canonical capability materialization

The fold merge d5024f29 materializes the delta's requirements in `openspec/specs/ci-topology/spec.md` while the change is active, per fold-before-archive policy. This archive commit does not touch `openspec/specs/**`.

## Production and publication restrictions

This archive commit touches no implementation, package manifest, CI workflow, release configuration, or generated artifact. The capability re-affirms the authorization boundary: the ratified topology authorizes no workflow edit, no branch-protection settings change, no runner, no secret, and no package implementation; the mandatory check set and fail-closed semantics belong to #85's later governed implementation. It authorizes no production transport, exporter, collector, storage, SIEM, analytics, detection, browser telemetry, audit-log chaining, publication, or real-user processing.

## Immutable archive contents

Byte-identical from the archive base HEAD (d5024f29e5266083194a2c3fccab323d7621be9f) into the archive:

- `.openspec.yaml` (change metadata: `schema: spec-driven`, `created: 2026-09-03`)
- `proposal.md`
- `assessment.json` (assessment level full; triggers: canonical_capability_requirement, security_sensitive_behavior; capabilities: ci-topology)
- `design.md`
- `specs/ci-topology/spec.md` (delta spec)

The only relocated file whose bytes changed is `tasks.md` (exactly five checkbox flips: 1.1, 1.2, 2.1, 4.1, 4.2). `archive-evidence.md` is new.

## Exact changed paths

Added under `openspec/changes/archive/2026-09-03-ratify-ci-topology/`:

- `.openspec.yaml`
- `assessment.json`
- `design.md`
- `proposal.md`
- `specs/ci-topology/spec.md`
- `tasks.md`
- `archive-evidence.md` (new)

Removed from `openspec/changes/ratify-ci-topology/` (active path):

- `.openspec.yaml`
- `assessment.json`
- `design.md`
- `proposal.md`
- `specs/ci-topology/spec.md`
- `tasks.md`

No path outside the active change directory and its dated archive directory is touched. In particular, `openspec/specs/**`, `docs/adr/**`, `packages/security-audit-sdk-core/**` (including `verification-lifecycle.json`), `contracts/**`, `.github/**`, and `packages/security-audit-sdk-core/compatibility.json` are untouched by this commit.

## Byte identity table

Expected blobs are the objects at the archive base HEAD (d5024f29); actual blobs are `git hash-object` of the relocated files.

| File | Expected (archive base HEAD) | Actual (relocated) | Identity |
| --- | --- | --- | --- |
| `.openspec.yaml` | 9696e00f11eedeb87cebb23d7c3fe5c042fc309f | 9696e00f11eedeb87cebb23d7c3fe5c042fc309f | identical |
| `assessment.json` | bba6d6e41183a681c4ac7628f0d675ae0268508d | bba6d6e41183a681c4ac7628f0d675ae0268508d | identical |
| `design.md` | e1ba364c0233e671821adb18859f61f4baefb404 | e1ba364c0233e671821adb18859f61f4baefb404 | identical |
| `proposal.md` | 74a8ec1a58e58a5dfe7719a4cd1a8256d6d43223 | 74a8ec1a58e58a5dfe7719a4cd1a8256d6d43223 | identical |
| `specs/ci-topology/spec.md` | c7f3b92a748a4271b0f268dfaaa046478bc04b19 | c7f3b92a748a4271b0f268dfaaa046478bc04b19 | identical |

`tasks.md` is the one relocated file whose bytes changed (HEAD blob 310125badbb69056b8eac0671df2a9c06eb618e1 → relocated blob ad807493f7d573d093f26f5725dd765769ffbd64): exactly five `- [ ]` → `- [x]` flips on lines 1.1, 1.2, 2.1, 4.1, and 4.2; every other line is byte-identical (exhaustive enumeration above).

Because `proposal.md` and `assessment.json` are the exact objects history carried at the active change path, the dated archive directory is recognized as the genuine relocation of the change (R15 dangling check and association perimeter), which is what preserves the governed evidence across the move.

## Active enforcement verification

At this archive HEAD — where the change is archived, so the R15 signed-review-stale scan no longer applies to this change, and the dangling check recognizes the byte-identical relocation — the following gate set was executed before push, with an empty index:

- `openspec validate --all --strict`
- `node openspec/scripts/check-design-pattern-governance.mjs --phase final`
- `node openspec/scripts/run-governance-dual-check.mjs`
- `npm run validate --prefix contracts/security-audit`
- `npm run validate --prefix packages/security-audit-sdk-core` (full 19-gate SDK chain, including `test:changed-paths` in archived mode, `test:governance-history`, `test:archive-attestations`, `test:coherence`, and the verification suite)
- Archive completeness: `git show --name-status --no-renames` shows every archive addition and active-path deletion explicitly; the active path is absent at HEAD and the dated archive is present.
- `git diff --cached --check`; staged scope is the relocation allowlist only (both directions staged).

Local-equivalence note: the local primary checkout's `refs/heads/main` is stale (246ce44) and locked by the main session, while CI resolves the protected mainline to d5024f29. The committed-head gate set above is therefore executed in a disposable local clone of the archive commit where `refs/heads/main` points at d5024f29 — exactly the baseline CI computes — with a clean (empty-index) checkout. The uncommitted-state runs above were executed in this worktree with an empty index as well.

Final-phase results are post-commit evidence: the archive PR's check state is the external record, and CI results are not claimed here before CI has run. A pre-merge requirement is that all required checks are green at the archive PR head before the owner's identity-preserving merge, and that the archive lands back-to-back after the fold merge d5024f29 with no unrelated normative merge in between.

## Assurance limitations

- No project-owner exact-commit decision bound to the proposal commit was found; the standing owner grant on the #82 integrator cards (2026-09-03, CI-green condition) is conditional merge authorization, not a head-bound sign-off, and the 2026-09-03 decision is delegated provenance recorded in issue comment 5530083065. Task 2.2 therefore remains unchecked. This evidence does not construct approval from review evidence, PR assignment, merged state, or checked tasks.
- Task 3.1 remains unchecked: issue #85 is open and its governed implementation has not landed; this archive evidences the ratification, not the materialization.
- The technical reviews (t_cae0c1ed, t_1a6853d1, t_555b8c5e) are evidence, not approval, and are AI-assisted technical review records, not independent human assurance.
- This archive-evidence record asserts the enumerated R24 items and the relocation facts above. It is not itself approval, assurance, or authorization, and it does not substitute for the owner's merge decision.
