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

## Settled during implementation

**The governance manifest generalizes `verification-lifecycle.json`** rather than living in each
change directory. It is a new top-level `governanceRecords` array; `schemaVersion` stays `1` because
the addition is purely additive. The file is already loaded once and frozen as `lifecycleMetadata` by
`scripts/lifecycle-policy.mjs`, already read by four gates, already declared in
`compatibility.json.verificationLifecycle`, and already the subject of two differential suites, so
the new gate and its controls inherit an established mechanism instead of introducing one.
*Alternative considered:* a per-change file — rejected because it needs its own discovery pass, and
because manifests that travel into `changes/archive/` would keep asserting ancestry over history
that later squash merges legitimately rewrite.

## Settled during remediation

Three of the gates this change introduced enforced less than the change claimed. Each was reproduced
against the implementation in disposable clones before being corrected, and each correction is
carried by a differential control that fails without it.

**The publication-path gate forbids the capability instead of tracing reachability.** The first
implementation scanned `.github/workflows/*.y*ml` and nothing else, so a `"release": "npm publish"`
script in a tracked manifest — invoked by `npm run release --prefix …` from a workflow — passed, and
manifest `private` was never checked. Following the indirection properly would mean a shell
call-graph analysis, and a regex that claimed to do that would be the kind of assertion this change
exists to remove. The gate therefore states and enforces a different, decidable property: **no
tracked package manifest script, no tracked file under `.github/`, and no local path a workflow
references may contain a publication command, registry publication configuration, or publication
credential — whether or not anything invokes it.** That is strictly stronger than reachability, and
it is checkable by reading content. Anything a workflow references that the gate cannot read fails
closed, because an exclusion cannot be established over unscanned content. The scan surface stays
narrow enough to keep the existing false-positive controls valid: `RELEASING.md` may still describe
`npm publish` and every lockfile may still name `registry.npmjs.org`, because documentation and
lockfiles are not in the scanned surface and manifests are read as structured data rather than text.
*Alternative considered:* scanning all tracked text for publication strings — rejected because it
fails on its own documentation, which is how a check gets deleted rather than trusted.

**Content binding resolves a path against a candidate tree; the durable half is path-to-object.**
The first implementation checked only that `reviewedContent.object` resolved to *a* tree, so a record
could claim `packages/security-audit-sdk-core` while supplying the tree of `.github` — and the
record form told the owner to compute a **root** tree, which the gate would then have compared as
though it were that subtree. The settled shape is a candidate root tree plus one entry per reviewed
path:

```json
"reviewedContent": {
  "kind": "tree",
  "candidateRoot": "<git rev-parse <candidate>^{tree}>",
  "entries": [{ "path": "…", "object": "<git rev-parse <candidate>:…>" }]
}
```

Git resolves `candidateRoot:path` and the gate compares it to `object`, so a mismatch, an
unresolvable path, a malformed path, and a blob where a tree belongs are all rejected by name.

`candidateRoot` cannot be a *hard* resolvability requirement. The candidate commit is not the commit
that signs it — a record cannot name the tree it is part of — so the signing commit sits on top of
the candidate, and a squash merge lands only the branch tip's tree on `main`. The candidate's root
tree is then orphaned and absent from a fresh clone, and a gate that required it to resolve would
turn `main` red permanently. The mandatory half is therefore the **path-to-object binding verified
against history**: some commit reachable from `HEAD` must carry `object` at `path`. That is what
survives squash, rebase, and cherry-pick, and it is what rejects the `.github` substitution even
when the candidate root is gone. `candidateRoot` is verified exactly when it resolves, and its
absence is reported rather than silently skipped.

This is also why a reviewed path may not contain the governance manifest. Binding
`packages/security-audit-sdk-core` while the record lives in
`packages/security-audit-sdk-core/verification-lifecycle.json` means signing changes the reviewed
tree, so the bound object never lands on `main`: green on the branch, red on `main`. Rejecting it up
front with a named diagnostic is the honest form of that failure. Reviewed paths are consequently
subtrees the signing commit does not touch.

**Archive movement is anchored in history, not in the pair it is meant to police.** Movement
validation ran only for the change named by `remediationChange`, so the attestation for
`2026-08-11-attest-archive-movement` was read by nothing — `verification-lifecycle.json` said so and
named this change as the owner of the fix. Worse, on the attested path the archive and the
attestation are both mutable working-tree content, so rewriting an archived file *and* its recorded
object passed. The anchor is derived instead from the commit reachable from `HEAD` that introduced
the archived path, obtained by walking history for that path and never from a value the manifest
declares. Both the working-tree archive and the declared inventory are compared against it, so a
coordinated rewrite fails twice. Every declared attestation is checked.

`anchorCommit` is declared for the reader and cross-checked, but enforcement rests on the derived
anchor, never on the declaration — and declaring it cannot be a precondition of the movement commit,
because a commit cannot name the commit that introduces its own archive. So the field is optional,
verified when present (it must be an ancestor of `HEAD` and must equal the derived anchor), and its
absence is reported. Both existing attestations declare it; that is the whole migration.

The residual is stated rather than implied: **a history-derived anchor does not withstand rewriting
the history it derives from.** What bounds that is outside this gate — `main` is protected against
force-push, and a rewrite at or before an anchor changes the identifier of every descendant commit,
including the bound commits `test:governance-history` requires to remain ancestors of `HEAD`. This
gate detects the attack it is specified to detect: archive and attestation rewritten together with
history intact. It is not offered as tamper-proof storage.
*Alternative considered:* recording a tree object for the archive alongside its per-file objects —
rejected as cosmetic, because a tree identifier is a pure function of the files, so an adversary who
rewrites the files recomputes it.

**Enforcement lives in a new gate, `test:archive-attestations`.** It runs over every declared
attestation independently of lifecycle mode and change selection, and leaves the existing
`check-changed-paths.mjs` movement logic — the most heavily mutation-tested code in the repository —
untouched. `validate` and `verify` run both, which is where the composite property holds.
*Alternative considered:* extending the movement validation in place — rejected because its
lifecycle gating is exactly what limited enforcement to one named change, and because rewriting it
risks weakening controls that already work.

Two boundaries deliberately not moved: the gate does not require an attestation for archives that
never declared one (five historical archives predate the mechanism, and demanding attestations for
them would rewrite frozen artifacts), and no archived artifact is edited — migration is one
`anchorCommit` field per existing entry.
