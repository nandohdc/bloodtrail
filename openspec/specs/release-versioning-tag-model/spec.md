# release-versioning-tag-model Specification

## Purpose

Records the ratified Bloodtrail release versioning and tag model: a repo-scoped repository release series, explicit per-artifact version ownership, independence of the repository and SDK package version namespaces, explicit private status, non-authorizing tag semantics, the release-PR sequencing rule, the decision provenance and scope boundary, and the revisit conditions.

The decision source is recorded verbatim wherever this capability refers to it: `decision_source = "delegated to Claude by the owner, 2026-09-03; not a human owner decision"`. It is a delegated technical decision, not a human owner sign-off.

## Requirements

### Requirement: The release model is repo-scoped with a single repository tag

The ratified release model SHALL be repo-scoped: `version.txt` plus a single `vX.Y.Z` tag versions the repository at a commit. Release Please SHALL remain configured with `release-type: simple`, a single package entry `"."`, and `include-component-in-tag: false`. The manifest SHALL carry exactly the `"."` entry; no component tags and no per-package manifest entries SHALL exist. A release SHALL NOT move any `package.json` version. Tag collision surface SHALL remain zero because exactly one tag name exists per release.

#### Scenario: A release moves only the repository series artifacts
- **WHEN** Release Please produces a release
- **THEN** the release changes `version.txt`, `.release-please-manifest.json` (the `"."` entry), and `CHANGELOG.md` only, and no `package.json` version changes

#### Scenario: No component tags are created
- **WHEN** a release is cut
- **THEN** exactly one tag is created, named `vX.Y.Z`, and no tag with a component prefix exists

#### Scenario: The manifest has no per-package entries
- **WHEN** `.release-please-manifest.json` is inspected
- **THEN** it contains exactly one entry, `"."`, and no per-package component entries

### Requirement: Version ownership is explicit per artifact

Version ownership SHALL be recorded per artifact and SHALL be binding: `version.txt` plus `.release-please-manifest.json` are the repository release series, moved only by Release Please (simple target, package `"."`); each private SDK candidate's `package.json` is a candidate identity frozen by its own `compatibility.json` `package.version` (status `isolated-candidate-not-published` for the core, `frozen-not-published` for the Node binding), held equal by the `package-version` coherence rule, and any movement of one SHALL be a separate governed change with its own owner decision that updates `compatibility.json` in the same commit, never a side effect of a release; the contract `package.json` (`1.0.0`) is owned by the separate `security-audit-event-contract` governance process under a protected prefix that `test:changed-paths` refuses to write, and is deliberately independent of the canonical contract schema version; the research `package.json` (`0.0.0-research`) is a research artifact and SHALL never be released.

Ratified text SHALL NOT pin an absolute candidate version literal. The literal is what goes stale: a governed candidate move is legitimate and expected, and a requirement naming the value it moves from becomes non-conformant the moment that move lands. Conformance SHALL be stated against the pin — `compatibility.json` — rather than against a snapshot of it.

#### Scenario: A release does not move the SDK version
- **WHEN** a repository release is cut
- **THEN** every workspace `package.json` version is unchanged and still equals its own `compatibility.json` `package.version` where one exists, and the release moved only `version.txt`, the manifest and the changelog

#### Scenario: SDK version movement is a governed decision
- **WHEN** an SDK package version needs to move
- **THEN** it moves only under a separate governed change with its own owner decision, and `compatibility.json` is updated in the same commit

#### Scenario: Contract and research versions are not release-managed
- **WHEN** a repository release is cut
- **THEN** the contract `package.json` version `1.0.0` and the research `package.json` version `0.0.0-research` are unchanged and are governed by their own processes

#### Scenario: A release touching a package version fails coherence
- **WHEN** a change moves an SDK `package.json` version without moving that package's `compatibility.json` `package.version` in the same commit
- **THEN** the `package-version` coherence rule fails, because the package version differs from the compatibility baseline

#### Scenario: Ratified text names no candidate version literal
- **WHEN** this capability's ratified text is inspected for candidate version literals
- **THEN** it names none, so a governed candidate move cannot make it non-conformant

### Requirement: The repository and SDK package version namespaces stay independent

The repository version namespace (`version.txt`) and the SDK package version namespace (`package.json`) SHALL stay independent, because they denote different things: `version.txt` is a repository state marker derived from Conventional Commits across the whole tree, answering which state of the repository this is, while the SDK version is a candidate identity answering which SDK candidate this is and which contract version and toolchain it speaks. No mechanism SHALL couple the two namespaces today, and a commit that changes only documentation SHALL NOT bump an SDK version. Coupling SHALL happen only under a revisit condition, when an SDK version acquires external consumers.

#### Scenario: A documentation-only commit does not bump the SDK version
- **WHEN** a commit changes only documentation and the repository series bumps
- **THEN** the SDK `package.json` version is unchanged and still equals its `compatibility.json` `package.version`

#### Scenario: No coupling mechanism exists today
- **WHEN** the version namespaces are inspected
- **THEN** `version.txt` (repository series) and the SDK `package.json` version are independent, with the SDK version pinned to `compatibility.json` rather than to the repository series

#### Scenario: Coupling is a revisit condition, not a pre-built feature
- **WHEN** coupling of the two namespaces is proposed outside a revisit condition
- **THEN** it is out of conformance, because the SDK version has no external consumer whose expectations coupling would serve

### Requirement: Private status remains explicit

Every workspace SHALL remain explicitly private: `packages/security-audit-sdk-core` SHALL declare `private: true` and `license: UNLICENSED`, and `check-package-contents.mjs` SHALL keep asserting both values, failing the `sdk` job if either flips; `contracts/security-audit` and `research/browser-telemetry` SHALL declare `private: true` (npm's default `UNLICENSED` applies where no license field is declared). No workflow SHALL run `npm publish`, and `check-publication-path.mjs` SHALL keep the publication surface absent. The ratified release model SHALL NOT manufacture per-package release metadata, because nothing in the repository is publishable.

#### Scenario: The SDK identity checks hold
- **WHEN** `check-package-contents.mjs` runs
- **THEN** it asserts the SDK `package.json` declares `private === true` and `license === "UNLICENSED"`, and flipping either fails the `sdk` job

#### Scenario: Every workspace is private
- **WHEN** any workspace `package.json` is inspected
- **THEN** its `private` field is `true`

#### Scenario: No workflow publishes
- **WHEN** the workflow set is inspected
- **THEN** no workflow runs `npm publish`, and `check-publication-path.mjs` exists to keep the publication surface absent

### Requirement: Release metadata is non-authorizing

A `vX.Y.Z` tag SHALL be documented and treated as non-authorizing: it versions the repository and confers no publication, deployment, or production authorization. Release metadata SHALL NOT imply publication authority. The documentation produced for the ratified model SHALL state the non-authorizing semantics, and the authorization boundary (production deployment, real-user data processing, framework instrumentation, collectors, transports, queue or outbox infrastructure, storage, SIEM integration, analytics) SHALL remain enforced by `npm run test:scope --prefix packages/security-audit-sdk-core`, not by convention.

#### Scenario: The documentation states the non-authorizing semantics
- **WHEN** the release documentation is read
- **THEN** it states that a `vX.Y.Z` tag versions the repository and confers no publication, deployment, or production authorization

#### Scenario: A tag grants nothing
- **WHEN** a `vX.Y.Z` tag is cut
- **THEN** no publication, deployment, or production authorization is conferred by the tag itself

### Requirement: No release-config edit lands while a release PR is open

No release-config edit SHALL land while a release-please PR is open, and a release PR branch SHALL NOT be rebased or force-pushed beneath the release-please automation. The downstream implementation (#84) SHALL not start until no release-please PR is open. At proposal time PR #182 has merged (2026-09-03T18:17:35Z), so the blocking window is closed; the rule SHALL remain binding for every future release PR.

#### Scenario: A release PR blocks release-config edits
- **WHEN** a release-please PR is open
- **THEN** no release-config edit lands, and the release PR branch is not rebased or force-pushed beneath the automation

#### Scenario: The downstream implementation waits
- **WHEN** the #84 implementation starts
- **THEN** no release-please PR is open; had #182 still been open, the implementation would wait

### Requirement: The published version table covers every declared package and is asserted

The document that states what a release versions SHALL enumerate every declared package — the set held by `DECLARED_PACKAGES` — and SHALL state, for each, the version its own `package.json` carries and what governs that version. A declared package absent from the table SHALL be a failure, and a table row naming no declared package SHALL also be a failure, so the enumeration fails closed in both directions.

Each row's version SHALL be compared against that package's own `package.json` rather than maintained by hand, so a governed version move that does not update the table fails rather than leaving the document describing a version that no longer exists.

#### Scenario: Every declared package appears in the table
- **WHEN** the table is compared against `DECLARED_PACKAGES`
- **THEN** each declared package is present, and the assertion passes

#### Scenario: A declared package missing from the table fails
- **WHEN** a declared package does not appear in the table
- **THEN** the assertion fails, naming the absent package

#### Scenario: A table row under no declared package fails
- **WHEN** the table names a workspace that is not a declared package
- **THEN** the assertion fails, naming the stray row

#### Scenario: A row whose version differs from its package.json fails
- **WHEN** a row states a version that the package's own `package.json` does not carry
- **THEN** the assertion fails, naming the row, the stated version and the actual one

#### Scenario: Adding a package without adding it to the table fails
- **WHEN** a package is added to `DECLARED_PACKAGES` and not to the table
- **THEN** the assertion fails, the same way a covering `make` target that skips it fails

### Requirement: The decision is recorded with its provenance and scope boundary

The decision source SHALL be recorded as `decision_source = "delegated to Claude by the owner, 2026-09-03; not a human owner decision"` wherever the capability refers to it. The decision SHALL NOT be cited as an exact-commit owner authorization, SHALL NOT satisfy any gate that specifically requires a human owner decision, and SHALL NOT authorize publication of any package. It records a decision only: no config edit, no tag, no release, no publication, no licensing change. Implementation SHALL belong to the later governed change #84, which must pass review and every required gate on its own merits.

#### Scenario: Provenance is recorded verbatim
- **WHEN** the capability names the decision's source
- **THEN** it records `decision_source = "delegated to Claude by the owner, 2026-09-03; not a human owner decision"` and does not represent it as an owner decision

#### Scenario: The decision authorizes no publication surface
- **WHEN** the change range is inspected
- **THEN** no config file, tag, release, publication, or licensing change is produced by the ratification

#### Scenario: Implementation remains a governed change
- **WHEN** the release model is implemented
- **THEN** it happens under #84 with its own review and required gates, never as part of this ratification

### Requirement: Revisit conditions re-open the decision

The decision SHALL be re-opened when any of the following becomes true: (a) the owner separately authorizes publication of any package, or (b) #83 materializes more than one shipping package. Both SHALL be false today. Should either become true, the namespace-coupling question SHALL be re-opened with it, because the SDK version would then have external consumers.

#### Scenario: Publication authorization re-opens the decision
- **WHEN** the owner separately authorizes publication of any package
- **THEN** the decision is re-opened, and the coupling question is re-opened with it

#### Scenario: Multiple shipping packages re-open the decision
- **WHEN** #83 materializes more than one shipping package
- **THEN** the decision is re-opened, and the coupling question is re-opened with it

#### Scenario: No revisit condition holds
- **WHEN** neither the owner has authorized publication nor more than one shipping package exists
- **THEN** the recorded repo-scoped model remains the ratified release versioning and tag model

### Requirement: The generated release changelog lists each merged change once

The release changelog generated for a repository release SHALL list each merged change once. When Release Please parses a repository that uses GitHub merge commits whose commit bodies repeat Conventional Commit message headers, the generated release section and release PR description SHALL NOT duplicate entries for the same change. A changelog deduplication step SHALL inspect release entries, identify merge commits duplicating branch commits within the same release section, and retain the branch commit entry while dropping the duplicate merge commit entry. The deduplication step SHALL preserve distinct changes that happen to share a commit subject when neither is a merge commit, and SHALL preserve all intermediate commits of a multi-commit pull request. A check mode SHALL assert that the release changelog contains no duplicate entries.

#### Scenario: Duplicate merge commit entries are removed
- **WHEN** a release section contains both a branch commit and a merge commit with identical commit subjects
- **THEN** the cleaner drops the merge commit entry and retains the branch commit entry

#### Scenario: Intermediate commits in multi-commit PRs are preserved
- **WHEN** a pull request contains multiple commits with distinct conventional commit subjects
- **THEN** all distinct branch commits are preserved in the changelog section

#### Scenario: Legitimate duplicate subjects from distinct non-merge commits are preserved
- **WHEN** two distinct non-merge commits in the same release section have identical subjects
- **THEN** both entries are preserved in the changelog section

#### Scenario: Changelog check mode detects uncleaned duplicates
- **WHEN** check mode is run against a changelog section containing merge-commit duplicates
- **THEN** check mode exits with non-zero exit code and reports the duplicate entries
