# Issue #203 — Enforce R14's Benign Path-Class Widening Scenario Mechanically — Triage and Implementation Plan

> **For Hermes:** The gap is confirmed: `grep -rn "widen\|benign" openspec/scripts/ openspec/governance/schemas/`
> returns **nothing** at `main@1948f9f`, while R14's scenario at
> `openspec/specs/software-design-pattern-governance/spec.md:359-361` demands a mechanical rejection. This
> is a schema change plus a checker rule, both in `governance_core`, and the schema move is the decision
> that must be settled first — Task 1 settles it. Two traps: the **assessment** schema is `closed: true`
> and is the *wrong* carrier (it is written by the author, not the reviewer); and R14 says
> **baseline verification** SHALL reject, so the rule must live where the trusted baseline checker
> evaluates it, not only in the candidate. Depends on #202, which is complete pending PR #206 — verify
> that before starting. Execute with the `openspec-*` skills. Do NOT merge — the owner merges.

**Goal:** Make an unacknowledged widening of an exempt or benign path class fail baseline verification
with a distinct named diagnostic, while a narrowing, an acknowledged widening, and a class-neutral policy
edit all pass untouched.

**Status at this baseline:** READY once #202 lands — the classification work #203 builds on is merged; only
its archive PR is outstanding.

**Architecture:** Three pieces, in this order.

1. **Carrier.** A new optional `path_class_widenings` array on the **signed governance record**, whose
   `schema_compatibility.minor_rule` says in as many words: *"A minor increment MAY add optional
   evidence."* Version moves `1.1` → `1.2`; `supported_versions` becomes `["1.0","1.1","1.2"]`. The record
   is the reviewer's artefact and already carries `catalog_invariants[].acknowledged`, so the
   acknowledgement idiom exists — this extends it rather than inventing one.
2. **Comparison.** A pure module computing the class delta between the **baseline** policy (read from the
   merge-base, which `run-governance-dual-check.mjs` already resolves) and the candidate policy. Widening
   is defined structurally, not by intuition — see F4.
3. **Rule.** A named diagnostic in the perimeter, evaluated from the trusted baseline checker, that fails
   when the delta contains a widening with no matching acknowledgement in the signed record.

**Tech Stack:** ESM `.mjs` under `openspec/scripts/` and `openspec/tests/design-pattern-governance/`,
`node --test`, disposable-repository fixtures, openspec CLI 1.10.0, Node `>=24 <25 || >=26 <27`.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #203, OPEN, labels `bug` `severity:medium` `verification` `openspec-change-needed` `area:core` `needs-triage` |
| Declared dependency | #202 — merged except its archive PR **#206** |
| Native GitHub blockers | `blocked_by` is `0` — the dependency is prose only |
| R14 scenario | `openspec/specs/software-design-pattern-governance/spec.md:359-361` |
| Rule inventory today | `grep -rn 'widen\|benign' openspec/scripts/ openspec/governance/schemas/` → **no hits** |
| Assessment schema | `openspec/governance/schemas/assessment.schema.json`, `version 1.1`, `closed: true`, `supported_versions ["1.0","1.1"]` |
| Signed record schema | `openspec/governance/schemas/signed-governance-record.schema.json`, `version 1.1`, `closed: true`, 12 rules, 6 mandatory withheld authorizations |
| Existing acknowledgement idiom | `catalog_invariants[].acknowledged: boolean` (rule `record-acknowledges-non-applicable-invariants`, R5) |
| Compatibility rules | `policy.schema_compatibility.minor_rule` / `major_rule` — adding optional evidence is **minor** |
| Path classes today | `governance_core`, `governance_record_only`, `governed_implementation`, `documentation_only` |
| Resolution rule | `path_class_notes.resolution` — longest matching pattern wins, then most specific class; unmatched fails closed |
| Floors note | `path_class_notes.floors_not_ceilings` — a class is a **minimum** trigger set |
| Established home for the control | `openspec/tests/design-pattern-governance/self-governance.test.mjs` |
| Dual checker | `openspec/scripts/run-governance-dual-check.mjs` — contains literal NUL bytes; `grep` reports it binary |
| Path class of everything this change touches | `governance_core` |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The gap is exactly as #203 describes, with no partial implementation to build on

No `widen`, no `benign`, no diagnostic id, no acknowledgement field anywhere in `openspec/scripts/` or
`openspec/governance/schemas/`. The scenario has been normative and unenforced since R14 was written. This
is a specified-but-unimplemented control, not a regression.

### F2 — The assessment schema is the wrong carrier, and closedness is the smaller reason

#203's "Required work" says the acknowledgement's home must be decided, and notes the assessment schema is
closed. Closedness is surmountable — it too has a `supported_versions` array and the same minor rule. The
disqualifying reason is different: **the assessment is authored by the person making the change**. R14 asks
for *reviewer* acknowledgement, and `openspec/governance/schemas/signed-governance-record.schema.json`'s
own note says the signed record "carries technical review and the project-owner decision together". Put the
acknowledgement where the reviewer signs, or the gate proves only that an author acknowledged their own
widening.

### F3 — The signed record already has the exact idiom, twice

`catalog_invariants[].acknowledged: boolean` with rule `record-acknowledges-non-applicable-invariants`, and
`divergences[]` with `{description, accepted, reason}` and `min_length: 20` on both strings. A widening
acknowledgement is structurally a divergence: a described deviation, accepted, with a reason. **Reuse the
shape.** Do not invent a fourth acknowledgement grammar in a schema that already has three.

### F4 — "Widening" needs a structural definition, and there are exactly three ways it happens

#203 names all three; make them the definition, and make each independently detectable:

| Form | Definition | Example |
| --- | --- | --- |
| **W1 — class demotion** | A path resolving to class *C1* in the baseline resolves to *C2* in the candidate, where *C2* has a strictly smaller trigger set | `sonar-project.properties` moving `governance_core` → `documentation_only` |
| **W2 — pattern broadening** | A pattern in a benign class grows to cover paths it did not cover, whether by editing the pattern or shortening it | `docs/adr/` → `docs/` in `documentation_only` |
| **W3 — membership growth** | A class's *effective* membership over `git ls-files` grows without any pattern textually changing | a new tracked path landing under an existing `documentation_only` prefix |

W1 and W2 are policy diffs. **W3 is not**, and it is the one that will be missed. Recommendation: scope
W3 out of this change with an explicit statement, because it fires on ordinary content addition and would
demand an acknowledgement for every new file under `docs/`. Record it as a named residual, exactly the way
#202 recorded #203.

### F5 — The trigger-set ordering must be data, not a code comparison

W1 needs "strictly smaller trigger set". Today that ordering is implicit in the four classes' behaviour.
Make it explicit in the policy as a declared partial order (`governance_core` > `governed_implementation` >
`governance_record_only` ≷ `documentation_only`), so the rule reads the ordering instead of hard-coding it.
`documentation_only` and `governance_record_only` are **not** comparable in general — they are exempt from
*different* triggers — so the order is partial, and the rule must treat an incomparable move as a widening
requiring acknowledgement rather than silently allowing it. Fail closed on incomparability.

### F6 — The baseline is already resolved; do not add a second resolution path

`run-governance-dual-check.mjs` resolves the merge-base and runs the trusted baseline checker's blob. The
comparison basis #203 asks for is therefore already available. Adding an independent "read the baseline
policy" path would create a second source of truth for what "baseline" means — the precise defect class
this repository keeps finding.

### F7 — This change's own signed record must carry the acknowledgement it invents

If the change adds `path_class_widenings` and its own policy edit declares the class ordering, it is
itself governance-core, and it must demonstrate the new field on itself. That is not ceremony — it is the
only way to prove the field is writable and the rule reads it. Expect a chicken-and-egg step: the trusted
baseline checker at the merge-base does not know the new field, so version negotiation
(`unknown-new-version`) must be exercised deliberately. Confirm `schema_compatibility.unknown_newer` is
`"unknown-new-version"` and decide whether the baseline checker's *unknown-newer* handling permits the
candidate to land. **This is the single highest-risk item in the change.**

### F8 — The control needs a new file, not an arm in an existing one

`self-governance.test.mjs` is the established home for R14 scenarios, but prior sessions record that
adding to a hotspot file fails `codescene delta` on file-level rules regardless of the new code's quality.
Check `cs delta` on `self-governance.test.mjs` before deciding; if it is a hotspot, create
`path-class-widening.test.mjs` beside it.

---

## Decisions taken (settle these; do not re-litigate during execution)

1. **Carrier: the signed governance record**, at schema version `1.2`, field `path_class_widenings`,
   **optional**, shaped like `divergences[]`.
2. **Optional, not mandatory.** `minor_rule` permits adding optional evidence; making it mandatory is a
   major increment with a migration. The rule enforces presence *conditionally* — required only when the
   delta contains a widening — which achieves the same gate without a major version.
3. **W1 and W2 in scope; W3 out**, recorded as a named residual (F4).
4. **The class ordering becomes declared policy data** (F5), and incomparable moves fail closed.
5. **Diagnostic id: `path-class-widened-unacknowledged`.** One id, naming every widened path/pattern, not
   only the first — the same shape #202's completeness diagnostic uses.
6. **Assert on the diagnostic id, never on exit status.** Several arms exit 1 for unrelated reasons in a
   fixture repository; exit status cannot tell them apart.
7. **Every arm carries a null control.** Prior sessions in this repository have twice found a probe's
   exit 1 to be a harness artefact rather than detection.

---

## Files to change

| Path | Class | Change |
| --- | --- | --- |
| `openspec/governance/schemas/signed-governance-record.schema.json` | `governance_core` | `version` → `1.2`; `supported_versions` += `"1.2"`; optional `path_class_widenings` |
| `openspec/governance/design-pattern-policy.json` | `governance_core` | declared `path_class_order`; `schema_compatibility.supported` += `"1.2"` |
| `openspec/scripts/path-class-delta.mjs` | `governance_core` | **new** — pure baseline↔candidate class comparison |
| `openspec/scripts/check-design-pattern-governance.mjs` | `governance_core` | wire the rule into the perimeter |
| `openspec/tests/design-pattern-governance/path-class-widening.test.mjs` | `governance_core` | **new** — four arms + null controls |
| `openspec/changes/enforce-benign-widening-acknowledgement/` | `governed_implementation` | proposal, design, assessment, tasks, spec delta |
| `openspec/specs/software-design-pattern-governance/spec.md` | `governed_implementation` | fold in PR 2 |
| `docs/adr/0007-acknowledge-path-class-widenings-in-the-signed-record.md` | `documentation_only` | root ADR |

---

## Task 0: Preflight

- [ ] 0.1 Confirm PR #206 merged and `openspec/changes/` holds only `archive/`. If #206 is still open,
      **stop** — #203 edits the same policy file and would conflict.
- [ ] 0.2 Re-run `grep -rn 'widen\|benign' openspec/scripts/ openspec/governance/schemas/`. Expect silence.
- [ ] 0.3 Read `run-governance-dual-check.mjs` with `sed`, not `grep` — it contains NUL bytes and greps as
      binary, so a search returns silence rather than "no match".
- [ ] 0.4 `cs delta` on `self-governance.test.mjs` to settle F8.
- [ ] 0.5 Read `schema_compatibility.unknown_newer` handling in the checker and record exactly what the
      **baseline** checker does with a `1.2` record. This is F7 and it decides whether the change is
      landable in one PR.

## Task 1: Settle the carrier and the widening definition on the issue

- [ ] 1.1 Post a brief on #203 stating: carrier = signed record at `1.2`; widening = W1 + W2, W3 deferred;
      class ordering becomes declared data; diagnostic id `path-class-widened-unacknowledged`.
- [ ] 1.2 State plainly that the acknowledgement proves a reviewer recorded it, **not** that the widening
      is correct — #203's own assurance limitation.
- [ ] 1.3 Promote `needs-triage` → `ready-for-agent`. Brief carries the AI-triage disclaimer.

## Task 2: Propose the change (commit P)

- [ ] 2.1 `openspec-propose`, id `enforce-benign-widening-acknowledgement`.
- [ ] 2.2 Full assessment — `governance_core_path` fires; all fifteen dimension justifications required.
- [ ] 2.3 Spec delta: one ADDED requirement with four scenarios mirroring #203's acceptance criteria.
- [ ] 2.4 The proposal must state the F7 risk and how the change lands despite it.
- [ ] 2.5 `openspec validate --strict enforce-benign-widening-acknowledgement`.

### ADDED Requirement

```markdown
### Requirement: Baseline verification rejects an unacknowledged path-class widening

Baseline verification SHALL compare the candidate path classification against the trusted baseline and
SHALL reject a widening of an exempt or benign path class that carries no reviewer acknowledgement in the
signed governance record.

#### Scenario: Unacknowledged widening is rejected
- **WHEN** a candidate policy moves a path to a class with a strictly smaller trigger set, or broadens a
  benign class pattern, with no matching acknowledgement
- **THEN** baseline verification SHALL fail with a distinct diagnostic naming every widened path or pattern

#### Scenario: Acknowledged widening passes
- **WHEN** the same widening is accompanied by a matching acknowledgement in the signed governance record
- **THEN** baseline verification SHALL pass

#### Scenario: Narrowing is unaffected
- **WHEN** a candidate policy moves a path to a class with a larger trigger set
- **THEN** the widening rule SHALL NOT fire

#### Scenario: Class-neutral policy edit is unaffected
- **WHEN** a candidate policy changes no path's resolved class and no class's pattern coverage
- **THEN** the widening rule SHALL NOT fire

#### Scenario: Incomparable class move fails closed
- **WHEN** a path moves between two classes whose trigger sets are not ordered
- **THEN** baseline verification SHALL treat the move as requiring acknowledgement
```

## Task 3: RED — every arm fails before the rule exists

Each arm in a disposable repository, each with a null control:

| Arm | Mutation | Expected after fix |
| --- | --- | --- |
| A1 | `sonar-project.properties` → `documentation_only`, no acknowledgement | `[path-class-widened-unacknowledged]` |
| A2 | same, with acknowledgement in the signed record | pass |
| A3 | `version.txt` → `governance_core` (a narrowing) | rule silent |
| A4 | reorder `path_classes` array, change no membership | rule silent |
| A5 | `documentation_only` pattern `docs/adr/` → `docs/` | `[path-class-widened-unacknowledged]` naming the pattern |
| A6 | move a path `governance_record_only` → `documentation_only` (incomparable) | acknowledgement required |
| N0 | **null control** — unmodified fixture | pass, and the diagnostic never appears |

- [ ] 3.1 All six mutation arms confirmed to **pass** (wrongly) on the pre-change checker.
- [ ] 3.2 N0 passes on both. If N0 fails on the pre-change checker, the harness is broken — fix the harness
      before reading any other arm.
- [ ] 3.3 Assertions name the diagnostic id and the widened paths, never exit status.

## Task 4: GREEN — schema, then policy data, then rule

- [ ] 4.1 Bump the signed-record schema to `1.2`; add optional `path_class_widenings` shaped as
      `[{ path_or_pattern, from_class, to_class, accepted, reason }]` with `min_length: 20` on `reason`.
- [ ] 4.2 Add `path_class_order` to the policy as declared data, and extend
      `schema_compatibility.supported`.
- [ ] 4.3 Write `openspec/scripts/path-class-delta.mjs` as a **pure function** over
      `(baselinePolicy, candidatePolicy, trackedPaths)` returning `{ widenings, narrowings }`. Pure means
      testable without a repository; test it directly as well as through the checker.
- [ ] 4.4 Wire the rule into `checkPerimeter`, reading the baseline policy through the existing
      merge-base resolution (F6). Do **not** add a second baseline resolver.
- [ ] 4.5 Re-run every Task 3 arm. All six GREEN, N0 still silent.
- [ ] 4.6 `node --test openspec/tests/design-pattern-governance/*.test.mjs` — full suite.

## Task 5: Prove the rule is evaluated by the trusted baseline checker

R14's scenario says *baseline verification* SHALL reject. A rule that only the candidate evaluates does not
satisfy it.

- [ ] 5.1 Run `run-governance-dual-check.mjs` on arm A1. Record the **baseline** checker's diagnostics.
- [ ] 5.2 Then run it with the candidate checker deliberately weakened to return success on A1 — the
      trusted baseline must still reject. This is R14's first scenario applied to the new rule.
- [ ] 5.3 Record both verdicts distinctly; rule `record-dual-checker-results-distinct` requires it.

## Task 6: The self-application step (F7)

- [ ] 6.1 Write this change's own signed record at `1.2`, carrying the acknowledgement for its own policy
      edit if that edit widens anything. (It should not — adding `path_class_order` changes no membership —
      but *verify*, do not assume.)
- [ ] 6.2 Exercise the baseline checker at the merge-base against the `1.2` record and record what
      `unknown-new-version` does. If it rejects, the change needs a two-step landing: schema-support first,
      field second. **Decide this before writing the PR body, not after CI tells you.**

## Task 7: Full read-only verification (empty index, BEFORE staging)

- [ ] 7.1 `npm run check:generated --prefix packages/security-audit-sdk-core`
- [ ] 7.2 `npm run validate --prefix packages/security-audit-sdk-core`
- [ ] 7.3 `npm run validate --prefix contracts/security-audit`
- [ ] 7.4 `node --test openspec/tests/design-pattern-governance/*.test.mjs`
- [ ] 7.5 `openspec validate --strict enforce-benign-widening-acknowledgement`
- [ ] 7.6 `git diff --check` clean and index empty.

## Task 8: Commit, push, PR 1 → PR 2 (spec fold) → PR 3 (archive)

- [ ] 8.1 Separate commits for proposal, implementation, archive. Explicit staging allowlist.
- [ ] 8.2 Verify governance **after** the commit exists — a pre-commit run on a branch cut at
      `origin/main` has `base == head` and inspects nothing (#191).
- [ ] 8.3 Archive PR: stage **both** source and destination paths of the move.
- [ ] 8.4 Retarget stacked PRs onto `main` before the one below merges.
- [ ] 8.5 Report readiness. **Do not merge.**

## Task 9: Close #203

- [ ] 9.1 Closing comment: the diagnostic id, the six arms, the dual-checker evidence, and the **W3
      residual** stated plainly.
- [ ] 9.2 `gh issue close 203 --reason completed`.
- [ ] 9.3 #203 is not a wave item; post a traceability note on #132, do not edit a checklist.

---

## Validation matrix

| Acceptance criterion (#203) | Arm | Assertion |
| --- | --- | --- |
| Unacknowledged widening fails with a distinct diagnostic | A1 | `[path-class-widened-unacknowledged]` names the path |
| Acknowledged widening passes | A2 | exit 0, diagnostic absent |
| Narrowing does not fire | A3 | diagnostic absent |
| Class-neutral edit does not fire | A4 | diagnostic absent |
| Evaluated by the trusted baseline checker | Task 5 | baseline rejects even when the candidate is weakened |
| Arm fails on pre-change checker, passes on candidate | Task 3 → Task 4 | RED then GREEN, both recorded |

## Risks, tradeoffs, and open questions

- **F7 is the real risk.** If the baseline checker rejects an unknown-newer record, this change cannot land
  in one PR. Measure it in Task 0.5, before proposing.
- **The acknowledgement is only as good as the reviewer.** #203 says so. The gate proves a record exists;
  it cannot prove the widening was justified. Repeat that in the ADR and the closing comment.
- **W3 will be asked about.** Someone will notice that adding `docs/whatever.md` silently grows
  `documentation_only`. Have the deferral written down before that conversation, not after.
- **Making acknowledgement mandatory later is a major bump** with a migration. Choosing optional-plus-
  conditional-enforcement now is what keeps this a minor increment; do not drift into mandatory during
  implementation.

## What this does not authorize

Re-litigating #202's classifications, changing what any path class requires, or altering the trigger sets
themselves. This change adds one rejection path and nothing else.

## What this plan did not verify

The baseline checker's actual `unknown-new-version` behaviour against a `1.2` record (Task 0.5), and
whether `self-governance.test.mjs` is a CodeScene hotspot at this baseline (Task 0.4). Both are cheap and
both change the shape of the work.
