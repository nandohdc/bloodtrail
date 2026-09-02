## Why

The repository has no governed way to record whether work that carries contract semantics reuses an existing Bloodtrail mechanism, extends one, or introduces a new contract. Without a distinct Contract Reuse Assessment (CRA), that decision can be made implicitly and the frozen security-audit contract's mechanisms can be duplicated or bypassed without a reviewable rationale.

A CRA is distinct from the existing design-pattern-governance `assessment.json`: the latter assesses the design approach of an OpenSpec change, while a CRA records a contract-reuse decision for work in the CRA trigger surface. This proposal creates the CRA capability and its planning boundary only; it does not implement a record schema, enforcement, or CI integration.

The project owner is Fernando Homem da Costa (`nandohdc`). The governed CRA scope is the closed trigger surface defined by this change: contract sources, SDK generated projections, and security-audit contract specification deltas.

## What Changes

- Define a new Contract Reuse Assessment capability with a mechanical trigger surface covering `contracts/`, SDK generated projections, and specified contract-semantic OpenSpec deltas.
- Define the three CRA dispositions: `reuse`, `extend`, and `new_contract`, with an explicit, separately authorized exemption path rather than a permissive fourth disposition.
- Define the evidence shape that later schema, checker, and CI work will enforce, including a positive fixture and a deterministic failing mechanism-reference mutation.
- Preserve separate downstream phases for the schema (#99), enforcement (#100), CI integration (#101), review, and archive. This proposal changes no schema, checker, workflow, contract, generated artifact, or production behavior.

## Capabilities

### New Capabilities
- `contract-reuse-assessment`: Defines when a Contract Reuse Assessment is required, the permitted dispositions and exemption boundary, and the evidence that later enforcement must verify.

### Modified Capabilities
- None.

## Impact

This proposal adds the OpenSpec planning artifacts under `openspec/changes/contract-reuse-assessment/` and the bounded domain/decision documentation that defines this capability's execution and enforcement boundaries. The intended downstream enforcement surface is limited to the contract-reuse record schema and governance checking for qualifying repository changes. It does not authorize changes to the frozen contract, generated SDK projections, implementation code, CI, browser telemetry, production transports, collection, storage, or publication.
