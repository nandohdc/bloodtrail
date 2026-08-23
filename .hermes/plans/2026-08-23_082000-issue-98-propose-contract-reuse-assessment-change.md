# Issue #98 — Create a Separate Contract Reuse Assessment OpenSpec Change — Plan

> **For Hermes:** This issue is **`ready-for-agent` with a brief already posted**, and it is the only
> Wave 3 item that can start today. Its scope is *artifacts only* — proposal, design, delta spec, tasks.
> Writing a schema, a checker, or a CI job here is scope expansion and will be rejected. The declared
> dependency #66 is closed. One thing the brief does not say and you must know: **`Contract Reuse
> Assessment` does not exist anywhere in this repository** — `grep -rl 'Contract Reuse Assessment\|contract-reuse'`
> returns nothing — so there is no partial implementation to reconcile with, and no name collision with
> the existing `assessment.json` design-pattern-governance artifact. That collision is the single largest
> authoring risk: two different things called "assessment" in one repository. Resolve it in the proposal's
> vocabulary section, not in review.

**Goal:** Land one strictly-governed OpenSpec change whose artifacts define when a Contract Reuse
Assessment is required, which paths it covers, and what positive and negative enforcement will look like —
with the schema (#99), checker (#100) and CI (#101) preserved as separate downstream phases.

**Status at this baseline:** **DONE — #98 is CLOSED.** The proposal landed in PR #208
(`771385f docs(openspec): propose contract reuse assessment`) and the change
`openspec/changes/contract-reuse-assessment/` is active on `main`. The open successor is **#99**, which
defines the assessment schema; nothing in this plan is outstanding.

**Architecture:** Four artifacts under `openspec/changes/contract-reuse-assessment/` and nothing else.
The change's *content* is a governance capability: a record that says whether a piece of work reuses an
existing contract mechanism, extends one, or introduces a new contract, and why. Its enforcement surface
lands later.

**Tech Stack:** openspec CLI 1.10.0, `openspec-propose` / `openspec-new-change`, Markdown + JSON.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #98, OPEN, labels `documentation` `enhancement` `openspec-change-needed` `area:core` `ready-for-agent` |
| Native GitHub blockers | `blocked_by` is `0`; declared dependency #66 is CLOSED |
| CRA presence in repo | **none** — no file, no term, no schema |
| Existing "assessment" | `openspec/changes/*/assessment.json`, schema `openspec/governance/schemas/assessment.schema.json`, `version 1.1`, `closed: true` — a **different** artifact |
| Existing capabilities | `change-governance`, `security-audit-event-contract`, `security-audit-sdk-core`, `software-design-pattern-governance` |
| Contract source | `contracts/security-audit/source/contract.source.json`, version `1.0.0`, **frozen** |
| Contract mechanisms available for reuse | `registries.trust_levels`, `authority_matrix`, `delivery_class_contracts`, `integrity_claims`, privacy transform SPI, bounds (65536 B event / depth 8 / 256 B strings / 32-element arrays), four extension namespaces |
| Active OpenSpec changes | none |
| Downstream | #99 (schema), #100 (checker + negative proof), #101 (CI) |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — Nothing exists yet, which is good news and one risk

No CRA artifact, term, or schema is present. There is no drift to reconcile. The risk is **naming**: this
repository already has `assessment.json` per OpenSpec change, governed by a closed schema, meaning
"design-pattern governance assessment". A second artifact called an "assessment" will be confused with it
in every future conversation.

**Recommendation:** name the artifact and its file distinctly from the outset — `contract-reuse.json` or
`reuse-assessment.json`, never bare `assessment.json` — and state the distinction in the proposal's first
paragraph and in `contracts/security-audit/CONTEXT.md` if that file gains a glossary.

### F2 — PLAN-090's constraint is a hard count, and it is easy to violate by accident

PLAN-090 requires that the design-pattern-governance change's corrected exact counts are preserved and its
100 apply tasks stay behind the owner gate — **CRA must not alter those counts**. `check-coherence.mjs`
pins `taskCount` for the change named in `verification-lifecycle.json`, not for the active change
directory, so the risk is not that CRA's own task count is checked, but that touching the DPG change's
files to "add CRA" would move a pinned number. **Do not touch the DPG change at all.** A separate change
is the entire point of #98.

### F3 — The reuse decision has three outcomes and a real subject

The contract at `1.0.0` is frozen, so "reuse vs extend vs new" is not hypothetical: #125 (bounded client
evidence) is the first real caller and would be an *extend*; #123 (ClientEvidenceEnvelope v1) is
explicitly designed to be *independent* of the audit event contract and would be a *new contract* with a
recorded reason. Use those two as the proposal's worked examples — they are real, they are already
specified, and they demonstrate opposite outcomes.

### F4 — Path coverage is the design's hard question

"Which repository paths does a CRA cover?" is the question that decides whether the checker (#100) is
implementable. Candidate answer, to be settled in the design:
`contracts/`, plus any change whose delta spec adds a requirement carrying contract semantics, plus the
generated projections in `packages/security-audit-sdk-core/src/generated/`. A path-prefix rule is
mechanical and cheap; a semantic rule ("any change with contract semantics") is not. **Prefer the
mechanical rule and accept false requirements over an unimplementable trigger.**

### F5 — The design must carry positive *and* negative enforcement evidence, per #98's own criteria

That is PLAN-074's shape applied at design time: the design names the passing fixture and the deterministic
failing mutation that #100 will implement. Naming them now is what keeps #100 from redefining the gate.
#100 already names one: a fixture using `registries.trust_levelz` instead of the approved path must fail.

### F6 — Governance shape is modest

`openspec/changes/` is `governed_implementation`. Writing only planning artifacts fires no
`governance_core_path` trigger. `planning_artifact_note` in the policy explicitly excludes planning
artifacts from *ordering* checks, because "an assessment commit necessarily writes the assessment". So one
proposal commit is correct and sufficient.

### F7 — Task-group ordering will bite the downstream issues, not this one

`check-coherence` rejects starting a later task group early, and merge/archive tasks must stay unchecked
while a change is active. #98 authors the task list that #99/#100/#101 will execute against — so the group
boundaries written here become enforcement later. Draw them at the issue boundaries: schema, checker, CI,
review, archive.

---

## Decisions taken

1. **Artifacts only.** No schema file, no checker, no workflow edit in this change's implementation.
2. **Distinct name.** Never `assessment.json`. State the distinction from the DPG assessment explicitly.
3. **Mechanical path trigger** over a semantic one (F4).
4. **#125 and #123 as worked examples** (F3).
5. **Task groups drawn at issue boundaries** (F7): schema · checker · CI · review · archive.
6. **Do not touch the design-pattern-governance change** (F2).

---

## Files to change

| Path | Class | Change |
| --- | --- | --- |
| `openspec/changes/contract-reuse-assessment/proposal.md` | `governed_implementation` | why, scope, non-goals |
| `openspec/changes/contract-reuse-assessment/design.md` | `governed_implementation` | trigger, path coverage, dispositions, positive + negative evidence |
| `openspec/changes/contract-reuse-assessment/specs/…` | `governed_implementation` | delta spec — one new capability or a delta on `change-governance` |
| `openspec/changes/contract-reuse-assessment/tasks.md` | `governed_implementation` | five groups matching #99/#100/#101/review/archive |
| `openspec/changes/contract-reuse-assessment/assessment.json` | `governed_implementation` | the **DPG** assessment for this change itself |

---

## Task 0: Preflight

- [ ] 0.1 `git switch --no-track -c docs/propose-contract-reuse-assessment origin/main`
- [ ] 0.2 Re-run `grep -rl 'Contract Reuse Assessment\|contract-reuse' .` excluding `node_modules`. Expect
      no hits. If there are hits, the landscape changed — re-triage before authoring.
- [ ] 0.3 Confirm `openspec/changes/` holds only `archive/`. A second active change complicates
      `check-changed-paths` mode resolution.
- [ ] 0.4 Read `openspec/specs/change-governance/spec.md` and decide: **new capability** or **delta on
      `change-governance`?** This is the first authoring decision and it shapes every artifact.

## Task 1: Author the change

- [ ] 1.1 `openspec-propose` (or `openspec-new-change` then `openspec-continue-change`) with id
      `contract-reuse-assessment`. **Do not hand-edit `openspec/changes/`.**
- [ ] 1.2 Proposal: state the separation from the DPG change in the first paragraph, name the owner, and
      name the governed scope.
- [ ] 1.3 Design: settle the trigger (F4), the three dispositions (reuse / extend / new contract), the
      closed vocabulary, the exemption mechanism and who may grant one, and the worked examples (F3).
- [ ] 1.4 Design: name the positive fixture and the deterministic failing mutation #100 will implement,
      including the `registries.trust_levelz` misspelling arm (F5).
- [ ] 1.5 Delta spec: requirements with scenarios, one per #99–#101 acceptance criterion.
- [ ] 1.6 Tasks: five groups (F7); merge/archive tasks left unchecked.
- [ ] 1.7 Assessment for **this** change under the DPG schema.
- [ ] 1.8 `openspec validate --strict contract-reuse-assessment`.

## Task 2: Prove no scope transfer

#98's verification step asks for it explicitly.

- [ ] 2.1 Diff this change's scope against the archived design-pattern-governance change. Record that no
      requirement, task, or count moved between them.
- [ ] 2.2 Record the DPG change's task and scenario counts before and after — **unchanged**.

## Task 3: Verify, commit, PR

- [ ] 3.1 `npm run check:generated --prefix packages/security-audit-sdk-core`, then both `validate` chains.
- [ ] 3.2 Verify governance **after** the commit exists (#191).
- [ ] 3.3 One commit, `docs(openspec): propose contract-reuse-assessment`. Explicit staging allowlist.
- [ ] 3.4 PR body: "proposals grant no authorization; owner decisions remain separate."
- [ ] 3.5 Report readiness. **Do not merge.**

## Task 4: Hand off

- [ ] 4.1 Comment on #99 that its authoring surface now exists, and promote it to `ready-for-agent`.
- [ ] 4.2 Close #98 with the change id and the strict-validation result.
- [ ] 4.3 Update #132's Wave 3 checklist entry for #98 — this **is** a wave item, unlike #191/#201/#202/#203.

---

## Validation matrix

| Acceptance criterion (#98) | Where satisfied |
| --- | --- |
| A distinct change exists naming owner and governed scope | proposal |
| Artifacts define when an assessment is required and which paths it covers | design (F4) |
| Design includes positive and negative enforcement evidence | design (F5) |
| Task list preserves separate schema/checker/CI/review/archive phases | tasks (F7) |
| Change passes strict OpenSpec validation | Task 1.8 |
| No silent scope transfer from the remediation change | Task 2 |

## Risks and open questions

- **The name collision (F1) is the highest-probability review comment.** Settle it in the proposal.
- **The trigger could be drawn so wide that every SDK change needs a CRA.** That would make the gate
  hated and then bypassed. Draw it at `contracts/` plus generated projections, and say why.
- **Open question for the owner:** does a CRA require a *reviewer* signature like the DPG signed record, or
  is an author-written record sufficient? This decides whether #100 can enforce it mechanically at all.
  Raise it in the proposal; do not decide it unilaterally.

## What this does not authorize

Implementing the schema, the checker, or the CI job. Modifying the frozen remediation change. Modifying
the contract. Authorizing any new architecture.

## What this plan did not verify

Whether `change-governance` is the right host capability or CRA needs its own (Task 0.4).
