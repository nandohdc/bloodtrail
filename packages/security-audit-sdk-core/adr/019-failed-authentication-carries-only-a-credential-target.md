# ADR-SDK-019: A failed authentication carries only a credential target

- Status: Accepted for SDK-core implementation
- Date: 2026-10-22
- Issue: https://github.com/nandohdc/bloodtrail/issues/862
- Owning change: `align-sdk-core-with-catalog-rules` (#861, #862)
- Decision source: owner decision, 2026-10-22, via AskUserQuestion and grilling in Claude Code session https://claude.ai/code/session_012Y6oT9KjPZ1BMvT63hU3ay, revised to a type rule in https://github.com/nandohdc/bloodtrail/issues/862#issuecomment-6352407345

## Context

The catalog's resource rule for `bloodtrail.audit.authentication.failed` is "credential type only when safe".
Stage P run 3 (P-attr, system ADR 0014) recorded that the SDK accepted failed authentications naming an account
as their target. The shapes recorded were:
- an account `subject` (AF-C4, AF-C5);
- a typeless `subject` holding only a display name (AF-C3s);
- a credential plus an account `subject` (AF-C6s);
- an account-typed `resource` (AF-CR).

Each is a **target-bearing field** naming something other than the credential. It records which account a failed
login aimed at, which the fraud-evidence profile forbids on contract 2.1.0.

**Two facts set the rule's shape:**
- The contract's approved positive example for this event carries:
  - a `subject` of type `credential`;
  - `credential.reference` and `credential.key_id`;
  - a credential `resource.id`.

  So the rule must judge the target's type, not the presence of a field.
- When no resource is supplied, `withDerivedOperationType` in `src/events.ts` derives
  `{ operation_type: "execute" }`, with no type. So a typeless resource is the SDK's own honest default.

## Decision

`validateCredentialOnlyTarget` in `src/validation/semantic.ts` runs as the very last check of
`validateBaseSemantics`, after `validateOutcomeConsistency`. For the `authentication_failed` semantic it refuses:

| Shape | Exact code / category / path |
|---|---|
| a `subject` typed other than `credential`, or with an `id` or a `tenant_id` but no `type` | `SDK_SEMANTIC_VALIDATION_FAILED` / `validation` / `/subject/type` |
| a `subject` that carries a `display_name`, typed or not | `SDK_SEMANTIC_VALIDATION_FAILED` / `validation` / `/subject/display_name` |
| a `resource` whose `type` is present and not `credential` | `SDK_SEMANTIC_VALIDATION_FAILED` / `validation` / `/resource/type` |
| a `resource` with no `type` that carries an `id` | `SDK_SEMANTIC_VALIDATION_FAILED` / `validation` / `/resource/type` |
| a `resource` that names a parent (`parent_type`, then `parent_id`), such as a credential naming its account | `SDK_SEMANTIC_VALIDATION_FAILED` / `validation` / `/resource/parent_type` or `/resource/parent_id` |
| an `authorization.resource_context` typed other than `credential`, or with an `id` but no `type` | `SDK_SEMANTIC_VALIDATION_FAILED` / `validation` / `/authorization/resource_context/type` |

**How the rows are applied.** The checks run in the table's order, and the first match is reported. An empty `subject`, and a `resource` or resource context with no type and no identity, name no target and stay valid; that includes the resource the SDK derives. A credential's display name is refused as well: on a failed authentication it cannot be told apart from a display name derived from the presented identifier, so omit it. The subject is judged as the event's target under the same resource rule, so any `subject` type other than `credential` is refused, a session or a tenant included: the rule admits only the credential.

**Inherited context.** A `subject` or `resource` inherited from configured `authoritativeContext` or an active `runWithContext` scope counts like call input. A credential `subject` or `resource` in the call input overrides it; an inherited value cannot be cleared per call. So an SDK instance that emits failed authentications should not configure a non-credential `subject` or `resource` in `authoritativeContext`. Set them per scope or per call instead.

**Stored events.** A stored failed authentication that carries a refused target cannot be redelivered, because `redeliver()` gives it no exemption and a changed copy would conflict with the original identity. Emit it again as a new occurrence through `authenticationFailed`, without the target.

**TypeScript.** It does not reject these shapes, because `authoritativeSubject` and `authoritativeResource` accept every type. The refusal is at runtime.

**Where it applies.** Named methods, `emit()`, `redeliver()` and free `validateSecurityAuditEvent()` share the
rule. Refused events never reach the sink, and old events get no `redeliver()` exemption.

**What it does not judge:**
- every other event;
- every actor field (AF-C1, C3, C8, X2 and X4);
- `credential.*`;
- a credential-typed resource with an identity.

**Why it runs last.** Every earlier contract and SDK diagnostic keeps precedence, and no approved fixture's first
code changes.

## Alternatives and consequences

- **Refusing by field presence** (`subject`, `credential.reference`, `credential.key_id`, `resource.id`,
  `resource.parent_id`) was the first decision. It would refuse the contract's own approved example, so the
  owner revised it to this type rule.
- **Documenting only** was rejected: it left account targets accepted on every path.
- **A separate module** was rejected because a new SDK source file must be listed in `verification-lifecycle.json`,
  a governance record that also binds the CB-018 candidate. The rule is twenty lines, and #812 placed its
  SDK-only rule in the same file.

This is a non-breaking `fix(sdk-core)`, with `MIGRATION.md` guidance and no release or version change. It adds no
public type, export or error code. A producer that put the targeted account on a failed authentication must drop
it. The contract offers no honest carrier for a failed login's target on 2.1.0; the separate contract minor
version tracked in #863 is that carrier.

## Evidence strategy

`tests/failed-authentication-target.test.ts` proves every refused shape on all four paths, with zero sink calls.
It also proves that:
- the approved example, the derived resource and an untyped resource without an identity are accepted;
- an earlier diagnostic keeps precedence;
- another event's account subject is untouched.

**Verification-only checks**, with no committed mutants:
- the differential against `main`'s `semantic.ts`;
- boundary mutants (ignoring `parent_id`, allowing a typeless subject).

Observed results belong to the owning change's `tasks.md` and `assessment.json`.

## Non-goals and trust limits

**Not covered:**
- other event families and actor fields;
- tenant rules (ADR-SDK-018);
- the frozen contract `2.1.0` and the collector's structural admission.

**Trust limits.** The SDK cannot establish where a value came from (Stage P's P-D). A keyed `credential.reference`
built from a presented identifier (AF-C6) is structurally the approved example, and stays accepted. Acceptance is
not conformance: the fraud-evidence profile and host conformance remain the controls.
