## ADDED Requirements

### Requirement: Authority-scope formalization is regression-guarded and mutation-sensitive

The SDK verification suite SHALL exercise a matrix of authority-scope arms — `same` (one instance, one module copy), `foreign` (two instances, one module copy), `forged` (cast or plain object claiming a brand), `cloned` (`structuredClone` of a branded value), `copy` (two genuine installed copies), `nested` (nested AsyncLocalStorage scopes), `concurrent` (concurrent scopes), `cleanup` (scope exit), and `null` (unmutated package) — with each arm's expected result recorded before any implementation change. Every arm SHALL carry a null control and demonstrable mutation sensitivity: a test arm whose guarded invariant is violated by a fixture mutation SHALL fail, and no arm that could never fail SHALL be retained. The `foreign` arm's expected result is settled, not pending: values branded through the same module copy SHALL remain acceptable across SDK instances, and the arm SHALL still be shown to fail under a cross-copy fixture mutation.

#### Scenario: Forged arm fails when a cast enters the registry
- **WHEN** a fixture mutation makes a TypeScript-cast plain object appear in the module-copy registry
- **THEN** the `forged` arm test fails and the suite reports the arm, and the unmutated `null` arm continues to pass

#### Scenario: Foreign arm is red-able under a cross-copy mutation
- **WHEN** the `foreign` arm fixture is mutated so that two SDK instances resolve different `context.ts` module copies
- **THEN** the arm fails with the cross-copy rejection while the unmutated same-copy two-instance fixture keeps passing

#### Scenario: Every arm has a null control
- **WHEN** the authority-scope matrix runs against the unmutated package
- **THEN** every arm passes, and a mutation of any single arm's guarded invariant fails that arm without changing any other arm's result

### Requirement: Registry insertion surface is enumerated with both constructor and kind counts

When the authority-scope verification enumerates the insertion surface, it SHALL derive the exported brand-constructor count and the `AuditBrandKind` member count from `src/context.ts` itself and SHALL assert **both** counts: exactly 35 exported brand constructors (`export function` declarations in `src/context.ts`, the same counting method as ADR 0010 F3) and exactly 19 `AuditBrandKind` union members. Adding or removing a constructor or a kind without updating the enumeration SHALL fail the suite loudly, and the two counts SHALL NOT be conflated.

#### Scenario: Constructor surface drifts
- **WHEN** an exported function is added to or removed from `src/context.ts` without the enumeration control being updated
- **THEN** the enumeration control fails and names the drifted constructor count

#### Scenario: Brand kind union drifts
- **WHEN** a member is added to or removed from the `AuditBrandKind` union without the enumeration control being updated
- **THEN** the enumeration control fails and names the drifted kind count

#### Scenario: Unmutated source asserts both counts
- **WHEN** the enumeration control runs against the unmutated `src/context.ts`
- **THEN** it asserts exactly 35 exported brand constructors and exactly 19 `AuditBrandKind` members

### Requirement: Cross-copy rejection is proven with a genuine second installed copy

The `copy` arm SHALL be exercised with two genuinely, independently installed copies of the SDK package — never one module imported twice through aliased resolution — constructed in an isolated `mkdtemp` fixture so sibling verification snapshots of the live package are unaffected. A value branded by one installed copy and supplied to the other copy SHALL fail closed with `AUTHORITY_ESCALATION` before sink handoff, and the fixture SHALL assert that the two resolved module copies are distinct before claiming rejection evidence.

#### Scenario: Two genuine copies exchange a branded value
- **WHEN** a value branded by one genuinely installed package copy is supplied to a second genuinely installed package copy
- **THEN** the second copy rejects the value with `AUTHORITY_ESCALATION` before sink handoff

#### Scenario: Fixture cannot be satisfied by one module imported twice
- **WHEN** the two-copy fixture resolves the same module instance for both sides
- **THEN** the fixture fails its distinct-copy assertion instead of recording rejection evidence

### Requirement: The chosen authority scope is compatibility-classified

The formalization SHALL be classified in `compatibility.json` against `semverClassification` as changing no public API and no runtime behavior: the classification SHALL record the bounded module-copy scope decision, the settled same-copy cross-instance acceptance, and the future obligations owned by #79 (the distinct duplicate-Core diagnostic) and #86 (single-copy Core proof and dependency-gate rescoping) without authorizing either. The formalization SHALL introduce no new SDK error code, and the bounded `AUTHORITY_ESCALATION` shape — code, category, and bounded path only, never caller data — SHALL be preserved.

#### Scenario: Compatibility record states the formalization's impact
- **WHEN** the compatibility classification for the authority-scope formalization is read
- **THEN** it records no public API change, no runtime behavior change, no new error code, and it names #79 and #86 as the owners of the future diagnostic and Core-split proof obligations

#### Scenario: A behavior-changing reclassification is rejected
- **WHEN** a change attempts to reclassify the formalization as a behavioral security tightening or a public API modification
- **THEN** compatibility verification rejects the reclassification because the recorded classification states no runtime or public API change
