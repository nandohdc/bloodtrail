## ADDED Requirements

### Requirement: Authority-brand scope and Core uniqueness are explicit

Authority brands SHALL be recognized only by the registry private to the resolved `context.ts` module copy that minted them. A TypeScript cast, a structurally equivalent plain object, a copied object, or ambient process state SHALL NOT add a value to that registry. Values branded through the same module copy SHALL remain acceptable across SDK instances; instance identity SHALL NOT become an authority discriminator.

A value branded by a different module copy SHALL fail closed and SHALL NOT be accepted as authority. The distinct duplicate-Core diagnostic for that cross-copy category is owned by separately governed issue #79; this requirement neither authorizes a global registry nor permits a foreign value while that diagnostic work remains pending.

Every supported consumer graph produced by the future Core split SHALL resolve Core to exactly one module instance. The Node binding SHALL depend on and re-export Core rather than duplicating `context.ts`. A deliberately duplicated-Core fixture SHALL fail closed, and the identical harness without duplicate Core resolution SHALL pass. The dependency controls for that split SHALL allow only the declared first-party Core runtime dependency and SHALL continue to reject every third-party runtime dependency.

#### Scenario: A cast or plain object attempts authority
- **WHEN** caller code supplies a TypeScript-cast value or hand-written plain object that claims a branded authority type
- **THEN** the value is absent from the module-copy registry, construction fails before sink handoff, and no authority is granted

#### Scenario: Same-copy SDK instances exchange a branded value
- **WHEN** one SDK instance and another SDK instance resolve the same `context.ts` module copy and the first supplies a legitimately branded value to the second
- **THEN** the second instance accepts the value without requiring instance-bound branding or a process-global registry

#### Scenario: Different module copies exchange a branded value
- **WHEN** a legitimately branded value from one resolved `context.ts` module copy is supplied to a second module copy
- **THEN** the second copy fails closed and does not accept the foreign value; #79 remains responsible for its distinct bounded duplicate-Core diagnostic

#### Scenario: Supported Core graph has one resolved instance
- **WHEN** a supported consumer graph loads the Node binding and its declared Core dependency
- **THEN** the binding re-exports the one resolved Core `context.ts` module copy and the graph contains one Core module instance

#### Scenario: Duplicate-Core control is exercised
- **WHEN** the #86 fixture deliberately resolves two Core module instances
- **THEN** the duplicate arm fails closed with bounded deduplication remediation while the otherwise identical non-duplicate null-control arm passes

#### Scenario: Runtime dependency allowance is challenged
- **WHEN** the #86 dependency controls inspect a Core-split package graph containing its declared first-party Core dependency and then a third-party runtime dependency mutation
- **THEN** the first-party dependency is accepted only through its exact allowlist entry and the third-party mutation is rejected by both dependency verification and the `lock-runtime-dependencies` coherence rule
