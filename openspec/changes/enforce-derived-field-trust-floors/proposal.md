## Why

Contract `1.1.0` lets a derived risk result list its material inputs, and nothing checks the list
against the trust it claims. A risk model can declare `derived_server` while its only material
input is `request.user_agent`, a `client_claim`, and every validator accepts it. Worse, a producer
can omit `derived_from` entirely and keep the same claim, so the optional provenance #95 introduced
gives a consumer nothing to rely on. The ratified `derived-field-trust-semantics` capability already
settles what enforcement must mean: maximum output trust is the lesser of the least trusted material
input in the closure and the transformation's own authority. #96 is that enforcement.

The same capability records that making provenance mandatory and enforcing the floor is the
**breaking major** step: `1.1.0` → `2.0.0`, with an SDK compatibility-major step for each private
candidate (`0.2.0` → `0.3.0`) under the exact-one version policy.

## Authorization

On 2026-09-10 the owner instructed, in an interactive session: *"I want you to keep going and
implement ONLY the issues between #96 to #132 … you full authorization to implement them"* and *"I
dont have time to make decisions, you must do for me."* That instruction names #96, which the
previous execution-order review listed as needing its own owner call because it is the breaking
step. It is the authorization for this change. **Every choice below was delegated to Claude** and
carries `decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner
decision"`. It is not an exact-commit owner authorization, and no human has reviewed it. It
authorizes no publication, deployment, or real-user data.

## What Changes

- **BREAKING:** advance the canonical contract `1.1.0` → `2.0.0`. Any event that carries `risk`
  SHALL carry both `risk.model.provenance.trust_level` and `risk.model.provenance.derived_from`;
  omitting either is rejected as `DERIVED_FROM_MISSING`.
- **Enforce the trust floor.** An input's trust is the contract's own declaration for it — the
  field-policy trust of a canonical path, the namespace trust of a registered extension. A declared
  trust more trusted than the least trusted input is rejected as `DERIVED_FROM_TRUST_FLOOR_EXCEEDED`,
  and the diagnostic points at the input that set the floor, by position, never by echoing it.
- **Enforce the transformation ceiling.** The producer derives under server authority, so a risk
  model may declare `derived_server` or any less trusted level, never `authoritative_server`,
  `verified_assertion`, or `observed_transport`; those keep the existing `DERIVED_FROM_NON_DERIVED`
  outcome. A model whose floor is `client_claim` now has a truthful way to say so, with its inputs
  listed, instead of being forced into a claim it cannot support.
- **Close the closure.** The risk model is the only derivation the contract carries provenance for,
  so an input under `risk` is the model's own output and is rejected as a cycle; every other input
  contributes its declared trust directly. That makes the transitive-closure rule complete for this
  contract rather than approximate.
- **BREAKING for exact-version consumers:** move `@bloodtrail/security-audit-sdk-core` and
  `@bloodtrail/security-audit-sdk-node` `0.2.0` → `0.3.0`, bind both to exact `2.0.0`, and advance
  every pin in the documented version-move inventory. The collector's generated supported set becomes
  `["2.0.0"]`.
- **One implementation per validator.** The SDK's semantic kernel is the single runtime
  implementation every construction path reaches; the contract's own validator applies the same
  rule to its fixtures, both driven by the generated provenance block.
- Rebind the contract immutability and changed-path governance to this candidate, and move the
  Contract Reuse Assessment pin after the version lands, as #95's chain established.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-event-contract`: the optional provenance requirement and the `1.1.0`
  compatibility requirement are removed and replaced by a mandatory, floor-enforced representation
  and a requirement covering both version moves.
- `derived-field-trust-semantics`: gains the requirement that records how this change re-opened and
  resolved the decision for enforcement, as its revisit conditions require.
- `security-audit-sdk-core` and `security-audit-sdk-node`: their candidate-alignment requirements are
  restated without version literals, so the next governed move does not have to rewrite them.

## Impact

- `contracts/security-audit/` — authored source, generator, validator, tests, and every generated
  artifact.
- `packages/security-audit-sdk-core/` — generated projection, semantic kernel, tests, candidate
  identity, compatibility, provenance, lifecycle, and gate pins.
- `packages/security-audit-sdk-node/` and `packages/security-audit-collector/` — candidate identity,
  compatibility, fixtures, and generated projections.
- `openspec/scripts/contract-reuse/`, `openspec/governance/schemas/contract-reuse.schema.json`, and
  `openspec/tests/contract-reuse/` — the CRA pin, in the fold after the version lands.
- Current-tense version statements the currency gate names, including `CLAUDE.md`.

## Assurance limitations

The floor proves consistency with declared inputs and cannot prove an undeclared input was not
used. Fields derived outside any provenance carrier (`session.age_seconds`,
`authentication.delegated`, `authentication.impersonated`) contribute their declared field-policy
trust; the closure cannot see through them. Downstream enrichment carries no `derived_from` and is
out of scope.
