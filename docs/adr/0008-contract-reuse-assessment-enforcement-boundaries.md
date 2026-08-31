# ADR 0008: Keep Contract Reuse Assessment validation structural and enforcement change-scoped

- Status: Accepted
- Date: 2026-08-31
- Decision owners: Project owner

## Context

A Contract Reuse Assessment (CRA) must create reviewable evidence without silently expanding the schema phase into contract semantics, permitting unresolvable historical versions, or accepting an author’s own exemption assertion as proof of a project-owner decision. The future checker also needs a deterministic unit of evaluation when a material range contains contract-semantic paths.

## Decision

CRA schema version `1.0` validates only the closed CRA record shape. Structural acceptance does not resolve mechanism references against the canonical contract; resolution belongs to the later CRA checker. Version `1.0` supports exactly the frozen `security-audit@1.0.0` contract and fails closed for every other declared contract version until a separately governed historical-source capability exists.

A CRA record uses explicit `mode` with exactly two mutually exclusive values. An assessment form carries exactly one disposition; an exemption form carries exception evidence and no disposition. Every record identifies exactly one `security-audit@1.0.0` contract. `reuse` and `extend` use 1–8 safe dotted mechanism paths; only `extend` carries the contract classifications `patch`, `minor`, or `major`. `new_contract` carries its separate-boundary rationale instead.

Assessment reasoning is bounded authored evidence, not a duplicated contract taxonomy: each narrative is 40–1000 characters, assurance limitations have 1–8 entries of 20–600 characters, and alternatives have 1–2 closed approaches with rejection reasons. The maximum is two because the selected disposition cannot also be rejected and only the other two closed dispositions remain. Assessment-form author evidence is a bounded identity plus repository-relative supporting references, never approval evidence.

The #99 structural test harness reuses the repository's existing dependency-free closed-schema interpreter without modifying design-pattern-governance code. The CRA schema will use two named closed record shapes selected by the explicit `mode`, and a CRA-local structural-rule adapter will apply declared cross-field rules after the generic interpreter validates field constraints. That adapter performs no canonical-contract, Git, or governance-record I/O. It is a CRA-specific schema boundary, not the later CRA checker.

The record dialect uses the repository-standard `schema_version` key and starts with only `1.0` supported. A minor version may add only optional evidence; removing, weakening, or changing existing evidence requires a major version, explicit migration, and CRA governance review. Unknown newer and unsupported older versions have distinct fail-closed `unknown-new-version` and `unsupported-old-version` outcomes.

A CRA evaluation concerns exactly one selected active OpenSpec change and its material range. A triggered path that cannot be attributed to exactly one selected change fails closed; CI later enumerates the relevant change roots rather than treating a repository-wide scan as one assessment.

An exemption is a distinct exception outcome, not a fourth disposition and not an authorization. It uses a symbolic locator for the same change in the existing `packages/security-audit-sdk-core/verification-lifecycle.json` `governanceRecords[]` source; a caller cannot select another record path. The exemption is not valid until direct-child signed record S exists after technical candidate T, has `reviewedCommit` equal to T, has `reviewedContent.candidateRoot` equal to `T^{tree}`, and carries the selected change root's exact T tree object. S must have `signed: true`, `reviewer.name` exactly `Fernando Homem da Costa (nandohdc)`, and `authorizations.granted` token `contract-reuse-exemption:<change-id>`. A self-authored CRA field cannot itself establish an owner grant.

## Consequences

- The #99 schema phase proves structural acceptance and controlled field failures only; it neither resolves mechanism references nor validates owner evidence.
- The #99 test harness has no independent schema interpreter to maintain and cannot grow checker semantics by modifying the existing design-pattern-governance interpreter; its CRA-local adapter is limited to declared structural relations.
- The #100 checker phase owns exact-version admission, reference resolution, change attribution, direct-child signed-record discovery, same-content-object and owner-grant verification, and their stable outcomes. A pre-sign exemption remains unrecognized and fails closed.
- A future owner-identity representation or signed-record source change requires a separately governed CRA compatibility decision; no fallback reviewer identity or grant token is accepted.
- A later contract-version history, multi-change evaluation model, or alternative exemption trust root requires a separately governed decision.

## Alternatives considered

### Resolve contract references during schema validation

Rejected. It merges structural and semantic responsibilities, pre-implements checker behavior in #99, and obscures which phase proves a reference is real.

### Create an independent CRA schema interpreter

Rejected. The existing closed-schema interpreter already provides the structural capabilities #99 needs. Duplicating it would create a second dialect implementation without strengthening CRA evidence.

### Support an undeclared or historical contract-version set now

Rejected. The repository contains only `security-audit@1.0.0`; accepting other versions would make fail-closed resolution impossible.

### Discover records heuristically or allow raw contract edits without a selected change

Rejected. The same changed paths could be associated inconsistently or left unassessed.

### Accept an owner identity or approval assertion inside the CRA record

Rejected. An author-written record is not independent evidence of a project-owner grant and would contradict the CRA's non-authorizing boundary.
