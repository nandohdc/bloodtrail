# Design Pattern Assessment — <change-id>

Copy this into the change's `design.md` under a `## Design Pattern Assessment` heading, or into a
standalone `assessment.md` in the change directory. The JSON block is the machine-readable evidence
the checker reads; the prose sections are what a reviewer reads. They must agree.

A full assessment compares **direct implementation** with **at least one materially plausible
alternative**. Naming a catalog pattern is never required. Listing patterns that do not match the
forces you identified does not satisfy the comparison, and "best practice" is not a reason.

## Governance metadata

```json
{
  "schema_version": "1.1",
  "change_id": "<change-id>",
  "assessment_level": "full",
  "decision": "direct_implementation",
  "forces": [
    "<the architectural force this design must answer, stated concretely>"
  ],
  "applicability": {
    "triggers_matched": [],
    "material_capability_modification": false,
    "capabilities": ["<capability-this-change-owns>"]
  },
  "candidate_approaches": [
    {
      "id": "approach-direct-<name>",
      "kind": "direct_implementation",
      "summary": "<what building this directly looks like>",
      "forces_addressed": ["<force from the list above>"]
    },
    {
      "id": "approach-<alternative>",
      "kind": "alternative",
      "summary": "<the plausible alternative, matched to the same forces>",
      "forces_addressed": ["<force from the list above>"],
      "catalog_pattern_id": "pattern-<name>"
    }
  ],
  "selected_approach_id": "approach-direct-<name>",
  "rejected_alternative_ids": ["approach-<alternative>"],
  "rejection_reasons": {
    "approach-<alternative>": {
      "forces": ["<force>"],
      "reason": "<why this approach does not answer that force better than the selection; at least forty characters, and about forces rather than popularity>"
    }
  },
  "selected_pattern_ids": [],
  "implementation_invariant_ids": ["implementation-<name>"],
  "invariant_evidence": {
    "implementation-<name>": {
      "task_ids": ["<n.n>"],
      "evidence_ids": ["<test name or fixture id>"]
    }
  },
  "security_sensitive": true,
  "ordering": {
    "proposal_baseline_commit": "<40-hex>"
  },
  "verification_task_ids": ["<n.n>"]
}
```

For a `named_pattern` decision, replace the decision, keep a rejected `direct_implementation`
candidate, populate `selected_pattern_ids`, and add:

```json
  "catalog_binding": {
    "catalog_version": "1.0.0",
    "pattern_id": "pattern-<name>",
    "required_invariant_ids": ["pattern-<name>-<invariant>"],
    "conditional_invariant_ids": [],
    "non_applicable_invariants": []
  }
```

When `security_sensitive` is `false`, add `security_justification` with an entry for every applicable
dimension. A positive declaration needs no justification and always overrides a benign path class.

## Problem

<What has to be true that is not true now.>

## Architectural forces

<The forces, stated so that an alternative can be judged against them. A force is something that
pushes the design — a correctness requirement, an ownership boundary, a concurrency hazard, a
lifecycle constraint — not a preference.>

## Constraints

<What the design may not do.>

## Candidate approaches

- **`approach-direct-<name>`:** <what direct implementation looks like here>
- **`approach-<alternative>`:** <the alternative>

## Selected approach

<Which, and why it answers the forces.>

## Rejected alternatives

- **`approach-<alternative>`:** <force-based reason>

## Simplicity check

<What this design does not introduce.>

## Security and correctness implications

<Which of the fifteen security dimensions apply, and what follows.>

## Pattern invariants

<For a named pattern: the catalog invariants and how each is met. For direct implementation:
implementation-specific invariants, which do not claim catalog conformance.>

## Verification strategy

<Positive controls plus one-relation mutations. Each mutation asserts a specific diagnostic.>

## Re-evaluation triggers

<What would make you revisit this.>
