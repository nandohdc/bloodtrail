## Context

Four hand-maintained descriptions of this repository disagree with it, and one ratified requirement
disagrees with another in the same file.

`.github/scripts/check-package-discovery.mjs` already proves the shape of the fix that works. #412 was
"`make` reported green across all four workspaces while never running the collector", and the repair
was not "correct the message" — it was an executable assertion that the covering targets invoke every
declared workspace. That assertion has held. Everything it does not reach has drifted again:

- the ratified requirement that enumerates the same package set (still four),
- the three partial targets' notices (still four),
- `make help`'s cost figures (still pre-#412),
- and every timing in `CLAUDE.md`, `AGENTS.md` and the `Makefile`.

The timings are a different problem from the counts. A count has one right answer; a runtime does not.
`test:verification` measured 258s and 1234s on two green `main` runs of unchanged code, and 700s and
1164s locally on one workstation hours apart. The figure is real and useful — it is how an agent
decides whether to run a chain before pushing — but it is a measurement, not a threshold, and a
ratified `SHALL` naming one literal turns every run that does not hit it into a nonconformity.

## Goals / Non-Goals

**Goals:**

- Make `ci-topology` self-consistent about the package set, and make it impossible for the next added
  workspace to leave that requirement stale.
- Keep the load-bearing claim about gate cost — `test:verification` dominates SDK `validate` — while
  removing the brittle literals, and require provenance in their place.
- Extend the one mechanism that has held (the executable assertion) to cover the claims that drifted.
- Give a contract version move a single documented pin inventory.

**Non-Goals:**

- Making the gates faster. #306 owns the runner shape that produces the 4.8x spread, it is
  Helm-managed in `doks-platform`, and nothing here changes it.
- Asserting the timings themselves. A gate that fails when a run is slower than a documented figure
  would fail on runner contention, which is the opposite of useful. What is asserted is that a figure
  carries its provenance, not that it is met.
- Rewriting `ci-topology`'s other requirements. Three blocks are replaced; the rest is untouched.

## Decisions

### D1 — Replace the literal counts with a reference to `DECLARED_PACKAGES`

The requirement currently restates the package set *and* its size. Restating the size is what broke:
`b0820c0` updated every consumer of the set and not the sentence describing it.

The enumeration stays — a reader should be able to see which packages exist without opening a script
— but the *authority* becomes `DECLARED_PACKAGES`, and the scenarios stop naming a number. "Exactly
matches the 4 declared packages" becomes "exactly matches the number of entries in the declared
list", which cannot go stale.

A stricter alternative — delete the enumeration entirely and reference only the script — was rejected:
a spec a reader cannot understand without running code is worse than one that repeats a list, provided
the repetition is not the authority.

### D2 — Runtime figures carry provenance; ratified text carries no literal

The replacement obligation is *stronger* than what it replaces. Before: state `~254s`. After: state a
measured figure, name the run or the host and date it came from, and record the method once so it can
be re-derived. A figure with no provenance now fails the requirement; before, a stale figure passed it.

The method is worth stating precisely because it was not obvious: on CI, the cost of one npm script is
the interval between its banner and the next script's banner in the job log — the `sdk` job's own step
timing includes checkout, `npm ci` and the matrix legs, which is why the job total (349s to 1511s
observed) and the step total disagree so widely.

The qualitative claim survives and strengthens. `test:verification` was documented as ~87% of SDK
`validate`; measured locally it is 700s of 737s and 1164s of 1234s — 95% and 94%. Dropping the
literals does not weaken the attribution; it removes the part that was wrong.

### D3 — One cost, one definition: `make` variables rather than a cross-checking assertion

`make help` says `runtime-gates` costs `~26s`; the recipe echoes `~34s`. The obvious repair is to
correct one of them, and the obvious guard is an assertion that they agree.

Both are rejected in favour of removing the duplication. Each cost is defined once as a `make`
variable and referenced everywhere it is stated:

```makefile
COST_RUNTIME_GATES := ~45s
...
	@echo "Running fast product test loop across all workspaces ($(COST_RUNTIME_GATES) local, 2026-09-10)..."
```

Two statements that are the same expansion cannot disagree, so the property holds by construction
rather than by a check that could itself go stale. What remains asserted is narrow and mechanical:
no bare `~<digits>s` literal appears anywhere in the `Makefile` outside the variable block, so a new
hand-typed figure fails rather than quietly reintroducing the divergence.

### D4 — Disclosure is asserted the same way coverage is

The ratified requirement already says a partial run must name what it did not run. Nothing enforced
it, so all three partial targets drifted to the same stale list.

`assertPartialTargetDisclosure` mirrors `assertMakefileCoverage`: for every non-covering target, the
declared workspaces the recipe does not invoke must appear in that target's messages, and a workspace
named as skipped while actually being invoked is equally a failure. Failing closed in both directions
matters — a notice that over-reports what it skipped is as misleading as one that under-reports.

### D5 — Coverage is judged by invocation, not by mention

Fixing D4 exposes a latent hole in the existing assertion. `assertMakefileCoverage` tests
`recipe.includes(workspace)` over the whole recipe, messages included. It passes today only because
neither covering target names a workspace in an `@echo`. The moment a covering target's notice
mentions a workspace it stopped running, the gate would report coverage for a workspace that never
ran — the exact defect #412 was filed for, re-entering through the door D4 opens.

So coverage is computed from the recipe's command lines and disclosure from its message lines. This is
a widening of an existing gate in the same edit that makes it necessary, with its own control arm.

## Risks / Trade-offs

- **The measured figures are stale the moment they are written.** That is inherent and is why the
  change requires provenance rather than accuracy: a figure labelled with its host and date is
  honestly interpretable a year later, while an unlabelled one silently pretends to be current. The
  method is documented so re-measuring is cheap.
- **Removing literals from ratified text removes a mechanically checkable claim.** Nothing now fails
  if `CLAUDE.md` says `~45s` when the truth is 90s. The alternative — asserting a runtime — fails on
  runner contention and would be turned off within a week. The claim that *is* worth failing on, that
  the documented workspace set matches the command surface, stays asserted and is strengthened.
- **`make` variables are a small step away from plain recipes.** The `Makefile` is deliberately a thin
  dispatcher; introducing variables adds indirection. It is confined to the cost strings, which are
  the only values stated more than once, and it buys a property no assertion can: two statements that
  cannot disagree.
