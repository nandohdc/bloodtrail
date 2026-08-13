# Governance record — right-size-change-governance

> **STATUS: SIGNED by the project owner.** The matching `signed: true`, `reviewer`, and
> `reviewedContent` are recorded in `governanceRecords` in
> [`verification-lifecycle.json`](../../../../packages/security-audit-sdk-core/verification-lifecycle.json),
> and `test:governance-history` verifies the binding below by resolving each reviewed path inside the
> candidate root tree and comparing it to the declared object.
>
> AI-produced analysis, passing gates, checked tasks, pull-request state, and merged state are not
> review, approval, or assurance, and none of them was substituted for the signature below.

## Binding

| Field | Value |
| --- | --- |
| Candidate root tree | `d0b390f6e5e64fc87665cad9be68c70ebeab1810` |
| Reviewed subtree — `packages/security-audit-sdk-core/scripts` | `8505d3a7f3e1a2a0e851e6655bd5263d1a5556d3` |
| Reviewed subtree — `packages/security-audit-sdk-core/tests/verification` | `7919daf21a0e1a376af73f82f2a1a393e0a5c196` |
| Reviewed commit (supplementary) | `f7239d7d0cb910ab0d6d74ab8233f7d81aeabd31` |
| Bound commit | `f7239d7d0cb910ab0d6d74ab8233f7d81aeabd31` |
| Governed commits | `ff0154dac`, `f7239d7d0`, `4a551f796` |
| Reviewer / project owner | Fernando Homem da Costa (`nandohdc`) |
| Review date | 2026-08-12 |

> **Correction, 2026-08-13.** `governedCommits` and `boundCommits` in the `governanceRecords` entry
> named `706dd935c` — the archive commit of the adversarial-review remediation, and a commit of a
> different change. It was carried unrevised from this record's first revision; the 2026-08-12
> re-binding corrected `reviewedCommit` and left it in place. Both fields now name this change's own
> mainline commits, as the table above records. The correction does not touch the reviewed content
> objects, so the signature's binding is unchanged.

Obtain every value from the reviewed implementation commit — once it is on the mainline, so that a
squash merge cannot orphan it afterwards — and record the same values in the `reviewedContent` of
this change's `governanceRecords` entry:

```bash
CANDIDATE=<the exact reviewed implementation commit, as merged>
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
carried at its `path` by history reachable from `HEAD`, which is the half a squash merge can break.

The candidate is therefore the merged mainline commit, not a commit on the branch that produced it.
An earlier revision of this record bound `b557b5f18`, a pre-squash branch commit: the act of signing
changed one reviewed subtree, two later commits on the same branch changed the other, and the squash
merge left every one of those commits unreachable — so the binding named objects no longer carried at
their paths, and the gate rejected it on the mainline. Binding the merged commit makes both halves
durable: `f7239d7d0` stays an ancestor of `HEAD`, so its root tree keeps resolving and its subtrees
stay carried by history. It also removes a dependency on an unmerged branch surviving deletion.

The reviewed paths are subtrees this signing commit does not touch — a property to re-establish, not
assume, whenever this record is renewed. The package root is deliberately not one of them: it contains
[`verification-lifecycle.json`](../../../../packages/security-audit-sdk-core/verification-lifecycle.json),
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

- Project-owner/implementer governance; not independent security, privacy, legal, or technical
  assurance.
- AI-produced analysis informed the implementation. It is not review, approval, or assurance.

## Authorizations

| Authorization | Decision |
| --- | --- |
| Change approved to land and archive | `YES — APPROVED` |
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

Signed by Fernando Homem da Costa (`nandohdc`), project owner and sole CODEOWNER, on 2026-08-12,
binding the content objects in the table above. The authoritative machine-readable form of this
signature is the `right-size-change-governance` entry in `governanceRecords`, where `signed` is
`true`; `test:governance-history` verifies its bindings on every run.

Superseding this record replaces its content in place. Prior revisions are retrieved from Git
history, not retained inside this document.
