# Governance record — right-size-change-governance

> **STATUS: UNSIGNED — NOT OPERATIVE EVIDENCE.**
> This is a blank form. It records no review, no decision, and no authorization. Every field marked
> `<TO BE COMPLETED BY THE PROJECT OWNER>` is a placeholder. Until the project owner completes and
> commits it, and sets `signed: true` with the matching `reviewedContent` and `reviewer` in
> `governanceRecords` in
> [`verification-lifecycle.json`](../../../packages/security-audit-sdk-core/verification-lifecycle.json),
> this change has **not** been reviewed or approved.
>
> AI-produced analysis, passing gates, checked tasks, pull-request state, and merged state are not
> review, approval, or assurance, and none of them may be substituted for the signature below.

## Binding

| Field | Value |
| --- | --- |
| Candidate root tree | `<TO BE COMPLETED BY THE PROJECT OWNER>` |
| Reviewed subtree — `packages/security-audit-sdk-core/scripts` | `<TO BE COMPLETED BY THE PROJECT OWNER>` |
| Reviewed subtree — `packages/security-audit-sdk-core/tests/verification` | `<TO BE COMPLETED BY THE PROJECT OWNER>` |
| Reviewed commit (supplementary) | `<TO BE COMPLETED BY THE PROJECT OWNER>` |
| Reviewer / project owner | `<TO BE COMPLETED BY THE PROJECT OWNER>` |
| Review date | `<TO BE COMPLETED BY THE PROJECT OWNER>` |

Obtain every value from the reviewed implementation commit, and record the same values in the
`reviewedContent` of this change's `governanceRecords` entry:

```bash
CANDIDATE=<the exact reviewed implementation commit>
git rev-parse "$CANDIDATE^{tree}"                                              # candidateRoot
git rev-parse "$CANDIDATE:packages/security-audit-sdk-core/scripts"            # entries[].object
git rev-parse "$CANDIDATE:packages/security-audit-sdk-core/tests/verification" # entries[].object
```

```json
"reviewedContent": {
  "kind": "tree",
  "candidateRoot": "<root tree>",
  "entries": [
    { "path": "packages/security-audit-sdk-core/scripts", "object": "<subtree>" },
    { "path": "packages/security-audit-sdk-core/tests/verification", "object": "<subtree>" }
  ]
}
```

`test:governance-history` resolves each `path` inside `candidateRoot` and compares it to `object`, so
these values cannot be transposed or borrowed from another path. It also requires every `object` to be
carried at its `path` by history reachable from `HEAD`, which is the half that survives a squash merge
— the candidate root tree does not, because this record is committed on top of the candidate rather
than inside it.

The reviewed paths are subtrees this signing commit does not touch. The package root is deliberately
not one of them: it contains
[`verification-lifecycle.json`](../../../packages/security-audit-sdk-core/verification-lifecycle.json),
so binding it would mean signing changed the reviewed content, and the gate rejects that as
self-referential. A commit hash alone remains an unaccepted binding.

## Gates cited, not restated

Every repository-state claim this change relies on is enforced. Cited, per the rule this change
introduces:

| Requirement in the `change-governance` delta | Enforced or realized by |
| --- | --- |
| Governance weight is proportionate to authorization state | `test:publication-path`, `test:scope`, `test:package`, `test:dependencies` establish the unpublished, undeployed condition mechanically; `CONTRIBUTING.md` states the proportionate path |
| Repository-state claims are gate-enforced rather than narrated | `test:publication-path` closes the one previously hand-verified claim; `CONTRIBUTING.md` requires citation over restatement |
| Publication capability is excluded across tracked repository content | `test:publication-path` — manifest script bodies, manifest `private`, every automation file, workflow-referenced local paths, `.npmrc`, `publishConfig`; unreadable referenced content fails closed |
| Merge and history integrity are gate-enforced | `test:governance-history` — declared merge parent counts, bound-commit ancestry of `HEAD`, governed-commit resolution |
| Declared archive movements are anchored in version-control history | `test:archive-attestations` — every declared attestation and its archive compared against the commit that introduced it |
| Review and authorization are one signed record bound to a content object | this record plus the `governanceRecords` entry; `governance-content-binding-missing` rejects a signed record with no content object, and `governance-content-object-mismatch` rejects a path bound to another path's tree |
| Superseded governance records supersede in version control | `CONTRIBUTING.md`; this change replaced `design.md`'s Open Questions rather than appending to them |

Differential controls for all three gates are in
`packages/security-audit-sdk-core/tests/verification/governance-history-mutations.test.mjs`,
`packages/security-audit-sdk-core/tests/verification/publication-path-mutations.test.mjs`, and
`packages/security-audit-sdk-core/tests/verification/archive-attestation-anchor.test.mjs`, run by
`test:verification`. Each includes a control that removes the check and shows the same mutation then
passing, so none of them is vacuous.

## Assurance limitations

- `<TO BE COMPLETED BY THE PROJECT OWNER>` — at minimum, whether this is project-owner/implementer
  governance rather than independent security, privacy, legal, or technical assurance.
- AI-produced analysis informed the implementation. It is not review, approval, or assurance.

## Authorizations

| Authorization | Decision |
| --- | --- |
| Change approved to land and archive | `<TO BE COMPLETED BY THE PROJECT OWNER>` |
| Package publication/release approved | `NO — NOT AUTHORIZED` |
| Production deployment approved | `NO — NOT AUTHORIZED` |
| Production collection approved | `NO — NOT AUTHORIZED` |
| Real-user processing approved | `NO — NOT AUTHORIZED` |
| Framework integration approved | `NO — NOT AUTHORIZED` |
| Delivery infrastructure approved | `NO — NOT AUTHORIZED` |

The withheld authorizations above are the change's stated position and are already mirrored in the
`governanceRecords` entry. They are not conditional on the signature; the signature governs only
whether this change is approved to land and archive.

## Signature

`<TO BE COMPLETED BY THE PROJECT OWNER>`

Superseding this record replaces its content in place. Prior revisions are retrieved from Git
history, not retained inside this document.
