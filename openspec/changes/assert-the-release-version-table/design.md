## Context

Three artefacts describe the SDK candidate's version. `packages/security-audit-sdk-core/package.json`
carries `0.2.0`; `compatibility.json` asserts `0.2.0` and `check-coherence.mjs` rule `package-version`
holds them equal; and the ratified `release-versioning-tag-model` specification says `0.1.0`, as does
`RELEASING.md`. The first two are correct and mechanically enforced. The second two are prose, and
both went stale when #422 moved the candidate.

## Goals / Non-Goals

**Goals.** Ratified text that a legitimate governed version move cannot falsify. A version table that
covers every declared package and cannot silently disagree with the manifests it describes.

**Non-Goals.** Moving any version. Changing the release model, its preconditions, or its Release Please
configuration. Fixing changelog duplication (#471).

## Decisions

### D1 — Remove the literal rather than update it

Four occurrences of `0.1.0` could be changed to `0.2.0` in one edit. That restores conformance today
and re-arms the trap for the next candidate move, which is expected: the same requirement says such a
move is legitimate under a governed change with its own owner decision. Ratified text that names the
value a sanctioned change will move is text that a sanctioned change makes non-conformant.

So conformance is stated against the pin. `compatibility.json` `package.version` is the artefact the
requirement already names as the freeze, and `package-version` is the rule that enforces it; a
scenario asserting "the version after a release equals the version before it, and still equals its
compatibility baseline" tests the property the requirement is about, while "still reports `0.1.0`"
tested a snapshot.

The same reasoning produced #444's outcome for gate timings: every figure carries its provenance, and
ratified text pins no absolute value a legitimate change will move. This is that conclusion applied to
a second kind of figure.

### D2 — Keep the contract row's literal

`contracts/security-audit/package.json` really is `1.0.0`, and the requirement's point about it is
precisely that it is owned by a different process and is independent of the canonical schema version —
now `1.1.0`. Removing that literal would remove the contrast the sentence exists to draw, and unlike
the candidate versions this one is not expected to move under this capability at all. It stays, and
the requirement now says explicitly that it is deliberately independent of the schema version, so the
next reader does not read the two as a disagreement.

### D3 — Assert the table against the manifests, not against a second list

The table is the fifth hand-maintained enumeration of the workspace set in this repository, after the
`make` recipes (#412), their notices and the ratified package enumeration (#441), and
`sonar.sources` (#452). Each was corrected once and went stale again; each needed an assertion.

`assertReleaseVersionTableCoversDeclaredPackages` therefore does two things at once, because the table
carries two kinds of claim. Coverage is checked against `DECLARED_PACKAGES` and fails closed in both
directions, mirroring `assertMakefileCoverage` and `assertSonarScopeCoversDeclaredPackages`. The
version literal in each row is checked against that workspace's own `package.json` — not against a
constant in the checker, which would be the sixth copy.

### D4 — Parse the table structurally, not by pattern-matching prose

The rows are Markdown table rows whose first cell is a backticked workspace path and whose second is a
backticked version. The checker splits on `|` and reads those two cells, so a row it cannot parse is a
failure rather than a silent skip — the failure mode that makes an assertion look green while checking
nothing. A row for a workspace that is not declared fails; a declared workspace with no row fails.

## Risks / Trade-offs

- **A governed version move now has one more place to update.** That is the point, and it fails loudly
  at the moment of the move rather than quietly afterwards. It also belongs in the candidate-move
  inventory, which does not exist yet — the contract-move inventory in `CLAUDE.md` covers a different
  set, and the absence of its counterpart is what let this go stale.
- **Restating a ratified requirement is a `MODIFIED` delta, which replaces the block.** Every existing
  scenario is carried through; strict OpenSpec validation and a diff against the pre-change file are
  what prove nothing was dropped.
- **`RELEASING.md` is `governance_core`.** It is the subject of this change rather than incidental to
  it, and the full assessment and fifteen-dimension justification the trigger forces are supplied.
