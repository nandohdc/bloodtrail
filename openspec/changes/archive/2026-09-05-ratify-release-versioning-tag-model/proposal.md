## Why

GitHub #81 requires exactly one recorded release versioning and tag model for the multi-package repository. The 2026-09-02 decision brief (issue comment 5511142062) presented two candidate models and the open question of whether the repository version namespace and the SDK package version namespace should ever couple; the decision was recorded on 2026-09-03 in issue comment 5530090318. This change ratifies that decision as the new `release-versioning-tag-model` capability, mapping every #81 acceptance criterion: exactly one model selected, version ownership explicit, tag/component and manifest behavior specified, private status explicit, and release metadata that cannot imply publication authority.

Provenance, recorded here and everywhere this change refers to the decision's source: the decision was delegated to the automated agent by the owner on 2026-09-03, in the owner's words "I dont have time to make decisions, you must do for me." It is therefore `decision_source = "delegated to Claude by the owner, 2026-09-03; not a human owner decision"` — a delegated technical decision, not a human owner sign-off, and nothing downstream may represent it as one. It does not satisfy any gate that specifically requires a human owner decision, and it authorizes publication, deployment, and production in no respect.

## What Changes

- Introduce the `release-versioning-tag-model` capability recording the ratified decision: **option 1 — repo-scoped, ratified**. `version.txt` plus a single `vX.Y.Z` tag versions **the repository at a commit**; Release Please continues with `release-type: simple`, package `"."`, `include-component-in-tag: false`. No component tags, no per-package manifest entries, and no `package.json` version is moved by a release.
- Record the decision's governance reasoning, not only the choice: component tags and per-package manifest entries exist **to coordinate publication**, and nothing in this repository is publishable — every workspace is `private: true`, the SDK is `UNLICENSED`, no workflow runs `npm publish`, and `check-publication-path.mjs` exists to keep it that way. A per-package release model would manufacture the metadata of a publishing repository without the authority to publish, which is precisely the drift this repository's governance prevents.
- Record **explicit per-artifact version ownership**: `version.txt` plus `.release-please-manifest.json` are the repository release series (release-please simple target); the SDK `package.json` (`0.1.0`) is a candidate identity frozen by `check-coherence.mjs` rule `package-version` against `compatibility.json` `package.version` (status `isolated-candidate-not-published`), movable only by a separate governed owner decision that updates `compatibility.json` in the same commit; the contract `package.json` (`1.0.0`) is owned by the separate `security-audit-event-contract` governance process under a protected prefix; research `package.json` (`0.0.0-research`) is a research artifact, never released.
- Record the open-question answer: the two version namespaces **stay independent**, because they denote different things — `version.txt` is a repository state marker derived from Conventional Commits across the whole tree, while the SDK's version is a candidate identity whose only consumer is the internal coherence check. Coupling them would let a documentation commit bump the SDK version while the candidate is unchanged, turning a meaningful coherence pin into noise. They couple only under a revisit condition.
- Record the **non-authorizing semantics**: a `vX.Y.Z` tag versions the repository and confers no publication, deployment, or production authorization; `RELEASING.md` already states this and the #84 documentation must keep it true.
- Record the **#182 sequencing rule**: no release-config edit may land while a release-please PR is open, and a release PR branch must not be rebased or force-pushed beneath the automation. Live state at proposal time: PR #182 merged on 2026-09-03T18:17:35Z, so the blocking window is closed and `version.txt` / `.release-please-manifest.json` are now `0.4.0`; the rule remains binding for every future release PR.
- Record the decision's **scope boundary**: it records a decision only — no config edit, no tag, no release, no publication; implementation belongs to the later governed change #84, which must pass review and every required gate on its own merits.
- Record the **revisit conditions**: the decision re-opens when (a) the owner separately authorizes publication of any package, or (b) #83 materializes more than one shipping package; the namespace-coupling question re-opens with it.

## Capabilities

### New Capabilities

- `release-versioning-tag-model`: Records the ratified Bloodtrail release versioning and tag model — repo-scoped repository series, per-artifact version ownership, namespace independence with its reasoning, private status, non-authorizing tag semantics, the release-PR sequencing rule, the decision provenance and scope boundary, and the revisit conditions.

### Modified Capabilities

- None.

## Impact

This change adds planning artifacts only, strictly under `openspec/changes/ratify-release-versioning-tag-model/`. It touches no `release-please-config.json`, no `.release-please-manifest.json`, no `version.txt`, no `CHANGELOG.md`, no `package.json`, no `compatibility.json`, no `contracts/` path, and no generated artifact — the change is records only. It creates no tag, performs no publication, and makes no licensing change. Because the decision is delegated and not a human owner decision, any downstream gate that requires genuine owner authorization — including any future publication authorization — still requires one; this proposal does not substitute.
