# Issue #99 — Define the Contract Reuse Assessment Schema — Plan

> **For Hermes:** Blocked on #98 — the change that gives this schema a governed home does not exist yet.
> Do not start by writing JSON. When #98 lands, this issue implements *one task group* inside that change,
> not a change of its own. The schema's shape is already constrained by two things in the repository:
> the closed-schema idiom used by `openspec/governance/schemas/*.schema.json`, and the compatibility rules
> at `policy.schema_compatibility` (adding optional evidence is minor; removing or weakening mandatory
> evidence is major). Follow those; do not invent a third schema dialect.

**Goal:** A machine-checkable, versioned, closed schema for recording a reuse / extend / new-contract
decision, with a canonical valid fixture and at least two negative fixtures.

**Status at this baseline:** BLOCKED ON #98 — no work should start before #98's artifacts are on `main`.

**Architecture:** One schema file plus fixtures, added inside #98's change. The schema describes a record,
not a process; enforcement is #100's job and CI is #101's.

**Tech Stack:** JSON schema in the repository's own closed-schema dialect, `node --test` fixtures.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #99, OPEN, labels `enhancement` `openspec-change-needed` `area:core` `needs-triage` |
| Declared dependency | #98 — **not started** |
| Native GitHub blockers | `blocked_by` is `0` — the dependency is prose only, nothing will stop a premature start |
| Existing schema dialect | `"schema": "bloodtrail.design-pattern-governance.closed-schema"`, with `id`, `version`, `supported_versions`, `closed: true`, `fields`, `rules` |
| Live examples | `assessment.schema.json` (v1.1), `signed-governance-record.schema.json` (v1.1, 12 rules, 6 mandatory withheld authorizations), `activation`, `provenance`, `baseline-disagreement` |
| Compatibility rules | `policy.schema_compatibility` — `minor_rule`: MAY add optional evidence; MUST NOT remove a field, narrow an enum, make mandatory evidence optional, or change a field's meaning. `major_rule`: removing or weakening mandatory evidence needs a major version, an explicit migration, and R14 review |
| Unknown-version handling | `unknown_newer: "unknown-new-version"`, `unsupported_older: "unsupported-old-version"` |
| Contract mechanisms a CRA must be able to reference | `registries.trust_levels`, `authority_matrix`, `delivery_class_contracts`, `integrity_claims`, privacy transform SPI, bounds, four extension namespaces |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The dialect is already decided; do not choose one

Every governance schema in this repository is a **closed** schema in a bespoke dialect with `fields`,
per-field `required`, `enum`, `pattern`, `min_length`, `min_items`, `max_items`, and a `rules` array whose
entries carry a `requirement` id. Follow it. A JSON Schema Draft 2020-12 file would be the only one of its
kind here and would need its own validator.

### F2 — The compatibility rules give versioning for free

#99's acceptance criterion "Schema versioning and backward-compatibility rules are documented" is
satisfied by *binding to* `policy.schema_compatibility`, not by writing new rules. Start at `1.0`, declare
`supported_versions: ["1.0"]`, and state that later increments follow the existing minor/major rules.

### F3 — "Required fields cannot be omitted" needs a real-mechanism reference field, and that is the hard one

PLAN-071 asks for "real-mechanism references": a CRA must point at the *actual* contract path it reuses,
and #100's canonical negative fixture is a **misspelling** — `registries.trust_levelz`. So the field cannot
be a free string; it must be validated against the contract's real structure. Two options:

| Option | Mechanism | Cost |
| --- | --- | --- |
| **A — enumerated** | A closed enum of admissible mechanism paths, generated from the contract source | Enum must regenerate when the contract changes; contract is frozen at `1.0.0`, so today the enum is static |
| **B — resolved** | A `pattern` plus a checker-side resolution against `contract.source.json` | Schema stays small; the misspelling arm becomes #100's job, not the schema's |

**Recommend B.** #99's own acceptance criteria say "Misspelling or omitting a required field
deterministically fails" — omission is schema-level, misspelling is resolution-level, and #100 explicitly
owns the `trust_levelz` arm. Keep the schema structural and let the checker resolve. Record the choice.

### F4 — The three dispositions need a closed vocabulary, and a fourth value will be requested

`reuse` / `extend` / `new_contract`. Someone will ask for `not_applicable`. Decide now: an exemption is a
**separate field** with its own approver, not a fourth disposition — otherwise "not applicable" becomes
the default and the gate is dead. #99 already lists exemptions as a distinct required field group.

### F5 — Approvers are assertions, not controls

#99's own assurance limitation says so: "Assessment fields capture security reasoning but are reviewer
assertions, not runtime controls." Put that sentence in the schema's `note`, the way
`signed-governance-record.schema.json` puts its reasoning in its `note`. It is the single most useful line
in the file.

---

## Decisions taken

1. **Use the repository's closed-schema dialect** (F1).
2. **Start at version `1.0`** and bind to `policy.schema_compatibility` rather than restating rules (F2).
3. **Structural schema, resolved references** — Option B (F3).
4. **Exemption is a separate field with a named approver**, not a disposition value (F4).
5. **The assurance limitation goes in the schema's `note`** (F5).
6. **Fixtures live beside the schema**, one canonical valid and at least two negative.

---

## Required fields (draft — settle in #98's design, implement here)

| Field | Required | Shape |
| --- | --- | --- |
| `schema_version` | yes | enum of supported versions |
| `change_id` | yes | same pattern as the signed record's |
| `affected_contracts` | yes | array, min 1, each `{ contract, version }` |
| `disposition` | yes | enum `reuse` \| `extend` \| `new_contract` |
| `mechanism_references` | yes when `disposition = reuse` | array of contract paths, resolved by the checker |
| `rationale` | yes | string, `min_length` generous enough to prevent "n/a" |
| `compatibility` | yes | `{ impact, version_treatment }` |
| `trust_boundaries` | yes | array, min 1 |
| `transformation_ownership` | yes | who owns any transform introduced |
| `alternatives_considered` | yes | array, min 1 |
| `approvers` | yes | array, min 1, `{ name, role, decided_at }` |
| `exemption` | optional | `{ granted_by, reason, expires }` — presence changes what the checker requires |
| `assurance_limitations` | yes | array, min 1, `min_length` per item |

---

## Task 0: Gate

- [ ] 0.1 **Confirm #98's change is on `main`.** If `openspec/changes/contract-reuse-assessment/` does not
      exist and no archive of it exists, **stop and work #98 instead.**
- [ ] 0.2 Confirm #98's design settled the trigger, path coverage, dispositions, and exemption authority.
      If any is open, resolve it there — not here.
- [ ] 0.3 Re-read `policy.schema_compatibility` and both live schemas end to end before writing a line.

## Task 1: Implement the schema task group

- [ ] 1.1 Work the schema task group inside #98's change with `openspec-apply-change`. Task groups complete
      **in order**; `check-coherence` rejects starting a later group early.
- [ ] 1.2 Write `openspec/governance/schemas/contract-reuse.schema.json` in the closed dialect.
      **`openspec/governance/` is `governance_core`** — this task group carries full-assessment ceremony
      even though #98's authoring commit did not.
- [ ] 1.3 Add the canonical valid fixture and at least two negative fixtures (omitted required field;
      unknown enum value).
- [ ] 1.4 Add a validator test asserting the fixtures' outcomes by **diagnostic**, not exit status.

## Task 2: Verify

- [ ] 2.1 `node --test openspec/tests/design-pattern-governance/*.test.mjs`
- [ ] 2.2 `openspec validate --strict contract-reuse-assessment`
- [ ] 2.3 Both `validate` chains; index empty before verification.
- [ ] 2.4 Dual check from the merge-base — `openspec/governance/` is `governance_core`, so the candidate is
      not its own judge.

## Task 3: Close

- [ ] 3.1 Comment on #100 that the schema exists; promote it.
- [ ] 3.2 Close #99 naming the schema path, version, and fixture results.
- [ ] 3.3 Tick #99 in #132's Wave 3 checklist.

---

## Validation matrix

| Acceptance criterion (#99) | Arm |
| --- | --- |
| Represents reuse, extension, new-contract with explicit rationale | `disposition` enum + `rationale` |
| Required trust-boundary, compatibility, owner, evidence fields cannot be omitted | negative fixture: each omitted in turn |
| Canonical valid assessment passes | positive fixture |
| Misspelling or omitting a required field deterministically fails | omission here; **misspelling in #100** (F3) |
| Versioning and backward-compatibility rules documented | binding to `policy.schema_compatibility` (F2) |

## Risks and open questions

- **Starting before #98 is the main risk**, and nothing mechanical prevents it — `blocked_by` is `0`.
- **The `mechanism_references` decision (F3) is load-bearing.** If the owner prefers Option A, the enum
  must be generated from `contract.source.json`, which makes this schema a *generated* artifact and pulls
  it into the generation pipeline. That is a much larger change. Get the decision recorded.
- **Schema conformance cannot prove the decision is sound.** #99 says so; keep saying it.

## What this does not authorize

Implementing enforcement, wiring CI, auto-approving assessments, or making any browser-evidence or
delivery decision.

## What this plan did not verify

Anything about #98's design, because it does not exist yet. Every "settle in #98" item above is a real
dependency, not a formality.
