# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root, if it exists. It identifies the domain contexts and points to their `CONTEXT.md` files. Read each context relevant to the work.
- **The relevant per-context `CONTEXT.md` files**, if they exist.
- **`docs/adr/`** for system-wide decisions, if it exists.
- **The relevant context-scoped ADR directory**:
  - `contracts/security-audit/adr/` for canonical contract decisions.
  - `packages/security-audit-sdk-core/adr/` for SDK-core decisions.
  - Other context-scoped ADR directories declared by `CONTEXT-MAP.md`.

The contract ADRs are generated artifacts: read them, but never edit them directly. The canonical contract source remains `contracts/security-audit/source/contract.source.json`.

If any of these files do not exist, **proceed silently**. Do not flag their absence or suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

This repository uses a multi-context layout:

```text
/
├── CONTEXT-MAP.md                         ← context index, created lazily
├── docs/adr/                              ← system-wide decisions, if needed
├── contracts/security-audit/
│   ├── CONTEXT.md                         ← canonical contract context
│   └── adr/                               ← generated contract decisions
├── packages/security-audit-sdk-core/
│   ├── CONTEXT.md                         ← SDK-core context
│   └── adr/                               ← SDK-core decisions
└── research/browser-telemetry/
    ├── CONTEXT.md                         ← isolated research context
    └── adr/                               ← research decisions, if needed
```

`CONTEXT-MAP.md` and the per-context `CONTEXT.md` files are created only when domain-modeling work resolves vocabulary or boundaries that need recording.

## Use the glossary's vocabulary

When output names a domain concept—in an issue title, refactor proposal, hypothesis, or test name—use the term as defined in the relevant `CONTEXT.md`. Do not drift to synonyms that the glossary explicitly avoids.

If a needed concept is not in the glossary, either the output is inventing language the project does not use (reconsider it) or there is a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 — but worth reopening because…_
