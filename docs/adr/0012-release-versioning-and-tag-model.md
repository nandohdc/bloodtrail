# ADR 0012: Ratify the release versioning and tag model

- Status: Accepted
- Date: 2026-09-03
- Decision made by: Claude (automated agent), under explicit delegation from
  the project owner on 2026-09-03 ("I dont have time to make decisions, you
  must do for me")
- Decision owners: NOT a human owner decision. This ADR records a delegated
  technical decision. It is not an exact-commit owner authorization and does
  not satisfy any gate that requires one.

## Context

GitHub #81 requires exactly one recorded release versioning and tag model for the multi-package
repository. Acceptance criteria: exactly one model is selected; version ownership is explicit;
tag/component and manifest behavior are specified; private status remains explicit. The issue's
own security consideration is that release metadata cannot imply publication authority, and its
verification step is a disposable Release Please configuration validation/dry-run. Source-plan
traceability: PLAN-009 (decide the release namespace/tag/manifest model before multi-package
materialization), PLAN-067 (if per-package release is selected, use component tags and per-package
manifest entries), PLAN-076 (decide package topology, release model, and CI model separately).

The 2026-09-02 decision brief (issue comment 5511142062) presented two candidate models and the
open question of whether the repository version namespace and the SDK package version namespace
should ever couple; the decision was recorded on 2026-09-03 in issue comment 5530090318.
`decision_source = "delegated to Claude by the owner, 2026-09-03; not a human owner decision"` —
the decision is a delegated technical decision, not a human owner sign-off, and nothing downstream
may cite it as the owner's exact-commit authorization for anything.

Scope clause, stated once and load-bearing because this ADR's subject is the release model:
**this ADR does not authorize publication of any package, and must never be read as doing so.**
Every workspace stays `private: true`, the SDK stays `UNLICENSED`, no workflow runs `npm publish`,
and `packages/security-audit-sdk-core/scripts/check-publication-path.mjs` keeps the publication
surface absent. Where a later gate requires a genuine owner decision — including any future
publication authorization — it still requires one.

Live state at materialization, verified read-only against `origin/main`
`5e61f5740dcaed00995a17259e77deea4dfb8b04` (the `ratify-release-versioning-tag-model` proposal
merge, PR #278): `version.txt` reads `0.5.0` and `.release-please-manifest.json` reads
`{".": "0.5.0"}` (release PR #274, v0.5.0, merged 2026-09-03T22:13:16Z; PR #182, v0.4.0, merged
2026-09-03T18:17:35Z). A release-please PR is open at authoring time — #283
(`chore: release v0.5.1`, opened 2026-09-03T22:40:38Z) — so the sequencing rule below is
live-binding at the time this record is written, not merely historical.

## Decision

The decision, recorded verbatim in substance from issue comment 5530090318:

> ### Decision: option 1 — repo-scoped, ratified
>
> The current model is adopted as the recorded decision. `version.txt` plus a single `vX.Y.Z` tag
> versions **the repository at a commit**. Release Please continues with `release-type: simple`,
> package `"."`, `include-component-in-tag: false`. No component tags, no per-package manifest
> entries, no `package.json` version is moved by a release.

The decision's reasoning is a governance argument, not an ergonomic one, and is carried in full:

> F3 is decisive and I want to state why plainly, because it is a governance argument rather than
> an ergonomic one. Component tags and per-package manifest entries exist **to coordinate
> publication**. Nothing in this repository is publishable: every workspace is `private: true`,
> the SDK is `UNLICENSED`, no workflow runs `npm publish`, and `check-publication-path.mjs` exists
> specifically to keep it that way. Adopting a per-package release model would manufacture *the
> metadata of a publishing repository without the authority to publish* — publication-shaped
> artifacts that assert a releasability nothing here has. That is precisely the class of drift
> this repository's governance is built to prevent, and it would be worse than useless: it would
> make a future reviewer believe a per-package release story that is not true.
>
> The comparison table's remaining rows all point the same way — repo-scoped needs no config
> change, has no tag-collision surface, requires no per-package restatement of private status, and
> does not interact with #182 at all.

### The open question: the two version namespaces stay independent

The brief identified that the substance of #81 is whether `version.txt` and the SDK's
`package.json` version should ever couple, and that nothing recorded whether today's independence
is deliberate. Decision: **they stay independent, because they denote different things.**

- `version.txt` is a **repository state marker**. Release Please derives it from Conventional
  Commits across the whole tree — contract, SDK, research, docs, governance machinery. It answers
  "which state of this repository is this?" (The decision comment cited `0.3.0`; live at
  materialization the series is at `0.5.0` after releases #182 and #274. The model selected is
  unchanged by the release itself.)
- The SDK's `package.json` version is a **candidate identity**. `check-coherence.mjs` rule
  `package-version` pins it to `compatibility.json` `package.version`, whose status is
  `isolated-candidate-not-published`. It answers "which SDK candidate is this, and which contract
  version and toolchain does it speak?"

Coupling would destroy the second meaning: a documentation commit would bump the SDK version while
the candidate is unchanged, turning a meaningful coherence pin into noise. The SDK version has no
external consumer whose expectations coupling would serve — its only consumer is the internal
coherence check. They couple only when the SDK version becomes an external contract with real
consumers, i.e. under a revisit condition, not as something to pre-build.

### Version ownership is explicit per artifact

Verified live at materialization (`origin/main` `5e61f5740dcaed00995a17259e77deea4dfb8b04`):

| Artifact | Version today | Owner and movement rule |
| --- | --- | --- |
| `version.txt` + `.release-please-manifest.json` | `0.5.0` / `{".": "0.5.0"}` | The repository release series. Moved only by Release Please (simple target, package `"."`), never by hand. |
| `packages/security-audit-sdk-core/package.json` | `0.1.0` | SDK candidate identity. Frozen: `compatibility.json` `package.version` asserts this exact value and `check-coherence.mjs` rule `package-version` fails on desync. Movement is a separate governed owner decision that updates `compatibility.json` in the same commit — never a side effect of a release. |
| `contracts/security-audit/package.json` | `1.0.0` | The separate `security-audit-event-contract` governance process; a protected prefix that `test:changed-paths` refuses to write. |
| `research/browser-telemetry/package.json` | `0.0.0-research` | Research artifact, never released. |

### Tag/component naming and manifest behavior

The selected model is repo-scoped, so there is no component scheme to name: each release cuts
exactly one tag, `vX.Y.Z` (`include-v-in-tag: true`, `include-component-in-tag: false`), and the
manifest carries exactly the `"."` entry. No component tags exist, no per-package manifest entries
exist, and none may be introduced. The per-package branch (PLAN-067: component tags plus
per-package manifest entries) was not selected and therefore has no naming scheme or manifest
entries to record.

### Private status remains explicit

Every workspace is `private: true` today, verified live: the SDK additionally declares
`license: "UNLICENSED"` and `check-package-contents.mjs` asserts both values, failing the `sdk`
job if either flips; the contract and research packages declare no license field, so npm's
default `UNLICENSED` applies. No workflow runs `npm publish`; `check-publication-path.mjs` keeps
the publication surface absent. Because the ratified model manufactures no per-package release
metadata, nothing new can imply releasability.

### Security note: release metadata is non-authorizing

A `vX.Y.Z` tag versions the repository and confers no publication, deployment, or production
authorization. Release metadata cannot imply publication authority — #81's own security
consideration. `RELEASING.md` already records both the repo-scoped model and this non-authorizing
semantics ("A tag marks a reviewed repository milestone. Nothing more."); the documentation #84
produces must keep it true, and the authorization boundary remains enforced by
`npm run test:scope --prefix packages/security-audit-sdk-core`, not by convention.

### Sequencing rule: no release-config edit while a release PR is open

No release-config edit may land while a release-please PR is open, and a release PR branch must
not be rebased or force-pushed beneath the automation. The decision comment framed it as "#84 is
blocked until #182 merges or closes"; as a standing rule it binds every future release PR. Live
at authoring time: #182 merged on 2026-09-03T18:17:35Z and release PR #274 merged on
2026-09-03T22:13:16Z, but release PR #283 (`chore: release v0.5.1`) is open — so #84 must wait
until no release-please PR is open.

### Scope of the decision

Records a decision only. No config edit, no tag, no release, no publication. Implementation is
#84, which must still pass review and every required gate.

### Revisit conditions

The decision is re-opened when (a) the owner separately authorizes publication of any package, or
(b) #83 materializes more than one *shipping* package. Both are false today. Should either become
true, the namespace-coupling question is re-opened with it, because the SDK version would then
have external consumers.

## Verification (issue #81: disposable Release Please configuration validation/dry-run)

The selected model is repo-scoped, not per-package, so the conditional dry-run (plan Task 2.3,
plan lines 151-153) does not apply: **Task 2.3 N/A**, recorded here as the plan requires. The plan
caveat is carried as recorded: the tolerance of the `simple` strategy to a mixed
repo+component configuration (multiple package entries, component tags) **was not measured**.
That configuration does not exist today — the manifest holds exactly one entry, `"."`, verified
live — and the ratified model forbids creating it, so nothing rests on that tolerance. If a
revisit condition ever re-opens the model toward per-package, measuring the mixed-configuration
tolerance becomes a precondition of that re-opening, not a presumption.

## Read-only validation at materialization

Performed at materialization time against `origin/main` `5e61f5740dcaed00995a17259e77deea4dfb8b04`,
reading repository files without modification:

- `release-please-config.json`: `release-type: simple`, single package entry `"."`
  (changelog-path `CHANGELOG.md`), `include-component-in-tag: false`, `include-v-in-tag: true`,
  `initial-version: 0.1.0`, `bootstrap-sha: f368cb49…` — the repo-scoped shape the decision ratifies.
- `.release-please-manifest.json`: exactly `{".": "0.5.0"}` — no per-package entries.
- `version.txt`: `0.5.0`.
- SDK `package.json`: `version: 0.1.0`, `private: true`, `license: UNLICENSED`.
- Contract `package.json`: `version: 1.0.0`, `private: true`. Research `package.json`:
  `version: 0.0.0-research`, `private: true`.
- `compatibility.json`: `package.version: 0.1.0`, `package.status:
  isolated-candidate-not-published`.
- `check-coherence.mjs` line 125: rule `package-version` pins `package.json` to the compatibility
  baseline and fails on drift.
- `RELEASING.md` already records the repo-scoped model and the non-authorizing tag semantics.

This validation modifies nothing: the only repository change this ADR makes is the ADR file itself.

## Acceptance-criteria mapping (#81)

- Exactly one model is selected — option 1, repo-scoped, ratified; the per-package component-tag
  model is the rejected alternative, rejected on the governance reasoning above.
- Version ownership is explicit — the per-artifact ownership table is normative: repository
  series, SDK candidate identity (frozen pin), contract governance process, research never
  released.
- Tag/component and manifest behavior are specified — one `vX.Y.Z` tag per release, no component
  tags, manifest exactly the `"."` entry, no `package.json` version moved by a release.
- Private status remains explicit — every workspace `private: true`, SDK `UNLICENSED`, asserted
  by `check-package-contents.mjs`, no `npm publish`, `check-publication-path.mjs` present.
- Security: release metadata cannot imply publication authority — the non-authorizing section.
- Verification: disposable dry-run — Task 2.3 N/A with the recorded caveat (repo-scoped
  selected; mixed-configuration tolerance unmeasured).

## Scope boundary

This ADR records a decision only. It touches no `release-please-config.json`, no
`.release-please-manifest.json`, no `version.txt`, no `CHANGELOG.md`, no `package.json`, and no
`compatibility.json`; the commit that carries it is ADR-only. It authorizes no config edit, no
tag, no release, no publication, and no licensing change. Implementation belongs to the later
governed change #84, which must pass review and every required gate on its own merits. Because
the decision is delegated and not a human owner decision, any gate requiring genuine owner
authorization — including any publication authorization — still requires one; this ADR does not
substitute, and does not authorize publication of any package.

## Migration plan (PLAN ONLY — nothing is executed by this ADR)

No migration is needed: today's configuration already implements the ratified model, so #84's
materialization is documentation and conformance work, not configuration migration. Recorded as a
plan only:

1. #84 verifies the configuration matches the ratified shape (simple target, single `"."` entry,
   `include-component-in-tag: false`) and produces documentation stating the non-authorizing
   semantics; it waits until no release-please PR is open (live: #283).
2. Any future SDK version movement follows its own governed owner decision updating
   `compatibility.json` in the same commit.
3. Rollback: since this ADR changes no configuration, there is nothing to roll back. If a future
   change moves the configuration away from the ratified model, the rollback is to restore the
   recorded values (`release-type: simple`, single `"."` entry, `include-component-in-tag: false`);
   changing the ratified model itself requires a new governed change and a superseding ADR, not an
   edit to this record.

## Consequences

- One repository release series, one `vX.Y.Z` tag per release, zero tag-collision surface.
- The SDK candidate identity stays meaningful: a documentation commit bumps the repository series
  and never the SDK version, and `check-coherence.mjs` fails closed on any desync.
- No per-package release metadata exists, so nothing in the release surface can imply per-package
  releasability; the publication surface stays absent and enforced.
- The sequencing rule binds #84 — and any future release-config work — to wait while a
  release-please PR is open (live at authoring: #283).
- Future readers must read release artifacts as repository-state markers only; the non-authorizing
  semantics are recorded here, in `RELEASING.md`, and normatively in the
  `release-versioning-tag-model` capability delta.

## Alternatives considered

- Per-package release with component tags and per-package manifest entries (PLAN-067) —
  rejected. It requires a config change, creates a tag-collision surface, requires per-package
  restatement of private status, and manufactures publication-shaped metadata for a repository
  with nothing releasable — a false release story a future reviewer might believe.
- Coupling the repository and SDK version namespaces today — rejected. It destroys the
  candidate-identity meaning, turns the coherence pin into noise on documentation commits, and
  serves no external consumer.
- Leaving version ownership implicit — rejected. A release or an incidental edit could move a
  package version without a decision.
- Leaving the non-authorizing semantics implicit — rejected. A downstream reader could infer
  publication authority from release-shaped artifacts.
- Treating the delegated decision as an owner sign-off — rejected. It would misattribute
  authority the owner did not exercise and let a technical decision substitute for a gate that
  specifically requires the owner.

## Traceability

- GitHub #81 — decision brief comment 5511142062 (2026-09-02); decision comment 5530090318
  (2026-09-03).
- OpenSpec change `ratify-release-versioning-tag-model` — proposal merged on 2026-09-03 as PR #278
  (proposal head `4fef7b0ed128be4594228442dc58634b485bd63b`, merge
  `5e61f5740dcaed00995a17259e77deea4dfb8b04`); the normative delta is
  `openspec/changes/ratify-release-versioning-tag-model/specs/release-versioning-tag-model/spec.md`.
- This ADR is the decision record materialized by Hermes task t_a0574c3a; the proposal was
  authored under Hermes task t_00e3e8f8; #84 owns implementation.
- Reference this ADR by its full filename
  `docs/adr/0012-release-versioning-and-tag-model.md` in every future artifact — never by the
  bare number. Numbering was checked live against `docs/adr/` at authoring time (0001-0011
  present, lowest free number taken); the duplicate-0009 collision from a past parallel chain was
  resolved via GitHub #250 (closed) into `0010-sdk-core-authority-scope.md`.
