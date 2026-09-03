## MODIFIED Requirements

### Requirement: Authority-brand scope and Core uniqueness are explicit

Authority brands SHALL be recognized only by the registry private to the resolved `context.ts` module copy that minted them. A TypeScript cast, a structurally equivalent plain object, a copied object, or ambient process state SHALL NOT add a value to that registry. Values branded through the same module copy SHALL remain acceptable across SDK instances; instance identity SHALL NOT become an authority discriminator.

A value branded by a different module copy SHALL fail closed and SHALL NOT be accepted as authority. When a diagnostic-only sibling probe observes that the value is branded by another installed module copy, the rejection SHALL carry the distinct bounded duplicate-Core diagnostic `DUPLICATE_AUTHORITY`; otherwise the rejection SHALL carry `AUTHORITY_ESCALATION`. A forged, cast, or cloned value SHALL continue to fail closed with `AUTHORITY_ESCALATION`, never `DUPLICATE_AUTHORITY`. The diagnostic changes only the operator-facing wording: the foreign value is rejected either way, and no global registry, brand sharing, or foreign-authority acceptance SHALL be introduced by it.

Every supported consumer graph produced by the future Core split SHALL resolve Core to exactly one module instance. The Node binding SHALL depend on and re-export Core rather than duplicating `context.ts`. A deliberately duplicated-Core fixture SHALL fail closed, and the identical harness without duplicate Core resolution SHALL pass. The dependency controls for that split SHALL allow only the declared first-party Core runtime dependency and SHALL continue to reject every third-party runtime dependency.

#### Scenario: A cast or plain object attempts authority
- **WHEN** caller code supplies a TypeScript-cast value or hand-written plain object that claims a branded authority type
- **THEN** the value is absent from the module-copy registry, construction fails before sink handoff, and no authority is granted

#### Scenario: Same-copy SDK instances exchange a branded value
- **WHEN** one SDK instance and another SDK instance resolve the same `context.ts` module copy and the first supplies a legitimately branded value to the second
- **THEN** the second instance accepts the value without requiring instance-bound branding or a process-global registry

#### Scenario: Different module copies exchange a branded value
- **WHEN** a legitimately branded value from one resolved `context.ts` module copy is supplied to a second module copy
- **THEN** the second copy fails closed and does not accept the foreign value; the rejection carries the distinct bounded duplicate-Core diagnostic `DUPLICATE_AUTHORITY` when the probe observes the value in another installed copy's registry and `AUTHORITY_ESCALATION` otherwise; either way no authority is granted and no global registry exists

#### Scenario: Supported Core graph has one resolved instance
- **WHEN** a supported consumer graph loads the Node binding and its declared Core dependency
- **THEN** the binding re-exports the one resolved Core `context.ts` module copy and the graph contains one Core module instance

#### Scenario: Duplicate-Core control is exercised
- **WHEN** the #86 fixture deliberately resolves two Core module instances
- **THEN** the duplicate arm fails closed with bounded deduplication remediation while the otherwise identical non-duplicate null-control arm passes

#### Scenario: Runtime dependency allowance is challenged
- **WHEN** the #86 dependency controls inspect a Core-split package graph containing its declared first-party Core dependency and then a third-party runtime dependency mutation
- **THEN** the first-party dependency is accepted only through its exact allowlist entry and the third-party mutation is rejected by both dependency verification and the `lock-runtime-dependencies` coherence rule

### Requirement: Cross-copy rejection is proven with a genuine second installed copy

The `copy` arm SHALL be exercised with two genuinely, independently installed copies of the SDK package — never one module imported twice through aliased resolution — constructed in an isolated `mkdtemp` fixture so sibling verification snapshots of the live package are unaffected. A value branded by one installed copy and supplied to the other copy SHALL fail closed with `DUPLICATE_AUTHORITY` before sink handoff, and the fixture SHALL assert that the two resolved module copies are distinct before claiming rejection evidence. The same diagnostic SHALL apply to a genuine nested duplicate copy resolved deeper inside one consumer graph: sibling and nested duplication SHALL both reject with `DUPLICATE_AUTHORITY`, because nothing observable at the rejection site distinguishes npm-installed duplication from a second loaded copy, and the security decision never changes.

#### Scenario: Two genuine copies exchange a branded value
- **WHEN** a value branded by one genuinely installed package copy is supplied to a second genuinely installed package copy
- **THEN** the second copy rejects the value with `DUPLICATE_AUTHORITY` before sink handoff

#### Scenario: Fixture cannot be satisfied by one module imported twice
- **WHEN** the two-copy fixture resolves the same module instance for both sides
- **THEN** the fixture fails its distinct-copy assertion instead of recording rejection evidence

#### Scenario: Nested duplicate copy receives the same diagnostic
- **WHEN** a value branded by a genuine nested duplicate installed copy is supplied to the consumer-graph copy
- **THEN** the consumer-graph copy rejects the value with `DUPLICATE_AUTHORITY` before sink handoff, and the fixture asserts the two nested copies are distinct before claiming rejection evidence

## ADDED Requirements

### Requirement: Duplicate-copy diagnostic is bounded, diagnostic-only, and remediates

On a brand miss — a supplied value the local module copy's registry does not recognize — the SDK SHALL distinguish a duplicate installed copy from a forged value using a diagnostic-only sibling probe. Each resolved copy SHALL register a boolean predicate in an append-only array under `Symbol.for("bloodtrail.security-audit-sdk-core.copy-probe.v1")` on `globalThis`; the local copy SHALL ask only sibling predicates (skipping itself by registration-object identity), SHALL wrap each call in try/catch and coerce every result to boolean, and SHALL select `DUPLICATE_AUTHORITY` when any sibling answers true and `AUTHORITY_ESCALATION` otherwise. The probe SHALL be boolean-only: it SHALL never share registry membership, brands, values, or authority, and a foreign predicate's answer SHALL never grant acceptance — the value is rejected either way. All brand-miss rejection sites SHALL route through one shared decision path, and the `DUPLICATE_AUTHORITY` rejection SHALL keep the bounded shape — code, category, and bounded path only, never caller data — serialized under 512 bytes.

The thrown `SecurityAuditSdkError` for `DUPLICATE_AUTHORITY` SHALL carry the static message "Core resolves to exactly one module instance in any supported consumer graph. A duplicate installed copy branded this value: deduplicate the @bloodtrail/security-audit-sdk-core dependency so a single copy resolves before continuing." `toJSON()` SHALL continue to expose only code, category, and path, and no error class SHALL gain new fields.

#### Scenario: Genuine duplicate copy receives the dedicated diagnostic
- **WHEN** a value branded by another installed copy — a sibling two-copy install or a nested duplicate — is supplied to the local copy and a sibling predicate answers true
- **THEN** the local copy rejects with `DUPLICATE_AUTHORITY`, category "authority", the bounded path, and no caller data, and the serialized error stays under 512 bytes

#### Scenario: Forged, cast, and cloned values keep the escalation diagnostic
- **WHEN** a TypeScript-cast, plain object, or `structuredClone`d value that no sibling registry recognizes is supplied
- **THEN** the local copy rejects with `AUTHORITY_ESCALATION` and emits no `DUPLICATE_AUTHORITY`

#### Scenario: The probe channel cannot become registry sharing or a crash surface
- **WHEN** a foreign predicate throws, returns a non-boolean, or a hostile in-process sibling predicate answers true
- **THEN** the site coerces the answer to boolean and never crashes, the value is still rejected, and no registry membership, brand, value, or authority crosses copies

#### Scenario: The duplicate diagnostic names the invariant and the remediation
- **WHEN** the `DUPLICATE_AUTHORITY` error is serialized
- **THEN** its message names the single-copy invariant — "Core resolves to exactly one module instance in any supported consumer graph" — and the deduplication remediation, and nothing else is added to the error surface
