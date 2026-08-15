# Design Pattern Governance

This document states the design-pattern governance perimeter for **every contributor and every
tool**. It applies identically to a human typing in an editor, to Hermes, to Claude Code, to any
other agent, to a direct commit, to a pull request, and to a script. There is no actor for whom a
different rule holds.

## What is authoritative

| Authoritative | Not authoritative |
| --- | --- |
| The canonical `software-design-pattern-governance` capability | `AGENTS.md` |
| `openspec/governance/design-pattern-policy.json` | `CLAUDE.md` |
| `openspec/scripts/check-design-pattern-governance.mjs` (trusted baseline) | `.hermes.md` |
| The candidate checker, where a governance-core change is involved | Generated instructions under `.hermes/skills/`, `.claude/commands/opsx/`, `.claude/skills/`, `.agents/skills/` |
| The required `design-pattern-governance` CI check | Any agent's convenience check |

This document, `CONTRIBUTING.md`, and `.github/PULL_REQUEST_TEMPLATE.md` describe the same policy in
prose so that it reaches people who never read the checker. Where prose and the canonical policy
disagree, the canonical policy and the required CI check control, and the disagreement is itself a
failure to fix.

Hermes and other agents are **convenience and early feedback only**. Running an agent's check is not
a substitute for the required CI check, and bypassing an agent does not bypass governance.

## When governance applies

A change is a **Full-assessment change** if it matches any of these triggers:

`public_api` · `integration` · `lifecycle_or_state` · `concurrency` · `persistence` ·
`security_sensitive_behavior` · `governance_core_path` · `canonical_capability_requirement`

A change is **Abbreviated-eligible** only if it is one bounded correction, introduces no abstraction,
adds no module, class, or interface, changes no public API, and proves that no full trigger applies.

A **Material capability modification** adds, modifies, or removes a normative capability requirement,
or modifies a capability-owned governed implementation path while matching a full trigger.

Those three terms are the entire applicability vocabulary. Undefined labels — "non-trivial",
"materially new", "materially modifies", "significant" — do not determine enforcement and are
rejected in normative evidence.

### The perimeter is behavioural, not declared

Classification reads what the change does, not what it is called. In particular:

- A change touching a governed implementation path must be associated with an OpenSpec change that
  **owns the modified capability**. An unrelated change does not satisfy the association.
- Implementation hidden in tests, build files, scripts, or configuration is still implementation.
- Splitting one material change across several commits does not lower its classification; the
  material commit range is inspected as a whole.
- A public API change labelled internal-only, or concurrency introduced under a performance-only
  label, is classified by the behaviour, not the label.
- Path classes are **minimum floors**, never ceilings. Behavioural evidence can raise a
  classification; nothing lowers it.
- A path matching no classification is `unclassified` and **fails closed**.

## What a full assessment must contain

A full assessment compares **direct implementation** with **at least one materially plausible
alternative** matching the forces you identified. That alternative may be composition, an existing
repository abstraction, a language-native mechanism, a named catalog pattern, or a simpler competing
design.

Naming a catalog pattern is **never required**. `direct_implementation` is a first-class decision.
What is required is that:

- every rejection cites **architectural forces** — "best practice", popularity, familiarity, and
  speculative future use are not reasons;
- each candidate's forces are drawn from the forces the assessment actually identified, so listing
  irrelevant patterns as boilerplate fails rather than passes;
- a `direct_implementation` decision has **no** selected pattern IDs, rejects at least one plausible
  alternative, and records implementation-specific invariants that do **not** claim catalog
  conformance;
- a `named_pattern` decision evaluates and rejects direct implementation, and binds the catalog.

### Binding a catalog pattern

Selecting a pattern from `openspec/governance/design-pattern-catalog.md` binds it. The assessment
records the pattern ID, the catalog version, every required invariant ID, the conditional invariant
IDs claimed, any conditional ID declared non-applicable with a force-based reason, the implementation
tasks, and the verification evidence. Every required invariant must be accounted for. A conditional
invariant may be non-applicable only when the catalog declares it conditional, the reason is
force-based, and the signed governance record acknowledges it explicitly.

The catalog is **not exhaustive**. It is the set of patterns whose invariants can be checked
mechanically here, not a list of the only designs permitted.

## Security classification

Fifteen dimensions trigger security-sensitive treatment:

`trust_boundary` · `authority_provenance` · `authentication_or_authorization` · `audit_integrity` ·
`confidentiality` · `mutation_ownership` · `fail_posture` · `error_disclosure` · `concurrency` ·
`lifecycle` · `resource_retention` · `retry_or_redelivery` · `cryptography` ·
`privacy_transformation` · `external_security_integration`

Declaring `security_sensitive: false` requires a justification addressing every applicable dimension.
A declaration of `false` that contradicts the change's own triggers — an authority change, or
introduced concurrency — is rejected. A positive declaration always wins and never needs
justification, including on a benign-classified path.

## Ordering

The assessment must exist **before** the implementation it governs. Concretely, the assessment commit:

- contains a valid approved assessment;
- has no governed implementation-path change relative to the proposal baseline;
- precedes and is an ancestor of the earliest post-baseline commit that modifies a governed
  implementation path;
- is an ancestor of the final reviewed technical commit.

Assessment and implementation in the same commit fails. Adding or amending an assessment after
implementation began fails, and does not backdate approval. Complete Git history is required; a
shallow clone fails closed rather than passing on absent evidence.

A **retrospective exception** is available only for grandfathered or emergency work whose ordering
cannot be reconstructed. It is human-owned, is never inferred by the checker, records owner identity,
reason, affected commits, paths, and residual risk, and states plainly that retrospective assessment
is not equivalent assurance.

## Review, decision, merge, activation, archive

These are distinct states, and evidence for one is never evidence for another.

1. **Technical commit T** — the implementation, verified by the gates.
2. **Signed governance record S** — one record carrying technical review *and* the project-owner
   decision, binding a reviewed content object and naming T. A commit hash alone does not satisfy the
   binding. No reviewed path may contain S.
3. **Merge commit M** — merge commit or fast-forward only. Squash, rebase, amendment, and force-push
   are prohibited, because they replace the reviewed objects the activation record must bind.
4. **Activation record A** — a dedicated commit whose sole parent is exactly M, changing only the
   activation record and allowlisted evidence, and never referencing its own hash. Enforcement begins
   at A.
5. **Archive** — explicitly validated, not assumed from `openspec validate --all --strict`.

Proposal validation is not apply authorization. AI review, pull-request assignment, authorship,
passing gates, and merged state are not owner approval. Publication and deployment stay prohibited
regardless of how many technical checks pass.

## Governance changes govern themselves

A change touching governance-core artifacts — the checker, the policy, the activation record, the
schemas, the catalog, the invariant registry, the actor-neutral documents, repository-managed root
or generated agent instructions, the CI workflow, or the path classifications — requires a full
assessment, security-sensitive analysis, explicit reviewer acknowledgement, **and two checker runs**: the trusted baseline checker
from the merge base or protected mainline, and the candidate checker from the branch. Both results
are recorded separately. A candidate checker is never the sole judge of whether it weakened itself.

## Fail-closed behaviour

After activation, all of the following fail with their own distinct diagnostic, and none of them ever
reads as "no applicable changes", "skip", or success:

absent policy · empty policy · truncated policy · invalid JSON · missing schema version ·
unsupported schema version · unknown newer schema version · activation hash mismatch · missing
activation commit · missing protected-mainline evidence · missing path classifications · removed
protected root · checker/policy incompatibility · unavailable history.

## Grandfathering, opt-in, and emergencies

A change active before activation is grandfathered under one of two classes — `mainline_present` (in
the merge commit's tree) or `external_in_flight` (only on a remote branch). These are alternatives; a
change is never required to be both. Grandfathering covers only the **recorded scope**: new public
API, integration, persistence, lifecycle, concurrency, security boundary, governed capability, or any
path outside the record requires normal full governance.

Opt-in is bound to an exact commit and becomes irrevocable at the first governed implementation
commit. Withdrawal before that point requires explicit project-owner governance evidence; silent
withdrawal is invalid.

An **emergency classification** covers an otherwise unclassified path for one exact change. It binds
the change ID, proposal baseline, affected paths, a conservative path class, a reason, an incident
reference, a mandatory follow-up, and the exact owner-governance commit. It emits a distinct warning
and still requires a full assessment. It cannot downgrade public API, security, concurrency,
persistence, or integration triggers. It ends when that change merges or is abandoned — **never on a
clock**.

## Running the checker

```bash
node openspec/scripts/check-design-pattern-governance.mjs --phase final
node openspec/scripts/run-governance-dual-check.mjs        # governance-core changes
node --test openspec/tests/design-pattern-governance/*.test.mjs
```

The checker is read-only, dependency-free, and deterministic: identical committed bytes, history, and
arguments produce identical classification and diagnostics.
