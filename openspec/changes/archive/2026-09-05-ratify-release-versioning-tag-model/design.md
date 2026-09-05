## Context

See `proposal.md` for motivation and the delta specification for the normative behavior. The decision this change ratifies was recorded on GitHub #81 (issue comment 5530090318, 2026-09-03) in answer to the 2026-09-02 decision brief (issue comment 5511142062). Repository evidence, verified read-only on 2026-09-03 against `origin/main` `6b94ee6f8d92193ae73e4df61223dc22c425a371`:

- `version.txt` reads `0.4.0` and `.release-please-manifest.json` reads `{".": "0.4.0"}` — PR #182 (`chore: release v0.4.0`) merged on 2026-09-03T18:17:35Z, minutes after the decision comment was posted, so the decision's `0.3.0` figures are superseded by the release itself while the model it selects is unchanged.
- `release-please-config.json`: `release-type: simple`, package `"."` (changelog-path `CHANGELOG.md`), `include-component-in-tag: false`, `include-v-in-tag: true`, `initial-version: 0.1.0`, `bootstrap-sha: f368cb49…`, Conventional-Commits changelog sections.
- SDK `package.json`: `version: 0.1.0`, `private: true`, `license: UNLICENSED`; `check-coherence.mjs` rules `package-version` (pins `package.json` to `compatibility.json` `package.version`) and `package-private` (requires `private === true`); `compatibility.json` `package.version: 0.1.0`, `package.status: isolated-candidate-not-published`.
- Contract `package.json`: `version: 1.0.0`, `private: true`, owned by the `security-audit-event-contract` governance process; research `package.json`: `version: 0.0.0-research`, `private: true`.
- `RELEASING.md` already records the repo-scoped model ("Release Please manages a repository-level version in `version.txt` and the matching `vX.Y.Z` tag. It deliberately does **not** touch any `package.json`."), the per-artifact ownership table, and the non-authorizing semantics ("A tag marks a reviewed repository milestone. Nothing more.").
- `check-package-contents.mjs` asserts the SDK's `private === true` and `license === "UNLICENSED"`; `check-publication-path.mjs` exists; no workflow runs `npm publish`.

The decision is a delegated technical decision: `decision_source = "delegated to Claude by the owner, 2026-09-03; not a human owner decision"`. It is not a human owner sign-off, is not an exact-commit owner authorization for anything, does not satisfy gates that specifically require a human owner decision, and does not authorize publication.

This change is records only. It touches nothing outside `openspec/changes/ratify-release-versioning-tag-model/`. A second OpenSpec change (`implement-duplicate-core-diagnostic`, #79) is active at proposal time; this change touches no `contracts/` path, so the two changes do not collide, and if `design-pattern-governance` reports a CRA diagnostic naming the other active change, that is the known cross-change artifact (bloodtrail #260), not a defect of this change.

## Goals / Non-Goals

**Goals:**

- Ratify the recorded #81 decision as the `release-versioning-tag-model` capability with deterministic, testable requirements.
- Encode the repo-scoped model: one repository series (`version.txt` + `vX.Y.Z` tag), release-please simple target, no component tags, no per-package manifest entries, no `package.json` version moved by a release.
- Encode explicit per-artifact version ownership: repository series, SDK candidate identity frozen behind `compatibility.json` + `check-coherence.mjs`, contract under the separate contract governance process, research never released.
- Encode the namespace-independence answer with its reasoning, the explicit private status, the non-authorizing tag semantics, and the release-PR sequencing rule.
- Record the decision's provenance verbatim and its scope boundary: no config edit, no tag, no release, no publication, no licensing change.

**Non-Goals:**

- No release-config edit: `release-please-config.json`, `.release-please-manifest.json`, `version.txt`, and `CHANGELOG.md` are untouched.
- No package or compatibility edit: no `package.json` and no `compatibility.json` change.
- No tag, no publication, no licensing decision, and no `contracts/` path.
- No re-authoring of the decision: the proposal encodes the recorded decision; it does not re-litigate the brief's recommendation.

## Decisions

### D1 — The repo-scoped model is ratified

`version.txt` plus a single `vX.Y.Z` tag versions the repository at a commit. Release Please stays `release-type: simple`, package `"."`, `include-component-in-tag: false`. The reasoning is governance, not ergonomics: component tags and per-package manifest entries exist to coordinate publication, nothing here is publishable (every workspace `private: true`, SDK `UNLICENSED`, no `npm publish`, `check-publication-path.mjs` exists), and a per-package model would manufacture the metadata of a publishing repository without the authority to publish — a false release story a future reviewer might believe.

The rejected alternative is the per-package component-tag model. It requires a config change, creates a tag-collision surface, requires per-package restatement of private status, and produces publication-shaped metadata for a repository with nothing releasable.

### D2 — Version ownership is per artifact

Each version-bearing artifact has one owner, recorded: `version.txt` + `.release-please-manifest.json` = repository release series (release-please only); SDK `package.json` `0.1.0` = candidate identity frozen by `check-coherence.mjs` `package-version` against `compatibility.json` (movement is a separate governed owner decision updating `compatibility.json` in the same commit); contract `package.json` `1.0.0` = separate `security-audit-event-contract` governance process; research `0.0.0-research` = research artifact, never released. `RELEASING.md`'s ownership table already records this; the capability makes it normative.

The rejected alternative is leaving ownership implicit, which lets a release or an incidental edit move a package version without a decision.

### D3 — The two version namespaces stay independent

`version.txt` is a repository state marker (Conventional Commits across the whole tree); the SDK version is a candidate identity (which contract version and toolchain this candidate speaks), pinned to `compatibility.json` with status `isolated-candidate-not-published`. Coupling would let a documentation commit bump the SDK version while the candidate is unchanged, turning a meaningful coherence pin into noise; the SDK version has no external consumer whose expectations coupling would serve. They couple only under a revisit condition, when publication gives the SDK version external consumers.

The rejected alternative is coupling the namespaces today. It destroys the second meaning for no consumer benefit and pre-builds a revisit condition.

### D4 — Release metadata is non-authorizing, stated in the delta

A `vX.Y.Z` tag versions the repository and confers no publication, deployment, or production authorization. The delta requirement states it; `RELEASING.md` already says it; the #84 documentation must keep it true. This satisfies #81's security consideration ("Release metadata cannot imply publication authority") at the normative level, not just in prose.

The rejected alternative is leaving the non-authorizing semantics implicit, which risks a downstream reader inferring publication authority from release-shaped artifacts.

### D5 — Private status is explicit

Every workspace is `private: true`; the SDK declares `license: UNLICENSED` and `check-package-contents.mjs` asserts both `private === true` and `license === "UNLICENSED"`; the contract and research packages declare no license field, so npm's default `UNLICENSED` applies; no workflow runs `npm publish`. The ratified model adds no per-package release metadata, so nothing new can imply releasability.

The rejected alternative is any model that manufactures per-package release metadata, which would imply a releasability nothing here has.

### D6 — Sequencing rule: no release-config edit while a release PR is open

No release-config edit lands while a release-please PR is open, and a release PR branch is never rebased or force-pushed beneath the automation; #84 waits accordingly. Live state: #182 merged on 2026-09-03T18:17:35Z, so the blocking window is closed; the rule remains binding for every future release PR, so the requirement is future-holding rather than historical.

The rejected alternative is editing release configuration beneath an open release PR, which corrupts the automation's baseline.

### D7 — The ratification is records only, with provenance recorded verbatim

The change adds planning artifacts only, strictly inside `openspec/changes/ratify-release-versioning-tag-model/`. It records `decision_source = "delegated to Claude by the owner, 2026-09-03; not a human owner decision"` wherever the decision's source is named, does not cite the decision as an owner's exact-commit authorization, and does not let it satisfy gates requiring a human owner decision. Implementation belongs to the later governed change #84.

The rejected alternative is treating the delegated decision as an owner sign-off. That would misattribute authority the owner did not exercise, and it would let a technical decision substitute for a gate that specifically requires the owner.

### D8 — Revisit conditions are recorded, not speculated on

The decision re-opens when (a) the owner separately authorizes publication of any package, or (b) #83 materializes more than one shipping package; both are false today. The coupling question re-opens with either, because the SDK version would then have external consumers. The conditions are recorded as gates; no prediction is made about whether any will occur.

## Migration Plan

1. Land the proposal packet (`proposal.md`, `design.md`, the `release-versioning-tag-model` delta spec, `tasks.md`) as a proposal-only commit and PR against `origin/main`; every task stays unchecked. Do not merge.
2. #84, the later governed change, materializes the ratified model in the release configuration and documentation; it must pass review and every required gate on its own merits, and any gate requiring genuine owner authorization still requires the owner. Publication, if ever contemplated, is a separate owner authorization, not a consequence of #84.
3. After implementation and merge under #84, fold the `release-versioning-tag-model` delta into `openspec/specs/release-versioning-tag-model/spec.md` in a separate active-change canonical-fold commit, proving a second semantic application is a no-op.
4. Archive this change after merge in a separate byte-preserving relocation commit.

Rollback before merge is removal of the unmerged proposal. After the delta is folded, changing the ratified model requires a new governed change rather than an edit to this record.

## Risks / Trade-offs

- [A release moves a package version] → Covered by D1/D2 plus existing enforcement: the release touches only the repository-series artifacts, and `check-coherence.mjs` fails if the SDK version desyncs from `compatibility.json`.
- [A future reader infers publication authority from release artifacts] → Covered by D4/D5: the non-authorizing semantics are normative in the delta, every workspace stays explicitly private, and `check-publication-path.mjs` keeps the publication surface absent.
- [A per-package story silently re-enters through #84] → Covered by D1 and the delta requirement that no component tags or per-package manifest entries exist; #84 implements under its own review and gates.
- [The delegated decision is misread as owner approval] → The provenance string is recorded verbatim in the proposal, design, and delta; downstream gates requiring the owner still require the owner.
- [The active #79 change collides with this one] → This change touches nothing under `contracts/` and stays strictly inside its own change directory; a CRA diagnostic naming the other change is the known cross-change artifact (bloodtrail #260) and is reported, not "fixed" by widening scope.
- [Prose is mistaken for implementation authorization] → Every task stays unchecked; implementation, review, merge, and archive tasks remain pending until their exact-commit gates fire.

## Open Questions

None that block the proposal. The model choice, the per-artifact ownership, the namespace-independence answer, the private status, the non-authorizing semantics, the sequencing rule, and the revisit conditions are all settled by the recorded decision. Implementation details left to #84 include the exact wording and placement of the non-authorizing statement in the produced documentation, all bounded by the requirements above.
