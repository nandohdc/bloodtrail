# Design: align the SDK core with the catalog's tenant and failed-authentication rules

Decision source: owner decision, 2026-10-22, via AskUserQuestion and grilling in Claude Code session
https://claude.ai/code/session_012Y6oT9KjPZ1BMvT63hU3ay. The owner accepted every recommended option, then revised
#862's rule to a type rule (https://github.com/nandohdc/bloodtrail/issues/862#issuecomment-6352407345).

## Design Pattern Assessment

The full machine-readable assessment is `assessment.json`. This is a direct implementation, not catalog-pattern
conformance. A full assessment is required because the change adds a security-sensitive validation rule and a
canonical capability requirement.

## Context and forces

- **The SDK refuses only what the catalog forbids.** The approved contract example must stay valid, and an
  honest failed authentication must not be refused.
- **Every validation path behaves the same.** Named methods, `emit()`, `redeliver()` and free
  `validateSecurityAuditEvent()` refuse the same events, before any sink handoff.
- **Preserved:**
  - earlier diagnostics;
  - the public surface;
  - the frozen contract and collector admission;
  - the verification lifecycle record.

**What the facts constrain:**
- The approved positive example for `authentication.failed` carries `subject` `{type: "credential"}`,
  `credential.reference`, `credential.key_id` and a credential `resource.id`.
- When the caller supplies no resource, `withDerivedOperationType` in `src/events.ts` derives
  `{ operation_type: "execute" }` for this event, with no type.
- P-attr's account carriers all name an account type, or carry a subject with no type. The keyed
  `credential.reference` carrier (AF-C6) is byte-for-byte the shape of the approved example.

So a field-presence rule would refuse the contract's own example. A rule that refused every typeless resource
would refuse the SDK's own default.

## Selection and alternatives

Select `approach-type-rule`. One module-scope table and one function in `src/validation/semantic.ts` judge the
target's type on `authentication_failed`, called as the very last semantic check.

Reject:
- **`approach-field-presence`**, which refuses `subject`, `credential.reference`, `credential.key_id`,
  `resource.id` and `resource.parent_id`. It refuses the approved example, so the SDK would contradict the
  contract it projects. This was the owner's first decision, revised once the example was read.
- **`approach-document-only`.** The owner chose enforcement. Documentation alone leaves AF-C4, C5, C3s, C6s and
  AF-CR's account half accepted.
- **`approach-separate-module`**, a new `src/validation/resource-rules.ts`. A new SDK source file must be listed
  in `verification-lifecycle.json`, a governance record that also binds the CB-018 candidate. The rule is about
  twenty lines, and #812 placed its comparable SDK-only rule in `semantic.ts`.

## Placement and invariants

### `implementation-credential-only-target`

`validateBaseSemantics` calls `validateCredentialOnlyTarget(event, definition)` after
`validateOutcomeConsistency`. For `definition.semantic === "authentication_failed"`, a module-scope table is checked in order, and the first
match returns `failure("SDK_SEMANTIC_VALIDATION_FAILED", "validation", <pointer>)`:
- **Subject type.** A `subject` whose `type` is present and not `credential`, or which has no `type` but carries an
  `id` or a `tenant_id`, at `/subject/type`.
- **Subject display name.** A `subject` with a `display_name`, at `/subject/display_name`.
- **Resource type.** A `resource` whose `type` is present and not `credential`, or which has no `type` but carries
  an `id`, at `/resource/type`.
- **Resource parent.** A `resource` with a `parent_type`, then a `parent_id`, at `/resource/parent_type` or
  `/resource/parent_id`.
- **Authorization resource context.** An `authorization.resource_context` whose `type` is present and not
  `credential`, or which has no `type` but carries an `id`, at `/authorization/resource_context/type`.

Every other event, and every other field, passes untouched.

### `implementation-shared-paths-no-exemption`

The check sits in the shared semantic layer that every entry point reaches, so all four paths refuse
identically with zero sink calls. `redeliver()` gives old events no exemption.

### `implementation-preserved-boundaries`

**Preserved:**
- **Precedence.** Running last keeps every earlier diagnostic. A failed authentication that also fails an earlier
  check returns that check's error.
- **Fixtures.** The approved positive examples, including `authentication.failed`, and every approved negative
  fixture's first code are unchanged.
- **What is not judged.** Actor fields (AF-C1, C3, C8, X2, X4), `credential.*`, and credential-typed resources
  with identities (AF-C6, AF-CR's credential half).
- **Surface.** No new export, error code or source file.

### `implementation-tenant-policy-recorded`

#861 changes no code. ADR-SDK-018 records three things:
- the existing refusal (`validateTenantResourceConsistency`, `/tenant/claimed_tenant_id`) is SDK policy under the
  contract's "if policy permits";
- the canonical sdk-core scenario already requires it;
- the host path is to drop the claim and carry it on `tenant.context_violation.detected`.

`tests/pass2.test.ts` already proves both halves. The test "claimed tenant conflicting with authoritative scope
is rejected outside the violation event" covers the refusal, and "the dedicated violation event preserves
claimed and authoritative tenants distinctly" covers the host path.

## Review-driven refinements

`/code-review high` reviewed the first candidate, which AGY had accepted. These changes followed the review, all
within the owner's type decision, which named AF-C3s and AF-CR's account half as refused:

- **Display names and parents.** A credential-typed `subject` could still carry an account display name
  (AF-C3s with a type added), and a credential `resource` could name its account through
  `parent_type`/`parent_id`. The rule now refuses a subject `display_name` (`/subject/display_name`) and
  any resource parent (`/resource/parent_type`, then `/resource/parent_id`). The approved example carries
  neither.
- **Inherited context is documented and tested.** A `subject` or `resource` from `authoritativeContext` or
  `runWithContext` is judged like call input, and a credential value in the call input overrides it.
- **A real precedence test.** It uses a missing required context, which is judged inside the shared semantic
  checks. A mutant that moves the rule ahead of them fails it.
- **A pin on the catalog text.** A test pins the catalog's `resource_rule` text, which the generator does not
  carry, so a contract change sends the rule back to ADR-SDK-019.
- **A direct guard.** It replaces a one-member semantic set.

A second `/code-review high` round led to three more changes:
- A `subject` with no type and no identity (`{}`, `{tenant_id}`) names no target, so it is no longer refused. AF-C3s, a typeless display-only subject, stays refused through `/subject/display_name`.
- Precedence tests now cover delegation, near the end of the shared semantic checks, and derived-field provenance, after them.
- ADR-SDK-018 addresses the catalog's own `tenant_rule`.

A third round closed two sibling carriers:
- `authorization.resource_context`, which is server-authoritative, is now judged like `resource`.
- A typeless `subject` that names the target's tenant is refused. Only an empty subject names no target.

It also added documentation and tests for configured and inherited context, and for named redelivery, plus the advice not to configure a non-credential subject or resource on an instance that emits failed authentications. It added the stored-event remediation too: emit a new occurrence without the target.

Kept as decided: a credential display name is still refused, because on a failed login it cannot be told apart from a presented-identifier digest.

Not adopted:
- Deriving the policy from `FIELD_POLICY` authorities.
- Moving the shared test helpers into `conformance-harness.ts`.

Both are broader refactors than this change.

Kept as decided: every non-credential `subject` type is refused, not only `account`. The rule admits only the
credential, and ADR-SDK-019 says so.

## Verification and task mapping

- **1.1–1.2:** the artifacts, assessment-phase governance and strict validation, before the proposal commit.
- **2.1:** ADR-SDK-018 and the tenant guidance, with the coherence ADR pins moved to 018.
- **3.1–3.2:** the rule in `semantic.ts`, then typecheck, build and the existing runtime tests.
- **4.1:** new top-level `tests/failed-authentication-target.test.ts`:
  - every refused shape on all four paths, with sink counts;
  - the approved example and the derived resource accepted;
  - precedence;
  - other events unaffected;
  - no `redeliver()` exemption.

  The differential runs the same tests against `main`'s `semantic.ts`. A removed-rule mutation runs during
  verification only and is not committed.
- **5.1:**
  - ADR-SDK-019, coherence pins to 019, the MIGRATION entry, and API, SECURITY and glossary text;
  - the Node error-catalog cause.
- **6.1:** the full verification chain, including sdk-core `npm run validate` (with `test:verification`) and the
  CodeScene delta.

## Delivery and boundaries

- **Baseline:** `7fbddd565629f2cff69045f8487d5ee50484501c` (`main`).
- **Commits:** proposal, #861 record, #862 rule, #862 tests, #862 documentation, evidence. Each carries
  `Refs #861` and/or `Refs #862`.
- **Owned paths:** only those listed in `assessment.json`. No contract, generated, collector, Node source,
  verification-lifecycle, CI or governance-core edits. The canonical spec changes only in the separate fold PR.

## Non-goals

- No tenant-claim retention, contract change or contract follow-up issue (#861 decision).
- No rule for other event families or actor fields. No claim to establish the provenance of a value (P-D).
