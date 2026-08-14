# Signed Governance Record — <change-id>

One record carries technical review **and** the project-owner decision. There is no separate review
record and no separate decision record: the canonical `change-governance` capability requires them to
be one signed record rather than separate governed task groups.

The record lives as an entry in `packages/security-audit-sdk-core/verification-lifecycle.json` under
`governanceRecords[]`, which is what `check-governance-history.mjs` resolves and enforces. This
template is the shape to fill in; the JSON below is the shape to commit.

## Binding rules

- The record binds a **content object** — a tree or subtree identifier — and additionally names the
  technical commit. A commit hash alone is not enough: a commit cannot record its own identifier, and
  a commit can be orphaned.
- Every declared reviewed path must resolve inside the bound candidate content, and the declared
  object must be the object that path resolves to. Syntactic validity is not acceptance.
- **No reviewed path may contain this record.** Signing a record stored inside the reviewed content
  would change that content, which is the self-reference the content-object binding exists to remove.
- AI-produced analysis may inform the record. It is not review, approval, or assurance, and approval
  is never inferred from passing tests, checked tasks, issue state, pull-request state, or merged
  state.
- Any change to a normative path after signing makes the record stale. A governance-record-only
  commit does not.

## Record

```json
{
  "change": "<change-id>",
  "policy": "<what this record binds and which gate verifies it; cite the gate rather than restating what it enforces>",
  "reviewedCommit": "<40-hex technical commit T>",
  "reviewedContent": {
    "kind": "tree",
    "candidateRoot": "<40-hex tree of the candidate commit>",
    "entries": [
      { "path": "<repository-relative reviewed path>", "object": "<40-hex object that path resolves to>" }
    ]
  },
  "governedCommits": ["<40-hex>"],
  "boundCommits": ["<40-hex technical commit T>"],
  "mergeCommits": [{ "commit": "<40-hex M>", "expectedParents": 2 }],
  "authorizations": {
    "granted": ["<what this record authorizes, named narrowly>"],
    "withheld": [
      "package-publication",
      "production-deployment",
      "production-collection",
      "real-user-processing",
      "framework-integration",
      "delivery-infrastructure"
    ]
  },
  "assuranceLimitations": [
    "Project-owner/implementer governance; not independent security, privacy, legal, or technical assurance.",
    "AI-produced analysis informed the implementation and is not review, approval, or assurance."
  ],
  "signed": true,
  "reviewer": { "name": "<name (handle)>", "signedAt": "<YYYY-MM-DD>" }
}
```

## Design-pattern governance addenda

For a change governed by design-pattern governance, the record also states:

| Field | Content |
| --- | --- |
| Assessment | path, `sha256:` digest, and the assessment commit |
| Catalog invariants | every bound invariant ID, its catalog version, and its evidence |
| Non-applicable conditionals | each one acknowledged explicitly, with its force-based reason |
| Implementation invariants | for a direct-implementation decision |
| Candidate comparison | confirmation that direct implementation and at least one plausible alternative were compared |
| Security classification | the declaration and, for `false`, the dimension-by-dimension justification |
| Baseline checker result | source ref, checker blob, exit code, diagnostics |
| Candidate checker result | source ref, checker blob, exit code, diagnostics — recorded **separately**; neither substitutes for the other |
| Activation bootstrap | the exact objects bootstrap will verify |
| Required-CI evidence plan | how required-status enforcement will be verified and stored for the activation record |
| Divergences | anything the implementation does differently from the plan, and whether it is accepted |

## What this record does not do

Signing establishes the `governance_signed` state. It does not merge, does not activate, does not
materialize the canonical capability, does not archive, and does not authorize publication or
deployment. Those states are established separately and reported separately.
