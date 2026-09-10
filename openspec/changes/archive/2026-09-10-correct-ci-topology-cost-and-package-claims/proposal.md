## Why

`openspec/specs/ci-topology/spec.md` describes this repository's package set and the cost of its gate
chains, and both descriptions have drifted from the repository. That matters more than an ordinary
documentation error: the actor-neutral documents say what they say *because a ratified requirement
tells them to*, so correcting `CLAUDE.md`, `AGENTS.md` and the `Makefile` alone would make them
non-conformant rather than correct.

**The spec contradicts itself about the package set (#444).** *Package discovery is an explicit
declared list with a completeness assertion* enumerates four packages, and its scenarios say "across
all four packages" and "exactly matches the 4 declared packages". `DECLARED_PACKAGES` in
`.github/scripts/check-package-discovery.mjs` has five entries and the gate prints
`5 declared package(s)`. The same document's *Root command surface* requirement, 160 lines later,
correctly names five. `b0820c0` — the #412 fix — added `packages/security-audit-collector` to the
declared list, the CI workflow, the `Makefile` and `CLAUDE.md`, and never reached the ratified
requirement that enumerates the same set.

**Three gate timings are pinned as normative literals, and none is right (#424).** The spec requires
the instructions to state "roughly 34 seconds", "~254 seconds out of ~291 seconds", and "~307s".
Measured as the interval between the `test:verification` and `test:git` npm banners in the `sdk` job
log, `test:verification` took 258s, 301s, 321s, 344s, 681s, 1022s and 1234s across the seven most
recent green `main` runs — a 4.8x spread for one unchanged step, driven by runner shape (#306; the
scanner reports `Available processors: 2`). Locally the same step measured 700s and 1164s in two runs
on one workstation hours apart. There is no literal that is correct, and a `SHALL` that names one
makes conformant runs read as non-conformant.

**Three `make` targets under-report what they skipped (#441).** `sdk`, `contract` and `research` each
omit `packages/security-audit-collector` from their "were NOT run" notice — again the workspace #412
was about. The ratified requirement already says a partial run "SHALL explicitly name the workspaces
or checks that were not run", so these are conformance violations rather than missing requirements.
`check-package-discovery.mjs` cannot see them: `COVERING_MAKE_TARGETS` names only the two covering
targets, and the assertion tests invocation, never the notice.

**`make help` and the recipes disagree.** `help` describes `runtime-gates` as `(~26s)` while the
target echoes `~34s`, and quotes `~299s` for `governance-gates` against the recipe's `~307s`. One
file, one target, two costs.

**A contract version move has no documented pin inventory (#426).** `1.0.0 -> 1.1.0` reached the
generator and missed the CRA pin, the collector's packed probe, and coherence's candidate
resolution. Each failed *after* the move landed. #426's remaining acceptance criterion is a single
documented list of the pins such a move must advance; today that list exists only as the union of
four post-hoc repairs.

The five share one shape, and it is the shape #82's decision brief named and #412 proved is not
theoretical: **a hand-maintained claim about the repository, with nothing asserting it.**

## What Changes

- **Correct the package-discovery requirement.** Name `DECLARED_PACKAGES` as the authority for the
  set, enumerate the five current packages, and stop restating the size as a literal, so the next
  added workspace cannot leave the requirement stale the way this one did.
- **Stop pinning absolute gate runtimes in ratified text.** Keep every existing obligation — the two
  chains distinguished, `test:verification` identified as the dominant cost of SDK `validate`, the
  workspace count agreeing with the command surface — and add a stronger one: every stated runtime
  must carry the measurement it came from, and the method must be written down once. This adds an
  obligation and removes none.
- **Make the partial-run disclosure mechanical.** Extend `.github/scripts/check-package-discovery.mjs`
  so every declared workspace a target does not invoke must be named in that target's notice, failing
  closed in both directions, and so coverage is judged by what a recipe *invokes* rather than what
  its messages mention — closing a second latent hole in `assertMakefileCoverage`, where a workspace
  named only in an `@echo` would satisfy the coverage assertion.
- **Bring the documents into conformance.** Correct the three partial-target notices, reconcile
  `make help` with each recipe, and restate every timing in `CLAUDE.md`, `AGENTS.md` and the
  `Makefile` with its provenance.
- **Write down the contract-version pin inventory** in `CLAUDE.md`'s "Gates that will bite you",
  including that the CRA pin validates the *reviewed baseline* and therefore passes exactly once —
  for the version-move PR itself, whose base still carries the old version.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

`ci-topology`. Three requirement blocks are replaced whole: *Package discovery is an explicit
declared list with a completeness assertion*, *Development instructions distinguish product loop from
governance chains*, and *Root command surface dispatches product loop and governance gates*. Every
existing scenario in all three survives; six are added. No requirement is removed and no obligation
is dropped — the runtime literals are replaced by a strictly stronger obligation to state a figure
*with* its provenance.

## Impact

- `openspec/specs/ci-topology/spec.md` — via the delta in this change; folded in its own PR.
- `CLAUDE.md`, `AGENTS.md` — `governance_core`; timings, and the pin inventory in `CLAUDE.md`.
- `Makefile` — `governance_core`; timings, the three partial-target notices, and `help`.
- `.github/scripts/check-package-discovery.mjs` and `.github/scripts/check-package-discovery.test.mjs`
  — `governance_core`; the new partial-target assertion and the invocation-versus-mention fix.

No package, dependency, API, or contract artifact changes. No workspace's declared Node support
changes and `compatibility.json` is untouched.
