## Context

`.github/scripts/check-package-discovery.mjs` holds `DECLARED_PACKAGES` and asserts two things about
it: that it matches what `git ls-files` finds on disk, and that both covering `make` targets invoke
every entry. Both assertions exist because the hand-maintained alternative failed — #412 for the
`Makefile` recipes, #441 for their notices.

`sonar-project.properties` is the same kind of list and has never been asserted against anything. It
was widened once, from a research-only scan to what its header calls "every workspace", and the two
workspaces added since were never appended. The header is the reason nobody noticed: a file that
declares itself complete does not invite re-reading.

## Goals / Non-Goals

**Goals:**

- Bring the required gate's analysis scope up to the declared package set.
- Assert that property, so the next added workspace fails rather than drifts.
- Read the two workspaces' existing coverage reports, which the `coverage` job already produces and
  path-rewrites and Sonar currently ignores.

**Non-Goals:**

- Adding `openspec/scripts/` or `.github/scripts/`. See D3.
- Changing any threshold, quality profile, or the project key. The gate's conditions are untouched;
  only what it looks at changes.
- Fixing the permanently-present unresolved-path warning (#442). Widening the scope changes which
  records resolve, so that issue is sequenced after this one and is not addressed here.

## Decisions

### D1 — Widen the scope rather than narrow the claim

The header comment could be corrected instead — "scans the SDK core, the contract and the research
harness" — leaving the scope as it is. That is rejected: the two omitted workspaces are the Node
delivery binding and the collector ingress, which are where authentication, deduplication, retry and
backpressure live. Of the five workspaces, they are the two whose code most warrants a security-
oriented analyser, and `sonar` is required precisely so that such code is analysed before it lands.

### D2 — The blast radius is bounded, and it was measured before deciding

The quality gate is `Sonar way` (default, built-in) and all three of its conditions are new-code only:
`new_coverage >= 80`, `new_duplicated_lines_density <= 3`, `new_violations = 0`. Pre-existing findings
in newly analysed files land in overall code, which no condition covers, so widening cannot red the
gate by itself.

What it does change is that a future pull request touching one of those files inherits whatever the
analyser says about the lines it touches. `packages/security-audit-collector/src/ingress.ts`, the
largest file being added, was run through the analyser against this project's profile and reported
`issueCount: 0`.

One sample bounds nothing on its own, and the way to bound it is not to replay the analyser file by
file. The implementation pull request's own `sonar` run analyses exactly the widened set, against the
live quality profile and the live gate, and it runs **before** the merge — so it is both the
authoritative measurement and a blocking one. If the widening surfaces something the gate refuses,
the required context is red and the change does not land. Task 2.1 is written around that: sample
first so a catastrophic surprise is caught before the push, then take the real number from the run.

### D3 — Declared packages now; repository tooling separately

`openspec/scripts/` and `.github/scripts/` are outside the scope too, and are deliberately left out.
They are not declared packages, and — decisively — neither produces a coverage report, because the
`coverage` job runs `npm run test:coverage` in the four packages only. Under `new_coverage >= 80`,
analysing them makes the next pull request that edits a line in the governance checker or the merge
gate report 0% coverage on that line and fail a required context.

That is a worse outcome than the omission it fixes, and the fix for it — either produce coverage for
those trees or add them to `sonar.coverage.exclusions` — is a separate decision with its own
verification. The requirement added here says such an exclusion must be *recorded with its reason*
rather than left implicit, which is what keeps this from becoming the next silent omission.

### D4 — Assert against `DECLARED_PACKAGES`, in both directions

The assertion mirrors `assertMakefileCoverage`: every declared workspace must appear in
`sonar.sources`. The reverse direction matters as much — a scope entry under no declared package
means either a workspace was removed and the list was not, or a path was typed wrong and silently
analysed nothing. Both are the same class of stale list, so both fail.

Recorded exceptions are named explicitly in the checker rather than inferred, so adding one is a
visible edit to a governance-core file rather than a quiet widening of what the assertion tolerates.

## Risks / Trade-offs

- **A future PR touching the newly analysed files inherits findings on its touched lines.** That is
  the intended effect — it is what "analysed" means — but it is a real cost borne by whoever touches
  those files next rather than by this change. Task 2.1's full-file sweep is what keeps that cost
  from being a surprise; if it finds anything, the finding is recorded on the change before the scope
  moves, not discovered by the next contributor.
- **`new_coverage` now applies to the two workspaces' touched lines.** Their coverage reports are
  supplied, so this is the same regime sdk-core already lives under. A file with genuinely untested
  new lines will fail, which is the point.
- **The assertion couples two governance-core files.** `sonar-project.properties` can no longer be
  edited without regard for `DECLARED_PACKAGES`. That coupling is deliberate and already exists for
  the `Makefile`; the alternative is the state this change is fixing.
