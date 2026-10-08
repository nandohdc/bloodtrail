## Context

The `authentication.failed` contract permits an anonymous actor, and its tenant rule allows a tenantless or resolved tenant. Its purpose is to record failed authentication without account enumeration. The current quickstart instead gives a caller who never authenticated an authoritative human identity and a resolved tenant. An evaluator who removes that invented identity can compile a claimed username or omit the tenant, but discovers the authority or tenant failure only at runtime.

## Goals / Non-Goals

**Goals:**

- Make the failed-login quickstart call emit the contract-defined anonymous, tenantless event.
- Explain that a submitted username is a claim and that only a server-resolved tenant may replace the tenantless scope.
- Preserve the existing quickstart structure, per-request context-scope half, and kit-gate behavior.

**Non-Goals:**

- Changing package source, public API, constructors, authority brands, validation rules, the contract, a capability requirement, or the kit gate.
- Recording a tenant a client typed, modifying the evaluation-service example, or changing any other quickstart block.
- Adding a document-reference exception, control, or gate check.

## Decisions

### Use the anonymous actor with the tenantless scope for the failed-login call

The failed-login call uses `anonymousActor()` with no source argument and `authoritativeTenant({ scope: "tenantless" })`. This produces the contract example without naming a targeted account. The existing `authenticatedHumanActor` import remains for the separate per-request context-scope half of the block.

### State the authority boundary in the section opening

The opening paragraph adds the settled sentence immediately after its first sentence. It says that a client-submitted username is a claim that cannot identify the actor, and that a tenantless scope is used unless the server has already resolved the tenant from the login route.

### Preserve the existing kit gate

No gate, control, or reviewed exception changes. The installed-kit gate already runs every quickstart TypeScript block without `declare` and type-checks document blocks across its supported TypeScript versions.

## Rejected

- **Use a claimed actor built from the submitted username.** This fails the no-invented-identity and no-account-enumeration forces: it names the targeted account even though the client proved nothing, and the runtime rejects its claimed human identity with `AUTHORITY_ESCALATION` because a client claim cannot identify an actor.
- **Leave the tenant out.** This fails the contract-event force: the call compiles but is rejected at runtime with `MISSING_TENANT_CONTEXT`, so a copied call emits no event at all, while the contract explicitly permits the tenantless scope for this event.
- **Add a kit-gate check for the example.** This fails the bounded-correction force: #765 rules out a new check, and the existing gate already runs and type-checks every quickstart block.

## Risks / Trade-offs

The correction makes the distinction between an anonymous actor and a client claim explicit in one additional sentence. It deliberately does not demonstrate a client-supplied tenant because such a value is not server authority. The unchanged gate continues to exercise the full block, so this documentation correction adds no test machinery.

## Migration Plan

Merge the documentation correction. Evaluators copy the revised failed-login call, which emits the existing contract-defined event without inventing an authenticated principal. No package, contract, API, or capability migration is needed.
