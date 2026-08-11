## Context

See `proposal.md` — Why. The relevant current state:

- No spec mandates the ten-task governance tail. The canonical requirement *"Adversarial
  remediation verification and approval are exact-commit governed"* in `security-audit-sdk-core` is
  scoped to the completed adversarial remediation. The tail is precedent, so the next change
  inherits it by default rather than by rule.
- `verification-lifecycle.json` already demonstrates the pattern this change generalizes: governed
  commits, protected prefixes, and task-group phases declared as structured data that
  `check-changed-paths.mjs`, `check-coherence.mjs`, and `check-git-state.mjs` read. The gaps are
  that it is hard-coded to two named changes and that it carries no merge or ancestry properties.
- Every claim task 12.6 asserted is already enforced: `test:scope`, `test:package`,
  `test:dependencies`. The one claim with no gate — that no workflow contains a publication path —
  was verified by hand during that task and is not enforced anywhere.
- The remediation's two binding failures were both prose-versus-reality drift. The packet described
  `71dbd953` as a merge commit when it has one parent, and named `a7ac3177` as the review candidate
  when it is not an ancestor of `main`. Both are mechanically checkable and neither was checked.

## Goals / Non-Goals

**Goals:**

- Make the properties governance records assert about Git mechanically verifiable.
- Make governance bindings machine-readable so a gate, not a reader, is responsible for them.
- Let a change that touches only unpublished, undeployed workspaces land with one signed record.
- Preserve every existing gate and the rule that AI analysis is never review or approval.

**Non-Goals:**

- Weakening any executable gate, or reducing what the SDK itself must satisfy.
- Retroactively altering archived governance records, including the just-archived remediation.
- Deciding the fate of `establish-design-pattern-governance`.
- Automating the signature. A human still signs; this change reduces what surrounds the signature,
  not the act itself.

## Decisions

**Introduce a new capability rather than amend the existing requirement.** The existing requirement
is scoped to a completed, archived remediation and reads as historical evidence of how that work
was governed. Amending it would rewrite the record of a change archived hours earlier. A separate
`change-governance` capability states forward-looking rules without disturbing that history.
*Alternative considered:* modifying `security-audit-sdk-core` — rejected because it conflates a
historical account with a forward rule, and because the SDK capability is not where repository-wide
process belongs.

**Governance bindings are declared as structured data, not parsed from prose.** Each change that
carries governance bindings declares them in a small JSON manifest alongside its artifacts —
reviewed subtree, reviewed commit, bound merge commits with expected parent counts, and the
authorizations withheld. The gate reads the manifest; the signed record cites it.
*Alternative considered:* regex-scraping the markdown for 40-hex strings, which is what
`check-coherence.mjs` does today for the technical-commit field. That check verifies only the
*shape* of the field, not its value — a limitation the remediation packet itself recorded as
documented limitation 6. Prose that no gate can check is precisely what produced both binding
failures, so the fix is to stop parsing prose.

**The merge gate verifies three properties.** For each declared merge commit, that its actual
parent count matches the declared expectation. For each bound commit, that it is an ancestor of
`HEAD`. For each declared governed commit, that it resolves at all. Each failure names the property
and the actual value, so a squash reports as "expected 2 parents, found 1" rather than as a generic
mismatch. Run this in `validate` and `verify` next to the existing changed-path checks.

**Content-object binding is primary; commit binding is supplementary.** A record names the reviewed
tree or subtree identifier, and may also name a commit. Subtree identifiers are stable under squash
merge, rebase, and cherry-pick, and — unlike a commit hash — can be known before the recording
commit exists. This directly addresses finding R-A, where the review candidate was named by a
packet revision that predated it and was later orphaned by a squash merge.

**Add the one missing exclusion gate.** A check asserts that no workflow contains `npm publish`, a
registry reference, or a publication token, so the "no publication path exists" claim becomes
enforced rather than hand-verified. This is what makes the proportionality rule safe: lightweight
governance is conditioned on a mechanically established state.

**Governance records replace rather than accumulate.** Superseded revisions are dropped from the
document and retrieved from history when needed. Short dated correction notes remain permitted for
factually wrong prior statements, which is the one case where a reader could otherwise carry an
error forward.

## Risks / Trade-offs

- **Read as weakening governance under a package that had real defects** → Every executable gate
  survives and two are added. What is removed is prose restating gate output. The findings this
  session came from executing checks; none came from the prose.
- **A structured manifest can drift from the prose that cites it** → The gate treats the manifest as
  authoritative and the record cites it rather than restating values. Drift then surfaces as a gate
  failure instead of an unverified sentence.
- **Subtree binding is less familiar than commit binding** → Records name both. The subtree is what
  the gate enforces; the commit remains for human navigation.
- **Proportionality could be claimed while a workspace is quietly publishable** → The condition is
  gate-determined, and the new workflow check closes the one path that was previously unenforced.
  A change cannot assert its way into the lightweight path.
- **Dropping in-document supersession loses at-a-glance history** → Accepted deliberately. That
  convention produced a ~1,500-line packet containing revisions describing revisions and a
  self-referential candidate binding; Git already solves this problem correctly.

## Migration Plan

1. Land the capability, the merge and history gate, and the workflow publication check.
2. Update `CONTRIBUTING.md` and the `README.md` gate table to describe the proportionate path and
   the new gates.
3. Apply the new shape to the next change that starts. Archived changes are not revisited, and the
   adversarial remediation's records stay exactly as archived.

Rollback is removing the two new gates and the capability; nothing else depends on them, and no
runtime, contract, or package behavior is involved.

## Open Questions

- Whether the governance manifest belongs in each change directory or as a generalization of
  `verification-lifecycle.json`. Both satisfy the specs and the gate reads either; this can be
  settled during implementation without changing scope or task breakdown.
