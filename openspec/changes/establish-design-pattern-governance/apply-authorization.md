# Apply Authorization — establish-design-pattern-governance

This record discharges tasks 1.1 and 1.2. It authorizes **apply only**. It is not technical review,
not the signed governance record, not merge readiness, not activation authorization, and not
publication or deployment authorization. Those states are established separately and are reported
separately (R23).

## Authorized proposal baseline

| Field | Value |
| --- | --- |
| Authorized proposal commit | `e536c9b74ec009a1bfad1c1561d478cb48600ba4` |
| Repository tree at that commit | `c594bf1bf7a0b81a546af74311c202064e6452ad` |
| Change subtree object | `afdc4cf0b7ab901b47af80b8ffa8b9b83c8e3a26` |
| Predecessor reviewed proposal | `2fabbed06233c8f913ece51f8d3a2930ad229954` |
| Architectural-review baseline | `a17eb79a2dd0172bb888278a39ad898280a2f59a` |
| Protected mainline at authorization | `d22d6b74702a491d86ca4643fe73a682aea59cb3` |

`e536c9b7` supersedes `2fabbed06` as the authorized baseline. `2fabbed06` carried 100 tasks across
groups 1.1–10.10; `e536c9b7` carries 98, after the reconciliation with the canonical
`change-governance` capability collapsed the separate review and decision groups and removed the
prose scope-exclusion task. Task 8.2 inspects `e536c9b7` itself, not mutable current task state.

## Authorization

| Field | Value |
| --- | --- |
| Authorizing party | Fernando Homem da Costa (`nandohdc`), project owner and sole CODEOWNER |
| Granted | `establish-design-pattern-governance-apply` — implement task groups 1 through 8 |
| Withheld | signed governance record, merge, activation, canonical materialization, archive, package publication, production deployment, production collection, real-user processing, framework integration, delivery infrastructure |
| Basis | Explicit instruction from the project owner to implement this change on a new branch |

Proposal validation, AI review, pull-request assignment, authorship, passing gates, and informal
messages did not create this authorization and do not create any of the withheld authorizations
(R23). AI-produced analysis informed the implementation and is not review, approval, or assurance.

## Changed-path allowlist

Apply may create or modify only these paths:

```
openspec/changes/establish-design-pattern-governance/**
openspec/governance/**
openspec/scripts/**
openspec/tests/**
docs/design-pattern-governance.md
.github/PULL_REQUEST_TEMPLATE.md
.github/workflows/ci.yml
CONTRIBUTING.md
```

Anything outside this list is out of scope for apply. `openspec/specs/software-design-pattern-governance/`
is deliberately excluded: the canonical capability is materialized at archive, through the governed
lifecycle, not during apply.

## Scope exclusions

Per the canonical `change-governance` capability, exclusions are discharged by citing the gates that
enforce them rather than by restating them in prose. Each gate runs from
`packages/security-audit-sdk-core`.

| Exclusion | Enforcing gate |
| --- | --- |
| No forbidden production-integration surface in the SDK | `npm run test:scope` |
| Canonical event contract unmodified | `npm run test:contract-immutability` |
| Protected paths and archived evidence unmodified | `npm run test:changed-paths` |
| No package-publication capability anywhere in tracked content | `npm run test:publication-path` |
| Governance records bind resolvable content and reachable history | `npm run test:governance-history` |
| Archive movements match their history-derived anchor | `npm run test:archive-attestations` |
| Package identity, versions, engines, and counts agree | `npm run test:coherence` |
| Whitespace, final newlines, and an empty index | `npm run test:git` |

## Stop conditions

Apply stops and reports rather than proceeding when any of the following holds:

1. A task requires the signed governance record, merge, activation, canonical materialization, or
   archive — all withheld above.
2. A required artifact cannot be produced without hand-editing generated output (see the Hermes
   finding recorded under task 7.8).
3. A gate fails for a reason the change does not authorize fixing.
4. An action would modify a path outside the allowlist.
5. Repository settings would have to change — configuring the governance CI job as a required status
   check is the owner's action, not apply's.

## Placement

Governance artifacts are repository-level under `openspec/`, `docs/`, and `.github/`. No root
`package.json` is introduced and no governance artifact is placed inside
`packages/security-audit-sdk-core/`, so governance neither couples to the SDK package nor creates a
publishable workspace (task 1.9).
