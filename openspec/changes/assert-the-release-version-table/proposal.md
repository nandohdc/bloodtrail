## Why

`RELEASING.md` states what a release versions. Its table names `0.1.0` for a candidate that is
`0.2.0`, and lists three workspaces where there are five (#462). The clause that would have caught the
first defect is part of the same stale text: it says "`compatibility.json` asserts this exact value",
and `compatibility.json` asserts `0.2.0`.

**But `RELEASING.md` is not the origin.** `openspec/specs/release-versioning-tag-model/spec.md`
ratifies `0.1.0` in current-tense binding text and in two scenarios:

| Where | Ratified text |
|---|---|
| *Version ownership is explicit per artifact* | "the SDK `package.json` (`0.1.0`) is a candidate identity frozen by `check-coherence.mjs` rule `package-version`" |
| Scenario *A release does not move the SDK version* | "**THEN** `packages/security-audit-sdk-core/package.json` still reports `0.1.0`" |
| Scenario *A documentation-only commit does not bump the SDK version* | "**THEN** the SDK `package.json` version stays `0.1.0`" |

So the document is conformant with a specification that is itself stale, and a change that corrected
the document and stopped there would leave it in the wrong by the repository's own ordering. This is
the trap #424 recorded: grep `openspec/specs/` before fixing anything documentary.

#422 moved both private candidates to `0.2.0` in the `1.0.0` → `1.1.0` contract chain. The pin
inventory that chain produced lists thirteen places a **contract** version move must reach; nothing
lists where an **SDK candidate** move must reach, and the ratified release spec was not among the
paths that chain owned. Ownership is not coverage, in a fourth place.

## What Changes

- **Take the literal out of the ratified text.** Updating `0.1.0` to `0.2.0` in four places re-arms
  the same trap for the next governed candidate move. The scenarios do not depend on the number: what
  *A release does not move the SDK version* means is that the version after a release equals the
  version before it, and what holds it is `compatibility.json` `package.version` — which the
  requirement already names one clause later. Both requirements are restated against the pin rather
  than against a snapshot of it, and a new scenario asserts that the capability's ratified text names
  no candidate version literal at all.
- **Correct and complete the table.** `packages/security-audit-sdk-core` becomes `0.2.0`, and
  `packages/security-audit-sdk-node` (`0.2.0`) and `packages/security-audit-collector` (`0.1.0`) are
  added with what governs each. The contract row's `1.0.0` and the research row's `0.0.0-research` are
  correct as written and stay byte-identical — the contract workspace's package version really is
  `1.0.0` and is deliberately independent of the canonical schema version, now `1.1.0`.
- **Assert it.** `assertReleaseVersionTableCoversDeclaredPackages` in
  `.github/scripts/check-package-discovery.mjs` fails closed in both directions against
  `DECLARED_PACKAGES`, and compares each row's version against that package's own `package.json`
  rather than against a second copy. A governed version move that does not update the table then
  fails, instead of leaving the document describing a version that no longer exists.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

`release-versioning-tag-model` has two requirements restated so that neither pins an absolute
candidate version literal, and gains one requirement: the published version table covers every
declared package and is asserted against the declared set and against each package's own manifest. No
requirement is removed and no scenario is dropped.

## Impact

- `openspec/specs/release-versioning-tag-model/spec.md` — the fold target; two `MODIFIED` requirements
  and one `ADDED`.
- `RELEASING.md` — `governance_core`; the version table only. No release mechanism, precondition,
  bump rule or Release Please configuration changes.
- `.github/scripts/check-package-discovery.mjs` and its test — `governance_core`; the new assertion
  and its controls.

## Out of scope

**No version moves.** No `package.json`, `compatibility.json`, `version.txt` or manifest value
changes. The candidates stay at `0.2.0`, `0.2.0` and `0.1.0`; the contract workspace stays at `1.0.0`;
`version.txt` is Release Please's.

**The release model itself is untouched.** `release-type: simple`, the single `"."` manifest entry,
`include-component-in-tag: false`, `bootstrap-sha` and `initial-version` all stay exactly as they are,
and the requirement that a release moves no `package.json` version is strengthened rather than
relaxed — it now covers every workspace rather than naming one.

**Changelog duplication is a different issue.** Every release lists each change twice, because the
merge-commit policy makes Release Please count both the merge commit and the commit it merged. That is
filed as #471 and needs its own decision about commit parsing; it is not folded in here.
