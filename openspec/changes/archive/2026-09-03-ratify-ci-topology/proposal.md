## Why

GitHub #82 requires exactly one recorded multi-package CI topology decision. Branch protection pins nine required contexts by hand, and adding a job to `ci.yml` does not make it required — only a repository-settings edit does, and nothing in the repository enforces or reminds anyone to make that edit (the decision brief's F1). A per-package job model therefore silently degrades every time a package is added: the job runs, it is not required, and a red one cannot block a merge. The 2026-09-02 decision brief (issue comment 5511424245) presented five sub-decisions and three rules; the decision was recorded on 2026-09-03 in issue comment 5530083065. This change ratifies that decision as the new `ci-topology` capability.

Provenance, recorded here and everywhere this change refers to the decision's source: the decision was delegated to the automated agent by the owner on 2026-09-03, in the owner's words "I dont have time to make decisions, you must do for me." It is therefore `decision_source = "delegated to Claude by the owner, 2026-09-03; not a human owner decision"` — a delegated technical decision, not a human owner sign-off, and nothing downstream may represent it as one. It does not satisfy any gate that specifically requires a human owner decision, and it lifts the authorization boundary in no respect.

## What Changes

- Introduce the `ci-topology` capability recording the ratified decision: **one job per concern** fanning out over packages, with **per-concern, stable** status naming, so branch protection never changes as packages are added and a new package is covered the day it enters the list.
- Record **explicit declared list** discovery, amended over the brief: the list must be **provably complete** through a mechanical assertion that enumerates the packages actually present and fails closed in both directions — a package on disk absent from the list, and a listed package that no longer exists. Today the enumeration is exact and cheap: `git ls-files '*package.json' | grep -v node_modules` yields exactly `contracts/security-audit`, `packages/security-audit-sdk-core`, and `research/browser-telemetry`; the #87 Node binding becomes the fourth.
- Record the **per-package Node matrix**: the SDK runs `24.2.0` and `26.5.0` (`compatibility.json` `node.ciVersions`) while the contract and research workspaces declare `>=26.5.0`; a repository-wide matrix would run the contract outside its declared range or drop Node 24 from the SDK.
- Record the **gate split**: runtime gates run per matrix leg; repository-level gates (the gates `test:matrix` already omits: `test:git`, `test:package`, `test:coherence`, and six more) run once per change.
- Record the three binding rules: (1) the packed-install control keeps performing a real production-only install of the packed tarball into a clean consumer directory **outside any workspace root** — offline, scripts disabled, entry points imported by package specifier (ADR 0003 requires the real install; ADR 0009 pins the outside-any-root rule); (2) untrusted PRs receive static and mutation checks with no restricted secrets, and a skipped token-gated analysis renders as a skip, never a pass-shaped green; merge gates count against branch protection's declared context list, never against the reported set; (3) one declared runner-label constant, never per-job literals.
- Record the mandatory per-package check set — build, typecheck, runtime tests, production-only packed install, and at least one deterministic mutation control — and the failure semantics: fail closed; a missing required static validation is a failure, not a skip.
- Record the decision's scope boundary: it authorizes **no** workflow edit, no branch-protection settings change, no runner, no secret, and no package implementation; implementation belongs to the later governed change #85. The question whether `coverage` must become a required context is deliberately out of scope and is filed as its own issue.
- Record the revisit conditions: branch protection acquires automatic required-context registration; a package legitimately needs a Node range incompatible with per-package matrices; or the repository moves off standalone topology.

## Capabilities

### New Capabilities

- `ci-topology`: Records the ratified multi-package CI topology — per-concern job ownership with stable context names, the explicit declared package list with a both-directions completeness assertion, the per-package Node matrix, the runtime-per-leg/repository-once gate split, the three binding rules, the mandatory per-package check set with fail-closed semantics, the decision provenance and scope boundary, and the revisit conditions.

### Modified Capabilities

- None.

## Impact

This change adds planning artifacts only, strictly under `openspec/changes/ratify-ci-topology/`. It touches no `.github/workflows/`, no `.github/scripts/`, no `ci.yml`, no `contracts/` path, no package implementation, and no generated artifact — the change is records only. It does not edit branch protection, does not provision a runner or a secret, and does not authorize implementation: #85 owns the workflow materialization as a later governed change that must pass review and every required gate on its own merits. Because the decision is delegated and not a human owner decision, any downstream gate that requires genuine owner authorization still requires one; this proposal does not substitute.
