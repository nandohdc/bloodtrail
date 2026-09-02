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

### D1a — CRA records use an explicit, mutually exclusive mode

Each `contract-reuse.json` SHALL contain `mode` with exactly one value: `assessment` or `exemption`. An assessment-form record carries exactly one disposition; an exemption-form record carries a bounded reference to external signed governance evidence and does not carry a disposition. Mode-incompatible fields are rejected rather than inferred. Every form identifies exactly one `security-audit@1.0.0` contract; neither form is a contract list or a combined assessment-and-exemption assertion.

### D1b — Named closed record shapes and a local structural-rule adapter preserve the shared dialect

The schema SHALL define two named closed record shapes, `assessment` and `exemption`, and the CRA-local structural-rule adapter SHALL select the shape from the explicit `mode`. Both shapes use repository-standard `schema_version` and a fixed `contract` identity. The adapter reuses the dependency-free generic interpreter for all field constraints, then applies only these declared CRA-local relation IDs: `cra-assessment-disposition-fields`, `cra-mechanism-references-unique`, and `cra-alternatives-rejected-and-unique`. The assessment rules enforce assessment/exemption exclusivity; disposition-specific presence and absence; compatibility classification; a non-`security-audit` proposed contract identifier; unique alternatives distinct from the selected disposition; and unique mechanism references. The exemption shape has an empty declared relation set because its closed field table fully expresses its symbolic-locator shape. It SHALL not read the canonical contract, Git history, or governance records.

This is not a second schema interpreter or the #100 checker: it is a thin CRA-specific relational layer necessitated by the shared interpreter's deliberate separation of field tables and named relations. An unrecognised `mode` produces `cra-mode-unknown`; the three named relations produce, respectively, `cra-disposition-fields-invalid`, `cra-mechanism-reference-duplicate`, and either `cra-alternative-selected` or `cra-alternative-duplicate`. Generic field-table failures retain the existing stable `schema-*` diagnostics. The shared design-pattern-governance code remains unchanged.

### D1c — Mechanism references are bounded safe dotted paths

An assessment disposition that requires mechanism identification SHALL carry `mechanism_references`: one to eight distinct safe dotted ASCII paths of at most 200 characters, such as `registries.trust_levels`. Structural validation rejects empty, duplicate, unsafe, free-form, or overlong sets; the checker alone resolves those paths against the canonical source.

### D2 — One CRA evaluation has a closed path predicate over its changed range

Each CRA evaluation SHALL identify exactly one selected active OpenSpec change and inspect its material merge-base change range. A CRA is required when that range modifies at least one path in one of these scopes:

- `contracts/`;
- `packages/security-audit-sdk-core/src/generated/`;
- `openspec/specs/security-audit-event-contract/`; or
- `openspec/changes/<change-id>/specs/security-audit-event-contract/` for the change being evaluated.

The later checker SHALL compute this predicate from the changed path set, not from prose, labels, an unstructured author assertion, or whether a record happens to be present. It SHALL report a distinguishable approved skip when no listed path is modified, rather than presenting an unaffected change as a checked passing CRA. For each triggering path, it SHALL reuse the repository's existing `collectOpenSpecChanges` association helper and active changes' `assessment.json` `owned_paths`: the path is attributable only if exactly one active change's collected owned-path set matches it, and that change is the selected change. A change-local delta path is associated by its own `openspec/changes/<change-id>/` root, as provided by that same helper. Zero matches, multiple matches, or a unique match for another change fail closed. This is a closed path association, not heuristic record discovery. The later CI phase will enumerate relevant change roots and invoke one evaluation per root.

The predicate is deliberately closed and mechanical. A future contract source belongs under `contracts/`; adding a new trigger surface requires a separately governed update to this capability rather than an undocumented checker heuristic.

### D3 — Three closed assessment dispositions and one externally evidenced exemption form

An assessment-form CRA SHALL use exactly one disposition:

- `reuse`: use an existing contract mechanism and name its mechanism reference for later checker resolution, with no compatibility classification;
- `extend`: change an existing contract mechanism, name its mechanism reference for later checker resolution, and declare `compatibility_classification` as exactly `patch`, `minor`, or `major`; or
- `new_contract`: introduce a separately versioned contract, identify a proposed non-`security-audit` contract identifier, and explain why existing mechanisms are insufficient.

`not_applicable` is not a disposition. An exceptional qualifying change may proceed only with an exemption-form CRA carrying an explicit, change-bound exemption granted in writing by the project owner. The exemption must identify its scope and rationale and carry a symbolic locator for the same change in the fixed `packages/security-audit-sdk-core/verification-lifecycle.json` `governanceRecords[]` source; a caller cannot choose another record path. The locator is not valid until direct-child signed record S exists after technical candidate T, names that change, and meets the separately defined same-content-object binding rule. An exemption form SHALL NOT carry a disposition. The CRA schema validates only the locator's closed shape; the later checker validates the external evidence. A valid exemption has its own defined exception outcome and is not treated as a successful reuse outcome or as implementation authorization.

### D3a — Exemption binding is exact and narrowly granted

The later checker recognizes an exemption only when exactly one `governanceRecords[]` entry has `change` equal to `governance_locator.change`, and S has `reviewedCommit` equal to T, `reviewedContent.candidateRoot` equal to `T^{tree}`, and a reviewed-content entry whose selected change-root tree equals that path in T. S must have `signed: true`, `reviewer.name` exactly `Fernando Homem da Costa (nandohdc)`, and `contract-reuse-exemption:<change-id>` in `authorizations.granted`. Zero or multiple same-change entries, a change-name-only match, a different content object, a missing grant token, or another reviewer identity does not establish a CRA exemption.

### D4 — Version `1.0` references resolve only against the current canonical source

A CRA references real contract mechanisms, not free-form approximations. CRA record schema version `1.0` supports exactly the frozen `security-audit@1.0.0` contract. The later checker will resolve references against `contracts/security-audit/source/contract.source.json` for that exact version; a reference to `registries.trust_levels` is valid for the current contract and `registries.trust_levelz` is not. Every other declared contract version fails closed until a separately governed historical-source and resolver capability exists.

The schema remains structural: it validates the closed record shape and safe reference representation, not whether a reference resolves. The #99 tests will use the existing dependency-free closed-schema interpreter without modifying design-pattern-governance code; that test boundary is not the later CRA checker. Resolution, missing-record detection, malformed-record handling, exemption-evidence checks, attribution, and stable diagnostics belong to the later checker rather than to this proposal.

### D4a — Reasoning evidence is bounded without duplicating contract vocabularies

Assessment-form `rationale`, `trust_boundary`, and `transformation_ownership` are each authored text of 40–1000 characters. `assurance_limitations` contains one to eight entries of 20–600 characters. `alternatives` contains one to two closed `approach` values (`reuse`, `extend`, or `new_contract`), each with a 40–1000-character `rejection_reason`; an alternative cannot repeat the selected disposition. The maximum is two because the selected disposition cannot be its own rejected alternative and only two closed dispositions remain. `author` is a closed `{ name, handle }` object with a 3–120-character name and a one-to-39-character lowercase GitHub-style handle matching `^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$`. `evidence_references` contains one to eight repository-relative paths; #99 validates their lexical form only and neither #99 nor #100 treats their existence or contents as authorization evidence.

For `new_contract`, `proposed_contract_id` is a three-to-100-character lowercase kebab identifier matching `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$` and cannot equal `security-audit`. For an exemption form, `scope_paths` contains one to 25 repository-relative paths, `rationale` is 40–1000 characters, and `governance_locator` is a closed `{ change }` object using the existing `governanceRecords[]` change-key dialect and matching `^[a-z0-9][a-z0-9-]{2,99}$`. The locator contains no record-source or record-path field because the source is fixed by this design.

These fields record reasoning and support; they never create a second authority, privacy, transformation, or approval vocabulary.

### D4b — Schema compatibility starts closed at `1.0`

Every CRA record declares `schema_version: "1.0"`; the schema has `version` and `supported_versions` containing only `1.0`. Future minor versions may add optional evidence only. Removing a field, narrowing an enum, making mandatory evidence optional, or changing a field's meaning requires a major version, explicit migration, and CRA governance review. The shared interpreter's distinct `unknown-new-version` and `unsupported-old-version` diagnostics remain the CRA version outcomes; the structural adapter adds no fallback.

### D5 — Evidence keeps structural and semantic proof distinct

The downstream checker must provide these fixture classes, all in disposable repositories and with a null control:

- Positive: a change modifying a CRA-trigger path carries a valid record that references `registries.trust_levels` and passes.
- Approved skip: a change outside the trigger surface carries no CRA and reports the distinguishable skip outcome.
- Negative: the positive fixture with no CRA fails with a stable missing-record diagnostic.
- Negative: the valid record mutated to reference `registries.trust_levelz` fails with a stable unresolved-mechanism diagnostic naming the reference but not user-supplied rationale.
- Null control: the unmodified fixture reports no CRA diagnostic and passes.

In the schema phase, the `registries.trust_levels` record proves structural acceptance only; it does not prove that the reference resolves. In the checker phase, every enforcement result must assert the expected diagnostic and named safe path or reference; exit status alone is insufficient evidence.

### D6 — Known downstream examples exercise distinct dispositions

A future bounded client-evidence extension to the security-audit contract is an `extend` decision: it must compare reuse of existing claimed-identity and related contract mechanisms with the proposed extension. A separate ClientEvidenceEnvelope source is a `new_contract` decision because it is intentionally independent of the audit-event contract. Neither example is authorized by this design, and both remain subject to their own owner, privacy, and implementation gates.

## Record Model

The schema task group will define this exact closed dialect, using two named record shapes selected by `mode`:

| Field / form | Assessment | Exemption |
| --- | --- | --- |
| Common identity | `schema_version: "1.0"`; `contract: "security-audit@1.0.0"`; `mode: "assessment"` | `schema_version: "1.0"`; `contract: "security-audit@1.0.0"`; `mode: "exemption"` |
| Decision / reference | `disposition`; `mechanism_references` (exactly 1–8 safe paths for `reuse`/`extend`, absent for `new_contract`); `compatibility_classification` (required only for `extend`); `proposed_contract_id` (required only for `new_contract`) | no disposition, mechanism reference, compatibility classification, or proposed contract identifier |
| Reasoning | `rationale`; `trust_boundary`; `transformation_ownership`; `assurance_limitations`; `alternatives`; `author`; `evidence_references` | `scope_paths`; `rationale`; `governance_locator.change` |
| Rules | named CRA-local structural rules enforce the conditional fields, uniqueness, and closed alternative relationships | named CRA-local structural rules enforce the same-change locator's closed shape and exclusion of assessment fields |

Safe mechanism paths match `^[a-z][a-z0-9_]*(?:\\.[a-z][a-z0-9_]*)*$`. Schema version `1.0` admits no historical contract source or multiple contract identities; external source resolution, selected-change equality, signed-record discovery, and owner evidence remain checker work.

The record must preserve the distinction between an author assertion and a runtime control. Its presence cannot make an unapproved contract change authorized, and its contents must not be echoed into unbounded diagnostics. Structural acceptance is not a CRA-validated pass, contract-reference resolution, or owner-exemption validation.

## Task-Group Boundary

1. **Schema — #99:** define the versioned closed record schema, mutually exclusive forms, and structural fixtures using the existing closed-schema interpreter without source resolution or external-evidence validation.
2. **Checker — #100:** evaluate one selected change at a time, compute and attribute the range trigger, validate and resolve records and external exemption evidence, and prove positive, negative, skip, exception, and null-control behavior.
3. **CI — #101:** enumerate relevant change roots, run one checker evaluation per root in the existing governance job without a workflow path filter, and make the skip outcome observable.
4. **Review and owner governance:** complete normal review and owner-decision records for the exact technical commit; no CRA record substitutes for them.
5. **Archive:** fold the capability delta, preserve the required archive identity, and archive only after merge.

No task in a later group may start before the prior group is evidenced complete.

## Migration Plan

1. Land this proposal-only change with all task checkboxes unchecked.
2. After it is merged, #99 implements only the structural schema group in this same change.
3. #100 and #101 then implement the checker and CI groups in order, preserving the fixed trigger, one-change evaluation, external-exemption, and evidence model.
4. Complete review, owner governance, capability folding, and archive through the repository's governed lifecycle.

Rollback before enforcement is removal of this unmerged proposal. After a record schema or checker is merged, changes to the closed trigger or record semantics require a new governed change and an explicit compatibility decision; a local workaround or an exemption cannot redefine them.

## Risks / Trade-offs

- [Closed path scope can initially over-require records] → The scope is explicit and cheap to inspect; new surfaces require a governed update instead of semantic guessing.
- [Author-written records can be mistaken for approval] → The proposal states that CRA evidence is neither a signature nor authorization, and normal governance remains mandatory.
- [A new-contract rationale could mask duplication] → The record requires alternatives and resolved references where reuse or extension is plausible; the checker rejects malformed or unresolved evidence.
- [A checker can silently skip or never fire] → Positive, negative, approved-skip, and null-control fixtures assert diagnostics, and CI must expose the skip outcome.
- [The frozen contract can make stale references appear valid] → Resolution supports only the declared current `security-audit@1.0.0` version and fails closed when the version or path cannot be resolved.
- [An author can self-attest an exemption] → The CRA carries only a bounded reference; the checker validates separate signed governance evidence bound to the same change and reviewed content.
- [A multi-change range can hide attribution] → Each evaluation selects one active change, and an unassociated or ambiguous trigger path fails closed rather than being assigned heuristically.
