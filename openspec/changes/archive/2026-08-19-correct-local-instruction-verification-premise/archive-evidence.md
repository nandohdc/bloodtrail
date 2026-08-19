# Archive Evidence — correct-local-instruction-verification-premise

Discharges task 6.4: the archive commit for the first grandfathered change this repository has
ever archived. It does not rely on `openspec validate --all --strict` alone; every item below is
a separate check run or a direct Git-object comparison, with its result recorded at the archive
commit.

## Identities

| Binding | Value |
| --- | --- |
| Proposal commit P | `9e356f3a81b1290d61b7fc69fd0e1b38d367a285` (`docs(openspec): propose correcting the local-instruction verification premise (#135)`) |
| Technical commit T (review target) | `6fab5f9a6f7fc9bd6a63c1727fbc96fbac2890d3` (`test(verification): assert the local-instruction control's own premise`) |
| Merge commit M | `2b9b2297e3665b6f513eb9f85b522f556e61f24b` |
| M parents | `72a39e54001079434f3b7ad9f518287d59369ff0` (prior protected mainline), `6fab5f9a6f7fc9bd6a63c1727fbc96fbac2890d3` (branch tip T) — identity-preserving two-parent merge of PR #178, authored by the project owner |
| P, T, keeper proposal `716e35b4f10d07ecc9c33c3e4fdb94fb395f1255` reachable from M | yes (`git merge-base --is-ancestor` for each) |
| Grandfathering entry (retired) | `proposal_blob: 1c452d4570295f6193309e6d66679dda1b53999b`, `proposal_baseline_commit: 9e356f3`, `class: mainline_present` |
| Signed governance record S | none for this change — by design (grandfathered; carries no `assessment.json` and no governance record; review-freshness applies only to changes with records) |

## Task completeness

24/24 tasks checked at the archive commit (2+3+4+4+5+6). Groups 1–5 and 6.1 were discharged
before this archive, each with recorded evidence in `tasks.md`; this reconciliation adds the
evidence for 6.2–6.6:

- 6.2 — independent technical review, see the dedicated section below.
- 6.3 — owner's exact-commit decision and governance-core option, see the dedicated section below.
- 6.4 — this archive commit: fold before move, reconciliation inside the moved directory only,
  strict validation re-run.
- 6.5 — keeper `cover-local-instruction-control-paths` confirmed active at the fold with
  `applicability.capabilities: ["security-audit-sdk-core"]`; the fold landed while its capability
  coverage was held open.
- 6.6 — discharged by PRs #179/#180, recorded not re-done: `c944fed04d7373a2b7545f4f404cffe57dbd5fad`
  decoupled the fixture, `3a581fa6787c423268af23970f0cdb61e90b8682` archived that change.

## Independent review record (task 6.2)

Performed 2026-08-19 by an independent Hermes agent session (owner-authorized mechanism: a fresh
agent session as reviewer; the implementing pass was Claude Code, per the commit trailer).
Read-only against the six-point checklist; every state change happened in disposable clones.

1. Scope confinement: `git show 6fab5f9 --stat` — exactly four files: `design.md`, `tasks.md`, the
   new `local-instruction-classification.test.mjs`, the 8-line deletion in `mutations.test.mjs`.
   No SDK source, generated artifact, contract artifact, or public API change.
2. Checker immutability: `git diff 6fab5f9^ 6fab5f9 -- scripts/check-changed-paths.mjs` empty;
   blob `5244b6c2b1ddf1ac64d635c00d290c67baee3973` at both parent and T; rule at
   `check-changed-paths.mjs:476`, bucket `local-instruction-unrelated`, summary line `:142-144`
   byte-identical to the parent.
3. Control correctness: `classificationCount` anchors the summary line and fails loudly on parse
   failure; `?? 0` covers absent keys; `assertLocalInstructionDelta` measures the before/after
   delta, not global absence.
4. Two-state proof: 203/203 tests pass with no tracked `CLAUDE.md`; 203/203 pass with a root
   `CLAUDE.md` force-added and committed, the checker directly reporting `"local-instruction-unrelated":1`
   and exiting 0.
5. Mutation re-derivation (unwrapped, not merely re-run): tracked-instead-of-ignored fails
   `changed local-instruction-unrelated records by 1, expected 0`; classification-rule removal
   fails `…by 0, expected 1` while the checker still exits 0; flipping the ignored control's
   expectation 0→1 fails `…by 0, expected 1`. Each message names the path and the observed-vs-
   expected delta.
6. No runtime surface: `test:dependencies` 0 runtime deps; `check:generated`,
   `test:contract-immutability`, `test:exports`, `test:compatibility` green.

Findings: no discrepancies. This review is a recorded technical pass, not an approval; the
binding record is the owner's decision below.

## Owner decisions (task 6.3)

Recorded verbatim from the owner's plain-chat answers on 2026-08-19.

- **Exact-commit decision.** Exact commit: `6fab5f9a6f7fc9bd6a63c1727fbc96fbac2890d3`.
  **Granted:** proceed to archive this change with its spec delta folded into
  `openspec/specs/security-audit-sdk-core/spec.md`. **Withheld:** no production deployment,
  publication, or scope-expansion authorization of any kind.
- **Governance-core option (2b).** **Option A**: the grandfathering entry is retired under a
  dedicated change, `retire-local-instruction-grandfathering`, carrying a full assessment
  declaring `governance_core_path`; the keeper's assessment stays untouched.
- **Review record location.** Inline in `tasks.md` 6.2 and this document (fixture precedent).

## Grandfathering retirement (the governance-core prerequisite)

Archiving this change necessarily edits a governance-core artifact; that prerequisite was landed
first, under its own change:

- PR #181 (`68fb9680c578aed2b8abf6d90e28e22d3455c0e2`, merged at
  `029f8fb613e81c6282b1643194c8df15acebfeb9`): proposed `retire-local-instruction-grandfathering`
  with a full assessment declaring `triggers_matched: ["governance_core_path"]`,
  capabilities `["software-design-pattern-governance"]`, and `owned_paths` covering the policy
  file and this change's dated archive directory.
- PR #183 (`19afaa73fe01a734a6371b94b274ec9f2466c5d4`, merged at
  `6ea3b5c1e3492c1db5d834e7b75499f1add84569`): set `grandfathering` to `[]` in
  `openspec/governance/design-pattern-policy.json`.

This is the first grandfathered change archived in the repository's history; `grandfathering` has
held exactly one entry for its whole history. The retirement basis is the policy's own note,
`grandfathering_notes.sdk_remediation`: *"archived on 2026-08-11 and is no longer an active
change, so it needs no grandfathering entry."* The same basis applies here: at this commit this
change is archived and no longer active.

The retired entry's provenance prose is quoted here so the reasoning survives in the archive even
though the policy no longer carries it — `bounded_scope`: *"The local-instruction verification
premise correction as recorded in its proposal at proposal_blob. Any new public API, integration,
persistence, lifecycle, concurrency, security boundary, governed capability, or path outside
bounded_paths requires normal full governance."* — with `bounded_paths` =
`openspec/changes/correct-local-instruction-verification-premise/`,
`packages/security-audit-sdk-core/scripts/`, `packages/security-audit-sdk-core/tests/verification/`,
`packages/security-audit-sdk-core/verification-lifecycle.json`.

## Spec-fold evidence (task 6.4)

The fold ran before the move, per the archive workflow, and nothing was synced after moving:

- Delta: one `## ADDED Requirements` entry, *"Changed-path verification distinguishes ignored
  from tracked local instruction files"*, with four scenarios.
- After the fold, `openspec/specs/security-audit-sdk-core/spec.md` carries 47 requirements
  (46 before), with the requirement and all four scenarios present.
- The keeper change remained active at the fold (see task completeness 6.5), holding the
  capability coverage the fold requires.
- `openspec validate --all --strict` and `openspec validate --all --archived --strict` pass with
  this change in archived mode.

## Canonical capability presence

The ADDED requirement is present in `openspec/specs/security-audit-sdk-core/spec.md` at this
commit, folded from this change's delta. This change itself carries no `assessment.json` (it was
grandfathered) and declares no capabilities; its capability delta is the folded requirement.

## Production / publication restrictions

Unchanged and still enforced by executable gates (all green at the archive commit): `test:scope`,
`test:publication-path`, `test:dependencies` (0 runtime dependencies), and the withheld
authorization lists of the existing signed records. The owner's 6.3 decision withholds production
deployment, publication, and scope-expansion authorization; no authorization was granted or
implied anywhere in this cycle.

## Immutable archive contents, exact changed paths, byte identity

The relocation is a pure move. Before the reconciliation edits, every file at the active path
under M was hash-identical to its moved copy:

| File | Blob (active path at M = moved copy) |
| --- | --- |
| `.openspec.yaml` | `d7bc0110d8189dc02582aba58bc701790e661493` |
| `design.md` | `782ad806c98012c2f699c797a20c050eb4e9813e` |
| `proposal.md` | `1c452d4570295f6193309e6d66679dda1b53999b` (the policy-pinned blob) |
| `specs/security-audit-sdk-core/spec.md` | `50ffc89605efd1baf9bab4cd24916f507cc91866` |
| `tasks.md` | `b8cf8104794717638eb35ed217b7eb808a2df334` (pre-reconciliation) |

`proposal.md` is this change's sole relocation-recognition artifact: with no `assessment.json`,
relocation recognition compares exactly `RELOCATION_ARTIFACTS = ["assessment.json",
"proposal.md"]`, so `proposal.md` must move byte-identical — verified at this commit with
`git rev-parse 2b9b2297:<active-path>` against `git rev-parse HEAD:<archived-path>`. Its blob
`1c452d45…` also matches the retired policy pin. `.openspec.yaml` moves unchanged but plays no
part in relocation recognition.

Changed paths at this commit are exactly: the fold into
`openspec/specs/security-audit-sdk-core/spec.md`, the active-directory removal, and the
dated-archive addition (`openspec/changes/archive/2026-08-19-correct-local-instruction-verification-premise/`
with `tasks.md` reconciled and `archive-evidence.md` added). No contract path, no package path,
no checker, and no `verification-lifecycle.json` is touched.

## Active enforcement verified

- Design-pattern governance final phase at the archive HEAD: passes with enforcement active and a
  non-null inspected range.
- Governance dual check: candidate and baseline agree on the checker blob.
- Governance test suite: all pass.
- `openspec validate --all --strict` and `openspec validate --all --archived --strict`: all pass,
  including this change in archived mode.
- Full SDK validation chain: every gate green with an empty index; contract validation: all pass.
- `git diff --check`: clean, no whitespace errors.
- Required CI at the exact archive PR head: required-status contexts must be green before merge,
  including the required `design-pattern-governance` check; the live PR check state and the
  owner's merge decision are the external record of this step. CI results are declared here as a
  pre-merge requirement — no CI outcome is claimed before it has run.

## Final lifecycle states (task 6.4)

Reported independently; evidence for one is not evidence for another.

| State | Status |
| --- | --- |
| Proposal | P = `9e356f3a81b1290d61b7fc69fd0e1b38d367a285` (grandfathered; no assessment) |
| Technical verification | T = `6fab5f9a6f7fc9bd6a63c1727fbc96fbac2890d3` — full chain green; independent review recorded in 6.2 |
| Merge | M = `2b9b2297e3665b6f513eb9f85b522f556e61f24b`, identity-preserving (PR #178), authored by the project owner |
| Grandfathering | entry retired in PR #183 under `retire-local-instruction-grandfathering` before this archive |
| Spec fold | the ADDED requirement folded into `openspec/specs/security-audit-sdk-core/spec.md` before the move |
| Canonical capability | `security-audit-sdk-core` spec gains one requirement (46 → 47) |
| Archive | this commit — hash reported after storage, not self-bound |
| Production / publication | withheld, unchanged, gate-enforced |
