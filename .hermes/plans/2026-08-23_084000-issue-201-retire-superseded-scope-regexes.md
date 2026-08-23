# Issue #201 — Retire the Superseded Source-Content Regexes in the Scope Gate — Triage and Implementation Plan

> **For Hermes:** #201's premise is accurate at `main@1948f9f`: `check-scope.mjs` still runs the five
> `forbiddenSource` regexes at `:26-32` and the text specifier scan at `:47`, beside the AST stage it
> delegates to at `:64`. This change **removes rejection surface**, so every retirement needs a control
> proving the AST stage rejects the same mutation *before* the pattern goes. One finding changes the shape
> of the work and is not in the issue: the existing arm at `mutations.test.mjs:639` writes
> `fetch('https://example.invalid')` and asserts the diagnostic contains the string `"fetch"` — the AST
> stage emits `[platform-coupling:undeclared-global] src/network-probe.ts: fetch`, which still contains
> it, so the arm **passes unchanged but its test name becomes a lie**. Fix the name in the same change.
> Execute with the `openspec-*` skills. Do NOT merge — the owner merges.

**Goal:** Delete the `forbiddenSource` array, its loop, and the text-based specifier scan from
`check-scope.mjs`, leaving the filename rule and the `package.json` manifest rules untouched, with a
control per retired pattern proving the net rejection surface did not shrink.

**Status at this baseline:** READY — no blocker. #71 landed the superseding stage; #201's own body says so.

**Architecture:** A deletion, not an addition. `check-scope.mjs` keeps three responsibilities and loses
one: it keeps `forbiddenFileName` (authorization boundary, no AST equivalent), the `dependencies` /
`optionalDependencies` / `peerDependencies` emptiness rules, and the forbidden-export scan over
`package.json`; it loses the source-text scanning entirely. The `.ts`-only file filter at `:13` and the
`src/generated/` skip at `:36` exist **only** to serve the deleted loop, so they go with it — the filename
rule should apply to every artifact the tree walk yields, which is strictly more coverage, not less. That
is the one place this change *adds* rejection surface, and it needs its own control.

**Tech Stack:** ESM `.mjs` under `packages/security-audit-sdk-core/scripts/` and `tests/verification/`,
`node --test`, disposable clones via `tests/verification/disposable-git.mjs`, openspec CLI 1.10.0.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #201, OPEN, labels `verification` `openspec-change-needed` `area:core` `needs-triage` |
| Native GitHub blockers | `blocked_by` is `0`; the body declares none |
| Legacy stage | `packages/security-audit-sdk-core/scripts/check-scope.mjs:26-32` (`forbiddenSource`), `:44-46` (loop), `:47-51` (text specifier scan) |
| File filter serving only the legacy stage | `:13` — `sourceTree.files.filter((file) => extname(file) === ".ts")` |
| Generated skip serving only the legacy stage | `:36` — `if (relativePath.startsWith("src/generated/")) continue;` |
| Rules that must survive | `:16-24` `forbiddenFileName` (18 terms), `:56-58` dependency emptiness, `:59-65` forbidden exports |
| AST stage entry | `:67` — `inspectPlatformCoupling({ packageRoot, sourceRoot, tree: sourceTree })` |
| AST diagnostics | `undeclared-specifier`, `undeclared-global`, `read-failure`, `directory-read-failure` |
| AST policy module | `packages/security-audit-sdk-core/scripts/platform-coupling-policy.mjs`, `PLATFORM_COUPLING_POLICY` at `:99` |
| Existing coupling controls | `tests/verification/platform-coupling-mutations.test.mjs` — 11 tests, arms `M-71-E` … `M-71-Q`, five of them negative controls |
| **The arm that changes meaning** | `tests/verification/mutations.test.mjs:639` — `"scope matcher retains source-content and runtime-dependency controls"` |
| Scope pass line | `check-scope.mjs:73` plus `formatInventory` — the count string appears nowhere else |
| Path class | `packages/` → `governed_implementation` |
| Lifecycle mode | `archived`; `reviewedNewSdkSourcePaths` currently lists only `src/bounded-fifo.ts` |
| Required PR checks | `ci / lint`, `ci / test`, `ci / audit`, `sdk`, `contract`, `sonar`, `conventional-commits`, `codescene delta`, `design-pattern-governance` |

---

## Proven findings

### F1 — The premise holds verbatim

All five patterns and the text specifier scan are present at the lines the issue names. `#71`'s AST stage
sits below them, untouched. Nothing between `b8a54e8` and `1948f9f` moved `check-scope.mjs`.

### F2 — The over- and under-approximation claims are structural, not empirical accidents

The over-approximation is a property of `RegExp.prototype.test` over raw file text: the patterns carry no
notion of comment, string literal, or identifier binding. `/\b(?:http|https|net|tls|dgram|fs|…)\b/` cannot
distinguish `fs` in `// never touches fs, by design` from an import. The under-approximation is a property
of the specifier scan's shape — `(?:from|import)\s*(?:"…"|'…')` requires a quote **directly** after the
keyword, which `await import("node:fs")` and `require("node:fs")` do not satisfy. Neither is a tuning
problem. Say this in the proposal; it is the argument for deletion rather than repair.

### F3 — The AST stage rejects every class the retirement targets, by construction

`LANGUAGE_GLOBALS` at `platform-coupling-policy.mjs:16` admits only ECMAScript language globals. Neither
role's `hostGlobals` declares `console`, `fetch`, `document`, `localStorage`, `sessionStorage`,
`navigator`, `window`, `WebSocket`, or `XMLHttpRequest`. Every one of them therefore reaches
`violation(artifactPath, identifier, "undeclared-global")` at `:563`. Undeclared module specifiers reach
`"undeclared-specifier"` at `:553` in every import/export/require position, dynamic included. **This is
not a claim to re-derive — it is the policy's data. Re-read it, then move on.**

### F4 — The existing arm survives, and that is the trap

`mutations.test.mjs:639` writes `fetch('https://example.invalid');\n` into `src/network-probe.ts` and
asserts `fails(..., "fetch")` — a substring match on the diagnostic. After retirement the diagnostic reads
`[platform-coupling:undeclared-global] src/network-probe.ts: fetch`, which contains `fetch`. **The arm
passes unchanged**, satisfying #201's last acceptance criterion literally.

But the test is named `"scope matcher retains source-content and runtime-dependency controls"` and the
source-content control will no longer exist. A green test asserting a stage that was deleted is exactly
the failure mode this repository has already been bitten by. Rename it in the same change, and record in
the change's evidence that the arm was verified to pass *for a different reason than before*.

Also note the fixture path: `network-probe.ts` does not match any of the 18 `forbiddenFileName` terms, so
the arm isolates the content stage cleanly. That is why it works as a differential.

### F5 — Dropping the `.ts` filter and the `src/generated/` skip widens the filename rule

Both exist only to feed the deleted loop. Removing them lets `forbiddenFileName` see `.cjs`/`.mjs`/`.js`
artifacts and everything under `src/generated/`. Today `src/generated/schema-validator.generated.cjs` is
invisible to the filename rule twice over. Widening is the right outcome — a file named
`src/generated/transport.generated.cjs` should fail — but it is a **behaviour change beyond deletion** and
needs its own arm and its own line in the proposal. Do not let it ride in silently under "retirement".

### F6 — The unreadable-file divergence resolves itself

`check-scope.mjs:41-43` swallows a read failure with a bare `continue`; the AST stage fails closed with
`read-failure` on the same artifact (`platform-coupling-policy.mjs:529`). Deleting the legacy loop deletes
the silent path. #201 asks for a decision here; the decision is **no decision is needed** — the divergence
disappears with the code that caused it. Record that rather than inventing a policy.

### F7 — The scope pass line changes, and one gate reads it

`check-scope.mjs:73` prints `scope passed: ${files.length} SDK source files, …`, where `files` is the
`.ts`-filtered list. Removing the filter changes that count. Grep for the count string before assuming
nothing consumes it — per #71's plan it appears nowhere but `check-scope.mjs` itself, but re-verify at this
baseline, because a green gate reading a changed string is a silent regression.

### F8 — Analyser exposure: two files, two different risks

`check-scope.mjs` shrinks, which helps `codescene delta`. `mutations.test.mjs` is a known code-health
hotspot: an edit there can fail file-level rules regardless of size. This change touches it only to rename
a test — the smallest possible edit — but check `cs delta` before assuming it is free. Prefer putting new
arms in `platform-coupling-mutations.test.mjs`, which already owns this subject.

Also relevant: **CodeScene cannot see `readonly` parameters** — CLI 1.0.37 skips any function whose
parameter list uses the `readonly` type modifier, so a green delta is not proof a function is healthy.
SonarQube does flag such code; read both.

### F9 — Governance shape

`packages/` is `governed_implementation`, so this needs an OpenSpec change in the same range but **not**
the `governance_core` full-assessment ceremony that #191 and #203 carry. Triggers likely to fire:
`security_sensitive_behavior` (it narrows a security gate's text surface) and
`canonical_capability_requirement` (the canonical scope requirement is worded around filenames and public
API — check whether it also asserts source content before assuming no delta is needed).

### F10 — `.out-of-scope/` does not exist

No prior rejection applies. Do not cite one.

---

## Decisions taken (settle these; do not re-litigate during execution)

1. **Delete, do not comment out or feature-flag.** A retired pattern behind a flag is a second source of
   truth for what the gate rejects.
2. **Drop the `.ts` filter and the `src/generated/` skip with the loop** (F5), and carry the widened
   filename coverage as an explicit, controlled addition.
3. **Rename `mutations.test.mjs:639`** to name the surviving controls only — filename boundary and
   runtime dependency. Keep the `fetch` fixture; add an assertion on the `[platform-coupling:` prefix so
   the arm can no longer pass for the wrong reason.
4. **No new npm script, no change to `test:matrix` membership.** `test:scope` stays where it is.
5. **Assert on the diagnostic class and detail, never exit status.**
6. **Every retirement arm carries a null control** — the unmutated copy must pass.

---

## Files to change

| Path | Class | Change |
| --- | --- | --- |
| `packages/security-audit-sdk-core/scripts/check-scope.mjs` | `governed_implementation` | delete `forbiddenSource`, its loop, the text specifier scan, the `.ts` filter, the generated skip |
| `packages/security-audit-sdk-core/tests/verification/platform-coupling-mutations.test.mjs` | `governed_implementation` | five retirement arms + one widened-filename arm + negative controls |
| `packages/security-audit-sdk-core/tests/verification/mutations.test.mjs` | `governed_implementation` | rename one test; tighten its assertion |
| `openspec/changes/retire-superseded-scope-regexes/` | `governed_implementation` | proposal, assessment, tasks, spec delta if F9 requires one |
| `openspec/specs/security-audit-sdk-core/spec.md` | `governed_implementation` | **archived mode only** — folded in PR 2, never hand-edited |
| `packages/security-audit-sdk-core/CONTEXT.md` | `governed_implementation` | if the retirement changes a defined term |

**No new file under `src/`.** If one becomes necessary, its exact path must be added to
`ownership.reviewedNewSdkSourcePaths` in `verification-lifecycle.json` or `test:changed-paths` rejects it.

---

## Task 0: Preflight and re-measure

- [ ] 0.1 `git switch --no-track -c refactor/retire-superseded-scope-regexes origin/main`
- [ ] 0.2 Re-read `check-scope.mjs` and record current line numbers for every item in the pins table.
- [ ] 0.3 `npm run test:scope --prefix packages/security-audit-sdk-core` — capture the exact pass line and
      the coupling inventory. This is the "unchanged inventory" baseline for acceptance criterion 1.
- [ ] 0.4 Grep the whole repository for the scope pass-line count string (F7). Record every consumer.
- [ ] 0.5 `cs delta` on `mutations.test.mjs` (F8).
- [ ] 0.6 Read the canonical scope requirement in `openspec/specs/security-audit-sdk-core/spec.md` and
      determine whether it asserts source content. This decides whether a spec delta is needed (F9).

## Task 1: Triage the issue and promote it

- [ ] 1.1 Post a brief on #201 recording F4 (the arm survives but its name lies), F5 (the filename rule
      widens), and F6 (the unreadable-file divergence resolves itself). Each is a scope correction the
      issue does not contain.
- [ ] 1.2 `needs-triage` → `ready-for-agent`. Brief carries `> *This was generated by AI during triage.*`.

## Task 2: Propose the change (commit P)

- [ ] 2.1 `openspec-propose`, id `retire-superseded-scope-regexes`.
- [ ] 2.2 The proposal must state, in one sentence each: what is removed, what is kept and why, what is
      *widened* (F5), and that the net rejection surface is proven not to shrink.
- [ ] 2.3 Assessment: justify each trigger. `security_sensitive_behavior` almost certainly applies — a
      change that removes lines from a security gate is security-sensitive even when it is a net
      improvement. Do not argue otherwise to save paperwork.
- [ ] 2.4 `openspec validate --strict retire-superseded-scope-regexes`.

## Task 3: RED — prove each retired pattern's replacement *before* deleting anything

For each of the five `forbiddenSource` patterns plus the specifier scan, write the arm against the
**current** gate first and confirm the AST diagnostic already fires:

| Arm | Mutation | Required diagnostic after retirement |
| --- | --- | --- |
| R1 | `fetch(u)` in authored source | `[platform-coupling:undeclared-global] …: fetch` |
| R2 | `import { readFile } from "node:fs/promises"` in authored source | `[platform-coupling:undeclared-specifier] …: node:fs/promises` |
| R3 | `import Redis from "redis"` | `[platform-coupling:undeclared-specifier] …: redis` |
| R4 | `window.location.href` | `[platform-coupling:undeclared-global] …: window` |
| R5 | `console.log(x)` | `[platform-coupling:undeclared-global] …: console` |
| R6 | `await import("node:child_process")` — **the gap the legacy scan leaves open** | `[platform-coupling:undeclared-specifier] …: node:child_process` |
| R7 | `src/generated/transport.generated.cjs` — the widened filename rule (F5) | `forbidden production integration filename` |
| N1 | **negative control** — comment naming `fs`, `window`, `redis` | exit 0 |
| N2 | **negative control** — `const msg = "redis";` | exit 0 |
| N0 | **null control** — unmutated copy | exit 0, inventory identical to Task 0.3 |

- [ ] 3.1 R1–R5 fail today **twice** (legacy + AST). Record both diagnostics so the "before" is on paper.
- [ ] 3.2 R6 fails today only via the AST stage — record it as the gap being closed, not preserved.
- [ ] 3.3 R7 **passes** today (wrongly). Confirm it.
- [ ] 3.4 N1 and N2 **fail** today (wrongly, over-approximation). Confirm both — these are the arms that
      justify the change to a reader who thinks the regexes were harmless.
- [ ] 3.5 N0 passes. **If N0 fails, the harness is broken; fix it before reading any other arm.**

Every arm runs in a disposable clone via `tests/verification/disposable-git.mjs`. Sibling test files
snapshot the live package in parallel, so a write to the working tree corrupts *other* test files.

## Task 4: GREEN — delete

- [ ] 4.1 Delete `forbiddenSource`, its loop, the text specifier scan, the `.ts` filter, and the
      `src/generated/` skip.
- [ ] 4.2 Re-run every arm. Expected: R1–R7 fail with the `[platform-coupling:*]` or filename diagnostic;
      N1, N2 and N0 pass.
- [ ] 4.3 Rename `mutations.test.mjs:639` and add the `[platform-coupling:` prefix assertion (F4).
- [ ] 4.4 `npm run test:scope` — compare the pass line and inventory against Task 0.3. The **inventory**
      must be identical; the **file count** will change (F5/F7). Update every consumer found in Task 0.4.
- [ ] 4.5 `npm run test:verification --prefix packages/security-audit-sdk-core` — the whole suite.

## Task 5: Full read-only verification (empty index, BEFORE staging)

- [ ] 5.1 `npm run check:generated --prefix packages/security-audit-sdk-core` — **before** `validate`,
      exactly as CI does; `validate` runs `generate` first and would mask committed drift.
- [ ] 5.2 `npm run validate --prefix packages/security-audit-sdk-core`
- [ ] 5.3 `npm run validate --prefix contracts/security-audit`
- [ ] 5.4 `npm run test:matrix --prefix packages/security-audit-sdk-core` on both Node majors
- [ ] 5.5 `openspec validate --strict retire-superseded-scope-regexes`
- [ ] 5.6 `git diff --check` clean; index empty.

## Task 6: Commit, push, PR 1 → PR 2 (spec fold) → PR 3 (archive)

- [ ] 6.1 Separate commits: proposal (`docs(openspec):`), implementation (`refactor(sdk):`), archive.
- [ ] 6.2 Verify governance **after** the commit exists (#191: `base == head` inspects nothing).
- [ ] 6.3 `openspec/specs/security-audit-sdk-core/` changes in **`archived` mode only** — through
      archiving, never by hand.
- [ ] 6.4 Archive PR: stage **both** source and destination paths of the move.
- [ ] 6.5 Report readiness. **Do not merge.**

## Task 7: Close #201

- [ ] 7.1 Closing comment: the seven arms, the two negative controls, the null control, the widened
      filename coverage, and the renamed test with the reason.
- [ ] 7.2 State the residual verbatim: **host-object member access stays undetected by construction**, and
      removing an unsound stage improved precision, not coverage.
- [ ] 7.3 `gh issue close 201 --reason completed`. #201 is deliberately not a wave item on #132; post a
      traceability note only.

---

## Validation matrix

| Acceptance criterion (#201) | Arm | Assertion |
| --- | --- | --- |
| `test:scope` passes with unchanged coupling inventory | N0 / Task 4.4 | inventory string byte-identical to Task 0.3 |
| Every retired pattern's mutation still fails | R1–R5 | `[platform-coupling:*]` names artifact + identifier/specifier |
| Comment and string literal naming `fs`/`window`/`redis` pass | N1, N2 | exit 0 |
| Dynamic `await import(...)` of an undeclared specifier fails | R6 | `undeclared-specifier` |
| Forbidden filename still fails, with no coupling diagnostic | R7 + existing `M-71` filename arm | filename diagnostic present, coupling absent |
| Existing scope arms pass unchanged | `mutations.test.mjs` | passes — **and the reason is recorded** (F4) |

## Risks, tradeoffs, and open questions

- **This change removes rejection surface.** The controls are the whole justification. If any arm cannot
  be made to fail via the AST stage, that pattern **stays** — retire the rest and record the exception.
- **The widened filename rule (F5) is the sleeper.** It could fail on an artifact nobody expected. Run
  Task 4.4 on the live tree early; a surprise there is cheap now and expensive in CI.
- **`mutations.test.mjs` is a hotspot.** If `cs delta` fails on the rename, move the arm to
  `platform-coupling-mutations.test.mjs` rather than fighting the analyser.
- **Open question for the owner:** should the filename rule's 18 terms also move into
  `platform-coupling-policy.mjs` as declared data? It would unify the gate's two remaining sources of
  truth. It is **out of scope here** — it changes the authorization boundary's representation — but it is
  the obvious next question and deserves its own issue rather than a silent inclusion.

## What this does not authorize

Changing the declared coupling policy, the admitted language globals, any role's declared specifiers, the
filename term list, the manifest rules, or anything gated on the package split (#88 rescopes these gates
after Core extraction and is independent of this work).

## What this plan did not verify

Whether the canonical scope requirement asserts source content (Task 0.6) — that decides whether a spec
delta is needed. And whether any consumer outside `check-scope.mjs` reads the pass-line count (Task 0.4).
