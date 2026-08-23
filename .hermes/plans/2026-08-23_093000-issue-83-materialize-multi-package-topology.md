# Issue #83 — Materialize the Approved Multi-Package Repository Topology — Plan

> **For Hermes:** Blocked on three unanswered items: #80 (topology, owner), #76 (version policy, via #75)
> and #78 (authority scope, via #77). **All three trace back to two owner decisions.** The issue's own
> constraint is the one to hold onto: "without semantic behavior change". That means this is a *move*, and
> a move in this repository is unusually expensive because `check-coherence.mjs` pins the SDK's identity,
> version, engines, export map and TypeScript pin as literals, and `check-changed-paths.mjs` rejects a new
> uncommitted file under `src/` unless its exact path is pre-declared. Plan the pins before the paths.

**Goal:** The selected package/workspace structure exists, every package installs and validates under the
selected lockfile policy, hoisting does not mask undeclared imports, and existing contract/SDK validation
stays green — with no semantic change.

**Status at this baseline:** BLOCKED ON #80 → and on #76, #78 (themselves blocked on #75, #77).

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #83, OPEN, labels `enhancement` `openspec-change-needed` `area:core` `needs-triage` |
| Declared dependencies | #80, #76, #78 — all blocked |
| Native GitHub blockers | `blocked_by` is `0` |
| Layout today | `contracts/security-audit`, `packages/security-audit-sdk-core`, `research/browser-telemetry`; **no root `package.json`** |
| Pinned by `check-coherence.mjs` | package name, version `0.1.0`, engines string, runtime-dependency count `0`, export map `[".", "./testing"]`, TypeScript pin `5.9.2`, catalog counts `24`/`24`, delivery classes, extension namespaces, ADR count `11`, scenario count `15` |
| Pinned by `check-compatibility.mjs` | the engines literal `>=24 <25 \|\| >=26 <27` |
| Pinned by `check-contract-immutability.mjs` | `contractVersion`, `normativeTechnicalTarget` |
| Lifecycle protected prefixes | `contracts/security-audit/`, `openspec/specs/security-audit-event-contract/`, the archived contract change |
| New `src/` file rule | fails `test:changed-paths` unless listed in `ownership.reviewedNewSdkSourcePaths` |
| Path classes | `packages/`, `contracts/`, `research/` all `governed_implementation`; a root `package.json` would be **unclassified** — see F4 |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — "No semantic behaviour change" is testable, and the test already exists

`npm run validate` in both workspaces plus `test:matrix` on both Node majors is the definition of "still
works". Run it before and after and diff the outputs, not just the exit codes. The SDK's scope pass line
and coupling inventory are the most sensitive strings; a topology change that alters them has changed
something.

### F2 — Package discovery from a clean clone is the acceptance criterion nobody usually tests

#83's first criterion is "Package discovery works from a clean clone." Under standalone that means: clone,
`cd` into each workspace, `npm ci`, `npm run validate`. Under workspaces it means `npm ci` at the root
resolves all three. **Test it in a genuinely fresh clone**, not in the working tree with a warm
`node_modules` — this repository's `verify` script already wipes `node_modules` for exactly this reason.

### F3 — Hoisting must be tested against the packed install, not against the source tree

The gate that hoisting threatens is `check-package-contents.mjs`, which does a production-only install of
the packed tarball. Under a workspace root, that install must happen in a clean directory **outside** the
root, or a hoisted transitive dependency satisfies an undeclared import and the gate passes a broken
artifact. #83's third criterion ("Hoisting does not mask undeclared imports") is satisfied by proving that
property, and by nothing else.

### F4 — A root `package.json` would be an unclassified path, and unclassified fails closed

`design-pattern-policy.json` classifies `packages/`, `contracts/`, `research/`, `openspec/`, and a list of
named root files. **`package.json` at the repository root is not among them.** Under the policy's own
resolution rule, "a path matching no pattern is unclassified and fails closed" — so the first commit
adding a root manifest would fail `design-pattern-governance` with `[path-unclassified]`, exactly as
`version.txt` did on PR #182 before #202.

**This is the single most likely way #83 fails on its first push, and it is invisible until then.** If a
root manifest is selected, classify it in the same change — and note that classifying it is a
`governance_core` edit requiring full assessment and dual-checker validation. Budget for that.

### F5 — Moving `src/` files is the second trap

If the topology change relocates any SDK source, every new path must be pre-declared in
`ownership.reviewedNewSdkSourcePaths`. Today that list has exactly one entry. A move of nineteen source
files means nineteen entries, added in the same change, in a file that is `governance_record_only`.

### F6 — Generated-source ownership must survive the move

`src/generated/` is produced by `scripts/generate-contract.mjs` from the contract source and compared
byte-for-byte by `check:generated`. If the SDK's directory moves, the generator's output path moves with
it, and the generator is the thing to change — **never its output**. Verify `check:generated` before
`validate` after the move, exactly as CI does, because `validate` runs `generate` first and would mask
committed drift.

### F7 — This change cannot be split, and that is uncomfortable

`test:coherence` asserts a set of literals simultaneously. Moving half of them fails. So a topology
materialization is one large change, or it is a sequence of changes each of which leaves the repository
red. Plan for one change and a long PR.

---

## Task 0: The gate

- [ ] 0.1 **Confirm #80 is answered.** If not, stop.
- [ ] 0.2 **Confirm #76 and #78 are resolved.** #83 declares both. If either is open, stop — a topology
      move on top of an unsettled authority model or version policy means doing it twice.
- [ ] 0.3 If #80 ratified standalone with no structural change: #83 may close as **already-satisfied**,
      with the ADR from #80 as its record. Verify each acceptance criterion against the current layout and
      close with evidence. **This is the most likely outcome** and it should be checked first.

## Task 1: Baseline measurement (read-only)

- [ ] 1.1 Fresh clone into the scratchpad. `npm ci` + `npm run validate` in both workspaces. Record full
      stdout, not exit codes (F1).
- [ ] 1.2 Record the scope pass line and coupling inventory verbatim.
- [ ] 1.3 Record every literal `check-coherence.mjs` pins (the pins table above), read from source.

## Task 2: Propose

- [ ] 2.1 OpenSpec change `materialize-repository-topology`.
- [ ] 2.2 The proposal must enumerate **every pinned literal that moves** and state the plan for each.
- [ ] 2.3 If a root manifest is involved: the change is `governance_core` because it must classify the new
      path (F4). Full assessment, dual-checker validation, the works.
- [ ] 2.4 If `src/` files move: enumerate every new path for `ownership.reviewedNewSdkSourcePaths` (F5).

## Task 3: Materialize

- [ ] 3.1 Add the selected root/package-manager metadata.
- [ ] 3.2 Classify any new root path in `design-pattern-policy.json` **in the same commit range** (F4).
- [ ] 3.3 Update `check-coherence.mjs` and `compatibility.json` together for any moved literal.
- [ ] 3.4 Update the generator, not its output, for any moved generated path (F6).
- [ ] 3.5 Document package-local commands and the migration in `CONTRIBUTING.md` and `CLAUDE.md` — both are
      `governance_core`, which raises this change's ceremony again.

## Task 4: Prove no semantic change

- [ ] 4.1 Fresh-clone discovery test (F2) — clone, install, validate, from zero.
- [ ] 4.2 Packed-install closure test from a clean directory **outside** any workspace root (F3), with an
      undeclared-import mutation arm and a **null control**.
- [ ] 4.3 Diff every output from Task 1 against the post-move run. Explain every difference; an unexplained
      difference is a semantic change and violates the issue's own constraint.
- [ ] 4.4 `check:generated` **before** `validate` (F6); then both `validate` chains; then `test:matrix` on
      both Node majors.

## Task 5: Commit, PR, close

- [ ] 5.1 Index empty before verification; governance verified **after** the commit exists (#191).
- [ ] 5.2 Expect a long PR. Do not split it into red intermediate states (F7).
- [ ] 5.3 Comment on #84, #85, #86 that materialization is done.
- [ ] 5.4 Close #83; tick it in #132's Wave 2 checklist.

---

## Validation matrix

| Acceptance criterion (#83) | Arm |
| --- | --- |
| Package discovery works from a clean clone | Task 4.1 |
| Every package installs/validates under the lockfile policy | Task 4.1, 4.4 |
| Hoisting does not mask undeclared imports | Task 4.2, with a null control |
| Existing contract/SDK validation stays green | Task 4.3, output diff |

## Risks and open questions

- **F4 is the ambush.** A root `package.json` is unclassified today and fails closed on first push.
- **Doing this before #76/#78 resolve means doing it twice.** Hold the gate.
- **The most likely correct outcome is "nothing to materialize".** Check Task 0.3 first; a change that
  turns out to be unnecessary is cheapest to discover before it is written.
- **Open question for the owner:** does materialization include creating the *empty* Core and sdk-node
  package skeletons (#86, #87), or only the workspace mechanics? #83's summary says "create the selected
  package/workspace structure", which is ambiguous. Recommend mechanics only; skeletons belong with the
  code that fills them.

## What this does not authorize

Semantic refactoring, creating sdk-node's contents, release configuration, CI changes, publication, or any
production integration.

## What this plan did not verify

Whether a root `package.json` would in fact trip `[path-unclassified]`. F4 is derived from the policy's
resolution rule and the #202 precedent; measure it in a disposable clone before proposing.
