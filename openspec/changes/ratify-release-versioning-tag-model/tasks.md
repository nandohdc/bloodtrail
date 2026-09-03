## 1. Proposal

- [ ] 1.1 Land the proposal PR for issue #81 against `origin/main`: the complete packet (`proposal.md`, `design.md`, the `release-versioning-tag-model` delta spec, `tasks.md`), `openspec validate ratify-release-versioning-tag-model --strict` passing, the required CI contexts green, conventional commit `docs(openspec): propose ratify-release-versioning-tag-model`, and every task unchecked. The diff SHALL modify only paths under `openspec/changes/ratify-release-versioning-tag-model/` — no `release-please-config.json`, no `.release-please-manifest.json`, no `version.txt`, no `CHANGELOG.md`, no `package.json`, no `compatibility.json`, no `contracts/` path. Do not merge.
- [ ] 1.2 Run the strict and semantic verification of the change: every requirement uses normative SHALL language with deterministic WHEN/THEN scenarios; the repo-scoped model, the per-artifact version ownership, the namespace-independence answer, the explicit private status, the non-authorizing tag semantics, the release-PR sequencing rule, and the revisit conditions are each present; the provenance string `delegated to Claude by the owner, 2026-09-03; not a human owner decision` appears verbatim; and no task is checked.

## 2. Review and authorization

- [ ] 2.1 Obtain an independent exact-commit technical review bound to the proposal commit. Record the review as evidence, not approval; the delegated 2026-09-03 decision is recorded provenance and does not substitute for any review.
- [ ] 2.2 Obtain the project owner's exact-commit decision bound to the proposal commit before merge. The delegated decision does not satisfy this task: any gate requiring a genuine human owner decision still requires one. Merge only after the owner's recorded decision and every required CI check are green at the exact head.

## 3. Downstream implementation (#84)

- [ ] 3.1 Verify that #84, the later governed change, materializes the ratified model — the repo-scoped repository series, per-artifact version ownership, the non-authorizing documentation statement, and no component tags or per-package manifest entries — under its own review and required gates. The `release-versioning-tag-model` delta requirements are the conformance target; this change performs no config edit itself.
- [ ] 3.2 Verify the #182 sequencing rule is honored by #84: no release-config edit lands while any release-please PR is open, and no release PR branch is rebased or force-pushed beneath the automation. Live state at proposal time: #182 merged on 2026-09-03T18:17:35Z, so the blocking window is closed.

## 4. Fold and archive

- [ ] 4.1 Fold the `release-versioning-tag-model` delta into `openspec/specs/release-versioning-tag-model/spec.md` in a dedicated commit and PR while this change is active; verify each requirement and scenario occurs exactly once, no delta header reaches the canonical spec, and a second semantic application of the delta is a no-op.
- [ ] 4.2 Archive the active change after merge in a separate byte-preserving relocation commit that does not repeat the fold and does not touch `openspec/specs/**`; verify strict OpenSpec validation and that the relocation changes no release-config, package, or contract path.
