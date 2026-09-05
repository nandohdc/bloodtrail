# OpenSpec Governance Context

This context defines the evidence-bearing concepts used to govern repository changes. It distinguishes an author’s architectural reasoning from technical review, project-owner decisions, and implementation authorization.

## Contract Reuse Assessment

**Contract Reuse Assessment (CRA)**:
A distinct author-written record of whether a qualifying change reuses, extends, or introduces a contract. A CRA is evidence and never approval or implementation authorization.
_Avoid_: design-pattern assessment, pull-request rationale

**CRA execution frontier**:
The earliest incomplete ordered CRA phase eligible for work. It advances from schema to checker to CI only after the preceding phase has its required evidence.
_Avoid_: Kanban frontier, current task

**CRA evaluation**:
One determination of CRA applicability for a selected OpenSpec change and its material change range.
_Avoid_: repository-wide CRA scan

**CRA disposition**:
One of the closed contract-reuse outcomes: `reuse`, `extend`, or `new_contract`. An exemption is not a disposition.
_Avoid_: not applicable, exemption outcome

**CRA record mode**:
The explicit `mode` field with exactly two mutually exclusive values: `assessment`, carrying a disposition, or `exemption`, carrying exception evidence. A record does not combine the two forms.
_Avoid_: optional exemption fields, combined assessment and exemption

**CRA exemption**:
A change-bound exception established by separate signed governance evidence for an otherwise qualifying change. It is not a successful disposition or authorization.
_Avoid_: self-attested exemption, fourth disposition

**CRA exemption locator**:
A symbolic reference from an exemption-form CRA to the existing canonical governance-record source for the same change. It becomes valid only after that source contains the direct-child signed record that binds the technical candidate.
_Avoid_: caller-selected record path, pre-sign exemption proof

**CRA exemption binding**:
The exact relation in which signed record S names the same change, names technical candidate T, binds T's root and selected change-root tree, has `signed: true` with `reviewer.name` exactly `Fernando Homem da Costa (nandohdc)`, and grants the narrowly named CRA exemption.
_Avoid_: change-name-only match, implied owner approval

**Mechanism reference set**:
A collection of 1–8 safe dotted ASCII canonical contract paths when an assessment disposition requires identified mechanisms.
_Avoid_: free-form mechanism names, contract list

**CRA compatibility classification**:
One of `patch`, `minor`, or `major`, recorded only for an `extend` assessment. It classifies the proposed contract extension rather than an unsupported-version condition.
_Avoid_: unsupported, reuse compatibility

**CRA reasoning evidence**:
Bounded authored explanation of rationale, trust boundaries, transformation ownership, alternatives, and assurance limitations. It supports a CRA but is not a controlled contract vocabulary or approval.
_Avoid_: copied contract registry, approval evidence

**CRA author evidence**:
A bounded author identity and repository-relative supporting references in an assessment-form CRA. It is an author assertion and never a signature or owner decision.
_Avoid_: approval record, reviewer evidence

**CRA structural-rule adapter**:
The CRA-local layer that dispatches the explicit record mode to a named closed record shape and applies declared cross-field structural rules after the shared generic interpreter validates field constraints. It performs no canonical-contract, Git, or governance-record I/O.
_Avoid_: second schema interpreter, CRA checker

**CRA schema compatibility**:
The version policy for the closed CRA record dialect. Every initial record uses `schema_version: "1.0"`; a minor version may add only optional evidence, while removing, weakening, or changing existing evidence requires a major version, explicit migration, and CRA governance review. Newer and older unsupported versions fail closed with `unknown-new-version` and `unsupported-old-version`, respectively.
_Avoid_: silent schema change, version fallback

**Structural acceptance**:
Conformance of a CRA record to its closed record shape without establishing that a contract mechanism reference resolves semantically.
_Avoid_: CRA-validated pass

**Approved skip**:
The distinguishable outcome that no CRA-triggering path exists in an evaluation. It is not a CRA-validated pass.
_Avoid_: passing CRA

## Verification Gates and Command Surface

**Runtime gates**:
The subset of checks that assert facts about a runtime rather than a repository state (behavioral tests, types, syntax, package exports, engine compatibility, scoped dependencies). Runtime gates execute per matrix leg and form the fast local development loop.
_Avoid_: repository-level gates, whole-chain checks

**Repository-level gates**:
The checks that assert facts about the repository rather than about a specific runtime (Git status, clean commits, package contents closure, cross-artifact coherence, contract immutability, publication paths, governance history, archive attestations, and fail-closed gate mutation verifications). Repository-level gates execute once per change rather than once per matrix leg.
_Avoid_: per-leg gates, runtime checks

**Product test loop**:
The fast, matrix-safe verification loop (~18s across all three workspaces) executed during active development (`npm run test:matrix` in the SDK, `validate` in contracts, `lint` and `test` in research).
_Avoid_: full governance-gate chain, slow validate

**Governance-gate chain**:
The complete validation chain (~291s across workspaces) that enforces fail-closed gate mutation testing (`test:verification`, ~254s dominant cost) and full contract/SDK validation, required before pushing to mainline or opening PRs.
_Avoid_: fast test loop, product loop
