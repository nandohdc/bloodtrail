# Issue #80 — Decide the Multi-Package Repository and Package-Manager Topology — Decision Packet

> **For Hermes:** Owner decision, `ready-for-human`, brief posted 2026-08-16 and unanswered. **Do not
> restructure anything.** This is the widest-reaching of the three open Wave 2 decisions: #81, #82, #83,
> #84, #85 and #86 all wait on it. Its four declared dependencies (#68, #69, #70, #71) are **all now
> closed** — Wave 1 completed on 2026-08-22 — so the precondition the issue set for itself is satisfied
> and nothing but the decision is missing. The single hard constraint is in the issue's own acceptance
> criteria: **"Undeclared imports remain visible."** That is not a preference; three separate gates in
> this repository exist to keep undeclared runtime imports detectable, and a hoisting package manager can
> silently defeat all three.

**Goal:** One recorded topology — standalone packages, npm workspaces, pnpm workspaces, or another
evaluated option — with lockfile and package ownership, root-package presence, and migration/rollback
documented.

**Status at this baseline:** BLOCKED ON OWNER. Preconditions met.

**Blast radius if unanswered:** #81 and #82 are gated directly; #83, #84, #85, #86, #87, #88 follow.
**Eight issues — the entire remainder of Wave 2.**

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #80, OPEN, labels `enhancement` `question` `openspec-change-needed` `area:core` `ready-for-human` |
| Declared dependencies | #68, #69, #70, #71 — **all CLOSED** (Wave 1 complete 2026-08-22) |
| Native GitHub blockers | `blocked_by` is `0` |
| Layout today | three standalone workspaces: `contracts/security-audit`, `packages/security-audit-sdk-core`, `research/browser-telemetry` |
| Root manifest | **none** — no root `package.json`, no workspace manifest |
| Command convention | every workspace standalone; always `--prefix` or `cd` |
| Node engines | SDK `>=24 <25 \|\| >=26 <27`; contract and research `>=26.5.0` |
| SDK runtime dependencies | **zero**; `dependencies`, `peerDependencies`, `optionalDependencies` all empty and gated |
| Gate 1 — undeclared imports | `check-scope.mjs` — filename rule, manifest rules, AST platform-coupling stage (#71) |
| Gate 2 — shipped imports | `check-dependencies.mjs` + `shipped-import-policy.mjs` (#69) — AST over packed artifacts |
| Gate 3 — packed closure | `check-package-contents.mjs` + `packed-completeness.mjs` (#70) — production-only install of the tarball |
| PLAN-008 disposition | recorded ALREADY_SATISFIED against the current layout — but **no decision record exists** |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The current layout is a de-facto standalone topology with no decision behind it

Three package boundaries, no root manifest, per-workspace `node_modules`, per-workspace lockfiles, per
-workspace scripts. PLAN-008 marks the topology obligation ALREADY_SATISFIED against this layout — but
"satisfied" and "decided" are different. Lockfile ownership, root-package presence, and migration/rollback
are unrecorded, which is exactly what #80 asks for.

**Consequence:** ratifying standalone is, like #75, mostly a writing exercise. Say so.

### F2 — Three gates depend on dependency visibility, and hoisting is precisely what defeats them

- `check-dependencies.mjs` inspects **shipped** artifacts for module specifiers not declared in the
  manifest. Hoisting does not blind it — it reads the artifact, not `node_modules`.
- `check-package-contents.mjs` performs a **production-only install of the packed tarball** and imports it.
  This is the gate hoisting actually threatens: under a hoisting workspace root, a transitively-hoisted
  package can satisfy an undeclared import during local development, and the packed install is the only
  place that lie is exposed. It must keep running **outside** the workspace root.
- `check-scope.mjs` reads source, not resolution. Unaffected.

So the honest statement is narrower and more useful than "hoisting hides undeclared imports": **hoisting
hides them during development; #70's packed install is the control that still catches them, provided the
install happens in a clean directory outside any workspace root.** Any topology chosen must preserve that
property, and that is testable.

### F3 — A prior session recorded a harness artefact that will recur under any hoisting topology

`check-dependencies.mjs` was observed exiting 1 in a *copy* harness whose `node_modules` was a symlink to
the live tree — printing `npm ls` JSON with `extraneous: fast-deep-equal@3.1.3`. A **null control** (the
identical harness, no mutation) also exited 1. On the live tree the same script exits 0.

Under a workspace root, that symlink-shaped confusion becomes the normal case rather than a harness
accident. **Any evaluation of npm or pnpm workspaces must include a null control**, or the measurement
will be noise.

### F4 — The three workspaces have different Node engine ranges, and a single root would have to reconcile them

SDK: `>=24 <25 || >=26 <27`. Contract and research: `>=26.5.0`. A root manifest with a single `engines`
field either drops to the intersection (`>=26.5.0 <27`, which loses Node 24 for the SDK and breaks
`test:matrix`) or omits engines and lets each workspace declare its own. **This is a concrete cost of a
root manifest** and it is not in the issue body.

### F5 — `check-coherence.mjs` pins the SDK's engines string as a literal

`rule("node-engines", …, pkg.engines?.node === expected.nodeEngines, …)` and the same value in
`compatibility.json`. Any topology change that touches the SDK's `engines` moves a pinned constant and
must update `compatibility.json` in the same change. Under standalone, nothing touches it.

### F6 — Materialization is a separate issue, and the decision must not pre-empt it

#83 materializes; #80 only decides. The decision record should name the migration and rollback **plan**,
not perform it. A decision that says "run `npm init -w`" is doing #83's work.

### F7 — pnpm would be a new tool in a repository that has deliberately few

There is no ESLint, no Prettier, no bundler, no monorepo tool. Strict `tsc`, SonarQube and CodeScene serve
the linter's role. Introducing pnpm adds a required tool to every contributor's machine and every CI job,
and CI currently installs with plain `npm ci` per workspace. That is a real cost against pnpm's real
benefit (strict `node_modules` isolation, the best undeclared-import visibility of the hoisting options).

---

## The decision, as the owner should see it

| | **Standalone (current)** — recommended | **npm workspaces** | **pnpm workspaces** |
| --- | --- | --- | --- |
| Migration cost | **zero** | root manifest, lockfile consolidation, CI rework | above, plus a new required tool (F7) |
| Undeclared-import visibility in development | **maximal** — no hoisting | weakest — hoisting by default | strong — strict isolation |
| Packed-install control (#70) still valid | yes | yes, **if run outside the root** (F2) | yes, same caveat |
| Engines reconciliation | none needed | root must drop engines or intersect (F4) | same |
| Pinned constants moved | none | possibly `engines` → `check-coherence` + `compatibility.json` (F5) | same |
| Cross-package install coordination | manual, and gets worse as packages grow | good | good |
| New tool required | no | no | **yes** |
| CI change | none | every job | every job |

**Recommendation: ratify standalone**, and revisit only when the package count actually grows. The
argument is not inertia: the repository's core discipline is that undeclared runtime dependencies must be
impossible to hide, the SDK has **zero** runtime dependencies by policy, and standalone is the only option
where that property needs no defending. The coordination pain that workspaces solve does not exist yet —
there are three packages, two of which are not shipping code.

**The counter-argument the owner should weigh:** #83, #86 and #87 are about to add packages (Core, the
Node binding, later a client-evidence package). If the target state is five or six packages, deciding
standalone now means deciding it again at package five. If the owner already knows the target count,
decide for the target, not for today.

---

## Task 0: Re-verify preconditions and measure (read-only)

- [ ] 0.1 Confirm #68, #69, #70, #71 are all closed. They are — but the issue's own gate says to check.
- [ ] 0.2 Confirm no root `package.json` and no workspace manifest exists.
- [ ] 0.3 **Prototype in disposable directories only** (#80's own verification step). For each of npm and
      pnpm workspaces: build a throwaway root, install, and run `check-package-contents.mjs` from a clean
      directory outside the root. Record whether an undeclared import is still caught.
- [ ] 0.4 **Every prototype arm carries a null control** — the same harness with no mutation (F3).
- [ ] 0.5 Record the engines reconciliation cost concretely (F4) for each hoisting option.

## Task 1: Post the decision brief

- [ ] 1.1 Lead with F2 stated precisely — hoisting hides undeclared imports *in development*; the packed
      install is the surviving control; it must run outside the workspace root.
- [ ] 1.2 Include the comparison table and the Task 0.3 measurements.
- [ ] 1.3 Ask the owner the target package count (the counter-argument above). It changes the answer.
- [ ] 1.4 Carry the AI-triage disclaimer. Keep `ready-for-human`.

## Task 2: When the owner answers

- [ ] 2.1 OpenSpec change `ratify-repository-topology`.
- [ ] 2.2 Root ADR `docs/adr/000N-repository-and-package-manager-topology.md` recording: the selection,
      lockfile and package ownership, root-package presence, the undeclared-import visibility argument
      with the Task 0.3 evidence, and the migration/rollback plan (**plan only** — F6).
- [ ] 2.3 Comment on #81 and #82 that their gate is open; they are the next two decisions.
- [ ] 2.4 Do **not** touch `check-coherence.mjs` or `compatibility.json` unless the selection actually moves
      a pinned constant (F5) — and if it does, that belongs to #83, not here.

## Task 3: Close

- [ ] 3.1 Close #80 naming the topology and the ADR path.
- [ ] 3.2 Tick #80 in #132's Wave 2 checklist; note the decision surface shrank.

---

## Validation matrix

| Acceptance criterion (#80) | Where satisfied |
| --- | --- |
| Exactly one topology selected | owner's recorded answer |
| Undeclared imports remain visible | Task 0.3 prototype evidence + F2's precise statement |
| Lockfile/package ownership and root-package presence explicit | ADR |
| Migration/rollback documented | ADR, as a plan (F6) |

## Risks and open questions

- **Deciding for today rather than the target state** is the main trap (see the counter-argument).
- **Prototypes without null controls will mislead** (F3). This has already happened once in this
  repository.
- **Ratifying standalone can look like avoidance.** It is not, if the ADR carries the measurement. Without
  the measurement it is exactly that — so do Task 0.3 even if the answer looks obvious.
- **Open question for the owner:** is `research/browser-telemetry` intended to stay in this repository at
  all? It is explicitly not shipping code, it has its own Node range, and it is the only workspace with a
  `lint` script. If it leaves, the topology question gets simpler by one third.

## What this does not authorize

Restructuring the repository, editing release configuration, changing CI, or publishing anything.

## What this plan did not verify

Whether npm or pnpm workspaces actually defeat #70's packed install — Task 0.3 measures it, and the answer
in F2 is structural reasoning, not a measurement.
