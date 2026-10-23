# ADR-SDK-018: A conflicting claimed tenant is refused by SDK policy

- Status: Accepted for SDK-core implementation
- Date: 2026-10-22
- Issue: https://github.com/nandohdc/bloodtrail/issues/861
- Owning change: `align-sdk-core-with-catalog-rules` (#861, #862)
- Decision source: owner decision, 2026-10-22, via AskUserQuestion and grilling in Claude Code session https://claude.ai/code/session_012Y6oT9KjPZ1BMvT63hU3ay

## Context

In tenant scope, the SDK refuses an event whose claimed tenant differs from its effective tenant:
- `validateTenantResourceConsistency` in `src/validation/semantic.ts` returns `TENANT_RESOURCE_CONFLICT` /
  `validation` / `/tenant/claimed_tenant_id`;
- the only exception is `bloodtrail.audit.tenant.context_violation.detected`.

Stage P run 3 (P-attr, system ADR 0014) recorded the refusal for seven steps and asked which side is right (#861).

The two specs read differently:
- **The contract** scenario "Client claims a different tenant" says the producer records the value "only as an
  untrusted claim if policy permits", records the authoritative tenant contexts, and "emits or links a
  tenant-context-violation event".
- **The SDK's canonical spec** already requires the refusal. Its scenario "Claimed tenant conflicts with
  authenticated scope" in `openspec/specs/security-audit-sdk-core/spec.md` says the SDK "rejects construction
  with a tenant-context-conflict error, and emits nothing". The same requirement allows caller-supplied tenant
  data "only as a labeled claim when policy permits".

The catalog's own `tenant_rule` reads "tenantless or resolved tenant; claimed tenant remains claim" for
`authentication.failed`, and "claimed tenant remains client claim" for `account.registration.attempted`. Both say a
claim is never promoted to authority.

## Decision

The refusal is the SDK's policy, and it stays.
- The contract leaves retention to policy ("if policy permits"). The SDK's policy does not permit retaining a
  conflicting claim on the original event.
- The contract is unchanged, and no contract follow-up is filed, because the two readings agree under that
  clause.

**The host path:**
1. Drop the conflicting claim from the original event, which the SDK then accepts with its authoritative
   tenant contexts.
2. Carry the claim on `bloodtrail.audit.tenant.context_violation.detected`. That event preserves the claimed and
   authoritative tenants side by side, and never treats the claim as authorization.

That satisfies the contract scenario's other two duties: the authoritative contexts are recorded, and the
violation is emitted.

**No code changes.** Existing tests in `tests/pass2.test.ts` already prove both halves:
- "claimed tenant conflicting with authoritative scope is rejected outside the violation event";
- "the dedicated violation event preserves claimed and authoritative tenants distinctly".

**The catalog rule.**
- A claim that agrees with the effective tenant stays on the event as a claim, so the catalog's "remains claim" holds.
- A claim that conflicts is refused on the original event, and the host carries it on the violation event.
- The trade-off is explicit: a failed authentication or registration attempt with a conflicting claim is recorded only if the host drops the claim and emits again. A host that does not loses that occurrence. This is the owner's decision.

## Alternatives and consequences

Accepting the conflicting claim as untrusted context on the original event would widen what the SDK accepts,
and would contradict the SDK's own canonical scenario. It would also leave every consumer to separate the
untrusted claim from the authoritative tenants on ordinary events. The owner chose to keep the refusal (the #817
/ ADR-SDK-016 precedent of an SDK rule recorded beside an unchanged contract).

Hosts that follow only the contract scenario learn the SDK's policy from this ADR, `SECURITY.md` and `API.md`.

## Non-goals and trust limits

The decision does not cover:
- any change to tenant validation, the contract, the collector, or public types and error codes;
- any claim that a refused event's tenant data was false: the SDK refuses the conflict, not the producer.
