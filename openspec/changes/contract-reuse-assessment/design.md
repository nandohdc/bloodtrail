## Context

`assessment.json` already exists for design-pattern-governance assessments. It evaluates the design approach of an OpenSpec change and remains governed by its existing closed schema. A Contract Reuse Assessment (CRA) is a different, author-written record: it explains whether a qualifying change reuses a Bloodtrail contract mechanism, extends a contract, or introduces a new contract.

The security-audit contract is frozen at `1.0.0`. Its existing mechanisms include registries, the authority matrix, delivery-class contracts, integrity claims, privacy-transformation ownership, structural bounds, and registered extension namespaces. Future work must not silently duplicate or bypass those mechanisms merely because the reuse decision was never made explicit.

## Goals / Non-Goals

**Goals:**

- Define a deterministic, commit-range-based CRA trigger that a later checker can evaluate without guessing an author's intent.
- Define the CRA record's distinct name, locations, dispositions, exemption boundary, and evidence expectations.
- Preserve separate, ordered task groups for the schema (#99), checker (#100), CI integration (#101), review, and archive.
- Give later enforcement both a passing fixture and a deterministic failing mutation, with diagnostics rather than exit status as evidence.

**Non-Goals:**

- Implement the CRA schema, checker, fixtures, workflow step, or any CI configuration.
- Modify the frozen security-audit contract, its generated projections, or any contract mechanism.
- Change the design-pattern-governance assessment schema or the archived design-pattern-governance change.
- Grant architectural, implementation, production, collection, delivery, storage, publication, or deployment authorization.

## Decisions

### D1 — CRA is a distinct author-written record

A CRA SHALL be stored as `contract-reuse.json` in the qualifying change root. The name is intentionally distinct from that change's `assessment.json`.

The CRA is author-written and mechanically validated. It records reasoning; it is not a signed review, owner approval, or implementation authorization. The normal OpenSpec governance lifecycle remains responsible for those decisions.

### D2 — The trigger is a closed path predicate over the changed range

A CRA is required when a change range modifies at least one path in one of these scopes:

- `contracts/`;
- `packages/security-audit-sdk-core/src/generated/`;
- `openspec/specs/security-audit-event-contract/`; or
- `openspec/changes/<change-id>/specs/security-audit-event-contract/` for the change being evaluated.

The later checker SHALL compute this predicate from the changed path set, not from prose, labels, an author's assertion, or whether a record happens to be present. It SHALL report a distinguishable approved skip when no listed path is modified, rather than presenting an unaffected change as a checked passing CRA.

The predicate is deliberately closed and mechanical. A future contract source belongs under `contracts/`; adding a new trigger surface requires a separately governed update to this capability rather than an undocumented checker heuristic.

### D3 — Three closed dispositions and one explicit exemption boundary

A CRA SHALL use exactly one disposition:

- `reuse`: use an existing contract mechanism and name the resolved mechanism reference;
- `extend`: change an existing contract mechanism and name both the mechanism and the compatibility treatment; or
- `new_contract`: introduce a separately versioned contract and explain why existing mechanisms are insufficient.

`not_applicable` is not a disposition. An exceptional qualifying change may proceed only with an explicit, change-bound exemption granted in writing by the project owner. The exemption must identify its scope and rationale and is validated as an exception, not treated as a successful reuse outcome.

### D4 — References resolve against the canonical source

A CRA references real contract mechanisms, not free-form approximations. The later checker will resolve references against `contracts/security-audit/source/contract.source.json` using the contract version declared by the record. A reference to `registries.trust_levels` is valid for the current contract; `registries.trust_levelz` is not.

The schema remains structural. Resolution, missing-record detection, malformed-record handling, exemption-authority checks, and stable diagnostics belong to the later checker rather than to this proposal.

### D5 — Evidence is positive, negative, and controlled

The downstream checker must provide these fixture classes, all in disposable repositories and with a null control:

- Positive: a change modifying a CRA-trigger path carries a valid record that references `registries.trust_levels` and passes.
- Approved skip: a change outside the trigger surface carries no CRA and reports the distinguishable skip outcome.
- Negative: the positive fixture with no CRA fails with a stable missing-record diagnostic.
- Negative: the valid record mutated to reference `registries.trust_levelz` fails with a stable unresolved-mechanism diagnostic naming the reference but not user-supplied rationale.
- Null control: the unmodified fixture reports no CRA diagnostic and passes.

Every enforcement result must assert the expected diagnostic and named safe path or reference; exit status alone is insufficient evidence.

### D6 — Known downstream examples exercise distinct dispositions

A future bounded client-evidence extension to the security-audit contract is an `extend` decision: it must compare reuse of existing claimed-identity and related contract mechanisms with the proposed extension. A separate ClientEvidenceEnvelope source is a `new_contract` decision because it is intentionally independent of the audit-event contract. Neither example is authorized by this design, and both remain subject to their own owner, privacy, and implementation gates.

## Record Model

The schema task group will define the exact closed record dialect. At minimum, the record model must capture the change identity, affected contract and version, one disposition, mechanism references when applicable, rationale, compatibility treatment, trust boundaries, transformation ownership, alternatives considered, author/decision evidence, assurance limitations, and any owner-granted exemption.

The record must preserve the distinction between an author assertion and a runtime control. Its presence cannot make an unapproved contract change authorized, and its contents must not be echoed into unbounded diagnostics.

## Task-Group Boundary

1. **Schema — #99:** define the versioned closed record schema and structural fixtures.
2. **Checker — #100:** compute the range trigger, validate and resolve records, and prove positive, negative, skip, and null-control behavior.
3. **CI — #101:** run the checker in the existing governance job without a workflow path filter and make the skip outcome observable.
4. **Review and owner governance:** complete normal review and owner-decision records for the exact technical commit; no CRA record substitutes for them.
5. **Archive:** fold the capability delta, preserve the required archive identity, and archive only after merge.

No task in a later group may start before the prior group is evidenced complete.

## Migration Plan

1. Land this proposal-only change with all task checkboxes unchecked.
2. After it is merged, #99 implements only the schema group in this same change.
3. #100 and #101 then implement the checker and CI groups in order, preserving the fixed trigger and evidence model.
4. Complete review, owner governance, capability folding, and archive through the repository's governed lifecycle.

Rollback before enforcement is removal of this unmerged proposal. After a record schema or checker is merged, changes to the closed trigger or record semantics require a new governed change and an explicit compatibility decision; a local workaround or an exemption cannot redefine them.

## Risks / Trade-offs

- [Closed path scope can initially over-require records] → The scope is explicit and cheap to inspect; new surfaces require a governed update instead of semantic guessing.
- [Author-written records can be mistaken for approval] → The proposal states that CRA evidence is neither a signature nor authorization, and normal governance remains mandatory.
- [A new-contract rationale could mask duplication] → The record requires alternatives and resolved references where reuse or extension is plausible; the checker rejects malformed or unresolved evidence.
- [A checker can silently skip or never fire] → Positive, negative, approved-skip, and null-control fixtures assert diagnostics, and CI must expose the skip outcome.
- [The frozen contract can make stale references appear valid] → Resolution is tied to the record's declared contract version and fails closed when the version or path cannot be resolved.
