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
| Reviewed content object (tree) | `<TO BE COMPLETED BY THE PROJECT OWNER>` |
| Reviewed content path | `<TO BE COMPLETED BY THE PROJECT OWNER>` |
| Reviewed commit (supplementary) | `<TO BE COMPLETED BY THE PROJECT OWNER>` |
| Reviewer / project owner | `<TO BE COMPLETED BY THE PROJECT OWNER>` |
| Review date | `<TO BE COMPLETED BY THE PROJECT OWNER>` |

The content object is primary. Obtain it from the implementation commit with
`git rev-parse <implementation-commit>^{tree}`; it survives squash merge, rebase, and cherry-pick,
and can be named by the later commit that carries this record. A commit hash alone is not an
accepted binding — `test:governance-history` rejects it.

## Gates cited, not restated

Every repository-state claim this change relies on is enforced. Cited, per the rule this change
introduces:

| Requirement in the `change-governance` delta | Enforced or realized by |
| --- | --- |
| Governance weight is proportionate to authorization state | `test:publication-path`, `test:scope`, `test:package`, `test:dependencies` establish the unpublished, undeployed condition mechanically; `CONTRIBUTING.md` states the proportionate path |
| Repository-state claims are gate-enforced rather than narrated | `test:publication-path` closes the one previously hand-verified claim; `CONTRIBUTING.md` requires citation over restatement |
| Merge and history integrity are gate-enforced | `test:governance-history` — declared merge parent counts, bound-commit ancestry of `HEAD`, governed-commit resolution |
| Review and authorization are one signed record bound to a content object | this record plus the `governanceRecords` entry; `governance-content-binding-missing` rejects a signed record with no content object |
| Superseded governance records supersede in version control | `CONTRIBUTING.md`; this change replaced `design.md`'s Open Questions rather than appending to them |

Differential controls for both gates are in
`packages/security-audit-sdk-core/tests/verification/governance-history-mutations.test.mjs` and
`packages/security-audit-sdk-core/tests/verification/publication-path-mutations.test.mjs`, run by
`test:verification`.

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
